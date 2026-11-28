import type { Readable } from 'node:stream';
import type { BusboyConfig } from 'busboy';

/** The raw request body and its headers; multipart parsing needs nothing else. */
export interface UploadRequest extends Readable {
  headers: BusboyConfig['headers'];
}
