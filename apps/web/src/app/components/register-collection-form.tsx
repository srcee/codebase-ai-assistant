import type {
  CreateDocumentCollectionRequest,
  DocumentCollectionResponse,
  DocumentOrigin,
} from '@codebase-ai/contracts';
import {
  Alert,
  Button,
  Group,
  NativeSelect,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconFolder, IconPlus } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { errorMessage, sendJson } from '../api/http';
import classes from './register-form.module.css';

const ORIGINS: { value: DocumentOrigin; label: string }[] = [
  { value: 'folder', label: 'A local folder' },
  { value: 'upload', label: 'Uploaded files' },
];

interface RegisterCollectionFormProps {
  onRegistered: () => void;
}

export function RegisterCollectionForm({
  onRegistered,
}: RegisterCollectionFormProps) {
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState<DocumentOrigin>('folder');
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() !== '' && (origin === 'upload' || path.trim());

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const body: CreateDocumentCollectionRequest =
        origin === 'folder'
          ? { name: name.trim(), origin, path: path.trim() }
          : { name: name.trim(), origin };
      await sendJson<DocumentCollectionResponse>(
        'POST',
        '/document-collections',
        body,
      );
      setName('');
      setPath('');
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
      aria-label="Add a document collection"
      onSubmit={(event) => void submit(event)}
    >
      <Text fw={600} size="sm" mb="sm">
        Add a document collection
      </Text>
      <Group align="flex-end" gap="sm">
        <TextInput
          label="Collection name"
          value={name}
          required
          withAsterisk={false}
          onChange={(event) => setName(event.currentTarget.value)}
          className={classes.narrow}
        />
        <NativeSelect
          label="Documents come from"
          value={origin}
          onChange={(event) =>
            setOrigin(event.currentTarget.value as DocumentOrigin)
          }
          data={ORIGINS}
          className={classes.narrow}
        />
        {origin === 'folder' && (
          <TextInput
            label="Folder path"
            value={path}
            required
            withAsterisk={false}
            placeholder="Absolute path inside ALLOWED_DOCUMENT_ROOTS"
            leftSection={<IconFolder size={16} />}
            onChange={(event) => setPath(event.currentTarget.value)}
            className={classes.wide}
          />
        )}
        <Button
          type="submit"
          loading={busy}
          disabled={!ready}
          leftSection={<IconPlus size={16} />}
        >
          Add collection
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
