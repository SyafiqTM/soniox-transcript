const SONIOX_MODULE_URL = "https://unpkg.com/@soniox/speech-to-text-web?module";
const FIN_TOKENS = new Set(["<fin>", "<end>"]);

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  isRecording: false,
  isThinking: false,
  isPlaying: false,
  recording: null,
  liveText: "",
  finalText: "",
  // OpenAI-format conversation history [{role, content}, ...]
  history: []
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const el = {
  chat:       document.querySelector("[data-vb-chat]"),
  draft:      document.querySelector("[data-vb-draft]"),
  draftText:  document.querySelector("[data-vb-draft-text]"),
  thinking:   document.querySelector("[data-vb-thinking]"),
  statusBar:  document.querySelector("[data-vb-status]"),
  statusText: document.querySelector("[data-vb-status-text]"),
  errorText:  document.querySelector("[data-vb-error]"),
  micBtn:     document.querySelector("[data-vb-mic]"),
  micLabel:   document.querySelector("[data-vb-mic-label]"),
  stopBtn:    document.querySelector("[data-vb-stop]")
};

// ── UI helpers ────────────────────────────────────────────────────────────────
function setStatus(msg, recording = false) {
  el.statusText.textContent = msg;
  el.statusBar.classList.toggle("status-bar--recording", recording);
}

function setError(msg) {
  el.errorText.textContent = msg || "";
}

function updateControls() {
  const busy = state.isThinking || state.isPlaying;

  el.micBtn.disabled = state.isRecording || busy;
  el.micBtn.classList.toggle("vb-mic-btn--recording", state.isRecording);

  el.stopBtn.hidden = !state.isRecording;

  el.draft.hidden    = !state.isRecording;
  el.thinking.hidden = !state.isThinking;

  if (state.isRecording) {
    el.micLabel.textContent = "Listening\u2026";
  } else if (state.isThinking) {
    el.micLabel.textContent = "Thinking\u2026";
  } else if (state.isPlaying) {
    el.micLabel.textContent = "Speaking\u2026";
  } else {
    el.micLabel.textContent = "Talk";
  }
}

function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `vb-bubble vb-bubble--${role}`;

  const roleLabel = document.createElement("span");
  roleLabel.className = "vb-bubble__role";
  roleLabel.textContent = role === "user" ? "You" : "Bot";

  const content = document.createElement("p");
  content.className = "vb-bubble__text";
  content.textContent = text;

  bubble.append(roleLabel, content);
  el.chat.append(bubble);
  el.chat.scrollTop = el.chat.scrollHeight;
}

// ── Soniox temp key ───────────────────────────────────────────────────────────
async function fetchTemporaryKey() {
  const res = await fetch("/api/soniox/tmp-key", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to get Soniox key.");
  return data.api_key;
}

// ── Audio playback ────────────────────────────────────────────────────────────
function playAudio(base64Audio) {
  return new Promise((resolve) => {
    const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);

    audio.onended = () => {
      state.isPlaying = false;
      setStatus("Press TALK to continue the conversation.");
      updateControls();
      resolve();
    };

    audio.onerror = () => {
      state.isPlaying = false;
      setError("Audio playback failed.");
      setStatus("Press TALK to continue.");
      updateControls();
      resolve();
    };

    state.isPlaying = true;
    setStatus("Bot is speaking\u2026");
    updateControls();

    audio.play().catch(() => {
      // Browser may block autoplay on first interaction — nudge user
      state.isPlaying = false;
      setError("Autoplay blocked. Click TALK once to unblock audio, then try again.");
      setStatus("Press TALK to continue.");
      updateControls();
      resolve();
    });
  });
}

// ── Backend call: transcription → OpenAI → ElevenLabs ─────────────────────────
async function sendToBackend(transcript, sttMs = 0) {
  state.isThinking = true;
  setStatus("Thinking\u2026");
  setError("");
  updateControls();

  // Add user turn to chat immediately
  addBubble("user", transcript);
  // Keep a copy of history *before* this turn for the request
  const historySnapshot = [...state.history];
  state.history.push({ role: "user", content: transcript });

  try {
    const res = await fetch("/api/voicebot/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, history: historySnapshot })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Reply request failed.");

    const { llmMs = 0, ttsMs = 0 } = data._timing || {};
    const backendMs = llmMs + ttsMs;
    const totalMs = sttMs + backendMs;
    console.log(
      `[voicebot] STT: ${sttMs}ms | LLM: ${llmMs}ms | TTS: ${ttsMs}ms | total: ${totalMs}ms`
    );

    state.history.push({ role: "assistant", content: data.replyText });
    addBubble("assistant", data.replyText);

    state.isThinking = false;
    updateControls();

    await playAudio(data.audio);
  } catch (err) {
    state.isThinking = false;
    setError(err.message);
    setStatus("Something went wrong. Press TALK to try again.");
    updateControls();
  }
}

// ── Recording cleanup ─────────────────────────────────────────────────────────
function cleanupRecording() {
  state.recording = null;
  state.isRecording = false;
  state.liveText = "";
  state.finalText = "";
  el.draftText.textContent = "";
  updateControls();
}

// ── Auto-stop (triggered by Soniox <fin> endpoint-detection token) ────────────
async function autoStop() {
  if (!state.recording || !state.isRecording) return;

  // Capture transcript text before stopping
  state.finalText = state.liveText;
  state.isRecording = false;
  setStatus("Processing speech\u2026");
  updateControls();

  try {
    await state.recording.stop();
    // onFinished will fire next and call sendToBackend
  } catch (err) {
    setError(err.message);
    cleanupRecording();
  }
}

// ── Manual stop (user presses Stop button) ────────────────────────────────────
async function manualStop() {
  if (!state.recording || !state.isRecording) return;

  state.finalText = state.liveText;
  state.isRecording = false;
  setStatus("Processing speech\u2026");
  updateControls();

  try {
    await state.recording.stop();
  } catch (err) {
    setError(err.message);
    cleanupRecording();
  }
}

// ── Start recording ───────────────────────────────────────────────────────────
async function startRecording() {
  setError("");

  let sonioxModule;
  try {
    sonioxModule = await import(SONIOX_MODULE_URL);
  } catch (err) {
    setError("Could not load the Soniox module. Check your internet connection.");
    return;
  }

  // Guard: prevent onFinished from firing twice (e.g. auto-stop + client finalize)
  let finishHandled = false;

  const client = new sonioxModule.SonioxClient({
    apiKey: fetchTemporaryKey,

    onPartialResult(result) {
      const tokens = result.tokens || [];

      // Detect end-of-speech turn from Soniox endpoint detection
      const hasFin = tokens.some((t) => FIN_TOKENS.has(t.text));

      // Build readable transcript from all non-control tokens
      const text = tokens
        .filter((t) => !FIN_TOKENS.has(t.text))
        .map((t) => t.text || "")
        .join("")
        .replace(/\s+([,.!?;:])/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

      state.liveText = text;
      el.draftText.textContent = text || "Listening\u2026";

      // Auto-halt STT when turn is complete
      if (hasFin && state.isRecording) {
        autoStop();
      }
    },

    onError(err) {
      setError(err?.message || "Soniox connection error.");
      setStatus("Recording stopped due to an error.");
      cleanupRecording();
    },

    async onFinished() {
      if (finishHandled) return;
      finishHandled = true;

      const text = state.finalText.trim();
      const sttMs = state._sttStart ? Date.now() - state._sttStart : 0;
      console.log(`[voicebot] STT: ${sttMs}ms`);
      cleanupRecording();

      if (text) {
        await sendToBackend(text, sttMs);
      } else {
        setStatus("Nothing captured. Press TALK to try again.");
      }
    }
  });

  state.recording = client;
  state.isRecording = true;
  state.liveText = "";
  state.finalText = "";
  state._sttStart = Date.now();
  el.draftText.textContent = "Listening\u2026";
  setStatus("Listening\u2026 speak when ready.", true);
  updateControls();

  try {
    await client.start({
      model: "stt-rt-v4",
      // "ms" = Malay, "en" = English — covers Manglish and code-switching
      languageHints: ["ms", "en"],
      enableEndpointDetection: true
    });
  } catch (err) {
    setError(err.message || "Microphone access failed. Check browser permissions.");
    setStatus("Unable to start the microphone.");
    cleanupRecording();
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
el.micBtn.addEventListener("click", () => {
  if (!state.isRecording && !state.isThinking && !state.isPlaying) {
    startRecording();
  }
});

el.stopBtn.addEventListener("click", () => {
  if (state.isRecording) {
    manualStop();
  }
});
