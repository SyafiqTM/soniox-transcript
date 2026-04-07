import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function validateTurn(turn) {
  if (!turn || typeof turn !== "object") {
    const error = new Error("Each turn must be an object.");
    error.statusCode = 400;
    throw error;
  }

  if (!["customer", "agent"].includes(turn.role)) {
    const error = new Error("Turn role must be 'customer' or 'agent'.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof turn.text !== "string" || !turn.text.trim()) {
    const error = new Error("Turn text must be a non-empty string.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof turn.startedAt !== "string" || typeof turn.endedAt !== "string") {
    const error = new Error("Turn timestamps must be ISO strings.");
    error.statusCode = 400;
    throw error;
  }

  return {
    role: turn.role,
    text: turn.text.trim(),
    startedAt: turn.startedAt,
    endedAt: turn.endedAt
  };
}

function validateSessionPayload(body) {
  if (!body || typeof body !== "object") {
    const error = new Error("Session payload is required.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof body.startedAt !== "string" || typeof body.endedAt !== "string") {
    const error = new Error("Session startedAt and endedAt are required.");
    error.statusCode = 400;
    throw error;
  }

  if (body.model && typeof body.model !== "string") {
    const error = new Error("Session model must be a string.");
    error.statusCode = 400;
    throw error;
  }

  if (body.languageHint && typeof body.languageHint !== "string") {
    const error = new Error("Session languageHint must be a string.");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(body.turns)) {
    const error = new Error("Session turns must be an array.");
    error.statusCode = 400;
    throw error;
  }

  const turns = body.turns.map(validateTurn);

  return {
    startedAt: body.startedAt,
    endedAt: body.endedAt,
    model: body.model || "stt-rt-v4",
    languageHint: body.languageHint || "en",
    turns
  };
}

export function createApp({ sonioxService, sessionStore }) {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(projectRoot, "views"));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(projectRoot, "public")));

  app.get("/", (req, res) => {
    res.render("index", {
      pageTitle: "Customer / Agent Mic Simulator",
      defaultModel: "stt-rt-v4",
      defaultLanguageHint: "en"
    });
  });

  app.post("/api/soniox/tmp-key", async (req, res, next) => {
    try {
      const key = await sonioxService.createTemporaryKey();
      res.json(key);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions", async (req, res, next) => {
    try {
      const payload = validateSessionPayload(req.body);
      const savedSession = await sessionStore.saveSession(payload);
      res.status(201).json({ sessionId: savedSession.id });
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({ error: error.message });
      }

      next(error);
    }
  });

  app.get("/api/sessions", async (req, res, next) => {
    try {
      const sessions = await sessionStore.listSessions();
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions/:id", async (req, res, next) => {
    try {
      const session = await sessionStore.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found." });
      }

      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  app.get("/sessions/:id", async (req, res, next) => {
    try {
      const session = await sessionStore.getSession(req.params.id);
      if (!session) {
        return res.status(404).render("session-not-found", {
          pageTitle: "Session Not Found",
          sessionId: req.params.id
        });
      }

      res.render("session", {
        pageTitle: `Session ${session.id}`,
        session
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Something went wrong on the server.";

    if (req.path.startsWith("/api/")) {
      return res.status(statusCode).json({ error: message });
    }

    return res.status(statusCode).render("error", {
      pageTitle: "Error",
      statusCode,
      message
    });
  });

  return app;
}

export { validateSessionPayload };
