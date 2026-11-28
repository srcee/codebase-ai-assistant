import { MantineProvider } from '@mantine/core';
import { useMemo, useState, type ReactNode } from 'react';
import { AccentContext } from './accent-context';
import { readStoredAccent, storeAccent, type Accent } from './accents';
import { buildTheme } from './theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<Accent>(readStoredAccent);
  const theme = useMemo(() => buildTheme(accent), [accent]);
  const value = useMemo(
    () => ({
      accent,
      setAccent: (next: Accent) => {
        storeAccent(next);
        setAccentState(next);
      },
    }),
    [accent],
  );

  return (
    <AccentContext value={value}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        {children}
      </MantineProvider>
    </AccentContext>
  );
}
