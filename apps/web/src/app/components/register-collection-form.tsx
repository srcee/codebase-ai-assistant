import type {
  CreateDocumentCollectionRequest,
  DocumentCollectionResponse,
  DocumentOrigin,
} from '@codebase-ai/contracts';
import { useState, type FormEvent } from 'react';
import { errorMessage, sendJson } from '../api/http';

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
      className="register"
      aria-label="Add a document collection"
      onSubmit={(event) => void submit(event)}
    >
      <label className="field">
        <span>Collection name</span>
        <input
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Documents come from</span>
        <select
          value={origin}
          onChange={(event) => setOrigin(event.target.value as DocumentOrigin)}
        >
          <option value="folder">A local folder</option>
          <option value="upload">Uploaded files</option>
        </select>
      </label>
      {origin === 'folder' && (
        <label className="field">
          <span>Folder path</span>
          <input
            value={path}
            required
            placeholder="Absolute path inside ALLOWED_DOCUMENT_ROOTS"
            onChange={(event) => setPath(event.target.value)}
          />
        </label>
      )}
      <button type="submit" disabled={busy || !ready}>
        Add collection
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
