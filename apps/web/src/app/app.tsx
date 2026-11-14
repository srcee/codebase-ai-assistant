import type { ConversationSummary } from '@codebase-ai/contracts';
import { useState } from 'react';
import { Composer } from './components/composer';
import { ConversationList } from './components/conversation-list';
import { HealthBanner } from './components/health-banner';
import { MessageList } from './components/message-list';
import { ScopePicker } from './components/scope-picker';
import { useChat } from './hooks/use-chat';
import { useConversations } from './hooks/use-conversations';
import { useHealth } from './hooks/use-health';
import { useScopes } from './hooks/use-scopes';
import type { ChatScope } from './types/chat-scope';

export function App() {
  const health = useHealth();
  const scopes = useScopes();
  const conversations = useConversations();
  const chat = useChat(conversations.refresh);
  const [scope, setScope] = useState<ChatScope | null>(null);

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

  const error = chat.error ?? scopes.error ?? conversations.error;

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Codebase AI Assistant</h1>
        <HealthBanner state={health} />
        <ScopePicker
          projects={scopes.projects}
          codebases={scopes.codebases}
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
      </aside>
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
    </div>
  );
}

export default App;
