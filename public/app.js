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
  saveUrl: null
};

const elements = {
  roleButtons: [...document.querySelectorAll("[data-role-button]")],
  startButton: document.querySelector("[data-action='start-turn']"),
  stopButton: document.querySelector("[data-action='stop-turn']"),
  saveButton: document.querySelector("[data-action='save-session']"),
  draftText: document.querySelector("[data-draft-text]"),
  turnList: document.querySelector("[data-turn-list]"),
  statusText: document.querySelector("[data-status-text]"),
  errorText: document.querySelector("[data-error-text]"),
  emptyState: document.querySelector("[data-empty-state]"),
  savedLink: document.querySelector("[data-saved-link]")
};

function setStatus(message) {
  elements.statusText.textContent = message;
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
    const item = document.createElement("article");
    item.className = `turn-card turn-card--${turn.role}`;

    const role = document.createElement("p");
    role.className = "turn-card__role";
    role.textContent = turn.role === "customer" ? "Customer" : "Agent";

    const text = document.createElement("p");
    text.className = "turn-card__text";
    text.textContent = turn.text;

    const time = document.createElement("p");
    time.className = "turn-card__time";
    time.textContent = new Date(turn.endedAt).toLocaleTimeString();

    item.append(role, text, time);
    elements.turnList.append(item);
  }
}

function renderDraft() {
  const text = getDraftText(state.conversation);
  elements.draftText.textContent = text || "Waiting for speech...";
}

function updateControls() {
  elements.startButton.disabled = state.isRecording;
  elements.stopButton.disabled = !state.isRecording;
  elements.saveButton.disabled =
    state.isRecording || state.conversation.turns.length === 0;
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
  setStatus(`Listening as ${state.selectedRole}...`);

  try {
    const { client, finished } = await createRecording();
    state.recording = client;
    state.recordingDone = finished;
    state.isRecording = true;
    updateRoleButtons();
    updateControls();
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

  setStatus("Finishing the current turn...");

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
  setStatus("Saving the conversation...");

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
    elements.savedLink.textContent = `Open saved session ${result.sessionId}`;
    setStatus("Conversation saved.");
  } catch (error) {
    setError(error.message || "Unable to save the conversation.");
    setStatus("Save failed.");
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

updateRoleButtons();
renderDraft();
renderTurns();
updateControls();
setStatus("Ready to record the first turn.");
