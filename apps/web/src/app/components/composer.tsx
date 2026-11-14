import { type FormEvent, type KeyboardEvent, useState } from 'react';

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
    <form className="composer" onSubmit={submit}>
      <textarea
        aria-label="Question"
        placeholder="Ask a question (Enter to send, Shift+Enter for a new line)"
        value={question}
        rows={3}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer__actions">
        <span className="muted">
          {question.length}/{MAX_QUESTION_CHARS}
        </span>
        {busy ? (
          <button type="button" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!canSend}>
            Send
          </button>
        )}
      </div>
    </form>
  );
}
