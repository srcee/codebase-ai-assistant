import type {
  CodebaseResponse,
  CreateCodebaseRequest,
} from '@codebase-ai/contracts';
import { useState, type FormEvent } from 'react';
import { errorMessage, sendJson } from '../api/http';

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
      className="register"
      aria-label="Register a repository"
      onSubmit={(event) => void submit(event)}
    >
      <label className="field">
        <span>Repository path</span>
        <input
          value={path}
          required
          placeholder="Absolute path inside ALLOWED_REPO_ROOTS"
          onChange={(event) => setPath(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Repository name (optional)</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="submit" disabled={busy || !path.trim()}>
        Register repository
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
