import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { usersQueryOptions } from "./usersQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

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
    const queryClient = new QueryClient();

    const result = await queryClient.query(usersQueryOptions("other user"));

    expect(apiFetch).toHaveBeenCalledOnce();
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

    queryClient.clear();
  });

  it("throws a user-facing error when the user search request is invalid", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 400 }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const result = queryClient.query(usersQueryOptions("other user"));

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Invalid user search");

    queryClient.clear();
  });

  it("throws a generic user-facing error for other unsuccessful responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const result = queryClient.query(usersQueryOptions("other user"));

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Failed to search users");

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

    const result = queryClient.query(usersQueryOptions("other user"));

    await expect(result).rejects.toBe(networkError);

    queryClient.clear();
  });
});
