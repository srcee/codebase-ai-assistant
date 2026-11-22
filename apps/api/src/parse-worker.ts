import { parentPort } from 'node:worker_threads';
import type {
  ParseTaskMessage,
  ParseWorkerMessage,
} from './app/modules/document-ingestion/types/parse-messages';
import { handleParseRequest } from './app/modules/document-ingestion/utils/handle-parse-request';

// Parse worker (decision 0011): parses and chunks one file at a time, with no database, network, inference, or logger.
parentPort?.on('message', (task: ParseTaskMessage) => {
  const reply: ParseWorkerMessage = {
    kind: 'result',
    id: task.id,
    result: handleParseRequest(task.request),
  };
  parentPort?.postMessage(reply);
});

const ready: ParseWorkerMessage = { kind: 'ready' };
parentPort?.postMessage(ready);
