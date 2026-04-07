import {
  applySonioxResult,
  createConversationState,
  finalizeDraft,
  getDraftText
} from "./lib/transcriptState.js";

const SONIOX_MODULE_URL = "https://unpkg.com/@soniox/speech-to-text-web?module";

const state = {
  selectedRole: "customer",
  conversation: createConversationState(),
  startedAt: new Date().toISOString(),
  model: "stt-rt-v4",
  languageHint: "en",
  recording: null,
  recordingDone: null,
  isRecording: false,
  saveUrl: null,
  allSessions: [],
  searchQuery: ""
};

const elements = {
  roleButtons:        [...document.querySelectorAll("[data-role-button]")],
  startButton:        document.querySelector("[data-action='start-turn']"),
  stopButton:         document.querySelector("[data-action='stop-turn']"),
  saveButton:         document.querySelector("[data-action='save-session']"),
  draftArea:          document.querySelector("[data-draft-area]"),
  draftText:          document.querySelector("[data-draft-text]"),
  turnList:           document.querySelector("[data-turn-list]"),
  statusBar:          document.querySelector("[data-status-bar]"),
  statusText:         document.querySelector("[data-status-text]"),
  errorText:          document.querySelector("[data-error-text]"),
  emptyState:         document.querySelector("[data-empty-state]"),
  savedLink:          document.querySelector("[data-saved-link]"),
  sessionList:        document.querySelector("[data-session-list]"),
  searchInput:        document.querySelector("[data-search-input]"),
  conversationScroll: document.querySelector("[data-conversation-scroll]")
};

function setStatus(message, isRecording = false) {
  elements.statusText.textContent = message;
  elements.statusBar.classList.toggle("status-bar--recording", isRecording);
}

function setError(message) {
  elements.errorText.textContent = message || "";
}

function updateRoleButtons() {
  for (const button of elements.roleButtons) {
    const isActive = button.dataset.roleButton === state.selectedRole;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = state.isRecording;
  }
}

function renderTurns() {
  const { turns } = state.conversation;
  elements.turnList.innerHTML = "";
  elements.emptyState.hidden = turns.length > 0;

  for (const turn of turns) {
    const card = document.createElement("div");
    card.className = `turn-card turn-card--${turn.role}`;

    const role = document.createElement("p");
    role.className = "turn-card__role";
    role.textContent = turn.role === "customer" ? "Customer" : "Agent";

    const bubble = document.createElement("div");
    bubble.className = "turn-card__bubble";
    bubble.textContent = turn.text;

    const time = document.createElement("p");
    time.className = "turn-card__time";
    time.textContent = new Date(turn.endedAt).toLocaleTimeString();

    card.append(role, bubble, time);
    elements.turnList.append(card);
  }

  if (turns.length > 0) {
    elements.conversationScroll.scrollTop = elements.conversationScroll.scrollHeight;
  }
}

function renderDraft() {
  if (state.isRecording) {
    elements.draftArea.hidden = false;
    elements.draftText.textContent = getDraftText(state.conversation) || "Listening\u2026";
  } else {
    elements.draftArea.hidden = true;
  }
}

function updateControls() {
  elements.startButton.disabled = state.isRecording;
  elements.stopButton.disabled = !state.isRecording;
  elements.saveButton.disabled =
    state.isRecording || state.conversation.turns.length === 0;
  elements.startButton.classList.toggle("is-active", state.isRecording);
}

async function fetchTemporaryKey() {
  const response = await fetch("/api/soniox/tmp-key", { method: "POST" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to request a temporary Soniox key.");
  }

  return payload.api_key;
}

async function createRecording() {
  const module = await import(SONIOX_MODULE_URL);
  let resolveFinished;
  let rejectFinished;
  const finished = new Promise((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  const recording = new module.SonioxClient({
    apiKey: fetchTemporaryKey,
    onPartialResult(result) {
      state.conversation = applySonioxResult({
        state: state.conversation,
        selectedRole: state.selectedRole,
        tokens: result.tokens || [],
        now: new Date().toISOString()
      });
      renderDraft();
      renderTurns();
      updateControls();
    },
    onError(error) {
      setError(error?.message || "Soniox connection error.");
      setStatus("The current turn stopped because of a transcription error.");
      rejectFinished(error);
      cleanupRecording();
    },
    onFinished() {
      resolveFinished();
    }
  });

  return {
    client: recording,
    finished
  };
}

function cleanupRecording() {
  state.recording = null;
  state.recordingDone = null;
  state.isRecording = false;
  updateRoleButtons();
  renderDraft();
  renderTurns();
  updateControls();
}

async function startTurn() {
  setError("");
  setStatus(`Listening as ${state.selectedRole}\u2026`, true);

  try {
    const { client, finished } = await createRecording();
    state.recording = client;
    state.recordingDone = finished;
    state.isRecording = true;
    updateRoleButtons();
    updateControls();
    renderDraft();
    await state.recording.start({
      model: state.model,
      languageHints: [state.languageHint],
      enableEndpointDetection: true
    });
  } catch (error) {
    cleanupRecording();
    setError(error.message || "Microphone access failed.");
    setStatus("Unable to start the microphone.");
  }
}

async function stopTurn() {
  if (!state.recording) {
    return;
  }

  setStatus("Finishing the current turn\u2026");

  try {
    await state.recording.stop();
    if (state.recordingDone) {
      await state.recordingDone.catch(() => {});
    }
    state.conversation = finalizeDraft(state.conversation, new Date().toISOString(), {
      includePartial: true
    });
    renderDraft();
    renderTurns();
    setStatus("Turn captured. Switch roles or record the next turn.");
  } catch (error) {
    setError(error.message || "Unable to finish the current turn.");
    setStatus("The current turn could not be finalized cleanly.");
  } finally {
    cleanupRecording();
  }
}

async function saveSession() {
  setError("");
  setStatus("Saving the conversation\u2026");

  const payload = {
    startedAt: state.startedAt,
    endedAt: new Date().toISOString(),
    model: state.model,
    languageHint: state.languageHint,
    turns: state.conversation.turns
  };

  try {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to save the session.");
    }

    state.saveUrl = `/sessions/${result.sessionId}`;
    elements.savedLink.href = state.saveUrl;
    elements.savedLink.hidden = false;
    elements.savedLink.textContent = `View saved session \u2197`;
    setStatus("Conversation saved.");
    await loadSessionHistory();
  } catch (error) {
    setError(error.message || "Unable to save the conversation.");
    setStatus("Save failed.");
  }
}

// ── Session history ───────────────────────────────────────────────────────────

async function loadSessionHistory() {
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) return;
    state.allSessions = await res.json();
    renderSessionList();
  } catch {
    // silently ignore; sidebar stays with its current content
  }
}

function renderSessionList() {
  const query = state.searchQuery.toLowerCase().trim();
  const filtered = query
    ? state.allSessions.filter(s => s.id.toLowerCase().includes(query))
    : state.allSessions;

  elements.sessionList.innerHTML = "";

  if (filtered.length === 0) {
    const msg = document.createElement("p");
    msg.className = "empty-sessions";
    msg.textContent = query ? "No sessions match your search." : "No saved sessions yet.";
    elements.sessionList.appendChild(msg);
    return;
  }

  for (const session of filtered) {
    const item = document.createElement("a");
    item.className = "session-item";
    item.href = `/sessions/${session.id}`;

    const date = new Date(session.startedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const turns = session.turnCount;

    const idEl = document.createElement("div");
    idEl.className = "session-item__id";
    idEl.textContent = session.id;

    const metaEl = document.createElement("div");
    metaEl.className = "session-item__meta";
    metaEl.innerHTML = `<span>${date}</span><span class="session-item__badge">${turns} turn${turns !== 1 ? "s" : ""}</span>`;

    item.append(idEl, metaEl);
    elements.sessionList.appendChild(item);
  }
}

for (const button of elements.roleButtons) {
  button.addEventListener("click", () => {
    state.selectedRole = button.dataset.roleButton;
    updateRoleButtons();
    setStatus(`Next turn will be recorded as ${state.selectedRole}.`);
  });
}

elements.startButton.addEventListener("click", startTurn);
elements.stopButton.addEventListener("click", stopTurn);
elements.saveButton.addEventListener("click", saveSession);

if (elements.searchInput) {
  elements.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderSessionList();
  });
}

updateRoleButtons();
renderDraft();
renderTurns();
updateControls();
setStatus("Ready to record the first turn.");
loadSessionHistory();
