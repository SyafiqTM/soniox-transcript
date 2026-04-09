import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createSessionStore } from "./services/sessionStore.js";
import { createSonioxService } from "./services/sonioxService.js";
import { createOpenAIService } from "./services/openaiService.js";
import { createOllamaService } from "./services/ollamaService.js";
import { createElevenLabsService } from "./services/elevenlabsService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const port = Number(process.env.PORT || 3000);
const dataDir = path.join(projectRoot, "data", "sessions");

const sonioxService = createSonioxService({
  apiKey: process.env.SONIOX_API_KEY
});
const sessionStore = createSessionStore({ baseDir: dataDir });

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

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
