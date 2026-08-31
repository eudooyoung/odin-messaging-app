import BadRequestError from "@/errors/badRequestError";
import { registerSchema } from "@/schemas/auth.schema.js";
import type { RegisterHandler } from "@/types/handler.types.js";

export const validateRegister: RegisterHandler = (req, _res, next) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    return next(new BadRequestError("Invalid registration input", "INVALID_REGISTRATION_INPUT"));
  }

  req.body = result.data;
  next();
};
