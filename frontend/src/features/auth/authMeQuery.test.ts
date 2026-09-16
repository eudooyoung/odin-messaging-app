import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { authMeQueryOptions } from "./authMeQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("authMeQueryOptions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

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
    const result = await queryClient.query(authMeQueryOptions);

    expect(authMeQueryOptions.queryKey).toEqual(["auth", "me"]);
    expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
      signal: expect.any(AbortSignal),
    });
    expect(result).toEqual(currentUser);

  });

  it("returns null when GET /auth/me ultimately returns 401", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const result = await queryClient.query(authMeQueryOptions);

    expect(result).toBeNull();

  });

  it("throws an error state when GET /auth/me returns a non-401 failure", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(null, {
        status: 500,
      }),
    );
    const result = queryClient.query(authMeQueryOptions);
    await expect(result).rejects.toThrow("Failed to fetch current user");
  });

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);
    const result = queryClient.query(authMeQueryOptions);
    await expect(result).rejects.toBe(transportError);
  });
});
