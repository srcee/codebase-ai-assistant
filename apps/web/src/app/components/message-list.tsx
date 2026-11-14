import type { ChatItem } from '../hooks/use-chat';
import { formatLocator } from '../utils/format-locator';

function Message({ item }: { item: ChatItem }) {
  return (
    <li className={`message message--${item.role} message--${item.state}`}>
      <div className="message__content">
        {item.content || (item.state === 'streaming' ? 'Thinking…' : '')}
      </div>
      {item.state === 'stopped' && <p className="muted">Stopped.</p>}
      {item.state === 'abstained' && item.suggestions.length > 0 && (
        <ul className="suggestions" aria-label="Suggestions">
          {item.suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      )}
      {item.citations.length > 0 && (
        <ol className="citations" aria-label="Citations">
          {item.citations.map((citation) => (
            <li key={citation.ordinal} className="citation">
              <span className="citation__number">[{citation.ordinal}]</span>{' '}
              {citation.sourceName} · {citation.relativePath} ·{' '}
              {formatLocator(citation.locator)}
            </li>
          ))}
        </ol>
      )}
      {item.invalidCitations.length > 0 && (
        <p className="muted">
          Removed {item.invalidCitations.length} citation
          {item.invalidCitations.length === 1 ? '' : 's'} that did not match the
          retrieved evidence.
        </p>
      )}
    </li>
  );
}

export function MessageList({ items }: { items: ChatItem[] }) {
  if (items.length === 0) {
    return (
      <p className="muted empty">
        Choose a project or repository and ask a question about it.
      </p>
    );
  }
  return (
    <ol className="messages" aria-live="polite">
      {items.map((item) => (
        <Message key={item.id} item={item} />
      ))}
    </ol>
  );
}
