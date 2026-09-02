import { beforeEach, describe, expect, it, vi } from "vitest";
import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import type { findConversationById } from "@/repositories/conversation.repository.js";
import { getConversationService } from "@/services/conversation.service.js";

const { findConversationByIdMock } = vi.hoisted(() => ({
  findConversationByIdMock: vi.fn<typeof findConversationById>(),
}));

vi.mock("@/repositories/conversation.repository.js", () => ({
  createConversation: vi.fn(),
  findConversationById: findConversationByIdMock,
  findConversationByParticipantIds: vi.fn(),
  findConversationsByParticipantId: vi.fn(),
}));

vi.mock("@/repositories/user.repository.js", () => ({
  findUserByUsername: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getConversationService", () => {
  it("returns the conversation when the current user is a participant", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const conversation = {
      id: conversationId,
      participants: [
        {
          id: currentUserId,
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        {
          id: 2,
          username: "other-user",
          displayName: "Other User",
          profileImage: "https://example.com/other-user.jpg",
        },
      ],
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-01T01:00:00.000Z"),
    };

    findConversationByIdMock.mockResolvedValue(conversation);

    const result = await getConversationService(currentUserId, conversationId);

    expect(findConversationByIdMock).toHaveBeenCalledWith(conversationId);
    expect(result).toEqual(conversation);
  });

  it("throws a not found error when the conversation does not exist", async () => {
    const currentUserId = 1;
    const conversationId = 10;

    findConversationByIdMock.mockResolvedValue(null);

    const result = getConversationService(currentUserId, conversationId);

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws a forbidden error when the current user is not a participant", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const conversation = {
      id: conversationId,
      participants: [
        {
          id: 2,
          username: "first-participant",
          displayName: "First Participant",
          profileImage: null,
        },
        {
          id: 3,
          username: "second-participant",
          displayName: "Second Participant",
          profileImage: null,
        },
      ],
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-01T01:00:00.000Z"),
    };

    findConversationByIdMock.mockResolvedValue(conversation);

    const result = getConversationService(currentUserId, conversationId);

    await expect(result).rejects.toBeInstanceOf(ForbiddenError);
    await expect(result).rejects.toMatchObject({ statusCode: 403 });
  });
});
