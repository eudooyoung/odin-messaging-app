import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { ConversationList } from "./ConversationList.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const firstConversation = {
  id: 1,
  otherUser: {
    username: "first-user",
    displayName: "First User",
    profileImage: null,
  },
  lastMessage: {
    id: 10,
    content: "Latest message",
    senderId: 2,
    createdAt: "2026-09-04T01:00:00.000Z",
  },
  lastActivityAt: "2026-09-04T01:00:00.000Z",
};

const secondConversation = {
  id: 2,
  otherUser: {
    username: "second-user",
    displayName: "Second User",
    profileImage: null,
  },
  lastMessage: null,
  lastActivityAt: "2026-09-03T02:30:00.000Z",
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const createConversationsResponse = (conversations: unknown[], nextCursor: number | null) =>
  new Response(JSON.stringify({ conversations, nextCursor }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const renderConversationList = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConversationList />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ConversationList", () => {
  describe("initial load", () => {
    it("shows a loading status while the request is pending", () => {
      const pendingResponse = deferred<Response>();
      vi.mocked(apiFetch).mockReturnValue(pendingResponse.promise);
      const queryClient = createQueryClient();

      renderConversationList(queryClient);

      expect(screen.getByRole("status")).toHaveTextContent("Loading conversations...");

      queryClient.clear();
    });

    it("shows the query error when the request fails", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
      const queryClient = createQueryClient();

      renderConversationList(queryClient);

      expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load conversations");

      queryClient.clear();
    });

    it("shows an empty state when there are no conversations", async () => {
      vi.mocked(apiFetch).mockResolvedValue(createConversationsResponse([], null));
      const queryClient = createQueryClient();

      renderConversationList(queryClient);

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();

      queryClient.clear();
    });

    it("renders conversation details and links", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        createConversationsResponse([firstConversation, secondConversation], null),
      );
      const queryClient = createQueryClient();

      renderConversationList(queryClient);

      const firstConversationLink = await screen.findByRole("link", { name: /First User/ });
      const secondConversationLink = screen.getByRole("link", { name: /Second User/ });

      expect(firstConversationLink).toHaveAttribute("href", "/conversations/1");
      expect(firstConversationLink).toHaveTextContent("First User");
      expect(firstConversationLink).toHaveTextContent("@first-user");
      expect(firstConversationLink).toHaveTextContent("Latest message");
      expect(firstConversationLink.querySelector("time")).toHaveAttribute(
        "datetime",
        firstConversation.lastActivityAt,
      );
      expect(secondConversationLink).toHaveAttribute("href", "/conversations/2");
      expect(secondConversationLink).toHaveTextContent("Second User");
      expect(secondConversationLink).toHaveTextContent("@second-user");
      expect(secondConversationLink.querySelector("time")).toHaveAttribute(
        "datetime",
        secondConversation.lastActivityAt,
      );

      queryClient.clear();
    });
  });

  describe("pagination", () => {
    it("shows Load more and disables it while the next page is pending", async () => {
      const nextPageResponse = deferred<Response>();
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(createConversationsResponse([firstConversation], 10))
        .mockReturnValueOnce(nextPageResponse.promise);
      const queryClient = createQueryClient();
      const user = userEvent.setup();

      renderConversationList(queryClient);

      const loadMoreButton = await screen.findByRole("button", { name: "Load more" });
      await user.click(loadMoreButton);

      await waitFor(() => {
        expect(loadMoreButton).toBeDisabled();
      });

      queryClient.clear();
    });

    it("appends the next page while keeping existing conversations", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(createConversationsResponse([firstConversation], 10))
        .mockResolvedValueOnce(createConversationsResponse([secondConversation], null));
      const queryClient = createQueryClient();
      const user = userEvent.setup();

      renderConversationList(queryClient);

      await user.click(await screen.findByRole("button", { name: "Load more" }));

      expect(await screen.findByText("Second User")).toBeInTheDocument();
      expect(screen.getByText("First User")).toBeInTheDocument();

      queryClient.clear();
    });

    it("keeps existing conversations and shows an error when the next page fails", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(createConversationsResponse([firstConversation], 10))
        .mockResolvedValueOnce(new Response(null, { status: 500 }));
      const queryClient = createQueryClient();
      const user = userEvent.setup();

      renderConversationList(queryClient);

      await user.click(await screen.findByRole("button", { name: "Load more" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Failed to load more conversations",
      );
      expect(screen.getByText("First User")).toBeInTheDocument();

      queryClient.clear();
    });
  });
});
