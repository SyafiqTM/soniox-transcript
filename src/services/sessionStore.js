import { mkdir, readFile, writeFile } from "node:fs/promises";
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
    }
  };
}
