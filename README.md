# groups-service

Usuarios, grupos, miembros y gastos. NestJS + MongoDB (`groups_db`).

## gRPC (puerto 50051)

El contrato es `protos/groups.proto`. El BFF tiene una copia que tiene que ser idéntica. `protos/balances.proto` es una copia del de balances-service y se usa para llamar a `GetMemberBalance` antes de quitar a un miembro.

```bash
# desde la carpeta con todos los repos
diff groups-service/protos/groups.proto bff-gateway/protos/groups.proto
diff balances-service/protos/balances.proto groups-service/protos/balances.proto
```

Implementa todo `groups.proto`. `RemoveMember` le pregunta el saldo a balances-service por gRPC (`GetMemberBalance`, `src/balances/`) y responde `FAILED_PRECONDITION` con lo que debe o tiene a favor. `CreateGroup` agrega a quien lo pide como primer miembro.

También implementa `grpc.health.v1` (`protos/health.proto`, copia del estándar de gRPC) para los probes de Kubernetes.

Los `.proto` se cargan con `keepCase: true` y `longs: Number` (`src/grpc-options.ts`, igual en el BFF): los campos se llaman como en el `.proto` (`group_id`) y los `int64` llegan como `number`.

Cada operación sobre un grupo recibe `requester_id` (el usuario del JWT, lo manda el BFF). Si no es miembro, se responde `PERMISSION_DENIED`.

Otros errores:

- `RegisterUser`: `ALREADY_EXISTS` si el correo ya existe.
- `VerifyCredentials`: `UNAUTHENTICATED`, con el mismo mensaje si falla el correo o la contraseña.
- `AddMember`: `NOT_FOUND` si no hay usuario con ese correo.
- `CreateExpense`: `INVALID_ARGUMENT` si las partes no suman el total, si hay montos no enteros o si quien pagó o alguna parte no es miembro (`src/groups/expense-validation.ts`).
- `GetGroup` y demás: `NOT_FOUND` si el grupo no existe.
- `RemoveMember`: `FAILED_PRECONDITION` si el miembro tiene saldo distinto de 0.

Las contraseñas se guardan con `scrypt` (de `node:crypto`) y una sal por usuario.

## Eventos

Publica en el exchange `quadracount.events` (topic). Para esto se usa `amqplib` directo, porque el transporte RMQ de Nest usa su propio formato.

```json
{
  "event_id": "uuid",
  "type": "gasto.creado",
  "occurred_at": "2026-11-06T18:20:00Z",
  "group_id": "g-depto",
  "data": {}
}
```

- `gasto.creado`: `expense_id`, `description`, `amount`, `paid_by`, `paid_by_name`, `shares` (`user_id`, `amount`) y `source`.
- `miembro.agregado` y `miembro.eliminado`: `user_id` y `name`.

Quien publica también declara las colas de los consumidores (`balances.events` ← `gasto.creado` y `activity.events` ← `#`). Un evento que llega a un exchange sin colas enlazadas se descarta, así que las colas tienen que existir antes del primer evento, aunque el consumidor todavía no haya arrancado (pasa al desplegar todo a la vez).

Se publica con `amqp-connection-manager`: si RabbitMQ está caído, el gasto se guarda igual y el evento queda en memoria hasta que se reconecta. Si groups-service se reinicia justo en ese momento, el evento se pierde (la solución completa sería un *outbox*; no hace falta para este proyecto).

## Datos de ejemplo

Con `SEED_DEMO=true` carga los datos de la sección 1 del plan (`src/seed/seed.service.ts`):

- 6 usuarios: Martín, Camila, Sofía, Diego, Valentina y Tomás (`martin@quadracount.dev`, `tomas@quadracount.dev`, etc.), todos con la contraseña `quadra123`.
- 3 grupos: "Depto Los Carrera 1450", "Proyecto Ingeniería de Software" y "Paseo fin de semestre".
- Los 4 gastos con sus fechas reales y el pago de Diego a Martín ($10.000).

Los gastos pasan por el mismo `createExpense` que un gasto normal (publican `gasto.creado`) y el pago se registra en balances-service por gRPC, así que los tres servicios quedan consistentes: Martín +12.000, Camila +1.000, Sofía −5.000, Diego −8.000. Corre en segundo plano y reintenta hasta que balances-service responda. Es idempotente: ids fijos y la colección `seed_state`.

## Variables de entorno

| Variable | Ejemplo |
|---|---|
| `GRPC_PORT` | `50051` |
| `MONGO_URL` | `mongodb://mongodb:27017` |
| `MONGO_DB` | `groups_db` |
| `RABBITMQ_URL` | `amqp://rabbitmq:5672` |
| `BALANCES_GRPC_URL` | `balances-service:50052` |
| `SEED_DEMO` | `true` para cargar los datos de ejemplo |

## Correr

```bash
pnpm install --frozen-lockfile
pnpm start:dev
```

Antes de hacer push: `pnpm run lint && pnpm test && pnpm build`.
