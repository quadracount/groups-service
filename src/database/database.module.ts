import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { type Collection, type Db, MongoClient } from 'mongodb';

export const MONGO_CLIENT = 'MONGO_CLIENT';

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: Date;
}

export interface MemberDoc {
  user_id: string;
  name: string;
  joined_at: Date;
}

export interface GroupDoc {
  _id: string;
  name: string;
  members: MemberDoc[];
  created_at: Date;
}

export interface ShareDoc {
  user_id: string;
  amount: number;
}

export type ExpenseSource = 'MANUAL' | 'ASSISTANT';

export interface ExpenseDoc {
  _id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  shares: ShareDoc[];
  source: ExpenseSource;
  created_at: Date;
}

/** Colecciones de groups_db. Ningún otro servicio lee esta base. */
@Injectable()
export class Database implements OnApplicationShutdown {
  readonly db: Db;
  readonly users: Collection<UserDoc>;
  readonly groups: Collection<GroupDoc>;
  readonly expenses: Collection<ExpenseDoc>;

  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {
    this.db = client.db(process.env.MONGO_DB ?? 'groups_db');
    this.users = this.db.collection<UserDoc>('users');
    this.groups = this.db.collection<GroupDoc>('groups');
    this.expenses = this.db.collection<ExpenseDoc>('expenses');
  }

  async ensureIndexes(): Promise<void> {
    await this.users.createIndex({ email: 1 }, { unique: true });
    await this.groups.createIndex({ 'members.user_id': 1 });
    await this.expenses.createIndex({ group_id: 1, created_at: -1 });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      useFactory: async () => {
        const client = new MongoClient(
          process.env.MONGO_URL ?? 'mongodb://localhost:27017',
        );
        await client.connect();
        return client;
      },
    },
    Database,
  ],
  exports: [Database],
})
export class DatabaseModule {}
