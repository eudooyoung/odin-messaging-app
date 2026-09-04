import { once } from "node:events";
import { createServer, type Server } from "node:http";
import request, { type Response } from "supertest";
import WebSocket, { type RawData, type WebSocketServer } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { prisma } from "@/lib/prisma.js";
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
import type { CreateMessageResponseBody } from "@/types/api.types.js";
import {
  attachWebSocketServer,
  createMessageCreatedPublisher,
  createWebSocketConnectionRegistry,
} from "@/websocket.js";

const getBody = <T>(response: Response) => response.body as T;

const receiveTextMessage = (webSocket: WebSocket) =>
  new Promise<string>((resolve, reject) => {
    const handleMessage = (data: RawData) => {
      webSocket.off("error", handleError);

      if (!Buffer.isBuffer(data)) {
        reject(new Error("Expected WebSocket message data to be a Buffer"));
        return;
      }

      resolve(data.toString("utf8"));
    };
    const handleError = (error: Error) => {
      webSocket.off("message", handleMessage);
      reject(error);
    };

    webSocket.once("message", handleMessage);
    webSocket.once("error", handleError);
  });

describe("new message WebSocket push", () => {
  let client: WebSocket | undefined;
  let additionalClient: WebSocket | undefined;
  let webSocketServer: WebSocketServer;
  let httpServer: Server;
  let webSocketUrl: string;

  beforeEach(async () => {
    client = undefined;
    additionalClient = undefined;

    const connectionRegistry = createWebSocketConnectionRegistry();
    const publishMessageCreated = createMessageCreatedPublisher(connectionRegistry);
    const server = createServer(createApp({ publishMessageCreated }));
    const attachedWebSocketServer = attachWebSocketServer(server, connectionRegistry);
    httpServer = server;
    webSocketServer = attachedWebSocketServer;

    await listen(server);

    webSocketUrl = getWebSocketUrl(server);
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

  it("pushes a message.created event to the other participant", async () => {
    const currentUser = await createTestUser({
      username: "current-user",
      displayName: "Current User",
    });
    const otherUser = await createTestUser({
      username: "other-user",
      displayName: "Other User",
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: otherUser.id }],
        },
      },
    });
    const currentUserCookie = createAccessTokenCookie(currentUser.id);
    const otherUserCookie = createAccessTokenCookie(otherUser.id);

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: otherUserCookie,
      },
    });

    await once(client, "open");

    const receivedEventPromise = receiveTextMessage(client);
    const response = await request(httpServer)
      .post(`/conversations/${conversation.id}/messages`)
      .set("Cookie", currentUserCookie)
      .send({ content: "Hello!" });

    expect(response.status).toBe(201);

    const createdMessage = getBody<CreateMessageResponseBody>(response);
    const receivedEvent = JSON.parse(await receivedEventPromise) as unknown;

    expect(receivedEvent).toEqual({
      type: "message.created",
      payload: {
        conversationId: conversation.id,
        message: createdMessage,
      },
    });
  });

  it("pushes a message.created event to all connections of the other participant", async () => {
    const currentUser = await createTestUser({
      username: "current-user",
      displayName: "Current User",
    });
    const otherUser = await createTestUser({
      username: "other-user",
      displayName: "Other User",
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: currentUser.id }, { id: otherUser.id }],
        },
      },
    });
    const currentUserCookie = createAccessTokenCookie(currentUser.id);
    const otherUserCookie = createAccessTokenCookie(otherUser.id);

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: otherUserCookie,
      },
    });
    additionalClient = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: otherUserCookie,
      },
    });

    await Promise.all([once(client, "open"), once(additionalClient, "open")]);

    const receivedEventPromises = [
      receiveTextMessage(client),
      receiveTextMessage(additionalClient),
    ];
    const response = await request(httpServer)
      .post(`/conversations/${conversation.id}/messages`)
      .set("Cookie", currentUserCookie)
      .send({ content: "Hello!" });

    expect(response.status).toBe(201);

    const createdMessage = getBody<CreateMessageResponseBody>(response);
    const receivedEvents = (await Promise.all(receivedEventPromises)).map(
      (receivedEvent) => JSON.parse(receivedEvent) as unknown,
    );
    const expectedEvent = {
      type: "message.created",
      payload: {
        conversationId: conversation.id,
        message: createdMessage,
      },
    };

    expect(receivedEvents).toEqual([expectedEvent, expectedEvent]);
  });

  it("pushes a message.created event to the recipient but not the sender", async () => {
    const sender = await createTestUser({
      username: "sender",
      displayName: "Sender",
    });
    const recipient = await createTestUser({
      username: "recipient",
      displayName: "Recipient",
    });
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: [{ id: sender.id }, { id: recipient.id }],
        },
      },
    });
    const senderCookie = createAccessTokenCookie(sender.id);
    const recipientCookie = createAccessTokenCookie(recipient.id);

    client = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: senderCookie,
      },
    });
    additionalClient = new WebSocket(webSocketUrl, {
      headers: {
        Cookie: recipientCookie,
      },
    });

    await Promise.all([once(client, "open"), once(additionalClient, "open")]);

    let senderReceivedEvent = false;
    client.on("message", () => {
      senderReceivedEvent = true;
    });
    const recipientEventPromise = receiveTextMessage(additionalClient);
    const response = await request(httpServer)
      .post(`/conversations/${conversation.id}/messages`)
      .set("Cookie", senderCookie)
      .send({ content: "Hello!" });

    expect(response.status).toBe(201);

    const createdMessage = getBody<CreateMessageResponseBody>(response);
    const recipientEvent = JSON.parse(await recipientEventPromise) as unknown;

    expect(recipientEvent).toEqual({
      type: "message.created",
      payload: {
        conversationId: conversation.id,
        message: createdMessage,
      },
    });

    await closeWebSocket(client);

    expect(senderReceivedEvent).toBe(false);
  });
});
