import type { UploadDocumentsResponse } from '@codebase-ai/contracts';
import { toApiError } from './http';

const logicalPathOf = (file: File): string =>
  file.webkitRelativePath || file.name;

/** Uses XMLHttpRequest because fetch cannot report upload progress. */
export function uploadDocuments(
  collectionId: string,
  files: readonly File[],
  onProgress: (fraction: number) => void,
): Promise<UploadDocumentsResponse> {
  const form = new FormData();
  for (const file of files) {
    // The API pairs each file with the path field sent right before it.
    form.append('path', logicalPathOf(file));
    form.append('file', file);
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api/document-collections/${collectionId}/documents`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const response = new Response(request.responseText, {
        status: request.status,
      });
      if (response.ok) {
        response.json().then(resolve, reject);
      } else {
        toApiError(response).then(reject, reject);
      }
    };
    request.onerror = () =>
      reject(new Error('The upload stopped before the API answered.'));
    request.send(form);
  });
}
