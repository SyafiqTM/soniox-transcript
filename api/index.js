import "dotenv/config";
import { createApp } from "../src/app.js";
import { createSessionStore } from "../src/services/sessionStore.js";
import { createSonioxService } from "../src/services/sonioxService.js";
import { createOpenAIService } from "../src/services/openaiService.js";
import { createOllamaService } from "../src/services/ollamaService.js";
import { createElevenLabsService } from "../src/services/elevenlabsService.js";

const sonioxService = createSonioxService({
  apiKey: process.env.SONIOX_API_KEY
});

const sessionStore = createSessionStore({ baseDir: "/tmp/sessions" });

const llmProvider = (process.env.LLM_PROVIDER || "ollama").toLowerCase();
const openaiService =
  llmProvider === "openai"
    ? createOpenAIService({ apiKey: process.env.OPENAI_API_KEY })
    : createOllamaService({
        baseUrl: process.env.OLLAMA_BASE_URL,
        model: process.env.OLLAMA_MODEL
      });

const elevenlabsService = createElevenLabsService({
  apiKey: process.env.ELEVENLABS_API_KEY,
  voiceId: process.env.ELEVENLABS_VOICE_ID
});

const app = createApp({ sonioxService, sessionStore, openaiService, elevenlabsService });

export default app;
