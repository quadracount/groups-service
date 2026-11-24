import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Database } from '../database/database.module';
import { hashPassword } from '../users/passwords';

const DEMO_PASSWORD = 'quadra123';

const DEMO_USERS = [
  { _id: 'u-martin', name: 'Martín', email: 'martin@quadracount.dev' },
  { _id: 'u-camila', name: 'Camila', email: 'camila@quadracount.dev' },
  { _id: 'u-sofia', name: 'Sofía', email: 'sofia@quadracount.dev' },
  { _id: 'u-diego', name: 'Diego', email: 'diego@quadracount.dev' },
];

const DEMO_GROUP = { _id: 'g-depto', name: 'Depto Los Carrera 1450' };

/**
 * Crea los índices y, con SEED_DEMO=true, los usuarios y el grupo de ejemplo.
 * Por ahora sin gastos: se crean por GraphQL para que pasen por los eventos.
 * Es idempotente: no toca lo que ya existe.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.db.ensureIndexes();
    if (process.env.SEED_DEMO !== 'true') return;

    const now = new Date();
    for (const user of DEMO_USERS) {
      if (await this.db.users.findOne({ _id: user._id })) continue;
      const { hash, salt } = await hashPassword(DEMO_PASSWORD);
      await this.db.users.insertOne({
        ...user,
        password_hash: hash,
        password_salt: salt,
        created_at: now,
      });
    }

    await this.db.groups.updateOne(
      { _id: DEMO_GROUP._id },
      {
        $setOnInsert: {
          name: DEMO_GROUP.name,
          members: DEMO_USERS.map((u) => ({
            user_id: u._id,
            name: u.name,
            joined_at: now,
          })),
          created_at: now,
        },
      },
      { upsert: true },
    );
    this.logger.log('Datos de ejemplo listos');
  }
}
