import BadRequestError from "@/errors/badRequestError.js";
import { createConversationSchema } from "@/schemas/conversation.schema.js";
import type { CreateConversationHandler } from "@/types/handler.types.js";

export const validateCreateConversation: CreateConversationHandler = (req, _res, next) => {
  const result = createConversationSchema.safeParse(req.body);

  if (!result.success) {
    return next(new BadRequestError("Invalid conversation input", "INVALID_CONVERSATION_INPUT"));
  }

  req.body = result.data;
  next();
};
