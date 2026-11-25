import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { type ClientGrpc, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { firstValueFrom, type Observable, timeout } from 'rxjs';

export const BALANCES_CLIENT = 'BALANCES_CLIENT';
const TIMEOUT_MS = 5000;

interface BalancesServiceGrpc {
  getMemberBalance(req: {
    group_id: string;
    user_id: string;
  }): Observable<{ user_id: string; net: number }>;
  registerPayment(req: {
    group_id: string;
    from_user_id: string;
    to_user_id: string;
    amount: number;
    from_name: string;
    to_name: string;
  }): Observable<{ id: string }>;
}

/**
 * Cliente gRPC de balances-service (comunicación entre microservicios):
 * - GetMemberBalance antes de quitar a un miembro.
 * - RegisterPayment solo para cargar el pago de los datos de ejemplo.
 */
@Injectable()
export class BalancesClient implements OnModuleInit {
  private service: BalancesServiceGrpc;

  constructor(@Inject(BALANCES_CLIENT) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.service =
      this.client.getService<BalancesServiceGrpc>('BalancesService');
  }

  async getMemberBalance(groupId: string, userId: string): Promise<number> {
    const res = await call(
      this.service.getMemberBalance({ group_id: groupId, user_id: userId }),
    );
    return res.net;
  }

  async registerPayment(req: {
    group_id: string;
    from_user_id: string;
    to_user_id: string;
    amount: number;
    from_name: string;
    to_name: string;
  }): Promise<string> {
    const res = await call(this.service.registerPayment(req));
    return res.id;
  }
}

async function call<T>(source: Observable<T>): Promise<T> {
  try {
    return await firstValueFrom(source.pipe(timeout(TIMEOUT_MS)));
  } catch {
    throw new RpcException({
      code: status.UNAVAILABLE,
      message: 'No se pudo consultar a balances-service. Intenta de nuevo.',
    });
  }
}
