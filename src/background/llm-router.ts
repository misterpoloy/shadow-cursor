import { ActionPlan, AssistantResponse, AnswerResponse, UserConfig } from '../shared/types';
import { AssembledContext } from './context-assembler';
import {
  ANTHROPIC_API_URL,
  OPENAI_API_URL,
  SMARTQUIZ_PROXY_URL,
  CLAUDE_MODEL,
  OPENAI_MODEL,
} from '../shared/constants';

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error('LLM response did not contain a JSON object');
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new Error('LLM response contained an incomplete JSON object');
}

function isActionPlan(value: unknown): value is ActionPlan {
  if (!value || typeof value !== 'object') return false;

  const plan = value as Partial<ActionPlan>;

  return (
    plan.mode === 'action' &&
    typeof plan.understanding === 'string' &&
    Array.isArray(plan.steps) &&
    Array.isArray(plan.warnings) &&
    typeof plan.needsMoreContext === 'boolean' &&
    (typeof plan.followUpQuestion === 'string' || plan.followUpQuestion === null)
  );
}

function isAnswerResponse(value: unknown): value is AnswerResponse {
  if (!value || typeof value !== 'object') return false;

  const response = value as Partial<AnswerResponse>;

  return (
    response.mode === 'answer' &&
    typeof response.understanding === 'string' &&
    typeof response.answer === 'string' &&
    Array.isArray(response.bullets) &&
    Array.isArray(response.warnings) &&
    typeof response.needsMoreContext === 'boolean' &&
    (typeof response.followUpQuestion === 'string' || response.followUpQuestion === null)
  );
}

function isAssistantResponse(value: unknown): value is AssistantResponse {
  return isActionPlan(value) || isAnswerResponse(value);
}

function parseAssistantResponse(text: string): AssistantResponse {
  const normalized = stripMarkdownFences(text);
  const candidates = [normalized];

  if (normalized !== text.trim()) {
    candidates.push(text.trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isAssistantResponse(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to object extraction below.
    }

    try {
      const parsed = JSON.parse(extractJsonObject(candidate)) as unknown;
      if (isAssistantResponse(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error('LLM returned a response that was not a valid ShadowCursor JSON response');
}

async function callClaude(ctx: AssembledContext, apiKey: string): Promise<AssistantResponse> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                ctx.systemPrompt +
                `\n\nPage URL: ${ctx.url}\nPage Title: ${ctx.pageTitle}\n\nTranscript: ${ctx.transcript}\n\nDOM elements:\n${ctx.domJson}`,
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: ctx.screenshotBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((c) => c.type === 'text')?.text ?? '{}';
  return parseAssistantResponse(text);
}

async function callOpenAI(ctx: AssembledContext, apiKey: string): Promise<AssistantResponse> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: ctx.systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Page URL: ${ctx.url}\nPage Title: ${ctx.pageTitle}\n\nTranscript: ${ctx.transcript}\n\nDOM elements:\n${ctx.domJson}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${ctx.screenshotBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices[0].message.content;
  return parseAssistantResponse(text);
}

async function callProxy(ctx: AssembledContext): Promise<AssistantResponse> {
  const response = await fetch(SMARTQUIZ_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: ctx.transcript,
      screenshotBase64: ctx.screenshotBase64,
      dom: ctx.domJson,
      url: ctx.url,
      pageTitle: ctx.pageTitle,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Proxy error ${response.status}: ${err}`);
  }

  return response.json() as Promise<AssistantResponse>;
}

export async function routeToLLM(ctx: AssembledContext, config: UserConfig): Promise<AssistantResponse> {
  if (config.mode === 'pro') {
    return callProxy(ctx);
  }

  const apiKey = config.apiKey ?? '';
  if (!apiKey) throw new Error('No API key configured. Please add your key in Settings.');

  if (config.provider === 'claude') {
    return callClaude(ctx, apiKey);
  }
  return callOpenAI(ctx, apiKey);
}
