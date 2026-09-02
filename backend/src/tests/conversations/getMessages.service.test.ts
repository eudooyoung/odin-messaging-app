import { beforeEach, describe, expect, it, vi } from "vitest";
import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import type {
  findConversationById,
  updateConversationLastActivityAt,
} from "@/repositories/conversation.repository.js";
import type {
  createMessage,
  findMessagesByConversationId,
} from "@/repositories/message.repository.js";
import { getMessagesService } from "@/services/message.service.js";

const { findConversationByIdMock, findMessagesByConversationIdMock } = vi.hoisted(() => ({
  findConversationByIdMock: vi.fn<typeof findConversationById>(),
  findMessagesByConversationIdMock: vi.fn<typeof findMessagesByConversationId>(),
}));

vi.mock("@/repositories/conversation.repository.js", () => ({
  findConversationById: findConversationByIdMock,
  updateConversationLastActivityAt: vi.fn<typeof updateConversationLastActivityAt>(),
}));

vi.mock("@/repositories/message.repository.js", () => ({
  createMessage: vi.fn<typeof createMessage>(),
  findMessagesByConversationId: findMessagesByConversationIdMock,
}));

describe("getMessagesService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the conversation messages ordered by creation time and id descending", async () => {
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
          profileImage: null,
        },
      ],
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-02T02:00:00.000Z"),
    };
    const messages = [
      {
        id: 3,
        content: "Third message",
        sender: {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        createdAt: new Date("2026-09-02T02:00:00.000Z"),
      },
      {
        id: 2,
        content: "Second message",
        sender: {
          username: "other-user",
          displayName: "Other User",
          profileImage: null,
        },
        createdAt: new Date("2026-09-02T02:00:00.000Z"),
      },
      {
        id: 1,
        content: "First message",
        sender: {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        createdAt: new Date("2026-09-02T01:00:00.000Z"),
      },
    ];

    findConversationByIdMock.mockResolvedValue(conversation);
    findMessagesByConversationIdMock.mockResolvedValue(messages);

    const result = await getMessagesService(currentUserId, conversationId);

    expect(findConversationByIdMock).toHaveBeenCalledWith(conversationId);
    expect(findMessagesByConversationIdMock).toHaveBeenCalledWith(conversationId);
    expect(result).toEqual({
      messages,
      nextCursor: null,
    });
  });

  it("returns a next cursor when more messages exist", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const cursor = 20;
    const limit = 2;
    const conversation = {
      id: conversationId,
      participants: [
        {
          id: currentUserId,
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
      ],
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-02T02:00:00.000Z"),
    };
    const repositoryMessages = [19, 18, 17].map((id) => ({
      id,
      content: `Message ${id}`,
      sender: {
        username: "current-user",
        displayName: "Current User",
        profileImage: null,
      },
      createdAt: new Date(`2026-09-02T00:${id}:00.000Z`),
    }));

    findConversationByIdMock.mockResolvedValue(conversation);
    findMessagesByConversationIdMock.mockResolvedValue(repositoryMessages);

    const result = await getMessagesService(
      currentUserId,
      conversationId,
      cursor,
      limit,
    );

    expect(findMessagesByConversationIdMock).toHaveBeenCalledWith(
      conversationId,
      cursor,
      limit,
    );
    expect(result).toEqual({
      messages: repositoryMessages.slice(0, limit),
      nextCursor: 18,
    });
  });

  it("returns a null next cursor when no more messages exist", async () => {
    const currentUserId = 1;
    const conversationId = 10;
    const cursor = 20;
    const limit = 2;
    const conversation = {
      id: conversationId,
      participants: [
        {
          id: currentUserId,
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
      ],
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-02T02:00:00.000Z"),
    };
    const repositoryMessages = [
      {
        id: 19,
        content: "Message 19",
        sender: {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        createdAt: new Date("2026-09-02T00:19:00.000Z"),
      },
    ];

    findConversationByIdMock.mockResolvedValue(conversation);
    findMessagesByConversationIdMock.mockResolvedValue(repositoryMessages);

    const result = await getMessagesService(
      currentUserId,
      conversationId,
      cursor,
      limit,
    );

    expect(findMessagesByConversationIdMock).toHaveBeenCalledWith(
      conversationId,
      cursor,
      limit,
    );
    expect(result).toEqual({
      messages: repositoryMessages,
      nextCursor: null,
    });
  });

  it("throws a not found error when the conversation does not exist", async () => {
    const currentUserId = 1;
    const conversationId = 10;

    findConversationByIdMock.mockResolvedValue(null);

    const result = getMessagesService(currentUserId, conversationId);

    await expect(result).rejects.toBeInstanceOf(NotFoundError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
    expect(findMessagesByConversationIdMock).not.toHaveBeenCalled();
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
      createdAt: new Date("2026-09-02T00:00:00.000Z"),
      lastActivityAt: new Date("2026-09-02T02:00:00.000Z"),
    };

    findConversationByIdMock.mockResolvedValue(conversation);

    const result = getMessagesService(currentUserId, conversationId);

    await expect(result).rejects.toBeInstanceOf(ForbiddenError);
    await expect(result).rejects.toMatchObject({ statusCode: 403 });
    expect(findMessagesByConversationIdMock).not.toHaveBeenCalled();
  });
});
