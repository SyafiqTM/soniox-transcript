const SONIOX_AUTH_URL = "https://api.soniox.com/v1/auth/temporary-api-key";

export function createSonioxService({ apiKey, expiresInSeconds = 300 } = {}) {
  return {
    async createTemporaryKey() {
      if (!apiKey) {
        const error = new Error(
          "SONIOX_API_KEY is missing. Add it to .env before requesting a temporary key."
        );
        error.statusCode = 500;
        throw error;
      }

      const response = await fetch(SONIOX_AUTH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          usage_type: "transcribe_websocket",
          expires_in_seconds: expiresInSeconds
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(
          payload.message || "Failed to create a temporary Soniox API key."
        );
        error.statusCode = response.status;
        throw error;
      }

      const payload = await response.json();

      return {
        api_key: payload.api_key,
        expires_at: payload.expires_at
      };
    }
  };
}
