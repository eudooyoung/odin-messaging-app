import { once } from "node:events";
import { createServer, type Server } from "node:http";
import jwt from "jsonwebtoken";
import WebSocket, { type WebSocketServer } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { env } from "@/config/env.config.js";
import { attachWebSocketServer, createWebSocketConnectionRegistry } from "@/websocket.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";
import { createTestUser } from "@/tests/helpers/createTestUser.js";
import {
  closeHttpServer,
  closeWebSocket,
  closeWebSocketServer,
  getWebSocketUrl,
  listen,
} from "@/tests/helpers/websocket.js";
import "@/tests/integration.setup.js";
import type {
  AuthenticatedWebSocket,
  WebSocketConnectionRegistry,
} from "@/types/websocket.types.js";

const waitForAuthenticatedConnection = (webSocketServer: WebSocketServer) =>
  new Promise<AuthenticatedWebSocket>((resolve) => {
    webSocketServer.once("connection", (connection) => {
      resolve(connection as AuthenticatedWebSocket);
    });
  });

describe("WebSocket connection authentication", () => {
  let client: WebSocket | undefined;
  let additionalClient: WebSocket | undefined;
  let webSocketServer: WebSocketServer | undefined;
  let httpServer: Server | undefined;
  let connectionRegistry: WebSocketConnectionRegistry;

  const startWebSocketServer = async () => {
    const server = createServer(createApp());
    const attachedWebSocketServer = attachWebSocketServer(server, connectionRegistry);
    httpServer = server;
    webSocketServer = attachedWebSocketServer;

    await listen(server);

    return {
      attachedWebSocketServer,
      webSocketUrl: getWebSocketUrl(server),
    };
  };

  beforeEach(() => {
    client = undefined;
    additionalClient = undefined;
    webSocketServer = undefined;
    httpServer = undefined;
    connectionRegistry = createWebSocketConnectionRegistry();
  });

  afterEach(async () => {
    try {
      if (client) {
        await closeWebSocket(client);
      }

      if (additionalClient) {
        await closeWebSocket(additionalClient);
      }
    } finally {
      try {
        if (webSocketServer) {
          await closeWebSocketServer(webSocketServer);
        }
      } finally {
        if (httpServer?.listening) {
          await closeHttpServer(httpServer);
        }
      }
    }
  });

  it("opens a connection with a valid access token cookie", async () => {
    const user = await createTestUser();
    const accessTokenCookie = createAccessTokenCookie(user.id);
    const { webSocketUrl } = await startWebSocketServer();

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: accessTokenCookie,
      },
    });

    await once(client, "open");

    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("stores the authenticated user id on the server-side WebSocket connection", async () => {
    const user = await createTestUser();
    const accessTokenCookie = createAccessTokenCookie(user.id);
    const { attachedWebSocketServer, webSocketUrl } = await startWebSocketServer();
    const connectionPromise = waitForAuthenticatedConnection(attachedWebSocketServer);

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: accessTokenCookie,
      },
    });

    const [connection] = await Promise.all([connectionPromise, once(client, "open")]);

    expect(connection.userId).toBe(user.id);
  });

  it("registers the authenticated connection by user id", async () => {
    const user = await createTestUser();
    const accessTokenCookie = createAccessTokenCookie(user.id);
    const { attachedWebSocketServer, webSocketUrl } = await startWebSocketServer();
    const connectionPromise = waitForAuthenticatedConnection(attachedWebSocketServer);

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: accessTokenCookie,
      },
    });

    const [connection] = await Promise.all([connectionPromise, once(client, "open")]);

    expect(connectionRegistry.get(user.id)?.has(connection)).toBe(true);
  });

  it("removes the user entry when their last connection closes", async () => {
    const user = await createTestUser();
    const accessTokenCookie = createAccessTokenCookie(user.id);
    const { attachedWebSocketServer, webSocketUrl } = await startWebSocketServer();
    const connectionPromise = waitForAuthenticatedConnection(attachedWebSocketServer);

    const connectedClient = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: accessTokenCookie,
      },
    });
    client = connectedClient;

    const [connection] = await Promise.all([connectionPromise, once(connectedClient, "open")]);

    expect(connectionRegistry.get(user.id)?.has(connection)).toBe(true);

    const clientClosePromise = once(connectedClient, "close");
    const serverClosePromise = once(connection, "close");

    connectedClient.close();
    await Promise.all([clientClosePromise, serverClosePromise]);

    expect(connectionRegistry.has(user.id)).toBe(false);
  });

  it("keeps the user entry and remaining connection when one of multiple connections closes", async () => {
    const user = await createTestUser();
    const accessTokenCookie = createAccessTokenCookie(user.id);
    const { attachedWebSocketServer, webSocketUrl } = await startWebSocketServer();
    const firstConnectionPromise = waitForAuthenticatedConnection(attachedWebSocketServer);
    const firstClient = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: accessTokenCookie,
      },
    });
    client = firstClient;
    const [firstConnection] = await Promise.all([
      firstConnectionPromise,
      once(firstClient, "open"),
    ]);

    const secondConnectionPromise = waitForAuthenticatedConnection(attachedWebSocketServer);
    const secondClient = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: accessTokenCookie,
      },
    });
    additionalClient = secondClient;
    const [secondConnection] = await Promise.all([
      secondConnectionPromise,
      once(secondClient, "open"),
    ]);

    const registeredConnections = connectionRegistry.get(user.id);

    expect(registeredConnections?.has(firstConnection)).toBe(true);
    expect(registeredConnections?.has(secondConnection)).toBe(true);

    const clientClosePromise = once(firstClient, "close");
    const serverClosePromise = once(firstConnection, "close");

    firstClient.close();
    await Promise.all([clientClosePromise, serverClosePromise]);

    expect(connectionRegistry.has(user.id)).toBe(true);
    expect(registeredConnections?.has(firstConnection)).toBe(false);
    expect(registeredConnections?.has(secondConnection)).toBe(true);
  });

  it("rejects a connection without an access token cookie", async () => {
    const { webSocketUrl } = await startWebSocketServer();

    client = new WebSocket(webSocketUrl);

    await expect(once(client, "open")).rejects.toThrow("Unexpected server response: 401");
    expect(client.readyState).not.toBe(WebSocket.OPEN);
  });

  it("rejects a connection with an invalid access token", async () => {
    const { webSocketUrl } = await startWebSocketServer();

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: "accessToken=invalid-access-token",
      },
    });

    await expect(once(client, "open")).rejects.toThrow("Unexpected server response: 401");
    expect(client.readyState).not.toBe(WebSocket.OPEN);
  });

  it("rejects a connection with an expired access token", async () => {
    const user = await createTestUser();
    const expiredAccessToken = jwt.sign(
      { sub: String(user.id), tokenType: "access" },
      env.jwtSecret,
      { expiresIn: -1 },
    );
    const { webSocketUrl } = await startWebSocketServer();

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: `accessToken=${expiredAccessToken}`,
      },
    });

    await expect(once(client, "open")).rejects.toThrow("Unexpected server response: 401");
    expect(client.readyState).not.toBe(WebSocket.OPEN);
  });
});
