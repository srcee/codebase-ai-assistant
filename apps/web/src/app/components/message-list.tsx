import {
  Alert,
  Group,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconMessageQuestion,
  IconSparkles,
} from '@tabler/icons-react';
import type { ChatItem } from '../hooks/use-chat';
import { formatLocator } from '../utils/format-locator';
import classes from './message-list.module.css';

function AnswerDetails({ item }: { item: ChatItem }) {
  return (
    <>
      {item.state === 'stopped' && (
        <Text size="sm" c="dimmed">
          Stopped.
        </Text>
      )}
      {item.state === 'unsupported' && (
        <Alert
          role="note"
          color="yellow"
          p="xs"
          icon={<IconAlertTriangle size={16} />}
        >
          This answer cites no evidence from the selected sources. Verify it
          before relying on it.
        </Alert>
      )}
      {(item.state === 'abstained' || item.state === 'unsupported') &&
        item.suggestions.length > 0 && (
          <div>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
              Try asking
            </Text>
            <ul className={classes.suggestions} aria-label="Suggestions">
              {item.suggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      {item.citations.length > 0 && (
        <ol className={classes.citations} aria-label="Citations">
          {item.citations.map((citation) => (
            <li key={citation.ordinal} className={classes.citation}>
              <span className={classes.citationNumber}>
                [{citation.ordinal}]
              </span>{' '}
              <span className={classes.citationText}>
                {citation.sourceName} · {citation.relativePath} ·{' '}
                {formatLocator(citation.locator)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {item.invalidCitations.length > 0 && (
        <Text size="xs" c="dimmed">
          Removed {item.invalidCitations.length} citation
          {item.invalidCitations.length === 1 ? '' : 's'} that did not match the
          retrieved evidence.
        </Text>
      )}
    </>
  );
}

function Message({ item }: { item: ChatItem }) {
  if (item.role === 'user') {
    return (
      <li className={classes.userRow}>
        <div className={classes.userBubble}>{item.content}</div>
      </li>
    );
  }
  return (
    <li className={classes.assistantRow}>
      <ThemeIcon size={32} radius="xl" variant="light" aria-hidden>
        <IconSparkles size={18} />
      </ThemeIcon>
      <div className={classes.answer} data-state={item.state}>
        {item.content ? (
          <div className={classes.content}>{item.content}</div>
        ) : (
          item.state === 'streaming' && (
            <Group gap="xs">
              <Loader type="dots" size="sm" />
              <Text size="sm" c="dimmed">
                Thinking…
              </Text>
            </Group>
          )
        )}
        <AnswerDetails item={item} />
      </div>
    </li>
  );
}

export function MessageList({ items }: { items: ChatItem[] }) {
  if (items.length === 0) {
    return (
      <Stack align="center" gap="sm" className={classes.empty}>
        <ThemeIcon size={56} radius="xl" variant="light" aria-hidden>
          <IconMessageQuestion size={30} stroke={1.5} />
        </ThemeIcon>
        <Title order={2} size="h3">
          Ask about your code and documents
        </Title>
        <Text c="dimmed" ta="center" maw={420}>
          Choose a project or repository and ask a question about it.
        </Text>
      </Stack>
    );
  }
  return (
    <ol className={classes.messages} aria-live="polite">
      {items.map((item) => (
        <Message key={item.id} item={item} />
      ))}
    </ol>
  );
}
