import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import BadRequestError from "@/errors/badRequestError.js";
import ForbiddenError from "@/errors/forbiddenError.js";
import NotFoundError from "@/errors/notFoundError.js";
import {
  findConversationById,
  findConversationsByParticipantId,
  findOrCreateConversation,
} from "@/repositories/conversation.repository.js";
import { findUserByHandle } from "@/repositories/user.repository.js";

const maxConversationCreationAttempts = 5;

const isConversationWriteConflict = (error: unknown) => {
  if (error instanceof PrismaClientKnownRequestError) {
    return error.code === "P2034";
  }

  // The PostgreSQL adapter can surface commit conflicts without a P2034 wrapper.
  return (
    error instanceof Error &&
    error.name === "DriverAdapterError" &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "kind" in error.cause &&
    error.cause.kind === "TransactionWriteConflict"
  );
};

export const getConversationService = async (currentUserId: number, conversationId: number) => {
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

export const createConversationService = async (currentUserId: number, targetHandle: string) => {
  const targetUser = await findUserByHandle(targetHandle);

  if (!targetUser) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  if (targetUser.id === currentUserId) {
    throw new BadRequestError(
      "Cannot create a conversation with yourself",
      "SELF_CONVERSATION_NOT_ALLOWED",
    );
  }

  const participantIds = [currentUserId, targetUser.id].sort((a, b) => a - b);

  for (let attempt = 1; ; attempt++) {
    try {
      return await findOrCreateConversation(participantIds);
    } catch (error) {
      if (!isConversationWriteConflict(error) || attempt >= maxConversationCreationAttempts) {
        throw error;
      }
    }
  }
};
