import type {
  CodebaseResponse,
  DocumentCollectionResponse,
  ProjectResponse,
} from '@codebase-ai/contracts';
import { useEffect, useState } from 'react';
import { errorMessage, getJson } from '../api/http';

export function useScopes() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [codebases, setCodebases] = useState<CodebaseResponse[]>([]);
  const [collections, setCollections] = useState<DocumentCollectionResponse[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<ProjectResponse[]>('/projects'),
      getJson<CodebaseResponse[]>('/codebases'),
      getJson<DocumentCollectionResponse[]>('/document-collections'),
    ])
      .then(([loadedProjects, loadedCodebases, loadedCollections]) => {
        if (cancelled) return;
        setProjects(loadedProjects);
        setCodebases(loadedCodebases);
        setCollections(loadedCollections);
      })
      .catch((caught: unknown) => !cancelled && setError(errorMessage(caught)));
    return () => {
      cancelled = true;
    };
  }, []);

  return { projects, codebases, collections, error };
}
