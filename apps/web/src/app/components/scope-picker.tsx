import type { CodebaseResponse, ProjectResponse } from '@codebase-ai/contracts';
import type { ChatScope } from '../types/chat-scope';

interface ScopePickerProps {
  projects: ProjectResponse[];
  codebases: CodebaseResponse[];
  value: ChatScope | null;
  onChange: (scope: ChatScope | null) => void;
}

const encode = (scope: ChatScope): string => `${scope.kind}:${scope.id}`;

function decode(value: string): ChatScope | null {
  const [kind, id] = value.split(':');
  return (kind === 'project' || kind === 'source') && id ? { kind, id } : null;
}

export function ScopePicker({
  projects,
  codebases,
  value,
  onChange,
}: ScopePickerProps) {
  return (
    <label className="field">
      <span>Ask about</span>
      <select
        value={value ? encode(value) : ''}
        onChange={(event) => onChange(decode(event.target.value))}
      >
        <option value="">Choose a project or repository</option>
        {projects.length > 0 && (
          <optgroup label="Projects">
            {projects.map((project) => (
              <option key={project.id} value={`project:${project.id}`}>
                {project.name}
              </option>
            ))}
          </optgroup>
        )}
        {codebases.length > 0 && (
          <optgroup label="Repositories">
            {codebases.map((codebase) => (
              <option key={codebase.id} value={`source:${codebase.id}`}>
                {codebase.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
