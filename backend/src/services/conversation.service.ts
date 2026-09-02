import BadRequestError from "@/errors/badRequestError.js";
import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import {
  createConversation,
  findConversationById,
  findConversationByParticipantIds,
  findConversationsByParticipantId,
} from "@/repositories/conversation.repository.js";
import { findUserByUsername } from "@/repositories/user.repository.js";

export const getConversationService = async (
  currentUserId: number,
  conversationId: number,
) => {
  const conversation = await findConversationById(conversationId);

  if (!conversation) {
    throw new NotFoundError("Conversation not found", "CONVERSATION_NOT_FOUND");
  }

  if (!conversation.participants.some(({ id }) => id === currentUserId)) {
    throw new ForbiddenError("Conversation access forbidden", "CONVERSATION_FORBIDDEN");
  }

  return conversation;
};

export const getConversationsService = async (
  currentUserId: number,
  cursor?: number,
  limit?: number,
) => {
  const conversations =
    cursor === undefined && limit === undefined
      ? await findConversationsByParticipantId(currentUserId)
      : await findConversationsByParticipantId(currentUserId, cursor, limit);
  const hasNextPage = limit !== undefined && conversations.length > limit;
  const page = hasNextPage ? conversations.slice(0, limit) : conversations;
  const lastConversation = page.at(-1);
  const nextCursor = hasNextPage && lastConversation ? lastConversation.id : null;

  return {
    conversations: page.map(({ id, participants, messages, lastActivityAt }) => ({
      id,
      otherUser: participants[0],
      lastMessage: messages[0],
      lastActivityAt,
    })),
    nextCursor,
  };
};

export const createConversationService = async (
  currentUserId: number,
  targetUsername: string,
) => {
  const targetUser = await findUserByUsername(targetUsername);

  if (!targetUser) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  if (targetUser.id === currentUserId) {
    throw new BadRequestError(
      "Cannot create a conversation with yourself",
      "SELF_CONVERSATION_NOT_ALLOWED",
    );
  }

  const participantIds = [currentUserId, targetUser.id];
  const existingConversation = await findConversationByParticipantIds(participantIds);

  if (existingConversation) {
    return { conversation: existingConversation, created: false };
  }

  const conversation = await createConversation(participantIds);

  return { conversation, created: true };
};
