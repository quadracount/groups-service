import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { randomUUID } from 'node:crypto';

export const EVENTS_EXCHANGE = 'quadracount.events';

/**
 * Declara el exchange y las colas de TODOS los consumidores con sus bindings.
 * Lo hacen los que publican (este servicio y balances-service), no solo los
 * consumidores: un evento que llega a un exchange sin colas enlazadas se descarta,
 * así que las colas tienen que existir antes del primer evento aunque el
 * consumidor todavía no haya arrancado.
 */
async function declareTopology(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue('balances.events', { durable: true });
  await channel.bindQueue('balances.events', EVENTS_EXCHANGE, 'gasto.creado');
  await channel.assertQueue('activity.events', { durable: true });
  await channel.bindQueue('activity.events', EVENTS_EXCHANGE, '#');
}

export type EventType =
  'gasto.creado' | 'miembro.agregado' | 'miembro.eliminado';

/**
 * Publica eventos en el exchange topic quadracount.events con amqplib
 * (el transporte RMQ de Nest usa su propio formato de mensajes).
 * amqp-connection-manager reconecta solo y guarda en memoria lo que se publique
 * mientras RabbitMQ no está disponible.
 */
@Injectable()
export class EventsPublisher implements OnApplicationShutdown {
  private readonly logger = new Logger(EventsPublisher.name);
  private readonly connection = amqp.connect([
    process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
  ]);
  private readonly channel = this.connection.createChannel({
    json: false,
    setup: declareTopology,
  });

  constructor() {
    this.connection.on('connect', () =>
      this.logger.log('Conectado a RabbitMQ'),
    );
    this.connection.on('disconnect', ({ err }) =>
      this.logger.warn(`Desconectado de RabbitMQ: ${err?.message}`),
    );
  }

  /**
   * No espera la confirmación de RabbitMQ: si está caído, el mensaje queda en
   * memoria y se envía al reconectar, sin bloquear la respuesta gRPC.
   */
  publish(
    type: EventType,
    groupId: string,
    data: object,
    occurredAt: Date = new Date(),
  ): void {
    const event = {
      event_id: randomUUID(),
      type,
      occurred_at: occurredAt.toISOString(),
      group_id: groupId,
      data,
    };
    this.channel
      .publish(EVENTS_EXCHANGE, type, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        contentType: 'application/json',
        messageId: event.event_id,
      })
      .then(() => this.logger.log(`Publicado ${type} ${event.event_id}`))
      .catch((err: unknown) =>
        this.logger.error(`No se pudo publicar ${type}: ${String(err)}`),
      );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }
}
