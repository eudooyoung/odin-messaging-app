import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { MessageList } from "./MessageList.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const latestMessage = {
  id: 10,
  content: "Latest message",
  sender: {
    username: "other-user",
    displayName: "Other User",
    profileImage: null,
  },
  createdAt: "2026-09-07T02:00:00.000Z",
};

const olderMessage = {
  id: 9,
  content: "Older message",
  sender: {
    username: "current-user",
    displayName: "Current User",
    profileImage: null,
  },
  createdAt: "2026-09-07T01:00:00.000Z",
};

const messagesResponse = (
  messages: (typeof latestMessage)[],
  nextCursor: number | null,
) =>
  new Response(JSON.stringify({ messages, nextCursor }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const renderMessageList = (queryClient: QueryClient, conversationId = 42) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MessageList conversationId={conversationId} />
    </QueryClientProvider>,
  );

describe("MessageList", () => {
  describe("initial page", () => {
    it("shows a loading state while the messages query is pending", () => {
      const pendingMessagesResponse = new Promise<Response>(() => undefined);
      vi.mocked(apiFetch).mockReturnValue(pendingMessagesResponse);
      const queryClient = new QueryClient();

      renderMessageList(queryClient);

      expect(screen.getByRole("status")).toHaveTextContent("Loading messages...");

      queryClient.clear();
    });

    it("renders messages and their senders from the conversation messages query", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        messagesResponse([latestMessage, olderMessage], null),
      );
      const queryClient = new QueryClient();

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
      expect(screen.getByText(latestMessage.sender.displayName)).toBeInTheDocument();
      expect(screen.getByText(`@${latestMessage.sender.username}`)).toBeInTheDocument();
      expect(screen.getByText(olderMessage.content)).toBeInTheDocument();
      expect(screen.getByText(olderMessage.sender.displayName)).toBeInTheDocument();
      expect(screen.getByText(`@${olderMessage.sender.username}`)).toBeInTheDocument();
      expect(apiFetch).toHaveBeenCalledWith("/conversations/42/messages?limit=20", {
        signal: expect.any(AbortSignal),
      });

      queryClient.clear();
    });

    it("shows an empty state when the first query page has no messages", async () => {
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([], null));
      const queryClient = new QueryClient();

      renderMessageList(queryClient);

      expect(await screen.findByText("No messages yet")).toBeInTheDocument();

      queryClient.clear();
    });

    it("shows the user-facing error from the messages query", async () => {
      const queryError = new UserFacingError(
        "You do not have access to this conversation",
      );
      vi.mocked(apiFetch).mockRejectedValue(queryError);
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      renderMessageList(queryClient);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(queryError.message);
      expect(alert).not.toHaveTextContent("Failed to load messages");

      queryClient.clear();
    });

    it("shows the generic fallback when the messages query fails unexpectedly", async () => {
      const unexpectedError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(unexpectedError);
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      renderMessageList(queryClient);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Failed to load messages");
      expect(alert).not.toHaveTextContent(unexpectedError.message);

      queryClient.clear();
    });

    it("keeps the rendered messages when a background refetch fails", async () => {
      let rejectBackgroundRefetch: (reason?: unknown) => void = () => undefined;
      const backgroundRefetchResponse = new Promise<Response>((_resolve, reject) => {
        rejectBackgroundRefetch = reject;
      });
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], null))
        .mockReturnValueOnce(backgroundRefetchResponse);
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();

      let backgroundRefetch!: Promise<void>;
      await act(async () => {
        backgroundRefetch = queryClient.invalidateQueries({
          queryKey: ["conversations", 42, "messages"],
        });
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledTimes(2);
        expect(
          queryClient.getQueryState(["conversations", 42, "messages"])
            ?.fetchStatus,
        ).toBe("fetching");
      });

      await act(async () => {
        rejectBackgroundRefetch(new TypeError("Failed to fetch"));
        await backgroundRefetch;
      });

      await waitFor(() => {
        expect(
          queryClient.getQueryState(["conversations", 42, "messages"]),
        ).toMatchObject({
          status: "error",
          fetchStatus: "idle",
        });
      });
      await act(async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByText(latestMessage.content)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      queryClient.clear();
    });
  });

  describe("pagination", () => {
    it("loads older messages using the next cursor", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], 10))
        .mockResolvedValueOnce(messagesResponse([olderMessage], null));
      const queryClient = new QueryClient();
      const user = userEvent.setup();

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
      const loadOlderButton = screen.getByRole("button", {
        name: "Load older messages",
      });

      await user.click(loadOlderButton);

      expect(await screen.findByText(olderMessage.content)).toBeInTheDocument();
      expect(apiFetch).toHaveBeenCalledTimes(2);
      expect(apiFetch).toHaveBeenNthCalledWith(
        2,
        "/conversations/42/messages?cursor=10&limit=20",
        { signal: expect.any(AbortSignal) },
      );

      queryClient.clear();
    });

    it("keeps existing messages and prevents duplicate requests while loading", async () => {
      let resolveNextPage: (response: Response) => void = () => undefined;
      const nextPageResponse = new Promise<Response>((resolve) => {
        resolveNextPage = resolve;
      });
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], 10))
        .mockReturnValueOnce(nextPageResponse);
      const queryClient = new QueryClient();
      const user = userEvent.setup();

      renderMessageList(queryClient);

      const loadOlderButton = await screen.findByRole("button", {
        name: "Load older messages",
      });

      await user.click(loadOlderButton);

      await waitFor(() => {
        expect(loadOlderButton).toBeDisabled();
      });
      expect(screen.getByText(latestMessage.content)).toBeInTheDocument();

      await user.click(loadOlderButton);

      expect(apiFetch).toHaveBeenCalledTimes(2);

      resolveNextPage(messagesResponse([], null));

      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Load older messages" }),
        ).not.toBeInTheDocument();
      });

      queryClient.clear();
    });

    it("keeps existing messages and allows retrying after a load error", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], 10))
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(messagesResponse([olderMessage], null));
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const user = userEvent.setup();

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Load older messages" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Failed to load older messages",
      );
      expect(screen.getByText(latestMessage.content)).toBeInTheDocument();
      const retryButton = screen.getByRole("button", {
        name: "Load older messages",
      });
      expect(retryButton).toBeEnabled();

      await user.click(retryButton);

      expect(await screen.findByText(olderMessage.content)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(apiFetch).toHaveBeenCalledTimes(3);
      expect(apiFetch).toHaveBeenNthCalledWith(
        3,
        "/conversations/42/messages?cursor=10&limit=20",
        { signal: expect.any(AbortSignal) },
      );

      queryClient.clear();
    });

    it("does not show the load-older UI on the last page", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        messagesResponse([latestMessage], null),
      );
      const queryClient = new QueryClient();

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Load older messages" }),
      ).not.toBeInTheDocument();

      queryClient.clear();
    });
  });
});
