import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { logout } from "./logout.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("logout", () => {
  it("completes successfully after POST /auth/logout returns 204", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 204 }));

    await logout();

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
    });
  });

  it.each([200, 500])(
    "throws a logout error when POST /auth/logout returns status %s",
    async (status) => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status }));

      const result = logout();

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow("Logout failed");
    },
  );

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);

    const result = logout();

    await expect(result).rejects.toBe(transportError);
  });
});
