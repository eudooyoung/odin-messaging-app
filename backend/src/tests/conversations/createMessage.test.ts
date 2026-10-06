import assert from "node:assert/strict";
import request from "supertest";
import { env } from "@/config/env.config.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestConversation } from "@/tests/helpers/createTestConversation.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import { getBody } from "@/tests/helpers/getBody.js";
import "@/tests/integration.setup.js";
import type { CreateMessageResponseBody } from "@/types/api.types.js";

describe("POST /conversations/:id/messages", () => {
  it.each(["json", "form"])(
    "rejects a cross-origin %s request without storing a message or updating activity",
    async (contentType) => {
      const currentUser = await createTestUser();
      const otherUser = await createTestUser({ username: "other-user" });
      const lastActivityAt = new Date("2026-09-01T00:00:00.000Z");
      const conversation = await createTestConversation({
        participantIds: [currentUser.id, otherUser.id],
        lastActivityAt,
      });

      const response = await request(createApp())
        .post(`/conversations/${conversation.id}/messages`)
        .set("Origin", "https://untrusted.example")
        .set("Cookie", createAccessTokenCookie(currentUser.id))
        .type(contentType)
        .send({ content: "Forged message" });

      expect.soft(response.status).toBe(403);
      await expect
        .soft(prisma.message.count({ where: { conversationId: conversation.id } }))
        .resolves.toBe(0);
      const persistedConversation = await prisma.conversation.findUnique({
        where: { id: conversation.id },
      });
      expect(persistedConversation?.lastActivityAt).toEqual(lastActivityAt);
    },
  );

  it("creates a message and updates the conversation activity", async () => {
    const app = createApp();
    const credentials = {
      username: "current-user",
      handle: "current_handle",
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
    const conversation = await createTestConversation({
      participantIds: [currentUser.id, otherUser.id],
      lastActivityAt: new Date("2026-09-01T00:00:00.000Z"),
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);
    const content = "Hello!";

    const response = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send({ content: `  ${content}  ` });

    expect(response.status).toBe(201);

    const body = getBody<CreateMessageResponseBody>(response);
    expect(typeof body.id).toBe("number");
    expect(body.content).toBe(content);
    expect(body.sender).toEqual({
      id: currentUser.id,
      handle: currentUser.handle,
      displayName: currentUser.displayName,
      profileImage: currentUser.profileImage,
    });
    expect(typeof body.createdAt).toBe("string");

    const persistedMessage = await prisma.message.findUnique({
      where: { id: body.id },
    });
    assert.ok(persistedMessage, "Message was not persisted");
    expect(persistedMessage).toMatchObject({
      id: body.id,
      content,
      senderId: currentUser.id,
      conversationId: conversation.id,
    });
    expect(body.createdAt).toBe(persistedMessage.createdAt.toISOString());

    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: conversation.id },
    });
    assert.ok(updatedConversation, "Conversation was not found after message creation");
    expect(updatedConversation.lastActivityAt).toEqual(persistedMessage.createdAt);
  });

  it("returns 401 when the access token cookie is missing", async () => {
    const response = await request(createApp())
      .post("/conversations/1/messages")
      .set("Origin", env.frontendOrigin)
      .send({ content: "Hello!" });

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

    const response = await request(app)
      .post("/conversations/999999/messages")
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send({ content: "Hello!" });

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
    const conversation = await createTestConversation({
      participantIds: [firstParticipant.id, secondParticipant.id],
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send({ content: "Hello!" });

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
      .post(`/conversations/${conversationId}/messages`)
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send({ content: "Hello!" });

    expect(response.status).toBe(400);
  });

  it.each([
    { caseName: "content is missing", requestBody: {} },
    { caseName: "content is empty", requestBody: { content: "" } },
    { caseName: "content contains only whitespace", requestBody: { content: "   " } },
    {
      caseName: "content has 1001 characters after trimming",
      requestBody: { content: `  ${"a".repeat(1001)}  ` },
    },
  ])("returns 400 when $caseName", async ({ requestBody }) => {
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
    const conversation = await createTestConversation({
      participantIds: [currentUser.id, otherUser.id],
    });
    const accessCookie = createAccessTokenCookie(currentUser.id);

    const response = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set("Origin", env.frontendOrigin)
      .set("Cookie", accessCookie)
      .send(requestBody);

    expect(response.status).toBe(400);
  });
});
