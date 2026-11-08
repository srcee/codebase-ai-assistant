export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

export class UserRepository {
  private readonly byEmail = new Map<string, UserRecord>();

  findByEmail(email: string): UserRecord | undefined {
    return this.byEmail.get(email.trim().toLowerCase());
  }

  /** Stores a new account; email addresses are unique regardless of case. */
  save(user: UserRecord): void {
    const key = user.email.trim().toLowerCase();
    if (this.byEmail.has(key)) {
      throw new Error('User already exists');
    }
    this.byEmail.set(key, { ...user, email: key });
  }

  count(): number {
    return this.byEmail.size;
  }
}
