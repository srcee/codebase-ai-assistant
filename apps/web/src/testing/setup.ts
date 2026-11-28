import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks these browser APIs, which Mantine uses for color scheme and layout.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class NoopResizeObserver {
  observe(): void {
    return undefined;
  }
  unobserve(): void {
    return undefined;
  }
  disconnect(): void {
    return undefined;
  }
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: NoopResizeObserver,
});

// The autosizing textarea re-measures when fonts load.
Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: new EventTarget(),
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
