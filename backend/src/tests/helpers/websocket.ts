import type { Server } from "node:http";
import WebSocket, { type WebSocketServer } from "ws";

export const listen = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

export const getWebSocketUrl = (server: Server) => {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("HTTP server did not listen on a TCP port");
  }

  return `ws://127.0.0.1:${address.port}`;
};

export const closeWebSocket = (webSocket: WebSocket) =>
  new Promise<void>((resolve) => {
    if (webSocket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    webSocket.once("close", () => resolve());

    if (webSocket.readyState === WebSocket.CONNECTING) {
      webSocket.once("error", () => undefined);
      webSocket.terminate();
      return;
    }

    webSocket.close();
  });

export const closeWebSocketServer = (webSocketServer: WebSocketServer) =>
  new Promise<void>((resolve, reject) => {
    webSocketServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
