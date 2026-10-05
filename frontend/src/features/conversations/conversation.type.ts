import type { PublicUserIdentity } from "@/features/users/user.type.ts";

export type ConversationDetail = {
  id: number;
  participants: PublicUserIdentity[];
  createdAt: string;
  lastActivityAt: string;
};

export type ConversationsPage = {
  conversations: {
    id: number;
    otherUser: PublicUserIdentity;
    lastMessage: {
      id: number;
      content: string;
      senderId: number;
      createdAt: string;
    } | null;
    lastActivityAt: string;
  }[];
  nextCursor: number | null;
};
