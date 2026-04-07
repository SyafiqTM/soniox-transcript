import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createSessionStore } from "./services/sessionStore.js";
import { createSonioxService } from "./services/sonioxService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const port = Number(process.env.PORT || 3000);
const dataDir = path.join(projectRoot, "data", "sessions");

const sonioxService = createSonioxService({
  apiKey: process.env.SONIOX_API_KEY
});
const sessionStore = createSessionStore({ baseDir: dataDir });
const app = createApp({ sonioxService, sessionStore });

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
