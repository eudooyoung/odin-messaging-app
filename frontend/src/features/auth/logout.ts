import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

export const GENERAL_LOGOUT_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function logout() {
  const response = await apiFetch("/auth/logout", {
    method: "POST",
  });

  if (response.status !== 204) {
    throw new UserFacingError("Logout failed");
  }

  return response;
}
