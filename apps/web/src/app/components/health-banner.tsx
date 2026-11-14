import type { HealthResponse } from '@codebase-ai/contracts';
import type { HealthState } from '../hooks/use-health';

function problems(health: HealthResponse): string[] {
  const found: string[] = [];
  if (health.database.status !== 'up')
    found.push('The database is not reachable.');
  if (health.inference.status !== 'up') {
    found.push('The local inference runtime is not reachable.');
  } else {
    for (const model of [
      health.inference.chatModel,
      health.inference.embeddingModel,
    ]) {
      if (!model.available) found.push(`Model ${model.name} is not installed.`);
    }
  }
  return found;
}

export function HealthBanner({ state }: { state: HealthState }) {
  const details = 'health' in state ? problems(state.health) : [];
  const warn = state.status === 'unreachable' || state.status === 'degraded';
  return (
    <div className={warn ? 'health health--warn' : 'health'}>
      <span role="status">API status: {state.status}</span>
      {details.length > 0 && (
        <ul>
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
