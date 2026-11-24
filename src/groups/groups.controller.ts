import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GroupsService } from './groups.service';
import type {
  CreateExpenseRequest,
  Expense,
  GetGroupRequest,
  GetUserRequest,
  Group,
  ListExpensesRequest,
  ListGroupsForUserRequest,
  User,
} from './proto-types';

// Implementa GroupsService de groups.proto. Los métodos que faltan
// (registro, login, crear grupo, miembros) responden UNIMPLEMENTED hasta la Fase 4.
@Controller()
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @GrpcMethod('GroupsService', 'GetUser')
  getUser(req: GetUserRequest): Promise<User> {
    return this.groups.getUser(req.user_id);
  }

  @GrpcMethod('GroupsService', 'ListGroupsForUser')
  async listGroupsForUser(
    req: ListGroupsForUserRequest,
  ): Promise<{ groups: Group[] }> {
    return { groups: await this.groups.listGroupsForUser(req.user_id) };
  }

  @GrpcMethod('GroupsService', 'GetGroup')
  getGroup(req: GetGroupRequest): Promise<Group> {
    return this.groups.getGroup(req.group_id, req.requester_id);
  }

  @GrpcMethod('GroupsService', 'CreateExpense')
  createExpense(req: CreateExpenseRequest): Promise<Expense> {
    return this.groups.createExpense(req);
  }

  @GrpcMethod('GroupsService', 'ListExpenses')
  async listExpenses(
    req: ListExpensesRequest,
  ): Promise<{ expenses: Expense[] }> {
    return {
      expenses: await this.groups.listExpenses(req.group_id, req.requester_id),
    };
  }
}
