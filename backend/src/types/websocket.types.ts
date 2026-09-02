import type WebSocket from "ws";
import type { CreateMessageResponseBody } from "@/types/api.types.js";

export type AuthenticatedWebSocket = WebSocket & { userId: number };

export type WebSocketConnectionRegistry = Map<
  number,
  Set<AuthenticatedWebSocket>
>;

export type MessageCreatedPublisher = (
  recipientUserIds: number[],
  conversationId: number,
  message: CreateMessageResponseBody,
) => void;
