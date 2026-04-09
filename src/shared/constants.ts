export const SMARTQUIZ_PROXY_URL = 'https://api.smartquiz.cloud/v1/shadow-cursor';
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
export const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

export const TRIGGER_HOLD_MS = 3000;
export const STEP_DELAY_MS = 500;
export const CURSOR_ANIMATION_MS = 800;
export const AUTO_CLICK_COUNTDOWN_MS = 1500;

export const MAX_DOM_ELEMENTS = 150;
export const MAX_TEXT_LENGTH = 100;
export const SCREENSHOT_QUALITY = 70;

export const CLAUDE_MODEL = 'claude-opus-4-6';
export const OPENAI_MODEL = 'gpt-4o';

export const STORAGE_KEYS = {
  USER_CONFIG: 'user_config',
  USAGE_STATS: 'usage_stats',
} as const;

export const DEFAULT_CONFIG = {
  mode: 'byok' as const,
  provider: 'claude' as const,
  sttProvider: 'whisper' as const,
  autoClick: false,
  confirmDestructive: true,
};
