import type { RequestHandler } from "express";
import type {
  ConversationResponseBody,
  CreateConversationInput,
  CreateMessageInput,
  GetConversationsQuery,
  GetConversationsResponseBody,
  GetMessagesResponseBody,
  LoginInput,
  LoginResponseBody,
  LogoutResponseBody,
  MeResponseBody,
  MessageResponseBody,
  RefreshResponseBody,
  RegisterInput,
  RegisterResponseBody,
  SearchUsersQuery,
  SearchUsersResponseBody,
  UpdateUserProfileInput,
  UserProfileResponseBody,
} from "./api.types";

export type RegisterHandler = RequestHandler<
  Record<string, never>,
  RegisterResponseBody,
  RegisterInput
>;

export type LoginHandler = RequestHandler<
  Record<string, never>,
  LoginResponseBody,
  LoginInput
>;

export type RefreshHandler = RequestHandler<
  Record<string, never>,
  RefreshResponseBody,
  Record<string, never>
>;

export type LogoutHandler = RequestHandler<
  Record<string, never>,
  LogoutResponseBody,
  Record<string, never>
>;

export type MeHandler = RequestHandler<
  Record<string, never>,
  MeResponseBody,
  Record<string, never>,
  Record<string, never>,
  { userId: number }
>;

export type GetUserProfileHandler = RequestHandler<
  { username: string },
  UserProfileResponseBody,
  Record<string, never>,
  Record<string, never>,
  { userId: number }
>;

export type UpdateUserProfileHandler = RequestHandler<
  Record<string, never>,
  UserProfileResponseBody,
  UpdateUserProfileInput,
  Record<string, never>,
  { userId: number }
>;

export type SearchUsersHandler = RequestHandler<
  Record<string, never>,
  SearchUsersResponseBody,
  Record<string, never>,
  SearchUsersQuery,
  { userId: number; query: string }
>;

export type CreateConversationHandler = RequestHandler<
  Record<string, never>,
  ConversationResponseBody,
  CreateConversationInput,
  Record<string, never>,
  { userId: number }
>;

export type GetConversationsHandler = RequestHandler<
  Record<string, never>,
  GetConversationsResponseBody,
  Record<string, never>,
  GetConversationsQuery,
  { userId: number; cursor?: number; limit?: number }
>;

export type GetConversationHandler = RequestHandler<
  { id: string },
  ConversationResponseBody,
  Record<string, never>,
  Record<string, never>,
  { userId: number; conversationId: number }
>;

export type CreateMessageHandler = RequestHandler<
  { id: string },
  MessageResponseBody,
  CreateMessageInput,
  Record<string, never>,
  { userId: number; conversationId: number }
>;

export type GetMessagesHandler = RequestHandler<
  { id: string },
  GetMessagesResponseBody,
  Record<string, never>,
  GetConversationsQuery,
  {
    userId: number;
    conversationId: number;
    cursor?: number;
    limit?: number;
  }
>;
