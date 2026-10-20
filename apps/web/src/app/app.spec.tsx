import { render, screen } from '@testing-library/react';
import App from './app';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows ok when the API is healthy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      }),
    );
    render(<App />);
    expect(await screen.findByText('API status: ok')).toBeTruthy();
  });

  it('shows unreachable when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    render(<App />);
    expect(await screen.findByText('API status: unreachable')).toBeTruthy();
  });
});
