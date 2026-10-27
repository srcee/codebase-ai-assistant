import ignore, { type Ignore } from 'ignore';

export interface GitignoreLayer {
  /** Directory of the `.gitignore` relative to the repository root; empty for the root. */
  base: string;
  matcher: Ignore;
}

export function createGitignoreLayer(
  base: string,
  content: string,
): GitignoreLayer {
  return { base, matcher: ignore().add(content) };
}

/** Layers are ordered from the repository root down; deeper rules override shallower ones. */
export function isGitignored(
  layers: readonly GitignoreLayer[],
  relativePath: string,
  isDirectory: boolean,
): boolean {
  let ignored = false;
  for (const layer of layers) {
    if (layer.base && !relativePath.startsWith(`${layer.base}/`)) continue;
    const local = layer.base
      ? relativePath.slice(layer.base.length + 1)
      : relativePath;
    const result = layer.matcher.test(isDirectory ? `${local}/` : local);
    if (result.ignored) ignored = true;
    else if (result.unignored) ignored = false;
  }
  return ignored;
}
