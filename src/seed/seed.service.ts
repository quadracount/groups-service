import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { BalancesClient } from '../balances/balances.client';
import { Database } from '../database/database.module';
import { GroupsService } from '../groups/groups.service';
import type { Share } from '../groups/proto-types';
import { hashPassword } from '../users/passwords';

const DEMO_PASSWORD = 'quadra123';
const SEED_VERSION = 2;
const RETRY_MS = 5000;

const USERS = {
  martin: { _id: 'u-martin', name: 'Martín' },
  camila: { _id: 'u-camila', name: 'Camila' },
  sofia: { _id: 'u-sofia', name: 'Sofía' },
  diego: { _id: 'u-diego', name: 'Diego' },
  valentina: { _id: 'u-valentina', name: 'Valentina' },
  tomas: { _id: 'u-tomas', name: 'Tomás' },
};
type UserKey = keyof typeof USERS;

const GROUPS: { _id: string; name: string; members: UserKey[] }[] = [
  {
    _id: 'g-depto',
    name: 'Depto Los Carrera 1450',
    members: ['martin', 'camila', 'sofia', 'diego'],
  },
  {
    _id: 'g-proyecto',
    name: 'Proyecto Ingeniería de Software',
    members: ['martin', 'valentina', 'tomas'],
  },
  {
    _id: 'g-paseo',
    name: 'Paseo fin de semestre',
    members: ['martin', 'camila', 'sofia', 'diego', 'valentina', 'tomas'],
  },
];

const split = (amounts: Partial<Record<UserKey, number>>): Share[] =>
  Object.entries(amounts).map(([key, amount]) => ({
    user_id: USERS[key as UserKey]._id,
    amount: amount ?? 0,
  }));

// Sección 1 del plan. Resultado esperado en el depto (con el pago de Diego):
// Martín +12.000, Camila +1.000, Sofía −5.000, Diego −8.000.
const EXPENSES = [
  {
    id: 'e-seed-mercaderia',
    group_id: 'g-depto',
    description: 'Mercadería y útiles de aseo',
    amount: 45000,
    paid_by: 'u-martin',
    source: 'ASSISTANT',
    created_at: '2026-11-06T18:20:00Z',
    shares: split({ martin: 12500, camila: 12500, sofia: 12500, diego: 7500 }),
  },
  {
    id: 'e-seed-internet',
    group_id: 'g-depto',
    description: 'Internet noviembre',
    amount: 24000,
    paid_by: 'u-camila',
    source: 'MANUAL',
    created_at: '2026-11-07T21:05:00Z',
    shares: split({ martin: 6000, camila: 6000, sofia: 6000, diego: 6000 }),
  },
  {
    id: 'e-seed-gas',
    group_id: 'g-depto',
    description: 'Gas',
    amount: 18000,
    paid_by: 'u-sofia',
    source: 'MANUAL',
    created_at: '2026-11-09T13:40:00Z',
    shares: split({ martin: 4500, camila: 4500, sofia: 4500, diego: 4500 }),
  },
  {
    id: 'e-seed-impresion',
    group_id: 'g-proyecto',
    description: 'Impresión del informe',
    amount: 10500,
    paid_by: 'u-valentina',
    source: 'MANUAL',
    created_at: '2026-11-12T16:00:00Z',
    shares: split({ martin: 3500, valentina: 3500, tomas: 3500 }),
  },
];

const PAYMENT = {
  group_id: 'g-depto',
  from_user_id: 'u-diego',
  to_user_id: 'u-martin',
  amount: 10000,
  from_name: 'Diego',
  to_name: 'Martín',
};

interface SeedState {
  _id: string;
  version: number;
  payment_done: boolean;
}

/**
 * Crea los índices y, con SEED_DEMO=true, los datos de ejemplo del plan:
 * 6 usuarios (contraseña quadra123), 3 grupos, 4 gastos y el pago de Diego.
 *
 * Los gastos pasan por GroupsService.createExpense, así que publican gasto.creado
 * y balances y activity se enteran como con cualquier gasto. El pago se registra
 * en balances-service por gRPC. Todo es idempotente (ids fijos y seed_state).
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly db: Database,
    private readonly groups: GroupsService,
    private readonly balances: BalancesClient,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.db.ensureIndexes();
    if (process.env.SEED_DEMO !== 'true') return;
    // En segundo plano: el pago necesita a balances-service, que puede tardar en estar listo
    void this.runWithRetries();
  }

  private async runWithRetries(): Promise<void> {
    for (;;) {
      try {
        await this.seed();
        return;
      } catch (err) {
        this.logger.warn(
          `Datos de ejemplo incompletos (${String(err)}); reintento en ${RETRY_MS / 1000} s`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
      }
    }
  }

  private async seed(): Promise<void> {
    const states = this.db.db.collection<SeedState>('seed_state');
    const state = await states.findOne({ _id: 'demo' });
    if (state && state.version >= SEED_VERSION && state.payment_done) return;

    const now = new Date();
    for (const user of Object.values(USERS)) {
      if (await this.db.users.findOne({ _id: user._id })) continue;
      const { hash, salt } = await hashPassword(DEMO_PASSWORD);
      const email = `${user._id.slice(2)}@quadracount.dev`;
      await this.db.users.insertOne({
        ...user,
        email,
        password_hash: hash,
        password_salt: salt,
        created_at: now,
      });
    }

    for (const group of GROUPS) {
      await this.db.groups.updateOne(
        { _id: group._id },
        {
          $setOnInsert: {
            name: group.name,
            members: group.members.map((key) => ({
              user_id: USERS[key]._id,
              name: USERS[key].name,
              joined_at: new Date('2026-11-01T12:00:00Z'),
            })),
            created_at: new Date('2026-11-01T12:00:00Z'),
          },
        },
        { upsert: true },
      );
    }

    for (const { id, created_at, ...expense } of EXPENSES) {
      if (await this.db.expenses.findOne({ _id: id })) continue;
      await this.groups.createExpense(
        { ...expense, requester_id: expense.paid_by },
        { id, createdAt: new Date(created_at) },
      );
    }

    if (!state?.payment_done) {
      await this.balances.registerPayment(PAYMENT);
      await states.updateOne(
        { _id: 'demo' },
        { $set: { version: SEED_VERSION, payment_done: true } },
        { upsert: true },
      );
    }
    this.logger.log('Datos de ejemplo listos');
  }
}
