import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import type { UpdatedUserProfile, UpdateUserProfileInput } from "./user.type.ts";

export const UPDATE_USER_PROFILE_ERROR_MESSAGE = "Failed to update profile";

export async function updateUserProfile(input: UpdateUserProfileInput) {
  const response = await apiFetch("/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (response.status === 400) {
    throw new UserFacingError("Invalid profile input");
  }

  if (response.status === 409) {
    throw new UserFacingError("This handle is already taken");
  }

  if (!response.ok) {
    throw new UserFacingError(UPDATE_USER_PROFILE_ERROR_MESSAGE);
  }

  return response.json() as Promise<UpdatedUserProfile>;
}
