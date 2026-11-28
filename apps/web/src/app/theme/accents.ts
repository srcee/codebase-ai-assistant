export const ACCENTS = ['indigo', 'blue', 'teal'] as const;

export type Accent = (typeof ACCENTS)[number];

export const DEFAULT_ACCENT: Accent = 'indigo';

export const ACCENT_STORAGE_KEY = 'codebase-ai:accent';

const isAccent = (value: unknown): value is Accent =>
  ACCENTS.includes(value as Accent);

export function readStoredAccent(): Accent {
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccent(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function storeAccent(accent: Accent): void {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for the session.
  }
}
