import { useCollectionChanges } from '../hooks/use-collection-changes';

interface ChangesBadgeProps {
  collectionId: string;
  /** Changes are counted again whenever this changes, such as after a sync. */
  refreshKey: string | null;
}

export function ChangesBadge({ collectionId, refreshKey }: ChangesBadgeProps) {
  const { pending, error } = useCollectionChanges(collectionId, refreshKey);
  if (error) return <span className="error">Changes unknown: {error}</span>;
  if (pending === 0) return null;
  return (
    <span className="badge badge--changes">
      {pending} {pending === 1 ? 'change' : 'changes'} available
    </span>
  );
}
