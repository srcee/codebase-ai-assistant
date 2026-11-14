export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const HINTS: Record<number, string> = {
  503: 'Check that the local inference runtime and the database are running, and that the models are pulled.',
};

/** Nest sends `message` as a string or a list of validation messages. */
export async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}.`;
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string') message = body.message;
    if (Array.isArray(body.message)) message = body.message.join(' ');
  } catch {
    // Keep the generic message when the body is not JSON.
  }
  const hint = HINTS[response.status];
  return new ApiError(response.status, hint ? `${message} ${hint}` : message);
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

export async function deleteResource(path: string): Promise<void> {
  const response = await fetch(`/api${path}`, { method: 'DELETE' });
  if (!response.ok) throw await toApiError(response);
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong.';
