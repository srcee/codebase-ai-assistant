import { randomUUID } from 'node:crypto';

const SESSION_LIFETIME_MS = 30 * 60 * 1000;

export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  /** Starts a session that lasts thirty minutes without activity. */
  createSession(userId: string, now = Date.now()): Session {
    const session = { id: randomUUID(), userId, expiresAt: now + SESSION_LIFETIME_MS };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string, now = Date.now()): Session {
    const session = this.sessions.get(id);
    if (!session) throw new Error('Unknown session');
    if (session.expiresAt <= now) {
      this.sessions.delete(id);
      throw new Error('Session expired, please sign in again');
    }
    session.expiresAt = now + SESSION_LIFETIME_MS;
    return session;
  }

  expireStaleSessions(now = Date.now()): number {
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
