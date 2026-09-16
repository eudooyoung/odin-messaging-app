import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { MESSAGES_QUERY_ERROR_MESSAGE, messagesQueryOptions } from "./messagesQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("messagesQueryOptions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("fetches and returns the first page of messages without a cursor", async () => {
    const firstPage = {
      messages: [
        {
          id: 10,
          content: "Hello",
          sender: {
            username: "other-user",
            displayName: "Other User",
            profileImage: null,
          },
          createdAt: "2026-09-07T01:00:00.000Z",
        },
      ],
      nextCursor: 10,
    };
    vi.mocked(apiFetch).mockResolvedValue(jsonResponse(firstPage));
    const queryOptions = messagesQueryOptions(42);

    const result = await queryClient.infiniteQuery(queryOptions);

    expect(queryOptions.queryKey).toEqual(["conversations", 42, "messages"]);
    expect(queryOptions.initialPageParam).toBeNull();
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/conversations/42/messages?limit=20", {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      pages: [firstPage],
      pageParams: [null],
    });

  });

  it("fetches consecutive message pages with the same limit and the next cursor", async () => {
    const firstPage = {
      messages: [
        {
          id: 10,
          content: "Latest message",
          sender: {
            username: "other-user",
            displayName: "Other User",
            profileImage: null,
          },
          createdAt: "2026-09-07T02:00:00.000Z",
        },
      ],
      nextCursor: 10,
    };
    const secondPage = {
      messages: [
        {
          id: 9,
          content: "Earlier message",
          sender: {
            username: "current-user",
            displayName: "Current User",
            profileImage: null,
          },
          createdAt: "2026-09-07T01:00:00.000Z",
        },
      ],
      nextCursor: null,
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse(secondPage));
    const result = await queryClient.infiniteQuery({
      ...messagesQueryOptions(42),
      pages: 2,
    });

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/conversations/42/messages?limit=20", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations/42/messages?cursor=10&limit=20", {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      pages: [firstPage, secondPage],
      pageParams: [null, 10],
    });

  });

  it.each([
    {
      status: 403,
      expectedMessage: "You do not have access to this conversation",
    },
    {
      status: 404,
      expectedMessage: "Conversation not found",
    },
  ])(
    "throws the status-specific user-facing error when the response status is $status",
    async ({ status, expectedMessage }) => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status }));
      const result = queryClient.infiniteQuery(messagesQueryOptions(42));

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow(expectedMessage);

    },
  );

  it("throws a generic user-facing error for any other unsuccessful response", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = queryClient.infiniteQuery(messagesQueryOptions(42));

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow(MESSAGES_QUERY_ERROR_MESSAGE);

  });

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);
    const result = queryClient.infiniteQuery(messagesQueryOptions(42));

    await expect(result).rejects.toBe(transportError);

  });
});
