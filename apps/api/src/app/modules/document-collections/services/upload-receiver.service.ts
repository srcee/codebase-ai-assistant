import type { Readable } from 'node:stream';
import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import busboy from 'busboy';
import type { UploadSkipReason } from '@codebase-ai/contracts';
import { APP_CONFIG, type AppConfig } from '@codebase-ai/server-config';
import { BlobStoreService } from '../../document-ingestion/services/blob-store.service';
import { documentFormatFor } from '../../document-ingestion/utils/document-format-for';
import { SECRET_FILENAME_PATTERNS } from '../../ingestion/constants/secret-filename-patterns';
import { createPathMatcher } from '../../ingestion/utils/create-path-matcher';
import type { ReceivedPart } from '../types/received-part';
import type { UploadRequest } from '../types/upload-request';
import { normalizeLogicalPath } from '../utils/normalize-logical-path';

const PATH_FIELD_MAX_BYTES = 2048;

const NOT_MULTIPART = 'Expected a multipart/form-data body.';
const UNPAIRED =
  'Send each file as a "file" part directly after its "path" field.';
const INVALID_PATH =
  'A path must be relative, without "..", drive letters, or control characters.';
const DUPLICATE_PATH = 'The same path appears twice in one upload.';
const MALFORMED = 'The multipart body is malformed or incomplete.';
const NO_FILES = 'The upload contains no files.';

/** Reads `path` + `file` pairs and streams each file to a temp blob; on any error nothing received is kept. */
@Injectable()
export class UploadReceiverService {
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly secretNames = createPathMatcher(SECRET_FILENAME_PATTERNS);

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly blobs: BlobStoreService,
  ) {
    this.maxBytes = config.documents.maxBytes;
    this.maxFiles = config.documents.uploadMaxFiles;
  }

  receive(request: UploadRequest): Promise<ReceivedPart[]> {
    return new Promise((resolve, reject) => {
      let parser: busboy.Busboy;
      try {
        parser = busboy({
          headers: request.headers,
          limits: {
            files: this.maxFiles,
            fields: this.maxFiles,
            // One byte over the limit is enough to tell that a file is too large.
            fileSize: this.maxBytes + 1,
            fieldSize: PATH_FIELD_MAX_BYTES,
          },
        });
      } catch {
        reject(new BadRequestException(NOT_MULTIPART));
        return;
      }

      const parts: Promise<ReceivedPart>[] = [];
      const seen = new Set<string>();
      let pendingPath: string | undefined;
      let failure: Error | undefined;
      let finished = false;
      const fail = (error: Error) => {
        failure ??= error;
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        if (pendingPath !== undefined) fail(new BadRequestException(UNPAIRED));
        this.settle(parts, failure).then(resolve, reject);
      };

      parser.on('field', (name, value, info) => {
        if (
          name !== 'path' ||
          info.valueTruncated ||
          pendingPath !== undefined
        ) {
          fail(new BadRequestException(UNPAIRED));
          return;
        }
        pendingPath = value;
      });
      parser.on('file', (name, stream) => {
        const claimed = claimPath(name, pendingPath, seen);
        pendingPath = undefined;
        if (claimed instanceof Error) fail(claimed);
        if (failure || claimed instanceof Error) {
          stream.resume();
          return;
        }
        parts.push(this.receivePart(claimed, stream));
      });
      const tooMany = () =>
        fail(
          new PayloadTooLargeException(
            `An upload accepts at most ${this.maxFiles} files.`,
          ),
        );
      parser.on('filesLimit', tooMany);
      parser.on('fieldsLimit', tooMany);
      parser.on('error', () => {
        fail(new BadRequestException(MALFORMED));
        finish();
      });
      parser.on('close', finish);
      request.pipe(parser);
    });
  }

  private async receivePart(
    logicalPath: string,
    stream: Readable,
  ): Promise<ReceivedPart> {
    if (this.secretNames.matches(logicalPath, false)) {
      return skip(stream, logicalPath, 'secret-filename');
    }
    const format = documentFormatFor(logicalPath);
    if (!format) return skip(stream, logicalPath, 'unsupported-extension');
    const outcome = await this.blobs.receive(stream, this.maxBytes);
    if (outcome.kind === 'too-large') {
      return { kind: 'skipped', logicalPath, reason: 'too-large' };
    }
    return {
      kind: 'received',
      logicalPath,
      blob: outcome.blob,
      mediaType: format.mediaType,
    };
  }

  private async settle(
    pending: Promise<ReceivedPart>[],
    failure: Error | undefined,
  ): Promise<ReceivedPart[]> {
    const settled = await Promise.allSettled(pending);
    const parts = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const rejected = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    const error: unknown =
      failure ??
      rejected?.reason ??
      (parts.length === 0 ? new BadRequestException(NO_FILES) : undefined);
    if (error) {
      await this.discard(parts);
      throw error;
    }
    return parts;
  }

  async discard(parts: readonly ReceivedPart[]): Promise<void> {
    await Promise.all(
      parts.map((part) =>
        part.kind === 'received' ? this.blobs.discard(part.blob) : undefined,
      ),
    );
  }
}

function claimPath(
  name: string,
  raw: string | undefined,
  seen: Set<string>,
): string | Error {
  if (name !== 'file' || raw === undefined) {
    return new BadRequestException(UNPAIRED);
  }
  const logicalPath = normalizeLogicalPath(raw);
  if (logicalPath === undefined) return new BadRequestException(INVALID_PATH);
  const key = logicalPath.toLowerCase();
  if (seen.has(key)) return new BadRequestException(DUPLICATE_PATH);
  seen.add(key);
  return logicalPath;
}

function skip(
  stream: Readable,
  logicalPath: string,
  reason: UploadSkipReason,
): ReceivedPart {
  stream.resume();
  return { kind: 'skipped', logicalPath, reason };
}
