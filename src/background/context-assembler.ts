import { ContextPayload, DOMElement } from '../shared/types';

export interface AssembledContext {
  systemPrompt: string;
  transcript: string;
  screenshotBase64: string;
  domJson: string;
  url: string;
  pageTitle: string;
}

const SYSTEM_PROMPT = `You are ShadowCursor, an AI assistant that helps users navigate cloud consoles.

You receive:
1. A voice transcript of what the user wants to do
2. A screenshot of their current browser tab
3. A structured DOM snapshot of visible interactive elements

Your job is to analyze the user's intent and decide whether ShadowCursor should:
1. Act on the UI with step-by-step guidance
2. Answer the user with an explanation only

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "mode": "action" | "answer",
  "understanding": "Brief description of what the user wants",
  "answer": "Direct answer for the user when mode is answer",
  "bullets": ["Optional short bullet points for answer mode"],
  "steps": [
    {
      "action": "click" | "type" | "scroll" | "navigate" | "wait",
      "selector": "CSS selector from DOM snapshot",
      "elementIndex": number,
      "value": "text to type (for type action)",
      "description": "Human-readable step description",
      "confidence": 0.0 to 1.0
    }
  ],
  "warnings": ["Any potential risks or confirmations needed"],
  "needsMoreContext": false,
  "followUpQuestion": null
}

Rules:
- Use "mode": "answer" for informational questions, explanations, or guidance that should be spoken/shown rather than executed
- Use "mode": "action" only when ShadowCursor should help the user perform UI actions on the current page
- If mode is "answer", return an empty steps array and provide a concise, helpful answer
- Break the task into small, atomic UI actions that a human could review one at a time
- Each step should represent exactly one user-visible action
- Prefer multiple precise steps over one broad step
- Use the elementIndex from the DOM snapshot to reference elements
- If confidence < 0.7 for any step, set needsMoreContext: true
- For destructive actions (delete, terminate, remove), ALWAYS add a warning
- If the page needs navigation first, include a navigate step
- Maximum 10 steps per action plan`;

function stripScreenshotPrefix(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
}

function formatDOMForLLM(dom: DOMElement[]): string {
  return dom
    .map((el) =>
      JSON.stringify({
        i: el.index,
        tag: el.tag,
        text: el.text,
        aria: el.ariaLabel,
        sel: el.selector,
        bbox: el.bbox,
        ...(el.href ? { href: el.href } : {}),
        ...(el.type ? { type: el.type } : {}),
      })
    )
    .join('\n');
}

export function assembleContext(payload: ContextPayload): AssembledContext {
  return {
    systemPrompt: SYSTEM_PROMPT,
    transcript: payload.transcript,
    screenshotBase64: stripScreenshotPrefix(payload.screenshot),
    domJson: formatDOMForLLM(payload.dom),
    url: payload.url,
    pageTitle: payload.pageTitle,
  };
}
