import { type InfiniteData, InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { type MessagesPage, messagesQueryOptions } from "./messagesQuery.ts";
import { syncMessageToCache } from "./syncMessagesToCache.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

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

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const messagesResponse = (page: MessagesPage) =>
  new Response(JSON.stringify(page), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("syncMessageToCache", () => {
  it("creates the messages cache when it does not exist", () => {
    const queryClient = new QueryClient();

    syncMessageToCache(queryClient, conversationId, createdMessage);

    expect(getMessagesCache(queryClient)).toEqual({
      pages: [{ messages: [createdMessage], nextCursor: null }],
      pageParams: [null],
    });

    queryClient.clear();
  });

  it("adds a new message while preserving the existing cache", () => {
    const queryClient = new QueryClient();
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

    queryClient.clear();
  });

  it("does not add the same message more than once", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(queryKey, {
      pages: [{ messages: [createdMessage, latestMessage], nextCursor: null }],
      pageParams: [null],
    });

    syncMessageToCache(queryClient, conversationId, createdMessage);

    const matchingMessages = getMessagesCache(queryClient)
      ?.pages.flatMap((page) => page.messages)
      .filter((message) => message.id === createdMessage.id);
    expect(matchingMessages).toEqual([createdMessage]);

    queryClient.clear();
  });

  it("reapplies the new message after an in-progress messages fetch completes", async () => {
    const nextPageResponse = deferred<Response>();
    vi.mocked(apiFetch).mockReturnValue(nextPageResponse.promise);
    const queryClient = new QueryClient();
    queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(queryKey, {
      pages: [{ messages: [latestMessage], nextCursor: 10 }],
      pageParams: [null],
    });
    const observer = new InfiniteQueryObserver(queryClient, messagesQueryOptions(conversationId));

    const messagesFetch = observer.fetchNextPage();
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/conversations/42/messages?cursor=10&limit=20", {
        signal: expect.any(AbortSignal),
      });
    });

    syncMessageToCache(queryClient, conversationId, createdMessage);

    expect(getMessagesCache(queryClient)?.pages[0]?.messages).toEqual([
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
    queryClient.clear();
  });
});
