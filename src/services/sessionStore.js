import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function buildSessionId() {
  return `session_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function sessionFilePath(baseDir, sessionId) {
  return path.join(baseDir, `${sessionId}.json`);
}

export function createSessionStore({ baseDir }) {
  return {
    async saveSession(payload) {
      await mkdir(baseDir, { recursive: true });

      const session = {
        id: buildSessionId(),
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
        model: payload.model,
        languageHint: payload.languageHint,
        turns: payload.turns
      };

      await writeFile(
        sessionFilePath(baseDir, session.id),
        JSON.stringify(session, null, 2),
        "utf8"
      );

      return session;
    },

    async getSession(sessionId) {
      try {
        const raw = await readFile(sessionFilePath(baseDir, sessionId), "utf8");
        return JSON.parse(raw);
      } catch (error) {
        if (error.code === "ENOENT") {
          return null;
        }

        throw error;
      }
    },

    async listSessions() {
      try {
        await mkdir(baseDir, { recursive: true });
        const files = await readdir(baseDir);
        const summaries = [];

        for (const file of files.filter((f) => f.endsWith(".json"))) {
          try {
            const raw = await readFile(path.join(baseDir, file), "utf8");
            const session = JSON.parse(raw);
            summaries.push({
              id: session.id,
              startedAt: session.startedAt,
              endedAt: session.endedAt,
              model: session.model,
              turnCount: session.turns.length
            });
          } catch {
            // skip malformed files
          }
        }

        return summaries.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      } catch {
        return [];
      }
    }
  };
}
