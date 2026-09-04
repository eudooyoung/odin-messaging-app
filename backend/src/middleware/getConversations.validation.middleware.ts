import BadRequestError from "@/errors/badRequestError.js";
import { getConversationsQuerySchema } from "@/schemas/conversation.schema.js";
import type { GetConversationsHandler } from "@/types/handler.types.js";

export const validateGetConversations: GetConversationsHandler = (req, res, next) => {
  const result = getConversationsQuerySchema.safeParse(req.query);

  if (!result.success) {
    return next(new BadRequestError("Invalid conversation query", "INVALID_CONVERSATION_QUERY"));
  }

  if (result.data.cursor !== undefined) {
    res.locals.cursor = result.data.cursor;
  }

  if (result.data.limit !== undefined) {
    res.locals.limit = result.data.limit;
  }

  next();
};
