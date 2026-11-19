import { createApp } from "@/app.js";
import { env } from "@/config/env.config.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestConversation } from "@/tests/helpers/createTestConversation.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { injectedUpdateFailure, checkpoint } = vi.hoisted(() => {
  const checkpoint: { wait?: () => Promise<void>; resume?: () => void } = {};

  return { injectedUpdateFailure: vi.fn(), checkpoint };
});

vi.mock("@/lib/prisma.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma.js")>();

  return {
    prisma: actual.prisma.$extends({
      query: {
        message: {
          async create({ args, query }) {
            const result = await query(args);
            // race condition distribution
            await checkpoint.wait?.();
            return result;
          },
        },
        async $executeRaw({ args, query }) {
          const result = (await query(args)) as number;
          // forcing error
          await injectedUpdateFailure();
          return result;
        },
      },
    }),
  };
});

describe("Create message atomicity", () => {
  afterEach(() => {
    injectedUpdateFailure.mockReset();
    checkpoint.resume?.();
    delete checkpoint.wait;
    delete checkpoint.resume;
  });

  it("rolls back the message when updating the conversation activity fails", async () => {
    // arrange
    const userA = await createTestUser({ username: "user A" });
    const userB = await createTestUser({ username: "user B" });
    const lastActivityAt = new Date("2026-09-01T00:00:00.000Z");
    const conversation = await createTestConversation({
      participantIds: [userA.id, userB.id],
      lastActivityAt,
    });
    injectedUpdateFailure.mockRejectedValueOnce(
      new Error("Simulated conversation activity update failure"),
    );

    // act & assert
    await request(createApp())
      .post(`/conversations/${conversation.id}/messages`)
      .set("Origin", env.frontendOrigin)
      .set("Cookie", createAccessTokenCookie(userA.id))
      .send({ content: "Hello!" })
      .expect(500);
    expect(injectedUpdateFailure).toHaveBeenCalled();

    const messageCount = await prisma.message.count({ where: { conversationId: conversation.id } });
    expect(messageCount).toBe(0);
    const { lastActivityAt: newLastActivityAt } = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      select: { lastActivityAt: true },
    });
    expect(newLastActivityAt).toEqual(lastActivityAt);
  });

  it("keeps the latest message created time record", async () => {
    // arrange
    const userA = await createTestUser({ username: "user A" });
    const userB = await createTestUser({ username: "user B" });
    const conversation = await createTestConversation({
      participantIds: [userA.id, userB.id],
    });
    const { promise: checkpointReached, resolve: resolveCheckpointReached } =
      Promise.withResolvers<void>();
    const { promise: resumeARequested, resolve: resolveResumeARequested } =
      Promise.withResolvers<void>();
    checkpoint.resume = resolveResumeARequested;
    checkpoint.wait = async () => {
      delete checkpoint.wait;
      resolveCheckpointReached();
      await resumeARequested;
    };

    // act
    const responseAReceived = request(createApp())
      .post(`/conversations/${conversation.id}/messages`)
      .set("Origin", env.frontendOrigin)
      .set("Cookie", createAccessTokenCookie(userA.id))
      .send({ content: "Hello, user B!" })
      .then((response) => response);

    try {
      await Promise.race([
        checkpointReached,
        responseAReceived.then(() => {
          throw new Error("Response A resolved before checkpoint");
        }),
      ]);

      await request(createApp())
        .post(`/conversations/${conversation.id}/messages`)
        .set("Origin", env.frontendOrigin)
        .set("Cookie", createAccessTokenCookie(userB.id))
        .send({ content: "Hello, user A!" })
        .expect(201);
    } finally {
      checkpoint.resume();
      await Promise.allSettled([responseAReceived]);
    }
    const responseA = await responseAReceived;

    // assert
    expect(responseA.status).toBe(201);
    const { messages, lastActivityAt } = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversation.id },
      select: { messages: true, lastActivityAt: true },
    });
    expect(messages.length).toBe(2);
    const [firstMessage, secondMessage] = messages;
    expect(firstMessage!.createdAt.getTime()).not.toBe(secondMessage!.createdAt.getTime());
    expect(lastActivityAt.getTime()).toBeGreaterThanOrEqual(
      Math.max(firstMessage!.createdAt.getTime(), secondMessage!.createdAt.getTime()),
    );
  });
});
