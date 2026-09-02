import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import {
  findConversationById,
  updateConversationLastActivityAt,
} from "@/repositories/conversation.repository.js";
import { createMessage } from "@/repositories/message.repository.js";

export const createMessageService = async (
  currentUserId: number,
  conversationId: number,
  content: string,
) => {
  const conversation = await findConversationById(conversationId);

  if (!conversation) {
    throw new NotFoundError("Conversation not found", "CONVERSATION_NOT_FOUND");
  }

  if (!conversation.participants.some(({ id }) => id === currentUserId)) {
    throw new ForbiddenError("Conversation access forbidden", "CONVERSATION_FORBIDDEN");
  }

  const message = await createMessage(conversationId, currentUserId, content);

  await updateConversationLastActivityAt(conversationId, message.createdAt);

  return message;
};
