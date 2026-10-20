import { useEffect, useState } from 'react';
import type { HealthResponse } from '@codebase-ai/contracts';

type ApiStatus = 'checking' | 'ok' | 'unreachable';

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}

export function App() {
  const [status, setStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((health) => !cancelled && setStatus(health.status))
      .catch(() => !cancelled && setStatus('unreachable'));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Codebase AI Assistant</h1>
      <p role="status">API status: {status}</p>
    </main>
  );
}

export default App;
