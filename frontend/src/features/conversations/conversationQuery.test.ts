import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { conversationQueryOptions } from "./conversationQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

let queryClient: QueryClient;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

describe("conversationQueryOptions", () => {
  it("fetches and returns the conversation for the given id", async () => {
    const conversation = {
      id: 42,
      participants: [
        {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        {
          username: "other-user",
          displayName: "Other User",
          profileImage: "https://example.com/other-user.jpg",
        },
      ],
      createdAt: "2026-09-01T00:00:00.000Z",
      lastActivityAt: "2026-09-04T01:00:00.000Z",
    };
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(conversation), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const queryOptions = conversationQueryOptions(42);

    const result = await queryClient.query(queryOptions);

    expect(queryOptions.queryKey).toEqual(["conversations", 42]);
    expect(apiFetch).toHaveBeenCalledWith("/conversations/42", {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual(conversation);

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
      const result = queryClient.query(conversationQueryOptions(42));

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow(expectedMessage);

    },
  );

  it("throws a user-facing error when the conversation response is unsuccessful", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = queryClient.query(conversationQueryOptions(42));

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Failed to load conversation");

  });

  it("preserves the original error when apiFetch rejects", async () => {
    const networkError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(networkError);
    const result = queryClient.query(conversationQueryOptions(42));

    await expect(result).rejects.toBe(networkError);

  });
});
