import type { ConversationSummary } from '@codebase-ai/contracts';
import { ActionIcon, Button, Text, UnstyledButton } from '@mantine/core';
import { IconMessage, IconTrash } from '@tabler/icons-react';
import classes from './conversation-list.module.css';

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
    <nav aria-label="Conversations">
      {items.length === 0 && (
        <Text size="sm" c="dimmed" px="xs">
          No conversations yet.
        </Text>
      )}
      <ul className={classes.list}>
        {items.map((conversation) => (
          <li
            key={conversation.id}
            className={classes.item}
            data-active={conversation.id === activeId || undefined}
          >
            <UnstyledButton
              className={classes.open}
              onClick={() => onOpen(conversation)}
            >
              <IconMessage size={16} stroke={1.6} aria-hidden />
              <span className={classes.title}>{conversation.title}</span>
            </UnstyledButton>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              className={classes.delete}
              aria-label={`Delete ${conversation.title}`}
              onClick={() => onDelete(conversation.id)}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button
          variant="subtle"
          size="xs"
          fullWidth
          mt="xs"
          onClick={onLoadMore}
        >
          Load more
        </Button>
      )}
    </nav>
  );
}
