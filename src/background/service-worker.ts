import { Message, ContextPayload, DOMElement } from '../shared/types';
import { onMessage, sendToTab } from '../shared/messaging';
import { getConfig } from '../shared/storage';
import { assembleContext } from './context-assembler';
import { routeToLLM } from './llm-router';
import { SCREENSHOT_QUALITY } from '../shared/constants';

async function captureScreenshot(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      tabId,
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
  dom: DOMElement[],
  url: string,
  title: string
): Promise<void> {
  const tabId = sender.tab?.id;
  if (!tabId) throw new Error('No tab ID');

  try {
    const [screenshot, config] = await Promise.all([
      captureScreenshot(tabId),
      getConfig(),
    ]);

    // Transcribe audio
    const transcript = await transcribeAudio(audio, config);

    const payload: ContextPayload = {
      transcript,
      screenshot,
      dom,
      url,
      pageTitle: title,
      timestamp: Date.now(),
    };

    const context = assembleContext(payload);
    const plan = await routeToLLM(context, config);

    await sendToTab(tabId, { type: 'ACTION_PLAN', plan });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendToTab(tabId, { type: 'ERROR', message: msg });
  }
}

async function transcribeAudio(audio: ArrayBuffer, config: ReturnType<typeof getConfig> extends Promise<infer T> ? T : never): Promise<string> {
  const { sttProvider, sttApiKey, apiKey } = await Promise.resolve(config);

  const blob = new Blob([audio], { type: 'audio/webm;codecs=opus' });
  const formData = new FormData();

  if (sttProvider === 'deepgram') {
    const key = sttApiKey ?? apiKey ?? '';
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${key}`,
        'Content-Type': 'audio/webm',
      },
      body: blob,
    });
    if (!response.ok) throw new Error(`Deepgram error: ${response.statusText}`);
    const data = await response.json() as { results: { channels: Array<{ alternatives: Array<{ transcript: string }> }> } };
    return data.results.channels[0].alternatives[0].transcript;
  } else {
    // Whisper via OpenAI
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    const key = sttApiKey ?? apiKey ?? '';
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: formData,
    });
    if (!response.ok) throw new Error(`Whisper error: ${response.statusText}`);
    const data = await response.json() as { text: string };
    return data.text;
  }
}

onMessage(async (message: Message, sender) => {
  if (message.type === 'CAPTURE_COMPLETE') {
    await handleCaptureComplete(
      sender,
      message.audio,
      message.dom,
      message.url,
      message.title
    );
  }
  if (message.type === 'GET_CONFIG') {
    return getConfig();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ShadowCursor] Extension installed');
});
