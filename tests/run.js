import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readdir } from "node:fs/promises";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { createSessionStore } from "../src/services/sessionStore.js";
import { createSonioxService } from "../src/services/sonioxService.js";
import {
  applySonioxResult,
  createConversationState,
  finalizeDraft,
  getDraftText
} from "../public/lib/transcriptState.js";

const results = [];

async function run(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

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

await run("temporary key service returns payload", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        api_key: "tmp_123",
        expires_at: "2026-04-07T00:05:00.000Z"
      };
    }
  });

  try {
    const service = createSonioxService({ apiKey: "secret-key" });
    const result = await service.createTemporaryKey();
    assert.deepEqual(result, {
      api_key: "tmp_123",
      expires_at: "2026-04-07T00:05:00.000Z"
    });
  } finally {
    global.fetch = originalFetch;
  }
});

await run("temporary key service fails cleanly without API key", async () => {
  const service = createSonioxService({ apiKey: "" });
  await assert.rejects(() => service.createTemporaryKey(), {
    message: /SONIOX_API_KEY is missing/
  });
});

await run("session store saves and reloads transcripts", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "soniox-store-"));
  const store = createSessionStore({ baseDir: tempDir });

  const saved = await store.saveSession({
    startedAt: "2026-04-07T00:00:00.000Z",
    endedAt: "2026-04-07T00:01:00.000Z",
    model: "stt-rt-v4",
    languageHint: "en",
    turns: [
      {
        role: "customer",
        text: "Hello there",
        startedAt: "2026-04-07T00:00:01.000Z",
        endedAt: "2026-04-07T00:00:03.000Z"
      }
    ]
  });

  const files = await readdir(tempDir);
  const loaded = await store.getSession(saved.id);

  assert.equal(files.length, 1);
  assert.equal(loaded.id, saved.id);
  assert.equal(loaded.turns[0].text, "Hello there");
});

await run("session store returns null for missing sessions", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "soniox-store-"));
  const store = createSessionStore({ baseDir: tempDir });
  const result = await store.getSession("missing");
  assert.equal(result, null);
});

await run("partial tokens create a customer draft", async () => {
  const next = applySonioxResult({
    state: createConversationState(),
    selectedRole: "customer",
    now: "2026-04-07T00:00:00.000Z",
    tokens: [{ text: "hello", is_final: false }]
  });

  assert.equal(next.draft.role, "customer");
  assert.equal(getDraftText(next), "hello");
});

await run("fin token finalizes a turn under the original role", async () => {
  const first = applySonioxResult({
    state: createConversationState(),
    selectedRole: "agent",
    now: "2026-04-07T00:00:00.000Z",
    tokens: [{ text: "thanks", is_final: true }]
  });

  const finalized = applySonioxResult({
    state: first,
    selectedRole: "customer",
    now: "2026-04-07T00:00:02.000Z",
    tokens: [{ text: "<fin>", is_final: true }]
  });

  assert.equal(finalized.turns.length, 1);
  assert.equal(finalized.turns[0].role, "agent");
  assert.equal(finalized.turns[0].text, "thanks");
});

await run("manual finalization keeps partial text at stop time", async () => {
  const state = applySonioxResult({
    state: createConversationState(),
    selectedRole: "customer",
    now: "2026-04-07T00:00:00.000Z",
    tokens: [{ text: "need help", is_final: false }]
  });

  const finalized = finalizeDraft(state, "2026-04-07T00:00:04.000Z", {
    includePartial: true
  });

  assert.equal(finalized.turns.length, 1);
  assert.equal(finalized.turns[0].text, "need help");
});

await run("temporary key and session routes work end to end", async () => {
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
    const keyResponse = await fetch(`${server.baseUrl}/api/soniox/tmp-key`, {
      method: "POST"
    });
    const keyPayload = await keyResponse.json();
    assert.equal(keyResponse.status, 200);
    assert.equal(keyPayload.api_key, "tmp_mocked");

    const saveResponse = await fetch(`${server.baseUrl}/api/sessions`, {
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
    const savePayload = await saveResponse.json();
    assert.equal(saveResponse.status, 201);

    const sessionResponse = await fetch(
      `${server.baseUrl}/api/sessions/${savePayload.sessionId}`
    );
    const session = await sessionResponse.json();
    assert.equal(session.turns.length, 1);
    assert.equal(session.turns[0].role, "customer");
  } finally {
    await server.close();
  }
});

await run("missing saved sessions render a not found page", async () => {
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

const failed = results.filter((result) => !result.ok);

console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

if (failed.length > 0) {
  process.exitCode = 1;
}
