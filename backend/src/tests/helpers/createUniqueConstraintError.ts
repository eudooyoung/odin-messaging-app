import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

export const createUniqueConstraintError = (index: string) =>
  new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: {
      modelName: "User",
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          kind: "UniqueConstraintViolation",
          constraint: { index },
        },
      },
    },
  });
