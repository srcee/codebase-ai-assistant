import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function evalRoot(start = __dirname): string {
  let directory = start;
  for (;;) {
    if (existsSync(join(directory, 'nx.json'))) {
      return join(directory, 'libs', 'server', 'testing', 'eval');
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Workspace root not found');
    directory = parent;
  }
}
