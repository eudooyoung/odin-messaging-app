import type { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { verifyAccessToken } from "@/lib/accessToken.js";
import { getCookieValue } from "@/lib/cookie.js";
import type {
  AuthenticatedWebSocket,
  MessageCreatedPublisher,
  WebSocketConnectionRegistry,
} from "@/types/websocket.types.js";

export const createWebSocketConnectionRegistry = (): WebSocketConnectionRegistry =>
  new Map<number, Set<AuthenticatedWebSocket>>();

export const attachWebSocketServer = (
  httpServer: Server,
  connectionRegistry: WebSocketConnectionRegistry,
) => {
  const webSocketServer = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const accessToken = getCookieValue(request.headers.cookie, "accessToken");

    const userId = accessToken ? verifyAccessToken(accessToken) : null;

    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      const authenticatedWebSocket = webSocket as AuthenticatedWebSocket;
      authenticatedWebSocket.userId = userId;

      let userConnections = connectionRegistry.get(userId);

      if (!userConnections) {
        userConnections = new Set<AuthenticatedWebSocket>();
        connectionRegistry.set(userId, userConnections);
      }

      userConnections.add(authenticatedWebSocket);
      authenticatedWebSocket.once("close", () => {
        userConnections.delete(authenticatedWebSocket);

        if (userConnections.size === 0) {
          connectionRegistry.delete(userId);
        }
      });

      webSocketServer.emit("connection", authenticatedWebSocket, request);
    });
  });

  return webSocketServer;
};

export const createMessageCreatedPublisher =
  (connectionRegistry: WebSocketConnectionRegistry): MessageCreatedPublisher =>
  (recipientUserIds, conversationId, message) => {
    const event = JSON.stringify({
      type: "message.created",
      payload: {
        conversationId,
        message,
      },
    });

    for (const userId of recipientUserIds) {
      const connections = connectionRegistry.get(userId);

      for (const connection of connections ?? []) {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(event);
        }
      }
    }
  };
