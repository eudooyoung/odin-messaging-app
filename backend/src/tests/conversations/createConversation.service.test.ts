import { beforeEach, describe, expect, it, vi } from "vitest";
import BadRequestError from "@/errors/badRequestError.js";
import NotFoundError from "@/errors/notFoundError.js";
import type { findOrCreateConversation } from "@/repositories/conversation.repository.js";
import type { findUserByHandle } from "@/repositories/user.repository.js";
import { createConversationService } from "@/services/conversation.service.js";

const { findOrCreateConversationMock, findUserByHandleMock } = vi.hoisted(() => ({
  findOrCreateConversationMock: vi.fn<typeof findOrCreateConversation>(),
  findUserByHandleMock: vi.fn<typeof findUserByHandle>(),
}));

vi.mock("@/repositories/conversation.repository.js", () => ({
  findOrCreateConversation: findOrCreateConversationMock,
}));

vi.mock("@/repositories/user.repository.js", () => ({
  findUserByHandle: findUserByHandleMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createConversationService", () => {
  it("creates and returns a conversation with the current and target users", async () => {
    const currentUserId = 1;
    const targetHandle = "target_handle";
    const targetUser = {
      id: 2,
      handle: targetHandle,
    };
    const createdConversation = {
      id: 1,
      participants: [
        {
          id: currentUserId,
          handle: "current_handle",
          displayName: "Current User",
          profileImage: null,
        },
        {
          id: targetUser.id,
          handle: targetHandle,
          displayName: "Target User",
          profileImage: "https://example.com/target.jpg",
        },
      ],
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    findUserByHandleMock.mockResolvedValue(targetUser);
    findOrCreateConversationMock.mockResolvedValue({
      conversation: createdConversation,
      created: true,
    });

    const result = await createConversationService(currentUserId, targetHandle);

    expect(findUserByHandleMock).toHaveBeenCalledWith(targetHandle);
    expect(findOrCreateConversationMock).toHaveBeenCalledWith([currentUserId, targetUser.id]);
    expect(result).toEqual({
      conversation: createdConversation,
      created: true,
    });
  });

  it("returns an existing conversation without creating a new one", async () => {
    const currentUserId = 1;
    const targetHandle = "target_handle";
    const targetUser = {
      id: 2,
      handle: targetHandle,
    };
    const existingConversation = {
      id: 1,
      participants: [
        {
          id: currentUserId,
          handle: "current_handle",
          displayName: "Current User",
          profileImage: null,
        },
        {
          id: targetUser.id,
          handle: targetHandle,
          displayName: "Target User",
          profileImage: "https://example.com/target.jpg",
        },
      ],
      createdAt: new Date("2026-08-31T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    findUserByHandleMock.mockResolvedValue(targetUser);
    findOrCreateConversationMock.mockResolvedValue({
      conversation: existingConversation,
      created: false,
    });

    const result = await createConversationService(currentUserId, targetHandle);

    expect(findUserByHandleMock).toHaveBeenCalledWith(targetHandle);
    expect(findOrCreateConversationMock).toHaveBeenCalledWith([currentUserId, targetUser.id]);
    expect(result).toEqual({
      conversation: existingConversation,
      created: false,
    });
  });

  it("throws a not found error when the target user does not exist", async () => {
    const currentUserId = 1;
    const targetHandle = "missing_handle";

    findUserByHandleMock.mockResolvedValue(null);

    const result = createConversationService(currentUserId, targetHandle);

    expect(findUserByHandleMock).toHaveBeenCalledWith(targetHandle);
    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
    expect(findOrCreateConversationMock).not.toHaveBeenCalled();
  });

  it("throws a bad request error when the target user is the current user", async () => {
    const currentUserId = 1;
    const targetHandle = "current_handle";
    const targetUser = {
      id: currentUserId,
      handle: targetHandle,
    };

    findUserByHandleMock.mockResolvedValue(targetUser);

    const result = createConversationService(currentUserId, targetHandle);

    expect(findUserByHandleMock).toHaveBeenCalledWith(targetHandle);
    await expect(result).rejects.toBeInstanceOf(BadRequestError);
    await expect(result).rejects.toMatchObject({ statusCode: 400 });
    expect(findOrCreateConversationMock).not.toHaveBeenCalled();
  });
});
