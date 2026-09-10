import { type InfiniteData, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { handleWebSocketMessage } from "./handleWebSocketMessage.ts";
import { type MessagesPage, messagesQueryOptions } from "./messagesQuery.ts";

const existingMessage = {
  id: 10,
  content: "Existing message",
  sender: {
    username: "current-user",
    displayName: "Current User",
    profileImage: null,
  },
  createdAt: "2026-09-08T01:00:00.000Z",
};

const receivedMessage = {
  id: 11,
  content: "Hello from the other user",
  sender: {
    username: "other-user",
    displayName: "Other User",
    profileImage: null,
  },
  createdAt: "2026-09-08T02:00:00.000Z",
};

const conversationId = 42;
const conversationMessagesQueryKey =
  messagesQueryOptions(conversationId).queryKey;
const existingMessagesData: InfiniteData<MessagesPage, number | null> = {
  pages: [{ messages: [existingMessage], nextCursor: null }],
  pageParams: [null],
};

const createQueryClientWithMessages = () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(conversationMessagesQueryKey, existingMessagesData);

  return queryClient;
};

const getConversationMessagesCache = (queryClient: QueryClient) =>
  queryClient.getQueryData<InfiniteData<MessagesPage, number | null>>(
    conversationMessagesQueryKey,
  );

const getQueryCacheSnapshot = (queryClient: QueryClient) =>
  queryClient.getQueryCache().getAll().map((query) => ({
    queryKey: query.queryKey,
    data: query.state.data,
  }));

const createMessageEvent = (receivedEvent: unknown) => {
  const data = JSON.stringify(receivedEvent);

  if (data === undefined) {
    throw new Error("Expected serializable WebSocket event data");
  }

  return new MessageEvent("message", { data });
};

const invalidMessageCreatedEvents: {
  caseName: string;
  receivedEvent: unknown;
}[] = [
  {
    caseName: "the event is null",
    receivedEvent: null,
  },
  {
    caseName: "the event is an array",
    receivedEvent: [],
  },
  {
    caseName: "the payload is missing",
    receivedEvent: { type: "message.created" },
  },
  {
    caseName: "the payload is null",
    receivedEvent: { type: "message.created", payload: null },
  },
  ...[undefined, "42", 0, -1, 1.5].map((invalidConversationId) => ({
    caseName: `the conversation id is ${String(invalidConversationId)}`,
    receivedEvent: {
      type: "message.created",
      payload: {
        conversationId: invalidConversationId,
        message: receivedMessage,
      },
    },
  })),
  {
    caseName: "the message is missing",
    receivedEvent: {
      type: "message.created",
      payload: { conversationId },
    },
  },
  {
    caseName: "the message id is not a positive integer",
    receivedEvent: {
      type: "message.created",
      payload: {
        conversationId,
        message: { ...receivedMessage, id: 0 },
      },
    },
  },
  {
    caseName: "the message content is missing",
    receivedEvent: {
      type: "message.created",
      payload: {
        conversationId,
        message: { ...receivedMessage, content: undefined },
      },
    },
  },
  {
    caseName: "the message sender is missing",
    receivedEvent: {
      type: "message.created",
      payload: {
        conversationId,
        message: { ...receivedMessage, sender: undefined },
      },
    },
  },
  ...(["username", "displayName", "profileImage"] as const).map(
    (missingSenderField) => ({
      caseName: `the sender ${missingSenderField} is missing`,
      receivedEvent: {
        type: "message.created",
        payload: {
          conversationId,
          message: {
            ...receivedMessage,
            sender: {
              ...receivedMessage.sender,
              [missingSenderField]: undefined,
            },
          },
        },
      },
    }),
  ),
  {
    caseName: "the message creation timestamp is not an ISO datetime",
    receivedEvent: {
      type: "message.created",
      payload: {
        conversationId,
        message: { ...receivedMessage, createdAt: "not a datetime" },
      },
    },
  },
];

describe("handleWebSocketMessage", () => {
  it("adds a received message.created message to its conversation messages cache", () => {
    const queryClient = createQueryClientWithMessages();
    const otherConversationMessagesQueryKey = messagesQueryOptions(7).queryKey;
    const otherConversationMessagesData: InfiniteData<
      MessagesPage,
      number | null
    > = {
      pages: [{ messages: [existingMessage], nextCursor: null }],
      pageParams: [null],
    };
    queryClient.setQueryData(
      otherConversationMessagesQueryKey,
      otherConversationMessagesData,
    );
    const event = new MessageEvent("message", {
      data: JSON.stringify({
        type: "message.created",
        payload: {
          conversationId,
          message: receivedMessage,
        },
      }),
    });

    handleWebSocketMessage(queryClient, event);

    expect(getConversationMessagesCache(queryClient)).toEqual({
      pages: [
        {
          messages: [receivedMessage, existingMessage],
          nextCursor: null,
        },
      ],
      pageParams: [null],
    });
    expect(queryClient.getQueryData(otherConversationMessagesQueryKey)).toEqual(
      otherConversationMessagesData,
    );

    queryClient.clear();
  });

  it("ignores events other than message.created without changing the cache", () => {
    const queryClient = createQueryClientWithMessages();
    const event = new MessageEvent("message", {
      data: JSON.stringify({
        type: "conversation.updated",
        payload: { conversationId },
      }),
    });

    handleWebSocketMessage(queryClient, event);

    expect(getConversationMessagesCache(queryClient)).toEqual(
      existingMessagesData,
    );

    queryClient.clear();
  });

  it("ignores malformed messages without throwing or changing the cache", () => {
    const queryClient = createQueryClientWithMessages();
    const event = new MessageEvent("message", { data: "not valid JSON" });

    expect(() => handleWebSocketMessage(queryClient, event)).not.toThrow();
    expect(getConversationMessagesCache(queryClient)).toEqual(
      existingMessagesData,
    );

    queryClient.clear();
  });

  it.each(invalidMessageCreatedEvents)(
    "ignores an invalid message.created event when $caseName",
    ({ receivedEvent }) => {
      const queryClient = createQueryClientWithMessages();
      const cacheBeforeHandling = getQueryCacheSnapshot(queryClient);
      const event = createMessageEvent(receivedEvent);

      expect(() => handleWebSocketMessage(queryClient, event)).not.toThrow();
      expect(getQueryCacheSnapshot(queryClient)).toEqual(cacheBeforeHandling);

      queryClient.clear();
    },
  );
});
