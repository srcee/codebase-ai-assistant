import type {
  CodebaseResponse,
  DocumentCollectionResponse,
  ProjectResponse,
} from '@codebase-ai/contracts';
import { NativeSelect } from '@mantine/core';
import { IconTarget } from '@tabler/icons-react';
import type { ChatScope } from '../types/chat-scope';

interface ScopePickerProps {
  projects: ProjectResponse[];
  codebases: CodebaseResponse[];
  collections: DocumentCollectionResponse[];
  value: ChatScope | null;
  onChange: (scope: ChatScope | null) => void;
}

interface Option {
  value: string;
  label: string;
}

const encode = (scope: ChatScope): string => `${scope.kind}:${scope.id}`;

const option =
  (kind: ChatScope['kind']) =>
  (item: { id: string; name: string }): Option => ({
    value: encode({ kind, id: item.id }),
    label: item.name,
  });

function decode(value: string): ChatScope | null {
  const [kind, id] = value.split(':');
  return (kind === 'project' || kind === 'source') && id ? { kind, id } : null;
}

export function ScopePicker({
  projects,
  codebases,
  collections,
  value,
  onChange,
}: ScopePickerProps) {
  const groups: { group: string; items: Option[] }[] = [
    { group: 'Projects', items: projects.map(option('project')) },
    { group: 'Repositories', items: codebases.map(option('source')) },
    { group: 'Document collections', items: collections.map(option('source')) },
  ].filter((group) => group.items.length > 0);

  return (
    <NativeSelect
      label="Ask about"
      leftSection={<IconTarget size={16} />}
      value={value ? encode(value) : ''}
      onChange={(event) => onChange(decode(event.currentTarget.value))}
      data={[
        { value: '', label: 'Choose a project, repository, or collection' },
        ...groups,
      ]}
    />
  );
}
