import type { CreateMessageResponseBody } from "@/types/api.types.js";
import type WebSocket from "ws";

export type WebSocketConnectionRegistry = Map<number, Set<WebSocket>>;

export type MessageCreatedPublisher = (
  recipientUserIds: number[],
  conversationId: number,
  message: CreateMessageResponseBody,
) => void;
