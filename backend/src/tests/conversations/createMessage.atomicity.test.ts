import request from "supertest";
import { env } from "@/config/env.config.js";
import { expect, it, vi } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestConversation } from "@/tests/helpers/createTestConversation.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";

const { injectedUpdateFailure } = vi.hoisted(() => ({ injectedUpdateFailure: vi.fn() }));

vi.mock("@/lib/prisma.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma.js")>();

  return {
    prisma: actual.prisma.$extends({
      query: {
        conversation: {
          update() {
            injectedUpdateFailure();
            return Promise.reject(new Error("Simulated conversation activity update failure"));
          },
        },
      },
    }),
  };
});

it("rolls back the message when updating the conversation activity fails", async () => {
  const sender = await createTestUser({ username: "sender" });
  const recipient = await createTestUser({ username: "recipient" });
  const lastActivityAt = new Date("2026-09-01T00:00:00.000Z");
  const conversation = await createTestConversation({
    participantIds: [sender.id, recipient.id],
    lastActivityAt,
  });

  const response = await request(createApp())
    .post(`/conversations/${conversation.id}/messages`)
    .set("Origin", env.frontendOrigin)
    .set("Cookie", createAccessTokenCookie(sender.id))
    .send({ content: "Hello!" });

  expect.soft(response.status).toBe(500);
  expect.soft(injectedUpdateFailure).toHaveBeenCalled();
  await expect
    .soft(prisma.message.count({ where: { conversationId: conversation.id } }))
    .resolves.toBe(0);
  const persistedConversation = await prisma.conversation.findUnique({
    where: { id: conversation.id },
  });
  expect(persistedConversation?.lastActivityAt).toEqual(lastActivityAt);
});
