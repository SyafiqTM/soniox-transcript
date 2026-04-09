const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT =
  "You are a helpful, friendly voice assistant. " +
  "Reply in exactly 2 short sentences. " +
  "Keep your answer natural and easy to understand when heard aloud. " +
  "Do not use bullet points, markdown, numbered lists, or any special formatting. " +
  "If a follow-up question is needed, ask only one.";

export function createOpenAIService({ apiKey } = {}) {
  return {
    async getReply(transcript, history = []) {
      if (!apiKey) {
        const error = new Error(
          "OPENAI_API_KEY is missing. Add it to .env before using the voicebot."
        );
        error.statusCode = 500;
        throw error;
      }

      // Keep last 10 turns of history to stay within token limits
      const trimmedHistory = history.slice(-10);

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...trimmedHistory,
        { role: "user", content: transcript }
      ];

      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 120,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(
          payload.error?.message || "OpenAI request failed."
        );
        error.statusCode = response.status;
        throw error;
      }

      const payload = await response.json();
      return payload.choices[0].message.content.trim();
    }
  };
}
