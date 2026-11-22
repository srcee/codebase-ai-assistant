/** Injection token for the script the parsing pool starts; specs swap in fixture workers. */
export const PARSE_WORKER_ENTRY = Symbol('PARSE_WORKER_ENTRY');

export interface ParseWorkerEntry {
  /** A script path, or source code when `eval` is set. */
  filename: string;
  eval: boolean;
}
