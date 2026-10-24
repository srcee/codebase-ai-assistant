import { render, screen } from '@testing-library/react';
import { faker, healthResponseFactory } from '@codebase-ai/shared-testing';
import App from './app';

describe('App', () => {
  it('shows ok when the API is healthy', async () => {
    const health = healthResponseFactory.build();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => health }),
    );
    render(<App />);
    expect(
      await screen.findByText(`API status: ${health.status}`),
    ).toBeTruthy();
  });

  it('shows degraded when the API reports a degraded dependency', async () => {
    const health = healthResponseFactory.degraded().build();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => health,
      }),
    );
    render(<App />);
    expect(
      await screen.findByText(`API status: ${health.status}`),
    ).toBeTruthy();
  });

  it('shows unreachable when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error(faker.lorem.sentence())),
    );
    render(<App />);
    expect(await screen.findByText('API status: unreachable')).toBeTruthy();
  });
});
