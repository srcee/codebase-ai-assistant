/** Sends through the stubbed fetch so `mockApi` routes answer uploads too. */
export class FakeXhr {
  status = 0;
  responseText = '';
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private method = 'GET';
  private url = '';

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  send(body: FormData): void {
    fetch(this.url, { method: this.method, body }).then(
      async (response) => {
        this.upload.onprogress?.(
          new ProgressEvent('progress', {
            lengthComputable: true,
            loaded: 1,
            total: 1,
          }),
        );
        this.status = response.status;
        this.responseText = await response.text();
        this.onload?.();
      },
      () => this.onerror?.(),
    );
  }
}
