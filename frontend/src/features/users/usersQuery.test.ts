import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { usersQueryOptions } from "./usersQuery.ts";

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

describe("usersQueryOptions", () => {
  it("searches users with the given query and returns the results", async () => {
    const users = [
      {
        username: "other-user",
        displayName: "Other User",
        profileImage: null,
      },
    ];
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(users), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const queryOptions = usersQueryOptions("other user");
    const result = await queryClient.query(queryOptions);

    expect(queryOptions.queryKey).toEqual(["users", "search", "other user"]);
    expect(apiFetch).toHaveBeenCalledWith(expect.any(String), {
      signal: expect.any(AbortSignal),
    });
    const requestUrl = new URL(
      vi.mocked(apiFetch).mock.calls[0]?.[0] as string,
      "http://localhost",
    );
    expect(requestUrl.pathname).toBe("/users");
    expect(requestUrl.searchParams.get("query")).toBe("other user");
    expect(result).toEqual(users);

  });

  it("throws a user-facing error when the user search request is invalid", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 400 }));
    const result = queryClient.query(usersQueryOptions("other user"));

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Invalid user search");

  });

  it("throws a generic user-facing error for other unsuccessful responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const result = queryClient.query(usersQueryOptions("other user"));

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Failed to search users");

  });

  it("preserves the original error when apiFetch rejects", async () => {
    const networkError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(networkError);
    const result = queryClient.query(usersQueryOptions("other user"));

    await expect(result).rejects.toBe(networkError);

  });
});
