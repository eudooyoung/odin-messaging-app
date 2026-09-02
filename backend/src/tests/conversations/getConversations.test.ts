import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import type { GetConversationsResponseBody } from "@/types/api.types.js";

const getBody = <T>(response: Response) => response.body as T;

describe("GET /conversations", () => {
  it("returns conversations belonging to the authenticated user", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const firstOtherUser = await createTestUser({
      username: "first-other-user",
      displayName: "First Other User",
      profileImage: "https://example.com/first-other-user.jpg",
    });
    const secondOtherUser = await createTestUser({
      username: "second-other-user",
      displayName: "Second Other User",
    });
    const firstLastActivityAt = new Date("2026-09-01T01:00:00.000Z");
    const secondLastActivityAt = new Date("2026-09-01T02:00:00.000Z");
    const firstConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: firstOtherUser.id }],
        },
        lastActivityAt: firstLastActivityAt,
      },
    });
    const secondConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: secondOtherUser.id }],
        },
        lastActivityAt: secondLastActivityAt,
      },
    });
    const unrelatedConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: firstOtherUser.id }, { id: secondOtherUser.id }],
        },
        lastActivityAt: new Date("2026-09-01T03:00:00.000Z"),
      },
    });
    const firstLastMessage = await prisma.message.create({
      data: {
        content: "First conversation message",
        senderId: firstOtherUser.id,
        conversationId: firstConversation.id,
        createdAt: firstLastActivityAt,
      },
    });
    const secondLastMessage = await prisma.message.create({
      data: {
        content: "Second conversation message",
        senderId: currentUser.id,
        conversationId: secondConversation.id,
        createdAt: secondLastActivityAt,
      },
    });
    await prisma.message.create({
      data: {
        content: "Unrelated conversation message",
        senderId: firstOtherUser.id,
        conversationId: unrelatedConversation.id,
      },
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app).get("/conversations").set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<GetConversationsResponseBody>(response);
    expect(body.nextCursor).toBeNull();
    expect(body.conversations).toHaveLength(2);
    expect(body.conversations).toEqual([
      {
        id: secondConversation.id,
        otherUser: {
          username: secondOtherUser.username,
          displayName: secondOtherUser.displayName,
          profileImage: secondOtherUser.profileImage,
        },
        lastMessage: {
          id: secondLastMessage.id,
          content: secondLastMessage.content,
          senderId: secondLastMessage.senderId,
          createdAt: secondLastMessage.createdAt.toISOString(),
        },
        lastActivityAt: secondConversation.lastActivityAt.toISOString(),
      },
      {
        id: firstConversation.id,
        otherUser: {
          username: firstOtherUser.username,
          displayName: firstOtherUser.displayName,
          profileImage: firstOtherUser.profileImage,
        },
        lastMessage: {
          id: firstLastMessage.id,
          content: firstLastMessage.content,
          senderId: firstLastMessage.senderId,
          createdAt: firstLastMessage.createdAt.toISOString(),
        },
        lastActivityAt: firstConversation.lastActivityAt.toISOString(),
      },
    ]);
    expect(body.conversations.map(({ id }) => id)).not.toContain(unrelatedConversation.id);
  });

  it("returns consecutive pages using the next cursor", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const firstOtherUser = await createTestUser({
      username: "first-other-user",
      displayName: "First Other User",
    });
    const secondOtherUser = await createTestUser({
      username: "second-other-user",
      displayName: "Second Other User",
    });
    const thirdOtherUser = await createTestUser({
      username: "third-other-user",
      displayName: "Third Other User",
    });
    const firstConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: firstOtherUser.id }],
        },
        lastActivityAt: new Date("2026-09-01T01:00:00.000Z"),
      },
    });
    const secondConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: secondOtherUser.id }],
        },
        lastActivityAt: new Date("2026-09-01T02:00:00.000Z"),
      },
    });
    const thirdConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: thirdOtherUser.id }],
        },
        lastActivityAt: new Date("2026-09-01T02:00:00.000Z"),
      },
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);
    const limit = 2;

    const firstPageResponse = await request(app)
      .get("/conversations")
      .query({ limit: String(limit) })
      .set("Cookie", accessCookie);

    expect(firstPageResponse.status).toBe(200);

    const firstPage = getBody<GetConversationsResponseBody>(firstPageResponse);
    const firstPageIds = firstPage.conversations.map(({ id }) => id);
    expect(firstPage.conversations).toHaveLength(limit);
    expect(firstPageIds).toEqual([thirdConversation.id, secondConversation.id]);
    expect(firstPage.nextCursor).toBe(secondConversation.id);

    const secondPageResponse = await request(app)
      .get("/conversations")
      .query({ cursor: String(firstPage.nextCursor), limit: String(limit) })
      .set("Cookie", accessCookie);

    expect(secondPageResponse.status).toBe(200);

    const secondPage = getBody<GetConversationsResponseBody>(secondPageResponse);
    const secondPageIds = secondPage.conversations.map(({ id }) => id);
    expect(secondPageIds).toEqual([firstConversation.id]);
    expect(secondPageIds.some((id) => firstPageIds.includes(id))).toBe(false);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("returns an empty conversation list when the authenticated user has none", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .get("/conversations")
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);
    expect(getBody<GetConversationsResponseBody>(response)).toEqual({
      conversations: [],
      nextCursor: null,
    });
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).get("/conversations");

    expect(response.status).toBe(401);
  });

  it.each([
    {
      caseName: "cursor cannot be converted to a number",
      query: { cursor: "not-a-number" },
    },
    {
      caseName: "cursor is zero",
      query: { cursor: "0" },
    },
    {
      caseName: "cursor is negative",
      query: { cursor: "-1" },
    },
    {
      caseName: "cursor is a decimal",
      query: { cursor: "1.5" },
    },
    {
      caseName: "limit cannot be converted to a number",
      query: { limit: "not-a-number" },
    },
    {
      caseName: "limit is zero",
      query: { limit: "0" },
    },
    {
      caseName: "limit is negative",
      query: { limit: "-1" },
    },
    {
      caseName: "limit is a decimal",
      query: { limit: "1.5" },
    },
  ])("returns 400 when $caseName", async ({ query }) => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .get("/conversations")
      .query(query)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(400);
  });
});
