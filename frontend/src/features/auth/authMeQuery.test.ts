import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions } from "./authMeQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("authMeQueryOptions", () => {
  it("returns the current user from GET /auth/me", async () => {
    const currentUser = {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    };
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(currentUser), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const queryClient = new QueryClient();

    const result = await queryClient.query(authMeQueryOptions);

    expect(authMeQueryOptions.queryKey).toEqual(["auth", "me"]);
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe("/auth/me");
    expect(result).toEqual(currentUser);

    queryClient.clear();
  });

  it("forwards the signal provided by TanStack Query to GET /auth/me", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          username: "current-user",
          displayName: "Current User",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();

    await queryClient.query(authMeQueryOptions);

    expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("returns null when GET /auth/me ultimately returns 401", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const result = await queryClient.query(authMeQueryOptions);

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe("/auth/me");
    expect(result).toBeNull();

    queryClient.clear();
  });

  it("enters an error state when GET /auth/me returns a non-401 failure", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          username: "current-user",
          displayName: "Current User",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    await queryClient.query(authMeQueryOptions).catch(() => undefined);

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe("/auth/me");
    expect(queryClient.getQueryState(authMeQueryOptions.queryKey)?.status).toBe("error");
    expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toBeUndefined();

    queryClient.clear();
  });
});
