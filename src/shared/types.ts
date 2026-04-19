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

export type TriggerMode = 'keyboard';

export interface UserConfig {
  mode: CursorMode;
  provider: LLMProvider;
  apiKey?: string;
  sttProvider: STTProvider;
  sttApiKey?: string;
  autoClick: boolean;
  confirmDestructive: boolean;
  triggerMode: TriggerMode;
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
  mode: 'action';
  understanding: string;
  steps: ActionStep[];
  warnings: string[];
  needsMoreContext: boolean;
  followUpQuestion: string | null;
}

export interface AnswerResponse {
  mode: 'answer';
  understanding: string;
  answer: string;
  bullets: string[];
  warnings: string[];
  needsMoreContext: boolean;
  followUpQuestion: string | null;
}

export type AssistantResponse = ActionPlan | AnswerResponse;

export interface ActionSession {
  plan: ActionPlan;
  nextStepIndex: number;
  warningsConfirmed: boolean;
  updatedAt: number;
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
  | { type: 'CAPTURE_COMPLETE'; audio: ArrayBuffer; transcript: string; dom: DOMElement[]; url: string; title: string }
  | { type: 'SCREENSHOT_READY'; data: string }
  | { type: 'LLM_RESPONSE'; response: AssistantResponse }
  | { type: 'GET_PENDING_ACTION_SESSION' }
  | { type: 'REPLAN_ACTION_SESSION'; dom: DOMElement[]; url: string; title: string }
  | { type: 'SYNC_ACTION_SESSION'; session: ActionSession }
  | { type: 'CLEAR_ACTION_SESSION' }
  | { type: 'EXECUTE_STEP'; step: ActionStep }
  | { type: 'STEP_COMPLETE'; stepIndex: number; success: boolean }
  | { type: 'ERROR'; message: string }
  | { type: 'GET_CONFIG' }
  | { type: 'CONFIG_RESPONSE'; config: UserConfig };
