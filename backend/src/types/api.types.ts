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

export type LoginInput = {
  username: string;
  password: string;
};

export type LoginResponseBody = Record<string, never>;
