const MAX_QUEUE_LENGTH = 500;

interface QueuedMail {
  to: string;
  subject: string;
  body: string;
}

const outbox: QueuedMail[] = [];

export async function sendWelcomeEmail(to: string): Promise<void> {
  enqueue({
    to,
    subject: 'Welcome to Harbor Shop',
    body: 'Your account is ready. Happy shopping!',
  });
}

export async function sendReceiptEmail(
  to: string,
  orderId: string,
  totalCents: number,
): Promise<void> {
  const total = (totalCents / 100).toFixed(2);
  enqueue({
    to,
    subject: `Receipt for order ${orderId}`,
    body: `Thank you. We charged ${total} to your card.`,
  });
}

function enqueue(mail: QueuedMail): void {
  if (outbox.length >= MAX_QUEUE_LENGTH) {
    throw new Error('Mail queue is full');
  }
  outbox.push(mail);
}

export function drainOutbox(): QueuedMail[] {
  return outbox.splice(0, outbox.length);
}
