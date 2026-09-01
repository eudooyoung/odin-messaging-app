import { beforeEach, describe, expect, it, vi } from "vitest";
import type { findConversationsByParticipantId } from "@/repositories/conversation.repository.js";
import { getConversationsService } from "@/services/conversation.service.js";

const { findConversationsByParticipantIdMock } = vi.hoisted(() => ({
  findConversationsByParticipantIdMock:
    vi.fn<typeof findConversationsByParticipantId>(),
}));

vi.mock("@/repositories/conversation.repository.js", () => ({
  createConversation: vi.fn(),
  findConversationByParticipantIds: vi.fn(),
  findConversationsByParticipantId: findConversationsByParticipantIdMock,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getConversationsService", () => {
  it("returns conversations for the current user", async () => {
    const currentUserId = 1;
    const otherUser = {
      username: "other-user",
      displayName: "Other User",
      profileImage: "https://example.com/other-user.jpg",
    };
    const lastMessage = {
      id: 3,
      content: "Hello!",
      senderId: 2,
      createdAt: new Date("2026-09-01T01:00:00.000Z"),
    };
    const lastActivityAt = new Date("2026-09-01T01:00:00.000Z");
    const conversations = [
      {
        id: 10,
        participants: [otherUser],
        messages: [lastMessage],
        lastActivityAt,
      },
    ];

    findConversationsByParticipantIdMock.mockResolvedValue(conversations);

    const result = await getConversationsService(currentUserId);

    expect(findConversationsByParticipantIdMock).toHaveBeenCalledWith(currentUserId);
    expect(result).toEqual({
      conversations: [
        {
          id: 10,
          otherUser,
          lastMessage,
          lastActivityAt,
        },
      ],
      nextCursor: null,
    });
  });

  it("returns a next cursor when more conversations exist", async () => {
    const currentUserId = 1;
    const cursor = 20;
    const limit = 2;
    const repositoryConversations = [19, 18, 17].map((id) => ({
      id,
      participants: [
        {
          username: `user-${id}`,
          displayName: `User ${id}`,
          profileImage: null,
        },
      ],
      messages: [
        {
          id: id + 100,
          content: `Message ${id}`,
          senderId: id,
          createdAt: new Date(`2026-09-01T00:${id}:00.000Z`),
        },
      ],
      lastActivityAt: new Date(`2026-09-01T00:${id}:00.000Z`),
    }));

    findConversationsByParticipantIdMock.mockResolvedValue(repositoryConversations);

    const result = await getConversationsService(currentUserId, cursor, limit);

    expect(findConversationsByParticipantIdMock).toHaveBeenCalledWith(
      currentUserId,
      cursor,
      limit,
    );
    expect(result).toEqual({
      conversations: repositoryConversations.slice(0, limit).map((conversation) => ({
        id: conversation.id,
        otherUser: conversation.participants[0],
        lastMessage: conversation.messages[0],
        lastActivityAt: conversation.lastActivityAt,
      })),
      nextCursor: repositoryConversations[limit - 1].id,
    });
  });
});
