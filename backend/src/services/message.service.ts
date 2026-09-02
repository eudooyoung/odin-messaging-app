import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import {
  findConversationById,
  updateConversationLastActivityAt,
} from "@/repositories/conversation.repository.js";
import * as messageRepository from "@/repositories/message.repository.js";

export const getMessagesService = async (
  currentUserId: number,
  conversationId: number,
  cursor?: number,
  limit?: number,
) => {
  const conversation = await findConversationById(conversationId);

  if (!conversation) {
    throw new NotFoundError("Conversation not found", "CONVERSATION_NOT_FOUND");
  }

  if (!conversation.participants.some(({ id }) => id === currentUserId)) {
    throw new ForbiddenError("Conversation access forbidden", "CONVERSATION_FORBIDDEN");
  }

  const messages =
    cursor === undefined && limit === undefined
      ? await messageRepository.findMessagesByConversationId(conversationId)
      : await messageRepository.findMessagesByConversationId(
          conversationId,
          cursor,
          limit,
        );
  const hasNextPage = limit !== undefined && messages.length > limit;
  const page = hasNextPage ? messages.slice(0, limit) : messages;
  const lastMessage = page.at(-1);
  const nextCursor = hasNextPage && lastMessage ? lastMessage.id : null;

  return {
    messages: page,
    nextCursor,
  };
};

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

  const message = await messageRepository.createMessage(
    conversationId,
    currentUserId,
    content,
  );

  await updateConversationLastActivityAt(conversationId, message.createdAt);

  const recipientUserIds = conversation.participants
    .filter(({ id }) => id !== currentUserId)
    .map(({ id }) => id);

  return { message, recipientUserIds };
};
