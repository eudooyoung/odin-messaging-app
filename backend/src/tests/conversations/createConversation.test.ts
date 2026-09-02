import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import type { ConversationResponseBody } from "@/types/api.types.js";

const getBody = <T>(response: Response) => response.body as T;

describe("POST /conversations", () => {
  it("creates a conversation between the authenticated and target users", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const targetUser = await createTestUser({
      username: "target-user",
      displayName: "Target User",
      profileImage: "https://example.com/target.jpg",
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post("/conversations")
      .set("Cookie", accessCookie)
      .send({ targetUsername: targetUser.username });

    expect(response.status).toBe(201);

    const body = getBody<ConversationResponseBody>(response);
    expect(typeof body.id).toBe("number");
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.lastActivityAt).toBe("string");

    expect(body.participants).toHaveLength(2);

    expect(body.participants).toContainEqual({
      username: currentUser.username,
      displayName: currentUser.displayName,
      profileImage: currentUser.profileImage,
    });

    expect(body.participants).toContainEqual({
      username: targetUser.username,
      displayName: targetUser.displayName,
      profileImage: targetUser.profileImage,
    });
  });

  it("returns the existing conversation without creating another one", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const targetUser = await createTestUser({
      username: "target-user",
      displayName: "Target User",
    });
    const existingConversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: targetUser.id }],
        },
      },
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post("/conversations")
      .set("Cookie", accessCookie)
      .send({ targetUsername: targetUser.username });

    expect(response.status).toBe(200);

    const body = getBody<ConversationResponseBody>(response);
    expect(body.id).toBe(existingConversation.id);
    await expect(prisma.conversation.count()).resolves.toBe(1);
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp()).post("/conversations").send({
      targetUsername: "target-user",
    });

    expect(response.status).toBe(401);
  });

  it.each([
    {
      caseName: "the target user does not exist",
      targetUsername: "missing-user",
      expectedStatus: 404,
    },
    {
      caseName: "the target user is the current user",
      targetUsername: "current-user",
      expectedStatus: 400,
    },
  ])("returns $expectedStatus when $caseName", async ({ targetUsername, expectedStatus }) => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post("/conversations")
      .set("Cookie", accessCookie)
      .send({ targetUsername });

    expect(response.status).toBe(expectedStatus);
  });

  it.each([
    {
      caseName: "the target username is missing",
      requestBody: {},
    },
    {
      caseName: "the target username is empty",
      requestBody: { targetUsername: "" },
    },
    {
      caseName: "the target username contains only whitespace",
      requestBody: { targetUsername: "   " },
    },
    {
      caseName: "the target username is longer than 30 characters",
      requestBody: { targetUsername: "a".repeat(31) },
    },
  ])("returns 400 when $caseName", async ({ requestBody }) => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post("/conversations")
      .set("Cookie", accessCookie)
      .send(requestBody);

    expect(response.status).toBe(400);
  });
});
