import type {
  CodebaseResponse,
  CreateCodebaseRequest,
} from '@codebase-ai/contracts';
import { Alert, Button, Group, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconFolder, IconPlus } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { errorMessage, sendJson } from '../api/http';
import classes from './register-form.module.css';

interface RegisterRepositoryFormProps {
  onRegistered: () => void;
}

export function RegisterRepositoryForm({
  onRegistered,
}: RegisterRepositoryFormProps) {
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const body: CreateCodebaseRequest = name.trim()
        ? { path: path.trim(), name: name.trim() }
        : { path: path.trim() };
      await sendJson<CodebaseResponse>('POST', '/codebases', body);
      setPath('');
      setName('');
      setError(null);
      onRegistered();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      aria-label="Register a repository"
      onSubmit={(event) => void submit(event)}
    >
      <Text fw={600} size="sm" mb="sm">
        Register a repository
      </Text>
      <Group align="flex-end" gap="sm">
        <TextInput
          label="Repository path"
          value={path}
          required
          withAsterisk={false}
          placeholder="Absolute path inside ALLOWED_REPO_ROOTS"
          leftSection={<IconFolder size={16} />}
          onChange={(event) => setPath(event.currentTarget.value)}
          className={classes.wide}
        />
        <TextInput
          label="Repository name (optional)"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          className={classes.narrow}
        />
        <Button
          type="submit"
          loading={busy}
          disabled={!path.trim()}
          leftSection={<IconPlus size={16} />}
        >
          Register repository
        </Button>
      </Group>
      {error && (
        <Alert role="alert" color="red" mt="sm" icon={<IconAlertCircle />}>
          {error}
        </Alert>
      )}
    </form>
  );
}
