import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { randomUUID } from 'node:crypto';
import {
  Database,
  type ExpenseDoc,
  type GroupDoc,
  type UserDoc,
} from '../database/database.module';
import { EventsPublisher } from '../events/events.publisher';
import { validateExpense } from './expense-validation';
import type { CreateExpenseRequest, Expense, Group, User } from './proto-types';

function rpcError(code: status, message: string): RpcException {
  return new RpcException({ code, message });
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly db: Database,
    private readonly events: EventsPublisher,
  ) {}

  async getUser(userId: string): Promise<User> {
    const user = await this.db.users.findOne({ _id: userId });
    if (!user) throw rpcError(status.NOT_FOUND, 'Usuario no encontrado');
    return toUser(user);
  }

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

  async createExpense(req: CreateExpenseRequest): Promise<Expense> {
    const group = await this.findGroupForMember(req.group_id, req.requester_id);
    const valid = validateExpense(
      req,
      group.members.map((m) => m.user_id),
    );
    if (typeof valid === 'string') {
      throw rpcError(status.INVALID_ARGUMENT, valid);
    }

    const doc: ExpenseDoc = {
      _id: randomUUID(),
      group_id: group._id,
      ...valid,
      created_at: new Date(),
    };
    await this.db.expenses.insertOne(doc);

    const payer = group.members.find((m) => m.user_id === doc.paid_by);
    this.events.publish('gasto.creado', group._id, {
      expense_id: doc._id,
      description: doc.description,
      amount: doc.amount,
      paid_by: doc.paid_by,
      paid_by_name: payer?.name ?? doc.paid_by,
      shares: doc.shares,
      source: doc.source,
    });
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

function toUser(doc: UserDoc): User {
  return { id: doc._id, name: doc.name, email: doc.email };
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
