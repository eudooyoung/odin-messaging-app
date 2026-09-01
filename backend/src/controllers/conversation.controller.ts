import {
  createConversationService,
  getConversationService,
  getConversationsService,
} from "@/services/conversation.service.js";
import type {
  CreateConversationHandler,
  GetConversationHandler,
  GetConversationsHandler,
} from "@/types/handler.types.js";

export const getConversationController: GetConversationHandler = async (_req, res) => {
  const conversation = await getConversationService(
    res.locals.userId,
    res.locals.conversationId,
  );

  res.status(200).json({
    id: conversation.id,
    participants: conversation.participants.map((participant) => ({
      username: participant.username,
      displayName: participant.displayName,
      profileImage: participant.profileImage,
    })),
    createdAt: conversation.createdAt.toISOString(),
    lastActivityAt: conversation.lastActivityAt.toISOString(),
  });
};

export const getConversationsController: GetConversationsHandler = async (_req, res) => {
  const { conversations, nextCursor } = await getConversationsService(
    res.locals.userId,
    res.locals.cursor,
    res.locals.limit,
  );

  res.status(200).json({
    conversations: conversations.map((conversation) => ({
      ...conversation,
      otherUser: conversation.otherUser!,
      lastMessage: conversation.lastMessage
        ? {
            ...conversation.lastMessage,
            createdAt: conversation.lastMessage.createdAt.toISOString(),
          }
        : null,
      lastActivityAt: conversation.lastActivityAt.toISOString(),
    })),
    nextCursor,
  });
};

export const createConversationController: CreateConversationHandler = async (req, res) => {
  const { conversation, created } = await createConversationService(
    res.locals.userId,
    req.body.targetUsername,
  );

  res.status(created ? 201 : 200).json({
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    lastActivityAt: conversation.lastActivityAt.toISOString(),
  });
};
