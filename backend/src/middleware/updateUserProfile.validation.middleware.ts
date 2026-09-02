import BadRequestError from "@/errors/badRequestError.js";
import { updateUserProfileSchema } from "@/schemas/user.schema.js";
import type { UpdateUserProfileInput } from "@/types/api.types";
import type { UpdateUserProfileHandler } from "@/types/handler.types.js";

export const validateUpdateUserProfile: UpdateUserProfileHandler = (req, _res, next) => {
  const result = updateUserProfileSchema.safeParse(req.body);

  if (!result.success) {
    return next(new BadRequestError("Invalid profile input", "INVALID_PROFILE_INPUT"));
  }

  req.body = result.data as UpdateUserProfileInput;
  next();
};
