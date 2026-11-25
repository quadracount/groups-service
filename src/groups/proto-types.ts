// Mensajes de groups.proto tal como los entrega @grpc/proto-loader (keepCase, longs: Number).

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Member {
  user_id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
  created_at: string;
}

export interface Share {
  user_id: string;
  amount: number;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  shares: Share[];
  source: string;
  created_at: string;
}

export interface RegisterUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface VerifyCredentialsRequest {
  email: string;
  password: string;
}

export interface GetUserRequest {
  user_id: string;
}

export interface CreateGroupRequest {
  name: string;
  requester_id: string;
}

export interface AddMemberRequest {
  group_id: string;
  email: string;
  requester_id: string;
}

export interface RemoveMemberRequest {
  group_id: string;
  user_id: string;
  requester_id: string;
}

export interface ListGroupsForUserRequest {
  user_id: string;
}

export interface GetGroupRequest {
  group_id: string;
  requester_id: string;
}

export interface CreateExpenseRequest {
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  shares: Share[];
  source: string;
  requester_id: string;
}

export interface ListExpensesRequest {
  group_id: string;
  requester_id: string;
}
