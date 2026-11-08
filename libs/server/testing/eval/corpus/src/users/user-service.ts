import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password-hasher';
import { ValidationError } from '../errors/app-errors';
import { sendWelcomeEmail } from '../notifications/email-sender';
import { UserRepository, type UserRecord } from './user-repository';

const MIN_PASSWORD_LENGTH = 12;

export class UserService {
  constructor(private readonly users: UserRepository) {}

  /** Creates an account, stores only the password hash and greets the new customer. */
  async registerUser(email: string, plainPassword: string): Promise<UserRecord> {
    if (!email.includes('@')) {
      throw new ValidationError('Email address is not valid', 'email');
    }
    if (plainPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError('Password is too short', 'password');
    }
    const user: UserRecord = {
      id: randomUUID(),
      email,
      passwordHash: hashPassword(plainPassword),
      createdAt: Date.now(),
    };
    this.users.save(user);
    await sendWelcomeEmail(user.email);
    return user;
  }
}
