import type { PublicUserIdentity } from "@/features/users/user.type.ts";

export type Message = {
  id: number;
  content: string;
  sender: PublicUserIdentity;
  createdAt: string;
};

export type MessagesPage = {
  messages: Message[];
  nextCursor: number | null;
};
