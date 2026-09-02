import { beforeEach, describe, expect, it, vi } from "vitest";
import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import type {
  findConversationById,
  updateConversationLastActivityAt,
} from "@/repositories/conversation.repository.js";
import type { createMessage } from "@/repositories/message.repository.js";
import { createMessageService } from "@/services/message.service.js";

const { createMessageMock, findConversationByIdMock, updateConversationLastActivityAtMock } =
  vi.hoisted(() => ({
    createMessageMock: vi.fn<typeof createMessage>(),
    findConversationByIdMock: vi.fn<typeof findConversationById>(),
    updateConversationLastActivityAtMock: vi.fn<typeof updateConversationLastActivityAt>(),
  }));

vi.mock("@/repositories/conversation.repository.js", () => ({
  findConversationById: findConversationByIdMock,
  updateConversationLastActivityAt: updateConversationLastActivityAtMock,
}));

vi.mock("@/repositories/message.repository.js", () => ({
  createMessage: createMessageMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createMessageService", () => {
  it("returns the created message and recipient user ids and updates the conversation activity", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const content = "Hello!";
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
        username: "current-user",
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
    expect(updateConversationLastActivityAtMock).toHaveBeenCalledWith(
      conversationId,
      createdMessage.createdAt,
    );
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
    expect(updateConversationLastActivityAtMock).not.toHaveBeenCalled();
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
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-02T00:00:00.000Z"),
    };

    findConversationByIdMock.mockResolvedValue(conversation);

    const result = createMessageService(currentUserId, conversationId, content);

    await expect(result).rejects.toBeInstanceOf(ForbiddenError);
    await expect(result).rejects.toMatchObject({ statusCode: 403 });
    expect(createMessageMock).not.toHaveBeenCalled();
    expect(updateConversationLastActivityAtMock).not.toHaveBeenCalled();
  });
});
