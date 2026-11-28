import type { HealthResponse } from '@codebase-ai/contracts';
import { Alert, Badge, List } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
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

const STATUS_COLORS: Record<HealthState['status'], string> = {
  checking: 'gray',
  ok: 'green',
  degraded: 'yellow',
  unreachable: 'red',
};

export function HealthStatus({ state }: { state: HealthState }) {
  return (
    <Badge
      variant="dot"
      color={STATUS_COLORS[state.status]}
      size="lg"
      tt="none"
      fw={500}
      role="status"
    >
      API status: {state.status}
    </Badge>
  );
}

export function HealthProblems({ state }: { state: HealthState }) {
  const details = 'health' in state ? problems(state.health) : [];
  if (details.length === 0) return null;
  return (
    <Alert
      role="status"
      color="yellow"
      title="Some local services need attention"
      icon={<IconAlertTriangle />}
    >
      <List size="sm">
        {details.map((detail) => (
          <List.Item key={detail}>{detail}</List.Item>
        ))}
      </List>
    </Alert>
  );
}
