import type {
  CodebaseResponse,
  DocumentCollectionResponse,
  ProjectResponse,
} from '@codebase-ai/contracts';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage, getJson } from '../api/http';

export function useScopes() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [codebases, setCodebases] = useState<CodebaseResponse[]>([]);
  const [collections, setCollections] = useState<DocumentCollectionResponse[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [loadedProjects, loadedCodebases, loadedCollections] =
        await Promise.all([
          getJson<ProjectResponse[]>('/projects'),
          getJson<CodebaseResponse[]>('/codebases'),
          getJson<DocumentCollectionResponse[]>('/document-collections'),
        ]);
      setProjects(loadedProjects);
      setCodebases(loadedCodebases);
      setCollections(loadedCollections);
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { projects, codebases, collections, error, reload };
}
