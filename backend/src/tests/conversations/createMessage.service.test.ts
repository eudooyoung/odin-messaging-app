import { beforeEach, describe, expect, it, vi } from "vitest";
import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import type { findConversationById } from "@/repositories/conversation.repository.js";
import type { createMessage } from "@/repositories/message.repository.js";
import { createMessageService } from "@/services/message.service.js";

const { createMessageMock, findConversationByIdMock } = vi.hoisted(() => ({
  createMessageMock: vi.fn<typeof createMessage>(),
  findConversationByIdMock: vi.fn<typeof findConversationById>(),
}));

vi.mock("@/repositories/conversation.repository.js", () => ({
  findConversationById: findConversationByIdMock,
}));

vi.mock("@/repositories/message.repository.js", () => ({
  createMessage: createMessageMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createMessageService", () => {
  it("returns the created message and recipient user ids", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const content = "Hello!";
    const conversation = {
      id: conversationId,
      participants: [
        {
          id: currentUserId,
          handle: "current_handle",
          displayName: "Current User",
          profileImage: null,
        },
        {
          id: 2,
          handle: "other_handle",
          displayName: "Other User",
          profileImage: null,
        },
      ],
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-02T00:00:00.000Z"),
    };
    const createdMessage = {
      id: 100,
      content,
      sender: {
        id: currentUserId,
        handle: "current_handle",
        displayName: "Current User",
        profileImage: null,
      },
      createdAt: new Date("2026-09-02T01:00:00.000Z"),
    };

    findConversationByIdMock.mockResolvedValue(conversation);
    createMessageMock.mockResolvedValue(createdMessage);

    const result = await createMessageService(currentUserId, conversationId, content);

    expect(findConversationByIdMock).toHaveBeenCalledWith(conversationId);
    expect(createMessageMock).toHaveBeenCalledWith(conversationId, currentUserId, content);
    expect(result).toEqual({
      message: createdMessage,
      recipientUserIds: [2],
    });
  });

  it("throws a not found error without creating a message when the conversation does not exist", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const content = "Hello!";

    findConversationByIdMock.mockResolvedValue(null);

    const result = createMessageService(currentUserId, conversationId, content);

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it("throws a forbidden error without creating a message when the current user is not a participant", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const content = "Hello!";
    const conversation = {
      id: conversationId,
      participants: [
        {
          id: 2,
          handle: "first_participant",
          displayName: "First Participant",
          profileImage: null,
        },
        {
          id: 3,
          handle: "second_participant",
          displayName: "Second Participant",
          profileImage: null,
        },
      ],
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-02T00:00:00.000Z"),
    };

    findConversationByIdMock.mockResolvedValue(conversation);

    const result = createMessageService(currentUserId, conversationId, content);

    await expect(result).rejects.toBeInstanceOf(ForbiddenError);
    await expect(result).rejects.toMatchObject({ statusCode: 403 });
    expect(createMessageMock).not.toHaveBeenCalled();
  });
});
