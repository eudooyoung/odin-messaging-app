import { prisma } from "@/lib/prisma.js";
import { afterAll, beforeEach } from "vitest";

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.user.deleteMany();

  await prisma.$disconnect();
});
