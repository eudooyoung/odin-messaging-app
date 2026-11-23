import { createApp } from "@/app.js";
import { env } from "@/config/env.config.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestConversation } from "@/tests/helpers/createTestConversation.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import request from "supertest";
import { describe, expect, it } from "vitest";

describe("POST /conversations/:id/messages", () => {
  it("creates a message and updates the conversation activity", async () => {
    // arrange
    const sender = await createTestUser({
      username: "sender",
      displayName: "Sender",
    });
    const recipient = await createTestUser();
    const conversation = await createTestConversation({
      participantIds: [sender.id, recipient.id],
    });
    const senderAccessToken = createAccessTokenCookie(sender.id);
    const messageContent = "Sender Message";

    // act
    const { body: senderResponseBody } = await request(createApp())
      .post(`/conversations/${conversation.id}/messages`)
      .set("Origin", env.frontendOrigin)
      .set("Cookie", senderAccessToken)
      .send({ content: messageContent })
      .expect(201);

    // assert
    expect(senderResponseBody).toMatchObject({
      id: expect.any(Number),
      content: messageContent,
      sender: {
        id: sender.id,
        handle: sender.handle,
        displayName: sender.displayName,
        profileImage: sender.profileImage,
      },
      createdAt: expect.any(String),
    });
    const { lastActivityAt } = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      select: { lastActivityAt: true },
    });
    expect(lastActivityAt.toISOString()).toEqual(senderResponseBody.createdAt);
  });

  describe("Errors", () => {
    it("returns 401 when the access token cookie is missing", () => {
      return request(createApp())
        .post("/conversations/1/messages")
        .set("Origin", env.frontendOrigin)
        .send({ content: "Hello!" })
        .expect(401);
    });

    it("returns 404 when the conversation does not exist", async () => {
      const sender = await createTestUser();
      const accessCookie = createAccessTokenCookie(sender.id);

      const {
        _max: { id: latestId },
      } = await prisma.conversation.aggregate({ _max: { id: true } });
      const unknownId = (latestId ?? 0) + 1;

      await request(createApp())
        .post(`/conversations/${unknownId}/messages`)
        .set("Origin", env.frontendOrigin)
        .set("Cookie", accessCookie)
        .send({ content: "Hello!" })
        .expect(404);
    });

    it("returns 403 when the authenticated user is not a participant", async () => {
      const nonparticipant = await createTestUser({ username: "nonparticipant" });
      const participantA = await createTestUser({ username: "participant-a" });
      const participantB = await createTestUser({ username: "participant-b" });
      const conversation = await createTestConversation({
        participantIds: [participantA.id, participantB.id],
      });

      await request(createApp())
        .post(`/conversations/${conversation.id}/messages`)
        .set("Origin", env.frontendOrigin)
        .set("Cookie", createAccessTokenCookie(nonparticipant.id))
        .send({ content: "Hello!" })
        .expect(403);
    });

    it.each([
      { caseName: "the conversation id is not a number", conversationId: "invalid" },
      { caseName: "the conversation id is zero", conversationId: "0" },
      { caseName: "the conversation id is negative", conversationId: "-1" },
      { caseName: "the conversation id is a decimal", conversationId: "1.5" },
    ])("returns 400 when $caseName", async ({ conversationId }) => {
      const currentUser = await createTestUser();

      await request(createApp())
        .post(`/conversations/${conversationId}/messages`)
        .set("Origin", env.frontendOrigin)
        .set("Cookie", createAccessTokenCookie(currentUser.id))
        .send({ content: "Hello!" })
        .expect(400);
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
      const sender = await createTestUser({ username: "sender" });
      const recipient = await createTestUser({ username: "recipient" });
      const conversation = await createTestConversation({
        participantIds: [sender.id, recipient.id],
      });

      await request(createApp())
        .post(`/conversations/${conversation.id}/messages`)
        .set("Origin", env.frontendOrigin)
        .set("Cookie", createAccessTokenCookie(sender.id))
        .send(requestBody)
        .expect(400);
    });
  });
});
