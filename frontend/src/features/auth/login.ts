import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

const LOGIN_ERROR_MESSAGE = "Login failed";
export const GENERAL_LOGIN_ERROR_MESSAGE = "Something went wrong. Please try again.";

type LoginInput = {
  username: string;
  password: string;
};

export async function login(input: LoginInput) {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    throw new UserFacingError(LOGIN_ERROR_MESSAGE);
  }

  if (!response.ok) {
    throw new UserFacingError(GENERAL_LOGIN_ERROR_MESSAGE);
  }

  return response;
}
