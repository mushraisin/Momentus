/**
 * Локальний ШІ-провайдер через Ollama (https://ollama.com).
 * Безкоштовно, офлайн, без API-ключа. Використовує structured output:
 * поле `format` приймає JSON-схему, і Ollama обмежує генерацію під неї
 * (constrained decoding), тож повертається валідний JSON за нашою схемою.
 *
 * Встановлення:
 *   1) https://ollama.com/download
 *   2) ollama pull qwen2.5:7b      (або llama3.1:8b / gemma2:9b / mistral)
 *   3) ollama serve                (зазвичай запускається автоматично)
 */
export function createOllamaProvider({ model, host } = {}) {
  const base = (host || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const modelId = model || process.env.OLLAMA_MODEL || 'qwen2.5:7b';

  return {
    name: 'ollama',
    model: modelId,

    /**
     * @param {{ system:string, prompt:string, schema:object, maxTokens:number }} req
     * @returns {Promise<{ data:object, usage:{in:number,out:number} }>}
     */
    async generate({ system, prompt, schema, maxTokens }) {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          stream: false,
          format: schema, // structured output за JSON-схемою
          options: {
            temperature: 0.2,
            num_predict: Math.min(maxTokens ?? 1500, 8192),
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const json = await res.json();
      const text = json.message?.content;
      if (!text) throw new Error('Ollama повернув порожню відповідь');

      return {
        data: JSON.parse(text),
        usage: { in: json.prompt_eval_count ?? 0, out: json.eval_count ?? 0 },
      };
    },
  };
}
