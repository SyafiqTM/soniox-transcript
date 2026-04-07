export const FIN_TOKENS = new Set(["<fin>", "<end>"]);

export function compactText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

export function tokensToText(tokens = []) {
  return compactText(
    tokens
      .map((token) => token?.text || "")
      .filter((text) => text && !FIN_TOKENS.has(text))
      .join("")
  );
}

function splitTokens(tokens = []) {
  const finalTokens = [];
  const partialTokens = [];
  let sawFin = false;

  for (const token of tokens) {
    if (!token || typeof token.text !== "string") {
      continue;
    }

    if (FIN_TOKENS.has(token.text)) {
      sawFin = true;
      continue;
    }

    if (token.is_final) {
      finalTokens.push(token);
      continue;
    }

    partialTokens.push(token);
  }

  return { finalTokens, partialTokens, sawFin };
}

export function createConversationState() {
  return {
    turns: [],
    draft: null
  };
}

export function applySonioxResult({
  state,
  selectedRole,
  tokens,
  now = new Date().toISOString()
}) {
  const nextState = {
    turns: [...state.turns],
    draft: state.draft
      ? {
          role: state.draft.role,
          startedAt: state.draft.startedAt,
          endedAt: state.draft.endedAt,
          finalTokens: [...state.draft.finalTokens],
          partialTokens: [...state.draft.partialTokens]
        }
      : null
  };

  const { finalTokens, partialTokens, sawFin } = splitTokens(tokens);
  const hasAnyText =
    finalTokens.length > 0 ||
    partialTokens.length > 0 ||
    (nextState.draft &&
      (nextState.draft.finalTokens.length > 0 ||
        nextState.draft.partialTokens.length > 0));

  if (!nextState.draft && hasAnyText) {
    nextState.draft = {
      role: selectedRole,
      startedAt: now,
      endedAt: now,
      finalTokens: [],
      partialTokens: []
    };
  }

  if (nextState.draft) {
    nextState.draft.finalTokens.push(...finalTokens);
    nextState.draft.partialTokens = partialTokens;
    nextState.draft.endedAt = now;
  }

  if (sawFin) {
    return finalizeDraft(nextState, now, { includePartial: false });
  }

  return nextState;
}

export function getDraftText(state) {
  if (!state.draft) {
    return "";
  }

  return compactText(
    `${tokensToText(state.draft.finalTokens)} ${tokensToText(state.draft.partialTokens)}`
  );
}

export function finalizeDraft(
  state,
  now = new Date().toISOString(),
  { includePartial = true } = {}
) {
  if (!state.draft) {
    return {
      turns: [...state.turns],
      draft: null
    };
  }

  const draftTokens = includePartial
    ? [...state.draft.finalTokens, ...state.draft.partialTokens]
    : [...state.draft.finalTokens];

  const text = tokensToText(draftTokens);
  if (!text) {
    return {
      turns: [...state.turns],
      draft: null
    };
  }

  return {
    turns: [
      ...state.turns,
      {
        role: state.draft.role,
        text,
        startedAt: state.draft.startedAt || now,
        endedAt: now
      }
    ],
    draft: null
  };
}
