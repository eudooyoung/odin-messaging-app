import request from "supertest";
import { env } from "@/config/env.config.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import { getBody } from "@/tests/helpers/getBody.js";
import "@/tests/integration.setup.js";
import type { CreateConversationResponseBody } from "@/types/api.types.js";

describe("POST /conversations", () => {
  it("creates a conversation between the authenticated and target users", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      handle: "current_handle",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const targetUser = await createTestUser({
      username: "target-user",
      handle: "a_1",
      displayName: "Target User",
      profileImage: "https://example.com/target.jpg",
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post("/conversations")
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send({ targetHandle: targetUser.handle });

    expect(response.status).toBe(201);

    const body = getBody<CreateConversationResponseBody>(response);
    expect(typeof body.id).toBe("number");
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.lastActivityAt).toBe("string");

    expect(body.participants).toHaveLength(2);

    expect(body.participants).toContainEqual({
      id: currentUser.id,
      handle: currentUser.handle,
      displayName: currentUser.displayName,
      profileImage: currentUser.profileImage,
    });

    expect(body.participants).toContainEqual({
      id: targetUser.id,
      handle: targetUser.handle,
      displayName: targetUser.displayName,
      profileImage: targetUser.profileImage,
    });
  });

  it("returns the existing conversation without creating another one", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      handle: "current_handle",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const targetUser = await createTestUser({
      username: "target-user",
      handle: "_1234567890.abcdefghijklmnopq_",
      displayName: "Target User",
      profileImage: "https://example.com/target.jpg",
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
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send({ targetHandle: targetUser.handle });

    expect(response.status).toBe(200);

    const body = getBody<CreateConversationResponseBody>(response);
    expect(body.id).toBe(existingConversation.id);
    expect(body.participants).toHaveLength(2);
    expect(body.participants).toContainEqual({
      id: currentUser.id,
      handle: currentUser.handle,
      displayName: currentUser.displayName,
      profileImage: currentUser.profileImage,
    });
    expect(body.participants).toContainEqual({
      id: targetUser.id,
      handle: targetUser.handle,
      displayName: targetUser.displayName,
      profileImage: targetUser.profileImage,
    });
    await expect(prisma.conversation.count()).resolves.toBe(1);
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp())
      .post("/conversations")
      .set("Origin", env.frontendOrigin)
      .send({
        targetHandle: "target_handle",
      });

    expect(response.status).toBe(401);
  });

  it.each([
    {
      caseName: "the target user does not exist",
      targetHandle: "missing_handle",
      expectedStatus: 404,
    },
    {
      caseName: "the target user is the current user",
      targetHandle: "current_handle",
      expectedStatus: 400,
    },
  ])("returns $expectedStatus when $caseName", async ({ targetHandle, expectedStatus }) => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      handle: "current_handle",
      password: "secure-password",
      displayName: "Current User",
    };
    const currentUser = await createTestUser(credentials);
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post("/conversations")
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send({ targetHandle });

    expect(response.status).toBe(expectedStatus);
  });

  it.each([
    {
      caseName: "the target handle is missing",
      requestBody: {},
    },
    {
      caseName: "only the legacy target username is provided",
      requestBody: { targetUsername: "target-user" },
    },
    {
      caseName: "the target handle is empty",
      requestBody: { targetHandle: "" },
    },
    {
      caseName: "the target handle contains only whitespace",
      requestBody: { targetHandle: "   " },
    },
    {
      caseName: "the target handle is shorter than 3 characters",
      requestBody: { targetHandle: "ab" },
    },
    {
      caseName: "the target handle is longer than 30 characters",
      requestBody: { targetHandle: "a".repeat(31) },
    },
    {
      caseName: "the target handle contains an uppercase letter",
      requestBody: { targetHandle: "invalidHandle" },
    },
    {
      caseName: "the target handle contains a disallowed character",
      requestBody: { targetHandle: "invalid-handle" },
    },
    {
      caseName: "the target handle starts with a dot",
      requestBody: { targetHandle: ".invalid_handle" },
    },
    {
      caseName: "the target handle ends with a dot",
      requestBody: { targetHandle: "invalid_handle." },
    },
    {
      caseName: "the target handle contains consecutive dots",
      requestBody: { targetHandle: "invalid..handle" },
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
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send(requestBody);

    expect(response.status).toBe(400);
  });
});
