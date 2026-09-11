import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import type { UserProfile } from "./userProfileQuery.ts";

export const UPDATE_USER_PROFILE_ERROR_MESSAGE = "Failed to update profile";

export type UpdateUserProfileInput = {
  displayName?: string;
  bio?: string | null;
  profileImage?: string | null;
};

export async function updateUserProfile(input: UpdateUserProfileInput) {
  const response = await apiFetch("/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (response.status === 400) {
    throw new UserFacingError("Invalid profile input");
  }

  if (!response.ok) {
    throw new UserFacingError(UPDATE_USER_PROFILE_ERROR_MESSAGE);
  }

  return response.json() as Promise<UserProfile>;
}
