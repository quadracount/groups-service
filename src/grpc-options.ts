import { join } from 'node:path';

export const GROUPS_PROTO = join(process.cwd(), 'protos', 'groups.proto');
export const BALANCES_PROTO = join(process.cwd(), 'protos', 'balances.proto');

/**
 * Opciones de @grpc/proto-loader. Iguales en el BFF:
 * - keepCase: los campos se llaman como en el .proto (group_id, requester_id).
 * - longs: Number: los int64 (montos en pesos) llegan como number.
 * - defaults/arrays: los campos vacíos llegan como "" / 0 / [] y no como undefined.
 */
export const PROTO_LOADER_OPTIONS = {
  keepCase: true,
  longs: Number,
  enums: String,
  defaults: true,
  arrays: true,
};
