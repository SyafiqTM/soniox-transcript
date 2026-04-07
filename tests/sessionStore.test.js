import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readdir } from "node:fs/promises";
import { createSessionStore } from "../src/services/sessionStore.js";

test("session store saves and reloads a transcript session", async () => {
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

test("session store returns null for a missing session", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "soniox-store-"));
  const store = createSessionStore({ baseDir: tempDir });

  const result = await store.getSession("missing");

  assert.equal(result, null);
});
