export type RegisterInput = {
  username: string;
  password: string;
  displayName: string;
};

export type RegisterResponseBody = {
  id: number;
  username: string;
  displayName: string;
};

export type CreateUserData = {
  username: string;
  passwordHash: string;
  displayName: string;
};

export type CreateRefreshSessionData = {
  tokenHash: string;
  userId: number;
  expiresAt: Date;
};

export type RotateRefreshSessionData = {
  previousTokenHash: string;
  tokenHash: string;
  userId: number;
  expiresAt: Date;
};

export type LoginInput = {
  username: string;
  password: string;
};

export type LoginResponseBody = Record<string, never>;

export type RefreshResponseBody = Record<string, never>;

export type LogoutResponseBody = Record<string, never>;

export type MeResponseBody = {
  id: number;
  username: string;
  displayName: string;
};

export type UserProfileResponseBody = {
  username: string;
  displayName: string;
  bio: string | null;
  profileImage: string | null;
};

export type UpdateUserProfileInput = {
  displayName?: string;
  bio?: string | null;
  profileImage?: string | null;
};

export type UserSearchResult = {
  username: string;
  displayName: string;
  profileImage: string | null;
};

export type SearchUsersResponseBody = UserSearchResult[];

export type SearchUsersQuery = {
  query: string;
};

export type CreateConversationInput = {
  targetUsername: string;
};

export type ConversationResponseBody = {
  id: number;
  participants: UserSearchResult[];
  createdAt: string;
  lastActivityAt: string;
};
