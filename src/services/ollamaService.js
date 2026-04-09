// Ollama runs locally at http://localhost:11434 by default.
// Uses the OpenAI-compatible endpoint so the interface matches openaiService.js.
// Set OLLAMA_BASE_URL and OLLAMA_MODEL in .env to override defaults.

const SYSTEM_PROMPT =
  "You are a helpful, friendly voice assistant. " +
  "Reply in exactly 2 short sentences. " +
  "Keep your answer natural and easy to understand when heard aloud. " +
  "Do not use bullet points, markdown, numbered lists, or any special formatting. " +
  "If a follow-up question is needed, ask only one.";

export function createOllamaService({
  baseUrl = "http://localhost:11434",
  model = "llama3.2"
} = {}) {
  const chatUrl = `${baseUrl}/v1/chat/completions`;

  return {
    async getReply(transcript, history = []) {
      // Keep last 10 turns of history to stay within context limits
      const trimmedHistory = history.slice(-10);

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...trimmedHistory,
        { role: "user", content: transcript }
      ];

      let response;
      try {
        response = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            options: { temperature: 0.7, num_predict: 120 }
          })
        });
      } catch (err) {
        const error = new Error(
          `Cannot reach Ollama at ${baseUrl}. Make sure Ollama is running (ollama serve).`
        );
        error.statusCode = 503;
        throw error;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(
          payload.error || `Ollama request failed (HTTP ${response.status}).`
        );
        error.statusCode = response.status;
        throw error;
      }

      const payload = await response.json();
      return payload.choices[0].message.content.trim();
    }
  };
}
