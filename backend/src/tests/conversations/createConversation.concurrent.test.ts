import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import { getBody } from "@/tests/helpers/getBody.js";
import "@/tests/integration.setup.js";
import type { CreateConversationResponseBody } from "@/types/api.types.js";

const { lookupBarrier } = vi.hoisted(() => {
  const lookupBarrier: { wait?: () => Promise<void>; release?: () => void } = {};

  return { lookupBarrier };
});

vi.mock("@/lib/prisma.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma.js")>();

  return {
    prisma: actual.prisma.$extends({
      query: {
        conversation: {
          async findFirst({ args, query }) {
            const result = await query(args);

            // Keep the real DB result, but hold both initial reads before either request creates.
            await lookupBarrier.wait?.();

            return result;
          },
        },
      },
    }),
  };
});

afterEach(() => {
  lookupBarrier.release?.();
  delete lookupBarrier.wait;
  delete lookupBarrier.release;
});

const synchronizeInitialLookups = () => {
  let completedLookups = 0;
  let release!: () => void;
  const bothLookupsCompleted = new Promise<void>((resolve) => {
    release = resolve;
  });

  lookupBarrier.release = release;
  lookupBarrier.wait = async () => {
    completedLookups += 1;

    if (completedLookups === 2) {
      release();
    }

    // A retried transaction must be able to read the conversation created by the winner.
    if (completedLookups <= 2) {
      await bothLookupsCompleted;
    }
  };
};

describe("POST /conversations concurrent requests", () => {
  it.each([
    { caseName: "A to B and A to B", reverseSecondRequest: false },
    { caseName: "A to B and B to A", reverseSecondRequest: true },
  ])(
    "creates once and reuses the same conversation for $caseName",
    async ({ reverseSecondRequest }) => {
      const app = createApp();
      const userA = await createTestUser({ username: "user-a", handle: "user_a" });
      const userB = await createTestUser({ username: "user-b", handle: "user_b" });
      const secondRequester = reverseSecondRequest ? userB : userA;
      const secondTarget = reverseSecondRequest ? userA : userB;

      synchronizeInitialLookups();

      const [firstResponse, secondResponse] = await Promise.all([
        request(app)
          .post("/conversations")
          .set("Cookie", createAccessTokenCookie(userA.id))
          .send({ targetHandle: userB.handle }),
        request(app)
          .post("/conversations")
          .set("Cookie", createAccessTokenCookie(secondRequester.id))
          .send({ targetHandle: secondTarget.handle }),
      ]);

      expect.soft([firstResponse.status, secondResponse.status].sort()).toEqual([200, 201]);

      const firstBody = getBody<CreateConversationResponseBody>(firstResponse);
      const secondBody = getBody<CreateConversationResponseBody>(secondResponse);
      expect.soft(secondBody.id).toBe(firstBody.id);

      await expect(
        prisma.conversation.count({
          where: {
            AND: [
              { participants: { some: { id: userA.id } } },
              { participants: { some: { id: userB.id } } },
            ],
          },
        }),
      ).resolves.toBe(1);
    },
  );
});
