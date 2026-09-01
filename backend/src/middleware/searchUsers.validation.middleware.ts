import BadRequestError from "@/errors/badRequestError.js";
import { searchUsersQuerySchema } from "@/schemas/user.schema.js";
import type { SearchUsersHandler } from "@/types/handler.types.js";

export const validateSearchUsers: SearchUsersHandler = (req, res, next) => {
  const result = searchUsersQuerySchema.safeParse(req.query);

  if (!result.success) {
    return next(new BadRequestError("Invalid search query", "INVALID_SEARCH_QUERY"));
  }

  res.locals.query = result.data.query;
  next();
};
