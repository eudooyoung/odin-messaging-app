import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import { loginAndGetAccessCookie } from "@/tests/helpers/login.js";
import "@/tests/integration.setup.js";
import type { GetMessagesResponseBody } from "@/types/api.types.js";

const getBody = <T>(response: Response) => response.body as T;

describe("GET /conversations/:id/messages", () => {
  it("returns the conversation messages ordered by creation time and id descending", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser({
      ...credentials,
      profileImage: "https://example.com/current-user.jpg",
    });
    const otherUser = await createTestUser({
      username: "other-user",
      displayName: "Other User",
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: otherUser.id }],
        },
      },
    });
    const firstMessage = await prisma.message.create({
      data: {
        content: "First message",
        senderId: currentUser.id,
        conversationId: conversation.id,
        createdAt: new Date("2026-09-02T01:00:00.000Z"),
      },
    });
    const secondMessage = await prisma.message.create({
      data: {
        content: "Second message",
        senderId: otherUser.id,
        conversationId: conversation.id,
        createdAt: new Date("2026-09-02T02:00:00.000Z"),
      },
    });
    const thirdMessage = await prisma.message.create({
      data: {
        content: "Third message",
        senderId: currentUser.id,
        conversationId: conversation.id,
        createdAt: new Date("2026-09-02T02:00:00.000Z"),
      },
    });
    const accessCookie = await loginAndGetAccessCookie(app, credentials);

    const response = await request(app)
      .get(`/conversations/${conversation.id}/messages`)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<GetMessagesResponseBody>(response);
    expect(body.nextCursor).toBeNull();
    expect(body.messages).toHaveLength(3);
    expect(body.messages).toEqual([
      {
        id: thirdMessage.id,
        content: thirdMessage.content,
        sender: {
          username: currentUser.username,
          displayName: currentUser.displayName,
          profileImage: currentUser.profileImage,
        },
        createdAt: thirdMessage.createdAt.toISOString(),
      },
      {
        id: secondMessage.id,
        content: secondMessage.content,
        sender: {
          username: otherUser.username,
          displayName: otherUser.displayName,
          profileImage: otherUser.profileImage,
        },
        createdAt: secondMessage.createdAt.toISOString(),
      },
      {
        id: firstMessage.id,
        content: firstMessage.content,
        sender: {
          username: currentUser.username,
          displayName: currentUser.displayName,
          profileImage: currentUser.profileImage,
        },
        createdAt: firstMessage.createdAt.toISOString(),
      },
    ]);
  });

  it("returns consecutive pages using the next cursor", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const otherUser = await createTestUser({
      username: "other-user",
      displayName: "Other User",
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: otherUser.id }],
        },
      },
    });
    const firstMessage = await prisma.message.create({
      data: {
        content: "First message",
        senderId: currentUser.id,
        conversationId: conversation.id,
        createdAt: new Date("2026-09-02T01:00:00.000Z"),
      },
    });
    const secondMessage = await prisma.message.create({
      data: {
        content: "Second message",
        senderId: otherUser.id,
        conversationId: conversation.id,
        createdAt: new Date("2026-09-02T02:00:00.000Z"),
      },
    });
    const thirdMessage = await prisma.message.create({
      data: {
        content: "Third message",
        senderId: currentUser.id,
        conversationId: conversation.id,
        createdAt: new Date("2026-09-02T02:00:00.000Z"),
      },
    });
    const accessCookie = await loginAndGetAccessCookie(app, credentials);
    const limit = 2;

    const firstPageResponse = await request(app)
      .get(`/conversations/${conversation.id}/messages`)
      .query({ limit: String(limit) })
      .set("Cookie", accessCookie);

    expect(firstPageResponse.status).toBe(200);

    const firstPage = getBody<GetMessagesResponseBody>(firstPageResponse);
    const firstPageIds = firstPage.messages.map(({ id }) => id);
    expect(firstPage.messages).toHaveLength(limit);
    expect(firstPageIds).toEqual([thirdMessage.id, secondMessage.id]);
    expect(firstPage.nextCursor).toBe(secondMessage.id);

    const secondPageResponse = await request(app)
      .get(`/conversations/${conversation.id}/messages`)
      .query({ cursor: String(firstPage.nextCursor), limit: String(limit) })
      .set("Cookie", accessCookie);

    expect(secondPageResponse.status).toBe(200);

    const secondPage = getBody<GetMessagesResponseBody>(secondPageResponse);
    const secondPageIds = secondPage.messages.map(({ id }) => id);
    expect(secondPageIds).toEqual([firstMessage.id]);
    expect(secondPageIds.some((id) => firstPageIds.includes(id))).toBe(false);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).get("/conversations/1/messages");

    expect(response.status).toBe(401);
  });

  it("returns 404 when the conversation does not exist", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    await createTestUser(credentials);
    const accessCookie = await loginAndGetAccessCookie(app, credentials);

    const response = await request(app)
      .get("/conversations/999999/messages")
      .set("Cookie", accessCookie);

    expect(response.status).toBe(404);
  });

  it("returns 403 when the authenticated user is not a participant", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    await createTestUser(credentials);
    const firstParticipant = await createTestUser({
      username: "first-participant",
      displayName: "First Participant",
    });
    const secondParticipant = await createTestUser({
      username: "second-participant",
      displayName: "Second Participant",
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: firstParticipant.id }, { id: secondParticipant.id }],
        },
      },
    });
    const accessCookie = await loginAndGetAccessCookie(app, credentials);

    const response = await request(app)
      .get(`/conversations/${conversation.id}/messages`)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(403);
  });

  it.each([
    { caseName: "the conversation id is not a number", conversationId: "invalid" },
    { caseName: "the conversation id is zero", conversationId: "0" },
    { caseName: "the conversation id is negative", conversationId: "-1" },
    { caseName: "the conversation id is a decimal", conversationId: "1.5" },
  ])("returns 400 when $caseName", async ({ conversationId }) => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    await createTestUser(credentials);
    const accessCookie = await loginAndGetAccessCookie(app, credentials);

    const response = await request(app)
      .get(`/conversations/${conversationId}/messages`)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(400);
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
    const otherUser = await createTestUser({
      username: "other-user",
      displayName: "Other User",
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: otherUser.id }],
        },
      },
    });
    const accessCookie = await loginAndGetAccessCookie(app, credentials);

    const response = await request(app)
      .get(`/conversations/${conversation.id}/messages`)
      .query(query)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(400);
  });
});
