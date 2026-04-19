import { Message, ContextPayload, DOMElement, UserConfig, ActionSession, ActionPlan, AssistantResponse } from '../shared/types';
import { onMessage, sendToTab } from '../shared/messaging';
import { getConfig } from '../shared/storage';
import { assembleContext } from './context-assembler';
import { routeToLLM } from './llm-router';
import { SCREENSHOT_QUALITY } from '../shared/constants';

const FILLER_ONLY_TOKENS = new Set([
  'ah',
  'eh',
  'er',
  'erm',
  'hmm',
  'huh',
  'mm',
  'mmm',
  'uh',
  'uhh',
  'um',
  'umm',
]);

function getActionSessionKey(tabId: number): string {
  return `action_session_${tabId}`;
}

async function saveActionSession(tabId: number, plan: ActionPlan): Promise<ActionSession> {
  const session: ActionSession = {
    plan,
    nextStepIndex: 0,
    warningsConfirmed: false,
    updatedAt: Date.now(),
  };

  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [getActionSessionKey(tabId)]: session }, () => resolve());
  });
  return session;
}

async function syncActionSession(tabId: number, session: ActionSession): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      { [getActionSessionKey(tabId)]: { ...session, updatedAt: Date.now() } },
      () => resolve()
    );
  });
}

async function getActionSession(tabId: number): Promise<ActionSession | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(getActionSessionKey(tabId), (result) => {
      resolve((result[getActionSessionKey(tabId)] as ActionSession | undefined) ?? null);
    });
  });
}

async function clearActionSession(tabId: number): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.remove(getActionSessionKey(tabId), () => resolve());
  });
}

async function captureScreenshot(windowId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      windowId,
      { format: 'jpeg', quality: SCREENSHOT_QUALITY },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(dataUrl);
        }
      }
    );
  });
}

async function handleCaptureComplete(
  sender: chrome.runtime.MessageSender,
  audio: ArrayBuffer,
  webSpeechTranscript: string,
  dom: DOMElement[],
  url: string,
  title: string
): Promise<void> {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (!tabId || windowId === undefined) throw new Error('No tab/window ID');

  try {
    const [screenshot, config] = await Promise.all([
      captureScreenshot(windowId),
      getConfig(),
    ]);

    const transcript = await resolveTranscript(webSpeechTranscript, audio, config);
    validateTranscript(transcript);

    const payload: ContextPayload = {
      transcript,
      screenshot,
      dom,
      url,
      pageTitle: title,
      timestamp: Date.now(),
    };

    const context = assembleContext(payload);
    const response = await routeToLLM(context, config);
    if (response.mode === 'action') {
      await saveActionSession(tabId, response);
    } else {
      await clearActionSession(tabId);
    }

    await sendToTab(tabId, { type: 'LLM_RESPONSE', response });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendToTab(tabId, { type: 'ERROR', message: msg });
  }
}

async function handleReplanActionSession(
  sender: chrome.runtime.MessageSender,
  dom: DOMElement[],
  url: string,
  title: string
): Promise<ActionPlan | null> {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (!tabId || windowId === undefined) throw new Error('No tab/window ID');

  const session = await getActionSession(tabId);
  if (!session) return null;

  const [screenshot, config] = await Promise.all([
    captureScreenshot(windowId),
    getConfig(),
  ]);

  const completedSteps = session.plan.steps
    .slice(0, session.nextStepIndex)
    .map((step, index) => `${index + 1}. ${step.description}`)
    .join('\n');

  const transcript = [
    `Original goal: ${session.plan.understanding}`,
    completedSteps ? `Completed steps:\n${completedSteps}` : '',
    'Continue from the current page state and return only the remaining steps needed to finish the goal.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const payload: ContextPayload = {
    transcript,
    screenshot,
    dom,
    url,
    pageTitle: title,
    timestamp: Date.now(),
  };

  const context = assembleContext(payload);
  const response = await routeToLLM(context, config);

  if (response.mode !== 'action') {
    await clearActionSession(tabId);
    return null;
  }

  await syncActionSession(tabId, {
    plan: response,
    nextStepIndex: 0,
    warningsConfirmed: false,
    updatedAt: Date.now(),
  });

  return response;
}

/**
 * Resolve the best available transcript:
 * 1. If a dedicated STT API key is set → call Whisper or Deepgram for higher accuracy
 * 2. Otherwise → use the Web Speech API transcript captured in the content script
 */
async function resolveTranscript(
  webSpeechTranscript: string,
  audio: ArrayBuffer,
  config: UserConfig
): Promise<string> {
  // Only call external STT if the user explicitly configured a separate STT key
  if (config.sttApiKey) {
    try {
      return await transcribeWithAPI(audio, config);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn(`[ShadowCursor] STT API failed (${detail}), falling back to Web Speech transcript`);
    }
  }

  if (!webSpeechTranscript) {
    throw new Error('No transcript available. Try speaking more clearly or configure a Deepgram/Whisper key in Settings for better accuracy.');
  }

  return webSpeechTranscript;
}

function validateTranscript(transcript: string): void {
  const trimmed = transcript.trim();
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    throw new Error('Invalid request. Please say a clear action and try again.');
  }

  const tokens = normalized.split(' ').filter(Boolean);
  const meaningfulTokens = tokens.filter((token) => !FILLER_ONLY_TOKENS.has(token));
  const alphaNumericCount = normalized.replace(/\s/g, '').length;

  if (alphaNumericCount < 3 || meaningfulTokens.length === 0) {
    throw new Error('Invalid request. Please say a clear action and try again.');
  }
}

async function transcribeWithAPI(audio: ArrayBuffer, config: UserConfig): Promise<string> {
  const { sttProvider, sttApiKey } = config;
  const key = sttApiKey ?? '';
  const blob = new Blob([audio], { type: 'audio/webm;codecs=opus' });

  if (sttProvider === 'deepgram') {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'audio/webm' },
      body: blob,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Deepgram ${response.status}: ${body}`);
    }
    const data = await response.json() as { results: { channels: Array<{ alternatives: Array<{ transcript: string }> }> } };
    return data.results.channels[0].alternatives[0].transcript;
  } else {
    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: formData,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Whisper ${response.status}: ${body}`);
    }
    const data = await response.json() as { text: string };
    return data.text;
  }
}

onMessage(async (message: Message, sender) => {
  const tabId = sender.tab?.id;

  if (message.type === 'CAPTURE_COMPLETE') {
    await handleCaptureComplete(
      sender,
      message.audio,
      message.transcript,
      message.dom,
      message.url,
      message.title
    );
  }
  if (message.type === 'GET_CONFIG') {
    return getConfig();
  }
  if (message.type === 'GET_PENDING_ACTION_SESSION') {
    if (!tabId) return null;
    return getActionSession(tabId);
  }
  if (message.type === 'REPLAN_ACTION_SESSION') {
    return handleReplanActionSession(sender, message.dom, message.url, message.title);
  }
  if (message.type === 'SYNC_ACTION_SESSION') {
    if (!tabId) return;
    await syncActionSession(tabId, message.session);
    return;
  }
  if (message.type === 'CLEAR_ACTION_SESSION') {
    if (!tabId) return;
    await clearActionSession(tabId);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ShadowCursor] Extension installed');
});
