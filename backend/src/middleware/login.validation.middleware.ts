import BadRequestError from "@/errors/badRequestError";
import { loginSchema } from "@/schemas/auth.schema.js";
import type { LoginHandler } from "@/types/handler.types.js";

export const validateLogin: LoginHandler = (req, _res, next) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return next(new BadRequestError("Invalid login input", "INVALID_LOGIN_INPUT"));
  }

  req.body = result.data;
  next();
};
