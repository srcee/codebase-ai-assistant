import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { DatabaseService } from '@codebase-ai/server-database';
import {
  createSandbox,
  type Sandbox,
  testConfig,
} from '@codebase-ai/server-testing';
import { faker } from '@codebase-ai/shared-testing';
import { BlobStoreService } from '../../document-ingestion/services/blob-store.service';
import type { UploadRequest } from '../types/upload-request';
import { UploadReceiverService } from './upload-receiver.service';

const BOUNDARY = 'caa-test-boundary';

const field = (name: string, value: string) =>
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
const file = (name: string, content: string) =>
  `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${name}"; filename="upload.bin"\r\nContent-Type: application/octet-stream\r\n\r\n${content}\r\n`;
const end = `--${BOUNDARY}--\r\n`;

const request = (
  body: string,
  contentType = `multipart/form-data; boundary=${BOUNDARY}`,
): UploadRequest =>
  Object.assign(Readable.from([Buffer.from(body)]), {
    headers: { 'content-type': contentType },
  });

describe('UploadReceiverService', () => {
  let box: Sandbox;
  let receiver: UploadReceiverService;

  const tempFiles = () =>
    existsSync(join(box.path, 'tmp')) ? readdirSync(join(box.path, 'tmp')) : [];

  beforeEach(() => {
    box = createSandbox('caa-upload-receiver-');
    const config = testConfig({
      DATA_DIR: box.path,
      DOCUMENT_MAX_BYTES: '1024',
      UPLOAD_MAX_FILES: '2',
    });
    receiver = new UploadReceiverService(
      config,
      new BlobStoreService(config, {} as DatabaseService),
    );
  });

  afterEach(() => box.dispose());

  it('pairs each file with the path field before it', async () => {
    const content = faker.lorem.sentence();
    const parts = await receiver.receive(
      request(
        field('path', 'specs\\roles.md') +
          file('file', content) +
          field('path', 'id_rsa') +
          file('file', 'key') +
          end,
      ),
    );
    expect(parts).toEqual([
      expect.objectContaining({
        kind: 'received',
        logicalPath: 'specs/roles.md',
        mediaType: 'text/markdown',
        blob: expect.objectContaining({ sizeBytes: content.length }),
      }),
      { kind: 'skipped', logicalPath: 'id_rsa', reason: 'secret-filename' },
    ]);
    await receiver.discard(parts);
    expect(tempFiles()).toEqual([]);
  });

  it.each([
    ['a body that is not multipart', request('{}', 'application/json')],
    ['an empty upload', request(end)],
    ['a file without a path', request(file('file', 'x') + end)],
    ['a path without a file', request(field('path', 'a.md') + end)],
    [
      'two paths in a row',
      request(
        field('path', 'a.md') + field('path', 'b.md') + file('file', 'x') + end,
      ),
    ],
    [
      'an unknown field',
      request(field('name', 'a.md') + file('file', 'x') + end),
    ],
    [
      'a file part with another name',
      request(field('path', 'a.md') + file('upload', 'x') + end),
    ],
    [
      'an overlong path field',
      request(
        field('path', `${'a'.repeat(3000)}.md`) + file('file', 'x') + end,
      ),
    ],
  ])('rejects %s with 400', async (_label, body) => {
    await expect(receiver.receive(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tempFiles()).toEqual([]);
  });

  it('rejects more files than allowed and keeps none', async () => {
    const body = ['a', 'b', 'c']
      .map((name) => field('path', `${name}.md`) + file('file', name))
      .join('');
    await expect(receiver.receive(request(body + end))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(tempFiles()).toEqual([]);
  });

  it('keeps no temp file when the body ends mid-file', async () => {
    const truncated =
      field('path', 'a.md') +
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a"\r\n\r\n` +
      faker.lorem.paragraph();
    await expect(receiver.receive(request(truncated))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tempFiles()).toEqual([]);
  });
});
