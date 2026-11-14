import type { HealthResponse } from '@codebase-ai/contracts';
import { useEffect, useState } from 'react';

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  // 503 still carries a degraded health body.
  if (!response.ok && response.status !== 503) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}

export type HealthState =
  | { status: 'checking' }
  | { status: 'unreachable' }
  | { status: HealthResponse['status']; health: HealthResponse };

export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then(
        (health) => !cancelled && setState({ status: health.status, health }),
      )
      .catch(() => !cancelled && setState({ status: 'unreachable' }));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
