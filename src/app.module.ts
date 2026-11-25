import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BALANCES_CLIENT, BalancesClient } from './balances/balances.client';
import { DatabaseModule } from './database/database.module';
import { EventsPublisher } from './events/events.publisher';
import { BALANCES_PROTO, PROTO_LOADER_OPTIONS } from './grpc-options';
import { GroupsController } from './groups/groups.controller';
import { GroupsService } from './groups/groups.service';
import { HealthController } from './health/health.controller';
import { SeedService } from './seed/seed.service';
import { UsersService } from './users/users.service';

@Module({
  imports: [
    DatabaseModule,
    // Cliente gRPC de balances-service (consulta de saldo antes de quitar a un miembro)
    ClientsModule.registerAsync([
      {
        name: BALANCES_CLIENT,
        useFactory: () => ({
          transport: Transport.GRPC,
          options: {
            package: 'balances',
            protoPath: BALANCES_PROTO,
            url: process.env.BALANCES_GRPC_URL ?? 'localhost:50052',
            loader: PROTO_LOADER_OPTIONS,
            channelOptions: {
              'grpc.initial_reconnect_backoff_ms': 1000,
              'grpc.max_reconnect_backoff_ms': 5000,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [GroupsController, HealthController],
  providers: [
    GroupsService,
    UsersService,
    BalancesClient,
    EventsPublisher,
    SeedService,
  ],
})
export class AppModule {}
