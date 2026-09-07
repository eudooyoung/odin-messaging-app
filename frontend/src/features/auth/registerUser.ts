import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

const USERNAME_CONFLICT_ERROR_MESSAGE = "Username already exists";
export const GENERAL_REGISTER_ERROR_MESSAGE = "Something went wrong. Please try again.";

type RegisterInput = {
  username: string;
  displayName: string;
  password: string;
};

export async function registerUser(input: RegisterInput) {
  const response = await apiFetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (response.status === 409) {
    throw new UserFacingError(USERNAME_CONFLICT_ERROR_MESSAGE);
  }

  if (response.status !== 201) {
    throw new UserFacingError(GENERAL_REGISTER_ERROR_MESSAGE);
  }

  return response;
}
