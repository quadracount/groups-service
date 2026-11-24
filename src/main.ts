import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { GROUPS_PROTO, PROTO_LOADER_OPTIONS } from './grpc-options';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'groups',
        protoPath: GROUPS_PROTO,
        url: `0.0.0.0:${process.env.GRPC_PORT ?? '50051'}`,
        loader: PROTO_LOADER_OPTIONS,
      },
    },
  );
  app.enableShutdownHooks();
  await app.listen();
  console.log(
    `groups-service gRPC en el puerto ${process.env.GRPC_PORT ?? '50051'}`,
  );
}
void bootstrap();
