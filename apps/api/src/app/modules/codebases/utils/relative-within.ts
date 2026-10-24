import { isAbsolute, relative, sep } from 'node:path';

/** Forward-slash path of `target` below `root` ('.' for the root itself), or null if outside. */
export function relativeWithin(root: string, target: string): string | null {
  const relation = relative(root, target);
  if (relation === '') return '.';
  if (
    relation === '..' ||
    relation.startsWith(`..${sep}`) ||
    isAbsolute(relation)
  ) {
    return null;
  }
  return relation.split(sep).join('/');
}

export function relativeToAnyRoot(
  roots: readonly string[],
  target: string,
): string | null {
  for (const root of roots) {
    const relation = relativeWithin(root, target);
    if (relation !== null) return relation;
  }
  return null;
}
