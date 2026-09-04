import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import {
  CONVERSATIONS_QUERY_ERROR_MESSAGE,
  conversationsQueryOptions,
} from "./conversationsQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("conversationsQueryOptions", () => {
  it("fetches consecutive conversation pages using the next cursor", async () => {
    const firstPage = {
      conversations: [
        {
          id: 1,
          otherUser: {
            username: "other-user",
            displayName: "Other User",
            profileImage: null,
          },
          lastMessage: {
            id: 10,
            content: "Hello",
            senderId: 2,
            createdAt: "2026-09-04T01:00:00.000Z",
          },
          lastActivityAt: "2026-09-04T01:00:00.000Z",
        },
      ],
      nextCursor: 1,
    };
    const secondPage = {
      conversations: [],
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
      ...conversationsQueryOptions,
      pages: 2,
    });

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/conversations", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations?cursor=1", {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual({
      pages: [firstPage, secondPage],
      pageParams: [null, 1],
    });

    queryClient.clear();
  });

  it("throws a user-facing error when the conversations response is unsuccessful", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const result = queryClient.infiniteQuery(conversationsQueryOptions);

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow(CONVERSATIONS_QUERY_ERROR_MESSAGE);

    queryClient.clear();
  });

  it("preserves the original error when apiFetch rejects", async () => {
    const networkError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(networkError);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const result = queryClient.infiniteQuery(conversationsQueryOptions);

    await expect(result).rejects.toBe(networkError);

    queryClient.clear();
  });
});
