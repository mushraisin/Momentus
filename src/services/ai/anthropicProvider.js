import Anthropic from '@anthropic-ai/sdk';

/**
 * Хмарний ШІ-провайдер через Anthropic Messages API.
 * Structured output — через output_config.format (JSON schema).
 * Активний лише за наявності ANTHROPIC_API_KEY.
 */
export function createAnthropicProvider({ model, effort } = {}) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic(); // читає ANTHROPIC_API_KEY з середовища
  const modelId = model || process.env.AI_MODEL || 'claude-opus-5';
  const effortLevel = effort || process.env.AI_EFFORT || 'low';

  return {
    name: 'anthropic',
    model: modelId,

    async generate({ system, prompt, schema, maxTokens }) {
      const resp = await client.messages.create({
        model: modelId,
        max_tokens: maxTokens ?? 1500,
        system,
        output_config: {
          effort: effortLevel,
          format: { type: 'json_schema', schema },
        },
        messages: [{ role: 'user', content: prompt }],
      });

      if (resp.stop_reason === 'refusal') {
        throw new Error(`AI відмовив: ${resp.stop_details?.category ?? 'refusal'}`);
      }
      const text = resp.content.find((b) => b.type === 'text')?.text;
      if (!text) throw new Error('AI повернув порожню відповідь');

      return {
        data: JSON.parse(text),
        usage: { in: resp.usage?.input_tokens ?? 0, out: resp.usage?.output_tokens ?? 0 },
      };
    },
  };
}
