import {
  render as baseRender,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from '../app/theme/theme-provider';

/** Testing Library's render inside the app theme, as `main.tsx` mounts it. */
export const render = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult => baseRender(ui, { wrapper: ThemeProvider, ...options });
