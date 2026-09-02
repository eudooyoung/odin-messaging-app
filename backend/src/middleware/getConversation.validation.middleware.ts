import BadRequestError from "@/errors/badRequestError.js";
import { getConversationParamsSchema } from "@/schemas/conversation.schema.js";
import type { GetConversationHandler } from "@/types/handler.types.js";

export const validateGetConversation: GetConversationHandler = (req, res, next) => {
  const result = getConversationParamsSchema.safeParse(req.params);

  if (!result.success) {
    return next(
      new BadRequestError("Invalid conversation id", "INVALID_CONVERSATION_ID"),
    );
  }

  res.locals.conversationId = result.data.id;
  next();
};
