import * as argon2 from "argon2";
import { prisma } from "@/lib/prisma.js";

type CreateTestUserOverrides = Partial<{
  username: string;
  handle: string;
  password: string;
  displayName: string;
  bio: string | null;
  profileImage: string | null;
}>;

const defaultUser = {
  username: "test-user",
  password: "secure-password",
  displayName: "Test User",
  bio: null,
  profileImage: null,
};

let defaultPasswordHash: Promise<string> | undefined;
let nextHandleId = 0;

const createTestHandle = () => `user_${String(nextHandleId++).padStart(8, "0")}`;

const hashPassword = (password: string) => {
  if (password !== defaultUser.password) {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  defaultPasswordHash ??= argon2.hash(password, { type: argon2.argon2id });

  return defaultPasswordHash;
};

export const createTestUser = async (overrides: CreateTestUserOverrides = {}) => {
  const { password, handle, ...userData } = {
    ...defaultUser,
    ...overrides,
  };
  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      ...userData,
      handle: handle ?? createTestHandle(),
      passwordHash,
    },
  });
};
