import { Button, Group, Text, Textarea } from '@mantine/core';
import { IconPlayerStopFilled, IconSend } from '@tabler/icons-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import classes from './composer.module.css';

export const MAX_QUESTION_CHARS = 4000;

interface ComposerProps {
  disabled: boolean;
  busy: boolean;
  onSend: (question: string) => void;
  onStop: () => void;
}

export function Composer({ disabled, busy, onSend, onStop }: ComposerProps) {
  const [question, setQuestion] = useState('');
  const trimmed = question.trim();
  const canSend =
    !disabled &&
    !busy &&
    trimmed !== '' &&
    trimmed.length <= MAX_QUESTION_CHARS;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    onSend(trimmed);
    setQuestion('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className={classes.composer} onSubmit={submit}>
      <Textarea
        variant="unstyled"
        aria-label="Question"
        placeholder={
          disabled
            ? 'Choose what to ask about first'
            : 'Ask a question (Enter to send, Shift+Enter for a new line)'
        }
        value={question}
        autosize
        minRows={2}
        maxRows={10}
        onChange={(event) => setQuestion(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        classNames={{ input: classes.input }}
      />
      <Group justify="space-between" wrap="nowrap">
        <Text
          size="xs"
          c={question.length > MAX_QUESTION_CHARS ? 'red' : 'dimmed'}
        >
          {question.length}/{MAX_QUESTION_CHARS}
        </Text>
        {busy ? (
          <Button
            type="button"
            color="red"
            variant="light"
            leftSection={<IconPlayerStopFilled size={14} />}
            onClick={onStop}
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!canSend}
            rightSection={<IconSend size={16} />}
          >
            Send
          </Button>
        )}
      </Group>
    </form>
  );
}
