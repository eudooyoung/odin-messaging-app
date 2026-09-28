import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma.js";
import { rotateRefreshSession } from "@/repositories/refreshSession.repository.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import "@/tests/integration.setup.js";

it("rolls back the previous session deletion when the replacement token hash already exists", async () => {
  const user = await createTestUser();
  const previousTokenHash = "previous-token-hash";
  const conflictingTokenHash = "existing-token-hash";
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const sessionA = await prisma.refreshSession.create({
    data: { tokenHash: previousTokenHash, userId: user.id, expiresAt },
  });
  const sessionB = await prisma.refreshSession.create({
    data: { tokenHash: conflictingTokenHash, userId: user.id, expiresAt },
  });

  await expect(
    rotateRefreshSession({
      previousTokenHash,
      tokenHash: conflictingTokenHash,
      userId: user.id,
      expiresAt,
    }),
  ).rejects.toMatchObject({ code: "P2002" });

  await expect(
    prisma.refreshSession.findMany({
      where: { userId: user.id },
      select: { id: true, tokenHash: true },
      orderBy: { id: "asc" },
    }),
  ).resolves.toEqual([
    { id: sessionA.id, tokenHash: previousTokenHash },
    { id: sessionB.id, tokenHash: conflictingTokenHash },
  ]);
});
