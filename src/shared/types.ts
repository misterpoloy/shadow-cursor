export type LLMProvider = 'claude' | 'openai';
export type CursorMode = 'pro' | 'byok';
export type STTProvider = 'deepgram' | 'whisper';

export interface DOMElement {
  tag: string;
  text: string;
  ariaLabel?: string;
  id?: string;
  className?: string;
  href?: string;
  type?: string;
  bbox: { x: number; y: number; w: number; h: number };
  selector: string;
  index: number;
}

export interface UserConfig {
  mode: CursorMode;
  provider: LLMProvider;
  apiKey?: string;
  sttProvider: STTProvider;
  sttApiKey?: string;
  autoClick: boolean;
  confirmDestructive: boolean;
}

export interface ActionStep {
  action: 'click' | 'type' | 'scroll' | 'navigate' | 'wait';
  selector: string;
  elementIndex: number;
  value?: string;
  description: string;
  confidence: number;
}

export interface ActionPlan {
  understanding: string;
  steps: ActionStep[];
  warnings: string[];
  needsMoreContext: boolean;
  followUpQuestion: string | null;
}

export interface ContextPayload {
  transcript: string;
  screenshot: string;
  dom: DOMElement[];
  url: string;
  pageTitle: string;
  timestamp: number;
}

export type Message =
  | { type: 'CAPTURE_STARTED' }
  | { type: 'CAPTURE_COMPLETE'; audio: ArrayBuffer; dom: DOMElement[]; url: string; title: string }
  | { type: 'SCREENSHOT_READY'; data: string }
  | { type: 'ACTION_PLAN'; plan: ActionPlan }
  | { type: 'EXECUTE_STEP'; step: ActionStep }
  | { type: 'STEP_COMPLETE'; stepIndex: number; success: boolean }
  | { type: 'ERROR'; message: string }
  | { type: 'GET_CONFIG' }
  | { type: 'CONFIG_RESPONSE'; config: UserConfig };
