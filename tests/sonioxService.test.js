import test from "node:test";
import assert from "node:assert/strict";
import { createSonioxService } from "../src/services/sonioxService.js";

test("createTemporaryKey returns the Soniox API key payload", async () => {
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

  const service = createSonioxService({ apiKey: "secret-key" });

  try {
    const result = await service.createTemporaryKey();

    assert.deepEqual(result, {
      api_key: "tmp_123",
      expires_at: "2026-04-07T00:05:00.000Z"
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("createTemporaryKey throws a helpful error when Soniox is not configured", async () => {
  const service = createSonioxService({ apiKey: "" });

  await assert.rejects(() => service.createTemporaryKey(), {
    message: /SONIOX_API_KEY is missing/
  });
});
