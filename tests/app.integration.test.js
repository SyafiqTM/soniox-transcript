import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { createSessionStore } from "../src/services/sessionStore.js";

async function startTestServer({ sonioxService, sessionStore }) {
  const app = createApp({ sonioxService, sessionStore });
  const server = app.listen(0);
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    async close() {
      server.close();
      await once(server, "close");
    }
  };
}

test("POST /api/soniox/tmp-key returns a mocked temporary key", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "soniox-app-"));
  const server = await startTestServer({
    sonioxService: {
      async createTemporaryKey() {
        return { api_key: "tmp_mocked", expires_at: "soon" };
      }
    },
    sessionStore: createSessionStore({ baseDir: tempDir })
  });

  try {
    const response = await fetch(`${server.baseUrl}/api/soniox/tmp-key`, {
      method: "POST"
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.api_key, "tmp_mocked");
  } finally {
    await server.close();
  }
});

test("POST /api/sessions validates and persists a transcript", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "soniox-app-"));
  const server = await startTestServer({
    sonioxService: {
      async createTemporaryKey() {
        return { api_key: "tmp_mocked", expires_at: "soon" };
      }
    },
    sessionStore: createSessionStore({ baseDir: tempDir })
  });

  try {
    const response = await fetch(`${server.baseUrl}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        startedAt: "2026-04-07T00:00:00.000Z",
        endedAt: "2026-04-07T00:01:00.000Z",
        model: "stt-rt-v4",
        languageHint: "en",
        turns: [
          {
            role: "customer",
            text: "Hello",
            startedAt: "2026-04-07T00:00:01.000Z",
            endedAt: "2026-04-07T00:00:04.000Z"
          }
        ]
      })
    });
    const payload = await response.json();
    const sessionResponse = await fetch(
      `${server.baseUrl}/api/sessions/${payload.sessionId}`
    );
    const session = await sessionResponse.json();

    assert.equal(response.status, 201);
    assert.equal(session.turns.length, 1);
    assert.equal(session.turns[0].role, "customer");
  } finally {
    await server.close();
  }
});

test("GET /sessions/:id returns a not found page when needed", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "soniox-app-"));
  const server = await startTestServer({
    sonioxService: {
      async createTemporaryKey() {
        return { api_key: "tmp_mocked", expires_at: "soon" };
      }
    },
    sessionStore: createSessionStore({ baseDir: tempDir })
  });

  try {
    const response = await fetch(`${server.baseUrl}/sessions/missing`);
    const html = await response.text();

    assert.equal(response.status, 404);
    assert.match(html, /could not find/i);
  } finally {
    await server.close();
  }
});
