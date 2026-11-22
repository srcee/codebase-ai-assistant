import { parentPort } from 'node:worker_threads';
import type {
  ParseTaskMessage,
  ParseWorkerMessage,
} from '../app/modules/document-ingestion/types/parse-messages';
import { handleParseRequest } from '../app/modules/document-ingestion/utils/handle-parse-request';
import { PARSE_WORKER_MARKERS } from './parse-worker-fixtures';

parentPort?.on('message', (task: ParseTaskMessage) => {
  const text = new TextDecoder().decode(task.request.bytes);
  if (text.includes(PARSE_WORKER_MARKERS.hang)) return;
  if (text.includes(PARSE_WORKER_MARKERS.exit)) process.exit(1);
  if (text.includes(PARSE_WORKER_MARKERS.throw)) {
    throw new Error('Fixture parse worker failure');
  }
  const reply: ParseWorkerMessage = {
    kind: 'result',
    id: task.id,
    result: handleParseRequest(task.request),
  };
  parentPort?.postMessage(reply);
});

const ready: ParseWorkerMessage = { kind: 'ready' };
parentPort?.postMessage(ready);
