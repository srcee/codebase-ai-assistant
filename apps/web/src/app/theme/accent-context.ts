import { createContext, useContext } from 'react';
import { DEFAULT_ACCENT, type Accent } from './accents';

interface AccentContextValue {
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

export const AccentContext = createContext<AccentContextValue>({
  accent: DEFAULT_ACCENT,
  setAccent: () => undefined,
});

export const useAccent = (): AccentContextValue => useContext(AccentContext);
