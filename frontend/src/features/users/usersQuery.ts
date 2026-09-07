import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

export const USERS_QUERY_ERROR_MESSAGE = "Failed to search users";

type UserSearchResult = {
  username: string;
  displayName: string;
  profileImage: string | null;
};

export const usersQueryOptions = (query: string) =>
  queryOptions({
    queryKey: ["users", "search", query] as const,
    queryFn: async ({ signal }): Promise<UserSearchResult[]> => {
      const searchParams = new URLSearchParams({ query });
      const response = await apiFetch(`/users?${searchParams.toString()}`, { signal });

      if (response.status === 400) {
        throw new UserFacingError("Invalid user search");
      }

      if (!response.ok) {
        throw new UserFacingError(USERS_QUERY_ERROR_MESSAGE);
      }

      return response.json() as Promise<UserSearchResult[]>;
    },
  });
