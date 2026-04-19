import { routeToLLM } from '../src/background/llm-router';
import { AssembledContext } from '../src/background/context-assembler';
import { UserConfig } from '../src/shared/types';

const mockContext: AssembledContext = {
  systemPrompt: 'You are ShadowCursor',
  transcript: 'Click the deploy button',
  screenshotBase64: 'abc123',
  domJson: JSON.stringify([{ index: 0, tag: 'button', text: 'Deploy', sel: '#deploy-btn' }]),
  url: 'https://console.example.com',
  pageTitle: 'Cloud Console',
};

const mockPlan = {
  understanding: 'User wants to deploy',
  steps: [{ action: 'click', selector: '#deploy-btn', elementIndex: 0, description: 'Click Deploy', confidence: 0.95 }],
  warnings: [],
  needsMoreContext: false,
  followUpQuestion: null,
};

describe('routeToLLM', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws when BYOK mode has no API key', async () => {
    const config: UserConfig = {
      mode: 'byok',
      provider: 'claude',
      apiKey: undefined,
      sttProvider: 'whisper',
      autoClick: false,
      confirmDestructive: true,
    };

    await expect(routeToLLM(mockContext, config)).rejects.toThrow('No API key');
  });

  it('calls Claude API in BYOK mode with claude provider', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(mockPlan) }],
      }),
    });

    const config: UserConfig = {
      mode: 'byok',
      provider: 'claude',
      apiKey: 'sk-ant-test',
      sttProvider: 'whisper',
      autoClick: false,
      confirmDestructive: true,
    };

    const plan = await routeToLLM(mockContext, config);
    expect(plan.understanding).toBe('User wants to deploy');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('anthropic.com'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('calls OpenAI API in BYOK mode with openai provider', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(mockPlan) } }],
      }),
    });

    const config: UserConfig = {
      mode: 'byok',
      provider: 'openai',
      apiKey: 'sk-test',
      sttProvider: 'whisper',
      autoClick: false,
      confirmDestructive: true,
    };

    const plan = await routeToLLM(mockContext, config);
    expect(plan.understanding).toBe('User wants to deploy');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('openai.com'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('parses Claude responses wrapped in json code fences', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: `\`\`\`json\n${JSON.stringify(mockPlan, null, 2)}\n\`\`\`` }],
      }),
    });

    const config: UserConfig = {
      mode: 'byok',
      provider: 'claude',
      apiKey: 'sk-ant-test',
      sttProvider: 'whisper',
      autoClick: false,
      confirmDestructive: true,
    };

    const plan = await routeToLLM(mockContext, config);
    expect(plan).toEqual(mockPlan);
  });

  it('parses OpenAI responses with surrounding prose before the JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: `Here is the action plan:\n${JSON.stringify(mockPlan, null, 2)}` } }],
      }),
    });

    const config: UserConfig = {
      mode: 'byok',
      provider: 'openai',
      apiKey: 'sk-test',
      sttProvider: 'whisper',
      autoClick: false,
      confirmDestructive: true,
    };

    const plan = await routeToLLM(mockContext, config);
    expect(plan).toEqual(mockPlan);
  });

  it('calls SmartQuiz proxy in pro mode', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlan,
    });

    const config: UserConfig = {
      mode: 'pro',
      provider: 'claude',
      sttProvider: 'whisper',
      autoClick: false,
      confirmDestructive: true,
    };

    const plan = await routeToLLM(mockContext, config);
    expect(plan.understanding).toBe('User wants to deploy');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('smartquiz.cloud'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws on non-ok API response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const config: UserConfig = {
      mode: 'byok',
      provider: 'claude',
      apiKey: 'bad-key',
      sttProvider: 'whisper',
      autoClick: false,
      confirmDestructive: true,
    };

    await expect(routeToLLM(mockContext, config)).rejects.toThrow('401');
  });
});
