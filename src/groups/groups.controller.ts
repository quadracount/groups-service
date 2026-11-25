import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UsersService } from '../users/users.service';
import { GroupsService } from './groups.service';
import type {
  AddMemberRequest,
  CreateExpenseRequest,
  CreateGroupRequest,
  Expense,
  GetGroupRequest,
  GetUserRequest,
  Group,
  ListExpensesRequest,
  ListGroupsForUserRequest,
  RegisterUserRequest,
  RemoveMemberRequest,
  User,
  VerifyCredentialsRequest,
} from './proto-types';

/** Implementa GroupsService de groups.proto. */
@Controller()
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly users: UsersService,
  ) {}

  @GrpcMethod('GroupsService', 'RegisterUser')
  registerUser(req: RegisterUserRequest): Promise<User> {
    return this.users.register(req);
  }

  @GrpcMethod('GroupsService', 'VerifyCredentials')
  verifyCredentials(req: VerifyCredentialsRequest): Promise<User> {
    return this.users.verifyCredentials(req.email, req.password);
  }

  @GrpcMethod('GroupsService', 'GetUser')
  getUser(req: GetUserRequest): Promise<User> {
    return this.users.getUser(req.user_id);
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

  @GrpcMethod('GroupsService', 'CreateGroup')
  createGroup(req: CreateGroupRequest): Promise<Group> {
    return this.groups.createGroup(req.name, req.requester_id);
  }

  @GrpcMethod('GroupsService', 'AddMember')
  addMember(req: AddMemberRequest): Promise<Group> {
    return this.groups.addMember(req.group_id, req.email, req.requester_id);
  }

  @GrpcMethod('GroupsService', 'RemoveMember')
  removeMember(req: RemoveMemberRequest): Promise<Group> {
    return this.groups.removeMember(
      req.group_id,
      req.user_id,
      req.requester_id,
    );
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
