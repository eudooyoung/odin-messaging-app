import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { GENERAL_LOGIN_ERROR_MESSAGE, login } from "./login.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const validLoginInput = {
  username: "test-user",
  password: "password123",
};

describe("login", () => {
  it("posts the credentials and returns the successful response", async () => {
    const response = new Response(null, { status: 204 });
    vi.mocked(apiFetch).mockResolvedValue(response);

    const result = await login(validLoginInput);

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validLoginInput),
    });
    expect(result).toBe(response);
  });

  it("throws a login error when the response status is 401", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));

    const result = login(validLoginInput);

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Login failed");
  });

  it("throws the general login error when the response status is 500", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    const result = login(validLoginInput);

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow(GENERAL_LOGIN_ERROR_MESSAGE);
  });

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);

    const result = login(validLoginInput);

    await expect(result).rejects.toBe(transportError);
  });
});
