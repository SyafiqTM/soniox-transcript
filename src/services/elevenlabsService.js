const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// Default: Rachel voice — change via ELEVENLABS_VOICE_ID env var
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// eleven_flash_v2_5 is ElevenLabs' lowest-latency model (ideal for voice agents)
const TTS_MODEL = "eleven_flash_v2_5";

export function createElevenLabsService({
  apiKey,
  voiceId = DEFAULT_VOICE_ID
} = {}) {
  return {
    async textToSpeech(text) {
      if (!apiKey) {
        const error = new Error(
          "ELEVENLABS_API_KEY is missing. Add it to .env before using the voicebot."
        );
        error.statusCode = 500;
        throw error;
      }

      const response = await fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text,
          model_id: TTS_MODEL,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(
          payload.detail?.message ||
            payload.message ||
            "ElevenLabs TTS request failed."
        );
        error.statusCode = response.status;
        throw error;
      }

      return Buffer.from(await response.arrayBuffer());
    }
  };
}
