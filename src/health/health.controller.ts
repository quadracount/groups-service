import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

/**
 * grpc.health.v1.Health/Check, para los probes gRPC de Kubernetes.
 * Si el proceso responde es porque Nest ya conectó MongoDB al arrancar.
 * Watch no se implementa (Kubernetes no lo usa).
 */
@Controller()
export class HealthController {
  @GrpcMethod('Health', 'Check')
  check(): { status: string } {
    return { status: 'SERVING' };
  }
}
