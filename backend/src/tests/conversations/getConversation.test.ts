import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import type { ConversationResponseBody } from "@/types/api.types.js";

const getBody = <T>(response: Response) => response.body as T;

describe("GET /conversations/:id", () => {
  it("returns the conversation when the authenticated user is a participant", async () => {
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
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        lastActivityAt: new Date("2026-09-01T01:00:00.000Z"),
      },
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .get(`/conversations/${conversation.id}`)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(200);

    const body = getBody<ConversationResponseBody>(response);
    expect(body.id).toBe(conversation.id);
    expect(body.createdAt).toBe(conversation.createdAt.toISOString());
    expect(body.lastActivityAt).toBe(conversation.lastActivityAt.toISOString());

    expect(body.participants).toHaveLength(2);

    expect(body.participants).toContainEqual({
      username: currentUser.username,
      displayName: currentUser.displayName,
      profileImage: currentUser.profileImage,
    });

    expect(body.participants).toContainEqual({
      username: otherUser.username,
      displayName: otherUser.displayName,
      profileImage: otherUser.profileImage,
    });
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).get("/conversations/1");

    expect(response.status).toBe(401);
  });

  it("returns 404 when the conversation does not exist", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app).get("/conversations/999999").set("Cookie", accessCookie);

    expect(response.status).toBe(404);
  });

  it("returns 403 when the authenticated user is not a participant", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
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
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .get(`/conversations/${conversation.id}`)
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
    const currentUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .get(`/conversations/${conversationId}`)
      .set("Cookie", accessCookie);

    expect(response.status).toBe(400);
  });
});
