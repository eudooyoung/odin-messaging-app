import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

export const USER_PROFILE_QUERY_ERROR_MESSAGE = "Failed to load profile";

export type UserProfile = {
  username: string;
  displayName: string;
  bio: string | null;
  profileImage: string | null;
};

export const userProfileQueryOptions = (username: string) =>
  queryOptions({
    queryKey: ["users", "profile", username] as const,
    queryFn: async ({ signal }): Promise<UserProfile> => {
      const response = await apiFetch(`/users/${encodeURIComponent(username)}`, {
        signal,
      });

      if (response.status === 404) {
        throw new UserFacingError("Profile not found");
      }

      if (!response.ok) {
        throw new UserFacingError(USER_PROFILE_QUERY_ERROR_MESSAGE);
      }

      return response.json() as Promise<UserProfile>;
    },
  });
