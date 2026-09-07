import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

export const AUTH_QUERY_ERROR_MESSAGE = "Failed to check authentication";

type AuthUser = {
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
      throw new UserFacingError(AUTH_QUERY_ERROR_MESSAGE);
    }

    return response.json() as Promise<AuthUser>;
  },
});
