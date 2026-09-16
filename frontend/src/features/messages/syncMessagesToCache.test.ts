import { type InfiniteData, InfiniteQueryObserver, type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { createDeferred } from "@/tests/createDeferred.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { type MessagesPage, messagesQueryOptions } from "./messagesQuery.ts";
import { syncMessageToCache } from "./syncMessagesToCache.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

let queryClient: QueryClient;

const conversationId = 42;
const queryKey = messagesQueryOptions(conversationId).queryKey;

const latestMessage = {
  id: 10,
  content: "Latest message",
  sender: {
    username: "other-user",
    displayName: "Other User",
    profileImage: null,
  },
  createdAt: "2026-09-07T02:00:00.000Z",
};

const olderMessage = {
  id: 9,
  content: "Older message",
  sender: {
    username: "other-user",
    displayName: "Other User",
    profileImage: null,
  },
  createdAt: "2026-09-07T01:00:00.000Z",
};

const createdMessage = {
  id: 11,
  content: "New message",
  sender: {
    username: "current-user",
    displayName: "Current User",
    profileImage: null,
  },
  createdAt: "2026-09-08T01:00:00.000Z",
};

const getMessagesCache = (queryClient: QueryClient) =>
  queryClient.getQueryData<InfiniteData<MessagesPage, number | null>>(queryKey);

beforeEach(() => {
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

describe("syncMessageToCache", () => {
  describe("basic cache sync", () => {
    it("creates the cache when it does not exist", () => {
      syncMessageToCache(queryClient, conversationId, createdMessage);

      expect(getMessagesCache(queryClient)).toEqual({
        pages: [{ messages: [createdMessage], nextCursor: null }],
        pageParams: [null],
      });
    });

    it("preserves the existing pagination cache when adding a message", () => {
      queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(queryKey, {
        pages: [
          { messages: [latestMessage], nextCursor: 10 },
          { messages: [olderMessage], nextCursor: null },
        ],
        pageParams: [null, 10],
      });

      syncMessageToCache(queryClient, conversationId, createdMessage);

      expect(getMessagesCache(queryClient)).toEqual({
        pages: [
          { messages: [createdMessage, latestMessage], nextCursor: 10 },
          { messages: [olderMessage], nextCursor: null },
        ],
        pageParams: [null, 10],
      });
    });

    it("does not add the same message more than once", () => {
      queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(queryKey, {
        pages: [{ messages: [createdMessage, latestMessage], nextCursor: null }],
        pageParams: [null],
      });

      syncMessageToCache(queryClient, conversationId, createdMessage);

      const matchingMessages = getMessagesCache(queryClient)
        ?.pages.flatMap((page) => page.messages)
        .filter((message) => message.id === createdMessage.id);
      expect(matchingMessages).toEqual([createdMessage]);
    });
  });

  describe("message ordering", () => {
    it("orders messages by createdAt descending", () => {
      syncMessageToCache(queryClient, conversationId, createdMessage);
      syncMessageToCache(queryClient, conversationId, latestMessage);

      expect(getMessagesCache(queryClient)).toEqual({
        pages: [
          {
            messages: [createdMessage, latestMessage],
            nextCursor: null,
          },
        ],
        pageParams: [null],
      });
    });

    it("orders messages with the same createdAt by id descending", () => {
      const higherIdMessage = {
        ...createdMessage,
        id: 12,
        content: "Higher id message",
      };

      syncMessageToCache(queryClient, conversationId, higherIdMessage);
      syncMessageToCache(queryClient, conversationId, createdMessage);

      expect(getMessagesCache(queryClient)).toEqual({
        pages: [
          {
            messages: [higherIdMessage, createdMessage],
            nextCursor: null,
          },
        ],
        pageParams: [null],
      });
    });
  });

  describe("fetch and recovery lifecycle", () => {
    const messagesResponse = (page: MessagesPage) => jsonResponse(page);

    it("reapplies the new message after an in-progress fetch completes", async () => {
      const nextPageResponse = createDeferred<Response>();
      vi.mocked(apiFetch).mockReturnValue(nextPageResponse.promise);
      queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(queryKey, {
        pages: [{ messages: [latestMessage], nextCursor: 10 }],
        pageParams: [null],
      });
      const observer = new InfiniteQueryObserver(queryClient, messagesQueryOptions(conversationId));

      const messagesFetch = observer.fetchNextPage();
      await waitFor(() => {
        expect(queryClient.isFetching({ queryKey, exact: true })).toBe(1);
      });

      syncMessageToCache(queryClient, conversationId, createdMessage);

      expect(getMessagesCache(queryClient)!.pages[0]!.messages).toEqual([
        createdMessage,
        latestMessage,
      ]);

      nextPageResponse.resolve(messagesResponse({ messages: [olderMessage], nextCursor: null }));
      await messagesFetch;

      await waitFor(() => {
        expect(getMessagesCache(queryClient)).toEqual({
          pages: [
            { messages: [createdMessage, latestMessage], nextCursor: 10 },
            { messages: [olderMessage], nextCursor: null },
          ],
          pageParams: [null, 10],
        });
      });

      observer.destroy();
    });

    it("keeps the new message after recovering an initial fetch error", async () => {
      const recoveryResponse = createDeferred<Response>();
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockReturnValueOnce(recoveryResponse.promise);

      await expect(
        queryClient.infiniteQuery(messagesQueryOptions(conversationId)),
      ).rejects.toThrow();
      expect(queryClient.getQueryState(queryKey)).toMatchObject({
        status: "error",
        data: undefined,
      });

      syncMessageToCache(queryClient, conversationId, createdMessage);

      await waitFor(() => {
        expect(queryClient.isFetching({ queryKey, exact: true })).toBe(1);
      });

      recoveryResponse.resolve(messagesResponse({ messages: [latestMessage], nextCursor: null }));

      await waitFor(() => {
        expect(getMessagesCache(queryClient)).toEqual({
          pages: [
            {
              messages: [createdMessage, latestMessage],
              nextCursor: null,
            },
          ],
          pageParams: [null],
        });
      });
    });

    it("does not recreate a cleared cache when a pending sync completes", async () => {
      const nextPageResponse = createDeferred<Response>();
      vi.mocked(apiFetch).mockReturnValue(nextPageResponse.promise);
      queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(queryKey, {
        pages: [{ messages: [latestMessage], nextCursor: 10 }],
        pageParams: [null],
      });
      const observer = new InfiniteQueryObserver(queryClient, messagesQueryOptions(conversationId));

      const messagesFetch = observer.fetchNextPage();
      await waitFor(() => {
        expect(queryClient.isFetching({ queryKey, exact: true })).toBe(1);
      });

      syncMessageToCache(queryClient, conversationId, createdMessage);
      queryClient.clear();

      expect(getMessagesCache(queryClient)).toBeUndefined();

      nextPageResponse.resolve(messagesResponse({ messages: [olderMessage], nextCursor: null }));
      await messagesFetch;
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(getMessagesCache(queryClient)).toBeUndefined();

      observer.destroy();
    });
  });
});
