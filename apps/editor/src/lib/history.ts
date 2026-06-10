import type { Blueprint } from '../types';

export interface BlueprintHistory {
  past: Blueprint[];
  present: Blueprint | null;
  future: Blueprint[];
}

export function createHistory(initial: Blueprint | null = null): BlueprintHistory {
  return { past: [], present: initial, future: [] };
}

export function commitHistory(history: BlueprintHistory, next: Blueprint | null): BlueprintHistory {
  if (history.present === next) return history;
  if (history.present && next && JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return {
    past: history.present ? [...history.past.slice(-99), history.present] : history.past,
    present: next,
    future: [],
  };
}

export function undoHistory(history: BlueprintHistory): BlueprintHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: history.present ? [history.present, ...history.future].slice(0, 100) : history.future,
  };
}

export function redoHistory(history: BlueprintHistory): BlueprintHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: history.present ? [...history.past, history.present].slice(-100) : history.past,
    present: next,
    future: history.future.slice(1),
  };
}
