import { createTheme, type MantineThemeOverride } from '@mantine/core';
import type { Accent } from './accents';

// System fonts only: the UI must work offline and never fetch web fonts.
const SYSTEM_FONTS =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO_FONTS =
  'ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace';

export function buildTheme(accent: Accent): MantineThemeOverride {
  return createTheme({
    primaryColor: accent,
    primaryShade: { light: 6, dark: 5 },
    defaultRadius: 'md',
    fontFamily: SYSTEM_FONTS,
    fontFamilyMonospace: MONO_FONTS,
    headings: { fontFamily: SYSTEM_FONTS, fontWeight: '650' },
    cursorType: 'pointer',
  });
}
