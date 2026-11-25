# groups-service

Usuarios, grupos, miembros y gastos. NestJS + MongoDB (`groups_db`).

## gRPC (puerto 50051)

El contrato es `protos/groups.proto`. El BFF tiene una copia que tiene que ser idéntica. `protos/balances.proto` es una copia del de balances-service y se usa para llamar a `GetMemberBalance` antes de quitar a un miembro.

```bash
# desde la carpeta con todos los repos
diff groups-service/protos/groups.proto bff-gateway/protos/groups.proto
diff balances-service/protos/balances.proto groups-service/protos/balances.proto
```

Implementado (Fase 2): `GetUser`, `ListGroupsForUser`, `GetGroup`, `CreateExpense` y `ListExpenses`. El resto responde `UNIMPLEMENTED` hasta la Fase 4.

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

Se publica con `amqp-connection-manager`: si RabbitMQ está caído, el gasto se guarda igual y el evento queda en memoria hasta que se reconecta. Si groups-service se reinicia justo en ese momento, el evento se pierde (la solución completa sería un *outbox*; no hace falta para este proyecto).

## Datos de ejemplo

Con `SEED_DEMO=true`, al arrancar crea (si no existen) los usuarios Martín, Camila, Sofía y Diego (`martin@quadracount.dev`, contraseña `quadra123`) y el grupo `g-depto` "Depto Los Carrera 1450". Todavía sin gastos: se crean por GraphQL para que pasen por los eventos.

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
