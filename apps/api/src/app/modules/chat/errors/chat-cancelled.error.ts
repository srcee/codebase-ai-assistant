/** Abort reason when the client closes the connection. */
export class ChatCancelledError extends Error {
  constructor() {
    super('The client closed the chat request');
    this.name = 'ChatCancelledError';
  }
}
