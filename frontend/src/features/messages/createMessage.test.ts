import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { createMessage } from "./createMessage.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("createMessage", () => {
  it("creates and returns a message in the conversation", async () => {
    const message = {
      id: 10,
      content: "Hello!",
      sender: {
        username: "current-user",
        displayName: "Current User",
        profileImage: null,
      },
      createdAt: "2026-09-08T01:00:00.000Z",
    };
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(JSON.stringify(message), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await createMessage(42, "Hello!");

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/conversations/42/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello!" }),
    });
    expect(result).toEqual(message);
  });

  it.each([
    {
      status: 403,
      expectedMessage: "You do not have access to this conversation",
    },
    {
      status: 404,
      expectedMessage: "Conversation not found",
    },
  ])(
    "throws the status-specific user-facing error when the response status is $status",
    async ({ status, expectedMessage }) => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status }));

      const result = createMessage(42, "Hello!");

      await expect(result).rejects.toBeInstanceOf(UserFacingError);
      await expect(result).rejects.toThrow(expectedMessage);
    },
  );

  it("throws a generic user-facing error for any other HTTP failure", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    const result = createMessage(42, "Hello!");

    await expect(result).rejects.toBeInstanceOf(UserFacingError);
    await expect(result).rejects.toThrow("Failed to send message");
  });

  it("preserves the original error when apiFetch rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);

    const result = createMessage(42, "Hello!");

    await expect(result).rejects.toBe(transportError);
  });
});
