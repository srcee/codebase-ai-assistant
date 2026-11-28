import { fireEvent, screen } from '@testing-library/react';
import { render } from '../../testing/render';
import { ACCENT_STORAGE_KEY } from '../theme/accents';
import { ThemeControls } from './theme-controls';

const pressed = (name: string): string | null =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('ThemeControls', () => {
  it('cycles the color scheme from system to light to dark', () => {
    render(<ThemeControls />);
    const root = document.documentElement;

    fireEvent.click(screen.getByRole('button', { name: 'Theme: System' }));
    expect(root.getAttribute('data-mantine-color-scheme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Theme: Light' }));
    expect(root.getAttribute('data-mantine-color-scheme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeTruthy();
  });

  it('defaults to the indigo accent', () => {
    render(<ThemeControls />);
    expect(pressed('Indigo accent')).toBe('true');
    expect(pressed('Teal accent')).toBe('false');
  });

  it('switches the accent and remembers it', () => {
    const { unmount } = render(<ThemeControls />);

    fireEvent.click(screen.getByRole('button', { name: 'Teal accent' }));

    expect(pressed('Teal accent')).toBe('true');
    expect(window.localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('teal');
    unmount();
    render(<ThemeControls />);
    expect(pressed('Teal accent')).toBe('true');
  });

  it('ignores an unknown stored accent', () => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, 'not-a-color');
    render(<ThemeControls />);
    expect(pressed('Indigo accent')).toBe('true');
  });
});
