import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  method: string;
  path: string;
  /** Parsed JSON body, or undefined when the request had none. */
  body: unknown;
}

export type FakeRouteHandler = (
  request: RecordedRequest,
  response: ServerResponse,
) => void | Promise<void>;

export function respondJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

/** Writes each value as one JSON line, pausing between lines so streaming can be observed. */
export async function respondNdjson(
  response: ServerResponse,
  lines: unknown[],
  delayMs = 0,
): Promise<void> {
  await respondLines(
    response,
    lines.map((line) => JSON.stringify(line)),
    delayMs,
  );
}

/** Writes raw lines, so tests can stream any line-based format. */
export async function respondLines(
  response: ServerResponse,
  lines: string[],
  delayMs = 0,
): Promise<void> {
  response.writeHead(200);
  for (const line of lines) {
    response.write(`${line}\n`);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  response.end();
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

/** A scriptable HTTP server on 127.0.0.1 that records requests; unknown routes return 404. */
export class FakeLoopbackServer {
  readonly requests: RecordedRequest[] = [];
  baseUrl = '';
  private readonly handlers = new Map<string, FakeRouteHandler>();
  private readonly server: Server = createServer((request, response) => {
    void this.handle(request, response);
  });

  static async start(): Promise<FakeLoopbackServer> {
    const instance = new FakeLoopbackServer();
    await new Promise<void>((resolve) =>
      instance.server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = instance.server.address() as AddressInfo;
    instance.baseUrl = `http://127.0.0.1:${port}`;
    return instance;
  }

  on(method: 'GET' | 'POST', path: string, handler: FakeRouteHandler): this {
    this.handlers.set(`${method} ${path}`, handler);
    return this;
  }

  requestsTo(path: string): RecordedRequest[] {
    return this.requests.filter((request) => request.path === path);
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const method = request.method ?? 'GET';
    const path = request.url ?? '/';
    const recorded: RecordedRequest = {
      method,
      path,
      body: await readBody(request).catch(() => undefined),
    };
    this.requests.push(recorded);
    const handler = this.handlers.get(`${method} ${path}`);
    if (!handler) {
      respondJson(response, 404, { error: 'not found' });
      return;
    }
    await handler(recorded, response);
  }
}
