import { beforeEach, describe, expect, it, vi } from "vitest";
import BadRequestError from "@/errors/badRequestError.js";
import NotFoundError from "@/errors/notFoundError.js";
import type {
  createConversation,
  findConversationByParticipantIds,
} from "@/repositories/conversation.repository.js";
import type { findUserByUsername } from "@/repositories/user.repository.js";
import { createConversationService } from "@/services/conversation.service.js";

const {
  createConversationMock,
  findConversationByParticipantIdsMock,
  findUserByUsernameMock,
} = vi.hoisted(() => ({
  createConversationMock: vi.fn<typeof createConversation>(),
  findConversationByParticipantIdsMock: vi.fn<typeof findConversationByParticipantIds>(),
  findUserByUsernameMock: vi.fn<typeof findUserByUsername>(),
}));

vi.mock("@/repositories/conversation.repository.js", () => ({
  createConversation: createConversationMock,
  findConversationByParticipantIds: findConversationByParticipantIdsMock,
}));

vi.mock("@/repositories/user.repository.js", () => ({
  findUserByUsername: findUserByUsernameMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createConversationService", () => {
  it("creates and returns a conversation with the current and target users", async () => {
    const currentUserId = 1;
    const targetUsername = "target-user";
    const targetUser = {
      id: 2,
      username: targetUsername,
      passwordHash: "hashed-password",
    };
    const createdConversation = {
      id: 1,
      participants: [
        {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        {
          username: targetUsername,
          displayName: "Target User",
          profileImage: "https://example.com/target.jpg",
        },
      ],
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    findUserByUsernameMock.mockResolvedValue(targetUser);
    findConversationByParticipantIdsMock.mockResolvedValue(null);
    createConversationMock.mockResolvedValue(createdConversation);

    const result = await createConversationService(currentUserId, targetUsername);

    expect(findUserByUsernameMock).toHaveBeenCalledWith(targetUsername);
    expect(createConversationMock).toHaveBeenCalledWith([currentUserId, targetUser.id]);
    expect(result).toEqual({
      conversation: createdConversation,
      created: true,
    });
  });

  it("returns an existing conversation without creating a new one", async () => {
    const currentUserId = 1;
    const targetUsername = "target-user";
    const targetUser = {
      id: 2,
      username: targetUsername,
      passwordHash: "hashed-password",
    };
    const existingConversation = {
      id: 1,
      participants: [
        {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        {
          username: targetUsername,
          displayName: "Target User",
          profileImage: "https://example.com/target.jpg",
        },
      ],
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    findUserByUsernameMock.mockResolvedValue(targetUser);
    findConversationByParticipantIdsMock.mockResolvedValue(existingConversation);

    const result = await createConversationService(currentUserId, targetUsername);

    expect(findUserByUsernameMock).toHaveBeenCalledWith(targetUsername);
    expect(findConversationByParticipantIdsMock).toHaveBeenCalledWith([
      currentUserId,
      targetUser.id,
    ]);
    expect(createConversationMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      conversation: existingConversation,
      created: false,
    });
  });

  it("throws a not found error when the target user does not exist", async () => {
    const currentUserId = 1;
    const targetUsername = "missing-user";

    findUserByUsernameMock.mockResolvedValue(null);

    const result = createConversationService(currentUserId, targetUsername);

    expect(findUserByUsernameMock).toHaveBeenCalledWith(targetUsername);
    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
    expect(findConversationByParticipantIdsMock).not.toHaveBeenCalled();
    expect(createConversationMock).not.toHaveBeenCalled();
  });

  it("throws a bad request error when the target user is the current user", async () => {
    const currentUserId = 1;
    const targetUsername = "current-user";
    const targetUser = {
      id: currentUserId,
      username: targetUsername,
      passwordHash: "hashed-password",
    };

    findUserByUsernameMock.mockResolvedValue(targetUser);

    const result = createConversationService(currentUserId, targetUsername);

    expect(findUserByUsernameMock).toHaveBeenCalledWith(targetUsername);
    await expect(result).rejects.toBeInstanceOf(BadRequestError);
    await expect(result).rejects.toMatchObject({ statusCode: 400 });
    expect(findConversationByParticipantIdsMock).not.toHaveBeenCalled();
    expect(createConversationMock).not.toHaveBeenCalled();
  });
});
