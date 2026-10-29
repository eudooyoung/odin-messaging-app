import { env } from "@/config/env.config.js";
import { verifyAccessToken } from "@/lib/accessToken.js";
import { getCookieValue } from "@/lib/cookie.js";
import type {
  MessageCreatedPublisher,
  WebSocketConnectionRegistry,
} from "@/types/websocket.types.js";
import type { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";

export const createWebSocketConnectionRegistry = (): WebSocketConnectionRegistry =>
  new Map<number, Set<WebSocket>>();

export const attachWebSocketServer = (
  httpServer: Server,
  connectionRegistry: WebSocketConnectionRegistry,
) => {
  const webSocketServer = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.headers.origin !== env.frontendOrigin) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const accessToken = getCookieValue(request.headers.cookie, "accessToken");

    const userId = accessToken ? verifyAccessToken(accessToken) : null;

    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      let userConnections = connectionRegistry.get(userId);

      if (!userConnections) {
        userConnections = new Set<WebSocket>();
        connectionRegistry.set(userId, userConnections);
      }

      userConnections.add(webSocket);
      webSocket.on("error", (error) => {
        console.error(error);
      });
      webSocket.once("close", () => {
        userConnections.delete(webSocket);

        if (userConnections.size === 0) {
          connectionRegistry.delete(userId);
        }
      });

      webSocketServer.emit("connection", webSocket, request);
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

    for (const recipientUserId of recipientUserIds) {
      const connections = connectionRegistry.get(recipientUserId);

      for (const connection of connections ?? []) {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(event);
        }
      }
    }
  };
