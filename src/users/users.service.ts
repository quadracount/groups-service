import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { MongoServerError } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { Database, type UserDoc } from '../database/database.module';
import type { User } from '../groups/proto-types';
import { hashPassword, verifyPassword } from './passwords';
import { normalizeEmail, validateNewUser } from './user-validation';

/** El mismo mensaje si falla el correo o la contraseña, para no revelar qué correos existen. */
const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';

@Injectable()
export class UsersService {
  constructor(private readonly db: Database) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const valid = validateNewUser(input);
    if (typeof valid === 'string') {
      throw new RpcException({ code: status.INVALID_ARGUMENT, message: valid });
    }
    const { hash, salt } = await hashPassword(valid.password);
    const doc: UserDoc = {
      _id: `u-${randomUUID()}`,
      name: valid.name,
      email: valid.email,
      password_hash: hash,
      password_salt: salt,
      created_at: new Date(),
    };
    try {
      await this.db.users.insertOne(doc);
    } catch (err) {
      // Índice único en email (código 11000 = clave duplicada)
      if (err instanceof MongoServerError && err.code === 11000) {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'Ese correo ya está registrado',
        });
      }
      throw err;
    }
    return toUser(doc);
  }

  async verifyCredentials(email: string, password: string): Promise<User> {
    const user = await this.db.users.findOne({ email: normalizeEmail(email) });
    const ok =
      user !== null &&
      (await verifyPassword(password, user.password_hash, user.password_salt));
    if (!user || !ok) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: INVALID_CREDENTIALS,
      });
    }
    return toUser(user);
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.db.users.findOne({ _id: userId });
    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Usuario no encontrado',
      });
    }
    return toUser(user);
  }

  findByEmail(email: string): Promise<UserDoc | null> {
    return this.db.users.findOne({ email: normalizeEmail(email) });
  }
}

export function toUser(doc: UserDoc): User {
  return { id: doc._id, name: doc.name, email: doc.email };
}
