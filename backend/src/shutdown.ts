import type { Server } from "node:http";
import { prisma } from "./lib/prisma.js";

export const registerShutdown = (server: Server) => {
  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    await prisma.$disconnect();

    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
};
