import test from "node:test";
import assert from "node:assert/strict";
import {
  applySonioxResult,
  createConversationState,
  finalizeDraft,
  getDraftText
} from "../public/lib/transcriptState.js";

test("partial tokens create a draft for the selected role", () => {
  const state = createConversationState();

  const next = applySonioxResult({
    state,
    selectedRole: "customer",
    now: "2026-04-07T00:00:00.000Z",
    tokens: [{ text: "hello", is_final: false }]
  });

  assert.equal(next.draft.role, "customer");
  assert.equal(getDraftText(next), "hello");
});

test("fin token finalizes a turn under the active role", () => {
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

test("manual finalization can keep partial text at stop time", () => {
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
