import { ActionPlan, UserConfig } from '../shared/types';
import { AssembledContext } from './context-assembler';
import {
  ANTHROPIC_API_URL,
  OPENAI_API_URL,
  SMARTQUIZ_PROXY_URL,
  CLAUDE_MODEL,
  OPENAI_MODEL,
} from '../shared/constants';

async function callClaude(ctx: AssembledContext, apiKey: string): Promise<ActionPlan> {
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
  return JSON.parse(text) as ActionPlan;
}

async function callOpenAI(ctx: AssembledContext, apiKey: string): Promise<ActionPlan> {
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
  return JSON.parse(text) as ActionPlan;
}

async function callProxy(ctx: AssembledContext): Promise<ActionPlan> {
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

  return response.json() as Promise<ActionPlan>;
}

export async function routeToLLM(ctx: AssembledContext, config: UserConfig): Promise<ActionPlan> {
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
