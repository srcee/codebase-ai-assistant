import type { HostPathMapping } from '@codebase-ai/server-config';

const WINDOWS_DRIVE_PATH = /^[a-z]:[\\/]/i;

function segments(path: string, windowsStyle: boolean): string[] {
  return path.split(windowsStyle ? /[\\/]+/ : /\/+/).filter(Boolean);
}

/** Rewrites a host path under the mapped prefix to its container path; the result still passes every policy check. */
export function mapHostPath(input: string, mapping?: HostPathMapping): string {
  if (!mapping) return input;
  const windowsStyle = WINDOWS_DRIVE_PATH.test(mapping.hostPrefix);
  if (windowsStyle ? !WINDOWS_DRIVE_PATH.test(input) : !input.startsWith('/')) {
    return input;
  }

  const prefix = segments(mapping.hostPrefix, windowsStyle);
  const parts = segments(input, windowsStyle);
  const same = (left: string, right: string) =>
    windowsStyle ? left.toLowerCase() === right.toLowerCase() : left === right;
  if (
    parts.length < prefix.length ||
    !prefix.every((segment, index) => same(segment, parts[index]))
  ) {
    return input;
  }

  const containerPrefix = mapping.containerPrefix.replace(/\/+$/, '');
  const rest = parts.slice(prefix.length);
  return rest.length > 0
    ? `${containerPrefix}/${rest.join('/')}`
    : containerPrefix || '/';
}

/** A Windows host path outside the mapped prefix, which the container cannot reach. */
export function isUnmappedHostPath(
  input: string,
  mapping?: HostPathMapping,
): boolean {
  return (
    mapping !== undefined &&
    WINDOWS_DRIVE_PATH.test(mapping.hostPrefix) &&
    WINDOWS_DRIVE_PATH.test(input) &&
    !segments(input, true).includes('..') &&
    mapHostPath(input, mapping) === input
  );
}
