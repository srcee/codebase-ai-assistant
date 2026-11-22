import type { ParseRequest } from './parse-request';
import type { ParseResult } from './parse-result';

/** Sent to a parse worker. */
export interface ParseTaskMessage {
  id: number;
  request: ParseRequest;
}

/** Sent by a parse worker: `ready` once it has loaded, then one `result` per task. */
export type ParseWorkerMessage =
  | { kind: 'ready' }
  | { kind: 'result'; id: number; result: ParseResult };
