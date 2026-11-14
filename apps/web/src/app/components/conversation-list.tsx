import type { ConversationSummary } from '@codebase-ai/contracts';

interface ConversationListProps {
  items: ConversationSummary[];
  activeId: string | null;
  hasMore: boolean;
  onOpen: (conversation: ConversationSummary) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
}

export function ConversationList({
  items,
  activeId,
  hasMore,
  onOpen,
  onDelete,
  onLoadMore,
}: ConversationListProps) {
  return (
    <nav aria-label="Conversations" className="conversations">
      {items.length === 0 && <p className="muted">No conversations yet.</p>}
      <ul>
        {items.map((conversation) => (
          <li
            key={conversation.id}
            className={conversation.id === activeId ? 'active' : undefined}
          >
            <button
              type="button"
              className="link"
              onClick={() => onOpen(conversation)}
            >
              {conversation.title}
            </button>
            <button
              type="button"
              className="icon"
              aria-label={`Delete ${conversation.title}`}
              onClick={() => onDelete(conversation.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button type="button" onClick={onLoadMore}>
          Load more
        </button>
      )}
    </nav>
  );
}
