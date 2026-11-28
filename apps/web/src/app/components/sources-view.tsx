import type {
  CodebaseResponse,
  DocumentCollectionResponse,
} from '@codebase-ai/contracts';
import { RegisterCollectionForm } from './register-collection-form';
import { RegisterRepositoryForm } from './register-repository-form';
import { SourceCard } from './source-card';

interface SourcesViewProps {
  codebases: CodebaseResponse[];
  collections: DocumentCollectionResponse[];
  onChanged: () => void;
  onDeleted: (id: string) => void;
}

export function SourcesView({
  codebases,
  collections,
  onChanged,
  onDeleted,
}: SourcesViewProps) {
  return (
    <div className="sources">
      <section aria-labelledby="repositories-heading">
        <h2 id="repositories-heading">Repositories</h2>
        {codebases.length === 0 && (
          <p className="muted">No repositories yet.</p>
        )}
        <ul className="source-list" aria-label="Repositories">
          {codebases.map((codebase) => (
            <SourceCard
              key={codebase.id}
              source={{ kind: 'codebase', id: codebase.id }}
              name={codebase.name}
              relativePath={codebase.relativePath}
              status={codebase.status}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
        <RegisterRepositoryForm onRegistered={onChanged} />
      </section>
      <section aria-labelledby="collections-heading">
        <h2 id="collections-heading">Document collections</h2>
        {collections.length === 0 && (
          <p className="muted">No document collections yet.</p>
        )}
        <ul className="source-list" aria-label="Document collections">
          {collections.map((collection) => (
            <SourceCard
              key={collection.id}
              source={{ kind: 'collection', id: collection.id }}
              name={collection.name}
              relativePath={collection.relativePath}
              status={collection.status}
              origin={collection.origin}
              onChanged={onChanged}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
        <RegisterCollectionForm onRegistered={onChanged} />
      </section>
    </div>
  );
}
