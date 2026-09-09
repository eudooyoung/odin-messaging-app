import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { createMessage } from "./createMessage.ts";
import { MessageComposer } from "./MessageComposer.tsx";

vi.mock("./createMessage.ts", () => ({
  createMessage: vi.fn(),
}));

const renderMessageComposer = (queryClient: QueryClient, conversationId = 42) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MessageComposer conversationId={conversationId} />
    </QueryClientProvider>,
  );

describe("MessageComposer", () => {
  it("disables the input and prevents duplicate sends while the mutation is pending", async () => {
    const pendingMessage = new Promise<never>(() => undefined);
    vi.mocked(createMessage).mockReturnValue(pendingMessage);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderMessageComposer(queryClient);

    const messageInput = screen.getByRole("textbox", { name: "Message" });
    const sendButton = screen.getByRole("button", { name: "Send" });
    await user.type(messageInput, "Hello!");
    await user.click(sendButton);

    await waitFor(() => {
      expect(messageInput).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    await user.click(sendButton);

    expect(createMessage).toHaveBeenCalledOnce();

    queryClient.clear();
  });

  it("clears the input after a message is sent successfully", async () => {
    vi.mocked(createMessage).mockResolvedValue({
      id: 10,
      content: "Hello!",
      sender: {
        username: "current-user",
        displayName: "Current User",
        profileImage: null,
      },
      createdAt: "2026-09-08T01:00:00.000Z",
    });
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderMessageComposer(queryClient);

    const messageInput = screen.getByRole("textbox", { name: "Message" });
    await user.type(messageInput, "Hello!");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(messageInput).toHaveValue("");
    });

    queryClient.clear();
  });

  it("shows the send error and preserves the input value", async () => {
    const mutationError = new UserFacingError("Failed to send message");
    vi.mocked(createMessage).mockRejectedValue(mutationError);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderMessageComposer(queryClient);

    const messageInput = screen.getByRole("textbox", { name: "Message" });
    await user.type(messageInput, "Hello!");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      mutationError.message,
    );
    expect(messageInput).toHaveValue("Hello!");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();

    queryClient.clear();
  });

  it.each([
    {
      caseName: "the message is empty after trimming",
      content: "   ",
      expectedMessage: "Message is required",
    },
    {
      caseName: "the message is longer than 2000 characters",
      content: "a".repeat(2001),
      expectedMessage: "Message must be at most 2000 characters",
    },
  ])(
    "shows a validation error and does not send when $caseName",
    async ({ content, expectedMessage }) => {
      vi.mocked(createMessage).mockClear();
      const queryClient = new QueryClient();
      const user = userEvent.setup();

      renderMessageComposer(queryClient);

      await user.type(screen.getByRole("textbox", { name: "Message" }), content);
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
      expect(createMessage).not.toHaveBeenCalled();

      queryClient.clear();
    },
  );
});
