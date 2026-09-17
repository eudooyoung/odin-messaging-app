import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { createDeferred } from "@/tests/createDeferred.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { ConversationList } from "./ConversationList.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("ConversationList", () => {
  let queryClient: QueryClient;

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

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const createConversationsResponse = (conversations: unknown[], nextCursor: number | null) =>
    jsonResponse({ conversations, nextCursor });

  const renderConversationList = (queryClient: QueryClient, initialEntry = "/") =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <ConversationList />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  describe("initial load", () => {
    it("shows a loading status while the request is pending", () => {
      const pendingResponse = createDeferred<Response>();
      vi.mocked(apiFetch).mockReturnValue(pendingResponse.promise);

      renderConversationList(queryClient);

      expect(screen.getByRole("status")).toHaveTextContent("Loading conversations...");
    });

    it("shows the query error when the request fails", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

      renderConversationList(queryClient);

      expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load conversations");
    });

    it("shows an empty state when there are no conversations", async () => {
      vi.mocked(apiFetch).mockResolvedValue(createConversationsResponse([], null));

      renderConversationList(queryClient);

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    });

    it("renders conversation details and links", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        createConversationsResponse([firstConversation, secondConversation], null),
      );
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
    });

    it("shows a placeholder when a conversation has no last message", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        createConversationsResponse([secondConversation], null),
      );

      renderConversationList(queryClient);

      expect(await screen.findByRole("link", { name: /Second User/ })).toHaveTextContent(
        "No messages yet",
      );
    });

    it("identifies the conversation matching the current URL as the current page", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        createConversationsResponse([firstConversation, secondConversation], null),
      );

      renderConversationList(queryClient, "/conversations/2");

      expect(await screen.findByRole("link", { name: /Second User/ })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: /First User/ })).not.toHaveAttribute(
        "aria-current",
      );
    });
  });

  describe("pagination", () => {
    it("shows Load more and disables it while the next page is pending", async () => {
      const nextPageResponse = createDeferred<Response>();
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(createConversationsResponse([firstConversation], 10))
        .mockReturnValueOnce(nextPageResponse.promise);
      const user = userEvent.setup();

      renderConversationList(queryClient);

      const loadMoreButton = await screen.findByRole("button", { name: "Load more" });
      await user.click(loadMoreButton);

      await waitFor(() => {
        expect(loadMoreButton).toBeDisabled();
      });
    });

    it("appends the next page while keeping existing conversations", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(createConversationsResponse([firstConversation], 10))
        .mockResolvedValueOnce(createConversationsResponse([secondConversation], null));
      const user = userEvent.setup();

      renderConversationList(queryClient);

      await user.click(await screen.findByRole("button", { name: "Load more" }));

      expect(await screen.findByText("Second User")).toBeInTheDocument();
      expect(screen.getByText("First User")).toBeInTheDocument();
    });

    it("keeps existing conversations and shows an error when the next page fails", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(createConversationsResponse([firstConversation], 10))
        .mockResolvedValueOnce(new Response(null, { status: 500 }));
      const user = userEvent.setup();

      renderConversationList(queryClient);

      await user.click(await screen.findByRole("button", { name: "Load more" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Failed to load more conversations",
      );
      expect(screen.getByText("First User")).toBeInTheDocument();
    });
  });
});
