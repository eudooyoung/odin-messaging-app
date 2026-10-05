import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

const handleUniqueDbIndex = "User_handle_key";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isHandleUniqueConstraintError = (error: unknown) => {
  const isUniqueConstraintError =
    error instanceof PrismaClientKnownRequestError && error.code === "P2002";
  if (!isUniqueConstraintError) {
    return false;
  }

  const driverAdapterError = error.meta?.driverAdapterError;
  if (!isRecord(driverAdapterError)) {
    return false;
  }
  const cause = driverAdapterError.cause;
  if (!isRecord(cause)) {
    return false;
  }

  const isUniqueConstraintViolation = cause.kind === "UniqueConstraintViolation";
  const constraint = cause.constraint;
  if (!isUniqueConstraintViolation || !isRecord(constraint)) {
    return false;
  }

  const fields = constraint.fields;
  if (Array.isArray(fields) && fields.includes("handle")) {
    return true;
  }

  return constraint.index === handleUniqueDbIndex;
};
