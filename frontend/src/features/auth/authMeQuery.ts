import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";

export const AUTH_QUERY_FALLBACK_MESSAGE = "Failed to check authentication";
export const AUTH_QUERY_ERROR_MESSAGE = "Failed to fetch current user";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
};

export const authMeQueryOptions = queryOptions({
  queryKey: ["auth", "me"] as const,
  queryFn: async ({ signal }): Promise<AuthUser | null> => {
    const response = await apiFetch("/auth/me", { signal });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new Error(AUTH_QUERY_ERROR_MESSAGE);
    }

    return response.json() as Promise<AuthUser>;
  },
});
