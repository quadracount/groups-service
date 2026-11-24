import type { ExpenseSource, ShareDoc } from '../database/database.module';

export interface ExpenseInput {
  description: string;
  amount: number;
  paid_by: string;
  shares: ShareDoc[];
  source: string;
}

export interface ValidExpense {
  description: string;
  amount: number;
  paid_by: string;
  shares: ShareDoc[];
  source: ExpenseSource;
}

/**
 * Valida un gasto contra los miembros del grupo. Devuelve el gasto normalizado
 * o un mensaje de error (que se responde como INVALID_ARGUMENT).
 * Los montos son pesos enteros y las partes tienen que sumar exactamente el total.
 */
export function validateExpense(
  input: ExpenseInput,
  memberIds: string[],
): ValidExpense | string {
  const members = new Set(memberIds);
  const description = input.description.trim();
  if (!description) return 'La descripción no puede estar vacía';
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    return 'El monto debe ser un número entero de pesos mayor que 0';
  }
  if (!members.has(input.paid_by)) {
    return 'Quien pagó tiene que ser miembro del grupo';
  }
  if (input.shares.length === 0) {
    return 'El gasto tiene que dividirse entre al menos un miembro';
  }

  const seen = new Set<string>();
  let sum = 0;
  for (const share of input.shares) {
    if (!members.has(share.user_id)) {
      return `${share.user_id} no es miembro del grupo`;
    }
    if (seen.has(share.user_id)) {
      return `${share.user_id} aparece más de una vez en la división`;
    }
    if (!Number.isSafeInteger(share.amount) || share.amount < 0) {
      return 'Cada parte debe ser un número entero de pesos, 0 o más';
    }
    seen.add(share.user_id);
    sum += share.amount;
  }
  if (sum !== input.amount) {
    return `Las partes suman $${sum} y el total es $${input.amount}`;
  }

  const source = input.source || 'MANUAL';
  if (source !== 'MANUAL' && source !== 'ASSISTANT') {
    return 'source debe ser MANUAL o ASSISTANT';
  }

  return {
    description,
    amount: input.amount,
    paid_by: input.paid_by,
    shares: input.shares.map(({ user_id, amount }) => ({ user_id, amount })),
    source,
  };
}
