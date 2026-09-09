import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { messagesQueryOptions } from "./messagesQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("messagesQueryOptions", () => {
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
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(firstPage), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const queryClient = new QueryClient();

    const result = await queryClient.infiniteQuery(messagesQueryOptions(42));

    expect(apiFetch).toHaveBeenCalledOnce();
    const requestUrl = new URL(
      vi.mocked(apiFetch).mock.calls[0]?.[0] as string,
      "http://localhost",
    );
    expect(requestUrl.pathname).toBe("/conversations/42/messages");
    expect(requestUrl.searchParams.get("cursor")).toBeNull();
    expect(result).toEqual({
      pages: [firstPage],
      pageParams: [null],
    });

    queryClient.clear();
  });

  it("forwards the signal provided by TanStack Query to the messages request", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ messages: [], nextCursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const queryClient = new QueryClient();

    await queryClient.infiniteQuery(messagesQueryOptions(42));

    expect(apiFetch).toHaveBeenCalledWith("/conversations/42/messages?limit=20", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const queryClient = new QueryClient();

    const result = await queryClient.infiniteQuery({
      ...messagesQueryOptions(42),
      pages: 2,
    });

    expect(apiFetch).toHaveBeenCalledTimes(2);
    const firstRequestUrl = new URL(
      vi.mocked(apiFetch).mock.calls[0]?.[0] as string,
      "http://localhost",
    );
    const nextRequestUrl = new URL(
      vi.mocked(apiFetch).mock.calls[1]?.[0] as string,
      "http://localhost",
    );
    const limit = firstRequestUrl.searchParams.get("limit");

    expect(firstRequestUrl.pathname).toBe("/conversations/42/messages");
    expect(firstRequestUrl.searchParams.get("cursor")).toBeNull();
    expect(limit).not.toBeNull();
    expect(Number.isInteger(Number(limit))).toBe(true);
    expect(Number(limit)).toBeGreaterThan(0);
    expect(nextRequestUrl.pathname).toBe("/conversations/42/messages");
    expect(nextRequestUrl.searchParams.get("cursor")).toBe("10");
    expect(nextRequestUrl.searchParams.get("limit")).toBe(limit);
    expect(result).toEqual({
      pages: [firstPage, secondPage],
      pageParams: [null, 10],
    });

    queryClient.clear();
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
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const result = queryClient.infiniteQuery(messagesQueryOptions(42));

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow(expectedMessage);

      queryClient.clear();
    },
  );

  it("throws a generic user-facing error for any other unsuccessful response", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const result = queryClient.infiniteQuery(messagesQueryOptions(42));

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Failed to load messages");

    queryClient.clear();
  });

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const result = queryClient.infiniteQuery(messagesQueryOptions(42));

    await expect(result).rejects.toBe(transportError);

    queryClient.clear();
  });
});
