import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { GENERAL_REGISTER_ERROR_MESSAGE, registerUser } from "./registerUser.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("registerUser", () => {
  const validRegistrationInput = {
    username: "test-user",
    displayName: "Test User",
    password: "password123",
  };

  it("posts the registration input and returns the successful response", async () => {
    const response = new Response(null, { status: 201 });
    vi.mocked(apiFetch).mockResolvedValue(response);

    const result = await registerUser(validRegistrationInput);

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validRegistrationInput),
    });
    expect(result).toBe(response);
  });

  it("throws a username conflict error when the response status is 409", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 409 }));

    const result = registerUser(validRegistrationInput);

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Username already exists");
  });

  it("throws the general registration error when the response status is 500", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    const result = registerUser(validRegistrationInput);

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow(GENERAL_REGISTER_ERROR_MESSAGE);
  });

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);

    const result = registerUser(validRegistrationInput);

    await expect(result).rejects.toBe(transportError);
  });
});
