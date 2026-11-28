import type { ConversationSummary } from '@codebase-ai/contracts';
import {
  Alert,
  AppShell,
  Burger,
  Button,
  Container,
  Divider,
  Group,
  NavLink,
  Stack,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconDatabase,
  IconMessageCircle,
  IconPlus,
  IconSparkles,
} from '@tabler/icons-react';
import { useState } from 'react';
import classes from './app.module.css';
import { Composer } from './components/composer';
import { ConversationList } from './components/conversation-list';
import { HealthProblems, HealthStatus } from './components/health-banner';
import { MessageList } from './components/message-list';
import { ScopePicker } from './components/scope-picker';
import { SourcesView } from './components/sources-view';
import { ThemeControls } from './components/theme-controls';
import { useChat } from './hooks/use-chat';
import { useConversations } from './hooks/use-conversations';
import { useHealth } from './hooks/use-health';
import { useScopes } from './hooks/use-scopes';
import type { ChatScope } from './types/chat-scope';

type View = 'chat' | 'sources';

const VIEWS: { id: View; label: string; Icon: typeof IconDatabase }[] = [
  { id: 'chat', label: 'Chat', Icon: IconMessageCircle },
  { id: 'sources', label: 'Sources', Icon: IconDatabase },
];

export function App() {
  const health = useHealth();
  const scopes = useScopes();
  const conversations = useConversations();
  const chat = useChat(conversations.refresh);
  const [scope, setScope] = useState<ChatScope | null>(null);
  const [view, setView] = useState<View>('chat');
  const [navOpened, nav] = useDisclosure(false);

  const openConversation = (conversation: ConversationSummary) => {
    if (conversation.projectId) {
      setScope({ kind: 'project', id: conversation.projectId });
    }
    void chat.open(conversation.id);
    nav.close();
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
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !navOpened },
      }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={navOpened}
              onClick={nav.toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <ThemeIcon size="lg" variant="light" aria-hidden>
              <IconSparkles size={20} />
            </ThemeIcon>
            <Title order={1} size="h4" visibleFrom="xs">
              Codebase AI Assistant
            </Title>
          </Group>
          <Group gap="md" wrap="nowrap">
            <HealthStatus state={health} />
            <ThemeControls />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section component="nav" aria-label="Views">
          <Stack gap={4}>
            {VIEWS.map(({ id, label, Icon }) => (
              <NavLink
                key={id}
                component="button"
                type="button"
                label={label}
                leftSection={<Icon size={18} stroke={1.6} />}
                active={view === id}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => {
                  setView(id);
                  nav.close();
                }}
                className={classes.navLink}
              />
            ))}
          </Stack>
        </AppShell.Section>
        {view === 'chat' && (
          <>
            <AppShell.Section mt="lg">
              <Stack gap="sm">
                <ScopePicker
                  projects={scopes.projects}
                  codebases={scopes.codebases}
                  collections={scopes.collections}
                  value={scope}
                  onChange={setScope}
                />
                <Button
                  variant="light"
                  leftSection={<IconPlus size={16} />}
                  onClick={chat.reset}
                  disabled={chat.busy}
                  fullWidth
                >
                  New chat
                </Button>
              </Stack>
            </AppShell.Section>
            <Divider my="md" label="Conversations" labelPosition="left" />
            <AppShell.Section grow className={classes.navScroll}>
              <ConversationList
                items={conversations.items}
                activeId={chat.conversationId}
                hasMore={conversations.hasMore}
                onOpen={openConversation}
                onDelete={deleteConversation}
                onLoadMore={conversations.loadMore}
              />
            </AppShell.Section>
          </>
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        {view === 'sources' ? (
          <Container size="lg" py="lg">
            <Stack gap="lg">
              <HealthProblems state={health} />
              {scopes.error && (
                <Alert role="alert" color="red" icon={<IconAlertCircle />}>
                  {scopes.error}
                </Alert>
              )}
              <SourcesView
                codebases={scopes.codebases}
                collections={scopes.collections}
                onChanged={scopes.reload}
                onDeleted={deleteSource}
              />
            </Stack>
          </Container>
        ) : (
          <div className={classes.chat}>
            <div className={classes.chatScroll}>
              <div className={classes.chatColumn}>
                <HealthProblems state={health} />
                <MessageList items={chat.items} />
              </div>
            </div>
            <div className={classes.chatFooter}>
              <div className={classes.chatColumn}>
                {error && (
                  <Alert
                    role="alert"
                    color="red"
                    icon={<IconAlertCircle />}
                    mb="sm"
                  >
                    {error}
                  </Alert>
                )}
                <Composer
                  disabled={scope === null}
                  busy={chat.busy}
                  onSend={(question) =>
                    scope && void chat.send(question, scope)
                  }
                  onStop={chat.stop}
                />
              </div>
            </div>
          </div>
        )}
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
