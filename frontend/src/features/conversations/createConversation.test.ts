import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import type { PublicUserIdentity } from "@/features/users/user.type.ts";
import { createConversation } from "./createConversation.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("createConversation", () => {
  const conversation = {
    id: 42,
    participants: [
      {
        id: 1,
        handle: "current-user",
        displayName: "Current User",
        profileImage: null,
      },
      {
        id: 2,
        handle: "target-user",
        displayName: "Target User",
        profileImage: "https://example.com/target-user.jpg",
      },
    ],
    createdAt: "2026-09-07T01:00:00.000Z",
    lastActivityAt: "2026-09-07T01:00:00.000Z",
  };

  it("creates and returns a conversation for the target user", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(conversation), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await createConversation("target-user");

    expectTypeOf(result.participants[0]!).toEqualTypeOf<PublicUserIdentity>();
    expect(apiFetch).toHaveBeenCalledWith("/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetHandle: "target-user" }),
    });
    expect(result).toEqual(conversation);
  });

  it("returns the existing conversation when the response status is 200", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(conversation), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await createConversation("target-user");

    expect(result).toEqual(conversation);
  });

  describe("errors", () => {
    it("throws a user-facing error when the conversation response is unsuccessful", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

      const result = createConversation("target-user");

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow("Failed to create conversation");
    });

    it.each([
      {
        status: 400,
        expectedMessage: "Cannot start conversation",
      },
      {
        status: 404,
        expectedMessage: "User not found",
      },
    ])(
      "throws the status-specific user-facing error when the response status is $status",
      async ({ status, expectedMessage }) => {
        vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status }));

        const result = createConversation("target-user");

        await expect(result).rejects.toBeInstanceOf(UserFacingError);
        await expect(result).rejects.toThrow(expectedMessage);
      },
    );

    it("preserves the original error when apiFetch rejects", async () => {
      const networkError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(networkError);

      const result = createConversation("target-user");

      await expect(result).rejects.toBe(networkError);
    });
  });
});
