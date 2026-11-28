import { Badge, Text } from '@mantine/core';
import { useCollectionChanges } from '../hooks/use-collection-changes';

interface ChangesBadgeProps {
  collectionId: string;
  /** Changes are counted again whenever this changes, such as after a sync. */
  refreshKey: string | null;
}

export function ChangesBadge({ collectionId, refreshKey }: ChangesBadgeProps) {
  const { pending, error } = useCollectionChanges(collectionId, refreshKey);
  if (error)
    return (
      <Text span size="xs" c="red">
        Changes unknown: {error}
      </Text>
    );
  if (pending === 0) return null;
  return (
    <Badge variant="outline" color="orange" tt="none">
      {pending} {pending === 1 ? 'change' : 'changes'} available
    </Badge>
  );
}
