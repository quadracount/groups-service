import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { randomUUID } from 'node:crypto';
import { BalancesClient } from '../balances/balances.client';
import {
  Database,
  type ExpenseDoc,
  type GroupDoc,
} from '../database/database.module';
import { EventsPublisher } from '../events/events.publisher';
import { formatMoney } from '../money';
import { UsersService } from '../users/users.service';
import { validateExpense } from './expense-validation';
import type { CreateExpenseRequest, Expense, Group } from './proto-types';

function rpcError(code: status, message: string): RpcException {
  return new RpcException({ code, message });
}

/** Opciones internas para cargar los datos de ejemplo con fecha e id fijos. */
export interface ExpenseOptions {
  id?: string;
  createdAt?: Date;
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly db: Database,
    private readonly events: EventsPublisher,
    private readonly users: UsersService,
    private readonly balances: BalancesClient,
  ) {}

  async listGroupsForUser(userId: string): Promise<Group[]> {
    const groups = await this.db.groups
      .find({ 'members.user_id': userId })
      .sort({ created_at: 1 })
      .toArray();
    return groups.map(toGroup);
  }

  async getGroup(groupId: string, requesterId: string): Promise<Group> {
    return toGroup(await this.findGroupForMember(groupId, requesterId));
  }

  /** Crea el grupo con quien lo pide como primer miembro. */
  async createGroup(name: string, requesterId: string): Promise<Group> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw rpcError(status.INVALID_ARGUMENT, 'El nombre no puede estar vacío');
    }
    const creator = await this.users.getUser(requesterId);
    const now = new Date();
    const doc: GroupDoc = {
      _id: `g-${randomUUID()}`,
      name: trimmed,
      members: [{ user_id: creator.id, name: creator.name, joined_at: now }],
      created_at: now,
    };
    await this.db.groups.insertOne(doc);
    this.events.publish('miembro.agregado', doc._id, {
      user_id: creator.id,
      name: creator.name,
    });
    return toGroup(doc);
  }

  /** Agrega por correo a una persona ya registrada. */
  async addMember(
    groupId: string,
    email: string,
    requesterId: string,
  ): Promise<Group> {
    const group = await this.findGroupForMember(groupId, requesterId);
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw rpcError(
        status.NOT_FOUND,
        'No hay ninguna cuenta registrada con ese correo',
      );
    }
    if (group.members.some((m) => m.user_id === user._id)) {
      throw rpcError(
        status.ALREADY_EXISTS,
        `${user.name} ya es miembro del grupo`,
      );
    }
    const member = {
      user_id: user._id,
      name: user.name,
      joined_at: new Date(),
    };
    await this.db.groups.updateOne(
      { _id: group._id },
      { $push: { members: member } },
    );
    this.events.publish('miembro.agregado', group._id, {
      user_id: user._id,
      name: user.name,
    });
    return toGroup({ ...group, members: [...group.members, member] });
  }

  /**
   * Quita a un miembro solo si su saldo en el grupo es exactamente 0.
   * El saldo se le pregunta a balances-service por gRPC.
   */
  async removeMember(
    groupId: string,
    userId: string,
    requesterId: string,
  ): Promise<Group> {
    const group = await this.findGroupForMember(groupId, requesterId);
    const member = group.members.find((m) => m.user_id === userId);
    if (!member) {
      throw rpcError(status.NOT_FOUND, 'Esa persona no es miembro del grupo');
    }
    if (group.members.length === 1) {
      throw rpcError(
        status.FAILED_PRECONDITION,
        'El grupo tiene que tener al menos un miembro',
      );
    }
    const net = await this.balances.getMemberBalance(group._id, userId);
    if (net !== 0) {
      const situation =
        net < 0
          ? `debe ${formatMoney(-net)}`
          : `tiene ${formatMoney(net)} a favor`;
      throw rpcError(
        status.FAILED_PRECONDITION,
        `No se puede quitar a ${member.name}: ${situation} en el grupo. Primero hay que saldar cuentas.`,
      );
    }
    await this.db.groups.updateOne(
      { _id: group._id },
      { $pull: { members: { user_id: userId } } },
    );
    this.events.publish('miembro.eliminado', group._id, {
      user_id: userId,
      name: member.name,
    });
    return toGroup({
      ...group,
      members: group.members.filter((m) => m.user_id !== userId),
    });
  }

  async createExpense(
    req: CreateExpenseRequest,
    options: ExpenseOptions = {},
  ): Promise<Expense> {
    const group = await this.findGroupForMember(req.group_id, req.requester_id);
    const valid = validateExpense(
      req,
      group.members.map((m) => m.user_id),
    );
    if (typeof valid === 'string') {
      throw rpcError(status.INVALID_ARGUMENT, valid);
    }

    const createdAt = options.createdAt ?? new Date();
    const doc: ExpenseDoc = {
      _id: options.id ?? randomUUID(),
      group_id: group._id,
      ...valid,
      created_at: createdAt,
    };
    await this.db.expenses.insertOne(doc);

    const payer = group.members.find((m) => m.user_id === doc.paid_by);
    this.events.publish(
      'gasto.creado',
      group._id,
      {
        expense_id: doc._id,
        description: doc.description,
        amount: doc.amount,
        paid_by: doc.paid_by,
        paid_by_name: payer?.name ?? doc.paid_by,
        shares: doc.shares,
        source: doc.source,
      },
      createdAt,
    );
    return toExpense(doc);
  }

  async listExpenses(groupId: string, requesterId: string): Promise<Expense[]> {
    await this.findGroupForMember(groupId, requesterId);
    const expenses = await this.db.expenses
      .find({ group_id: groupId })
      .sort({ created_at: -1 })
      .toArray();
    return expenses.map(toExpense);
  }

  /** Busca el grupo y verifica que requester_id sea miembro (PERMISSION_DENIED si no). */
  private async findGroupForMember(
    groupId: string,
    requesterId: string,
  ): Promise<GroupDoc> {
    if (!groupId) throw rpcError(status.INVALID_ARGUMENT, 'Falta group_id');
    if (!requesterId) {
      throw rpcError(status.UNAUTHENTICATED, 'Falta requester_id');
    }
    const group = await this.db.groups.findOne({ _id: groupId });
    if (!group) throw rpcError(status.NOT_FOUND, 'Grupo no encontrado');
    if (!group.members.some((m) => m.user_id === requesterId)) {
      throw rpcError(status.PERMISSION_DENIED, 'No eres miembro de este grupo');
    }
    return group;
  }
}

function toGroup(doc: GroupDoc): Group {
  return {
    id: doc._id,
    name: doc.name,
    members: doc.members.map(({ user_id, name }) => ({ user_id, name })),
    created_at: doc.created_at.toISOString(),
  };
}

function toExpense(doc: ExpenseDoc): Expense {
  return {
    id: doc._id,
    group_id: doc.group_id,
    description: doc.description,
    amount: doc.amount,
    paid_by: doc.paid_by,
    shares: doc.shares,
    source: doc.source,
    created_at: doc.created_at.toISOString(),
  };
}
