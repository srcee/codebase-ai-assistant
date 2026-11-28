import type { ConversationSummary } from '@codebase-ai/contracts';
import { useState } from 'react';
import { Composer } from './components/composer';
import { ConversationList } from './components/conversation-list';
import { HealthBanner } from './components/health-banner';
import { MessageList } from './components/message-list';
import { ScopePicker } from './components/scope-picker';
import { SourcesView } from './components/sources-view';
import { useChat } from './hooks/use-chat';
import { useConversations } from './hooks/use-conversations';
import { useHealth } from './hooks/use-health';
import { useScopes } from './hooks/use-scopes';
import type { ChatScope } from './types/chat-scope';

type View = 'chat' | 'sources';

const VIEWS: { id: View; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'sources', label: 'Sources' },
];

export function App() {
  const health = useHealth();
  const scopes = useScopes();
  const conversations = useConversations();
  const chat = useChat(conversations.refresh);
  const [scope, setScope] = useState<ChatScope | null>(null);
  const [view, setView] = useState<View>('chat');

  const openConversation = (conversation: ConversationSummary) => {
    if (conversation.projectId) {
      setScope({ kind: 'project', id: conversation.projectId });
    }
    void chat.open(conversation.id);
  };

  const deleteConversation = (id: string) => {
    if (id === chat.conversationId) chat.reset();
    void conversations.remove(id);
  };

  const deleteSource = (id: string) => {
    if (scope?.kind === 'source' && scope.id === id) setScope(null);
    void scopes.reload();
  };

  const error = chat.error ?? scopes.error ?? conversations.error;

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Codebase AI Assistant</h1>
        <HealthBanner state={health} />
        <nav aria-label="Views" className="views">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {view === 'chat' && (
          <>
            <ScopePicker
              projects={scopes.projects}
              codebases={scopes.codebases}
              collections={scopes.collections}
              value={scope}
              onChange={setScope}
            />
            <button type="button" onClick={chat.reset} disabled={chat.busy}>
              New chat
            </button>
            <ConversationList
              items={conversations.items}
              activeId={chat.conversationId}
              hasMore={conversations.hasMore}
              onOpen={openConversation}
              onDelete={deleteConversation}
              onLoadMore={conversations.loadMore}
            />
          </>
        )}
      </aside>
      {view === 'sources' ? (
        <main className="page">
          {scopes.error && (
            <p role="alert" className="error">
              {scopes.error}
            </p>
          )}
          <SourcesView
            codebases={scopes.codebases}
            collections={scopes.collections}
            onChanged={scopes.reload}
            onDeleted={deleteSource}
          />
        </main>
      ) : (
        <main className="chat">
          <MessageList items={chat.items} />
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Composer
            disabled={scope === null}
            busy={chat.busy}
            onSend={(question) => scope && void chat.send(question, scope)}
            onStop={chat.stop}
          />
        </main>
      )}
    </div>
  );
}

export default App;
