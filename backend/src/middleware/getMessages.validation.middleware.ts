import BadRequestError from "@/errors/badRequestError.js";
import {
  getConversationParamsSchema,
  getConversationsQuerySchema,
} from "@/schemas/conversation.schema.js";
import type { GetMessagesHandler } from "@/types/handler.types.js";

export const validateGetMessages: GetMessagesHandler = (req, res, next) => {
  const paramsResult = getConversationParamsSchema.safeParse(req.params);
  const queryResult = getConversationsQuerySchema.safeParse(req.query);

  if (!paramsResult.success || !queryResult.success) {
    return next(new BadRequestError("Invalid message query", "INVALID_MESSAGE_QUERY"));
  }

  res.locals.conversationId = paramsResult.data.id;

  if (queryResult.data.cursor !== undefined) {
    res.locals.cursor = queryResult.data.cursor;
  }

  if (queryResult.data.limit !== undefined) {
    res.locals.limit = queryResult.data.limit;
  }

  next();
};
