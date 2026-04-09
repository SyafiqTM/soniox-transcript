import "dotenv/config";
import { createApp } from "../src/app.js";
import { createSessionStore } from "../src/services/sessionStore.js";
import { createSonioxService } from "../src/services/sonioxService.js";

const sonioxService = createSonioxService({
  apiKey: process.env.SONIOX_API_KEY
});

const sessionStore = createSessionStore({ baseDir: "/tmp/sessions" });

const app = createApp({ sonioxService, sessionStore });

export default app;
