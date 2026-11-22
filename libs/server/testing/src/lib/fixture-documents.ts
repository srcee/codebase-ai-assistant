import { join } from 'node:path';
import { CANARY_SECRET } from '@codebase-ai/shared-testing';
import { type FixtureFiles, writeFiles } from './fixture-repository';
import type { Sandbox } from './sandbox';

export const ROLES_DOCUMENT = [
  '# Roles',
  '',
  'Every user has exactly one role.',
  '',
  '## Reviewer',
  '',
  'A reviewer approves or rejects change requests.',
  '',
  '### Permissions',
  '',
  '| Permission | Reviewer | Admin |',
  '| --- | --- | --- |',
  '| Approve request | yes | yes |',
  '| Delete project | no | yes |',
  '',
].join('\n');

// Fixed content on purpose: specs assert on headings and paths, and faker is unseeded.
export const SAMPLE_DOCUMENTS: Readonly<FixtureFiles> = {
  '.env': `TOKEN=${CANARY_SECRET}\n`,
  '.gitignore': 'drafts/\n',
  'design/mockup.png': Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
  'drafts/plan.md': '# Plan\n\nNot ready.\n',
  'node_modules/tool/readme.md': '# Tool\n',
  'notes/binary.txt': Uint8Array.from([0x41, 0x00, 0x42]),
  'notes/glossary.txt':
    'Change request: a proposed edit to a project.\n\nRelease: a published version.\n',
  'notes/leaked.md': `# Setup\n\nTOKEN=${CANARY_SECRET}\n`,
  'specs/matrix.xlsx': Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
  'specs/roles.md': ROLES_DOCUMENT,
  'specs/workflows.md':
    '# Workflows\n\n## Approval\n\nA change request needs one approval before release.\n',
};

/** Writes the sample documents to `<sandbox root>/<name>` and returns that folder. */
export function buildSampleDocuments(sandbox: Sandbox, name = 'docs'): string {
  const path = join(sandbox.root, name);
  writeFiles(path, SAMPLE_DOCUMENTS);
  return path;
}
