import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { createConversation } from "@/features/conversations/createConversation.ts";
import { UserSearch } from "./UserSearch.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/features/conversations/createConversation.ts", () => ({
  createConversation: vi.fn(),
}));

let queryClient: QueryClient;

const targetUser = {
  username: "target-user",
  displayName: "Target User",
  profileImage: null,
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

const usersResponse = (users: unknown[]) =>
  new Response(JSON.stringify(users), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const renderUserSearch = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserSearch />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("UserSearch", () => {
  describe("user search", () => {
    it("searches with the trimmed query while preserving the entered value", async () => {
      vi.mocked(apiFetch).mockImplementation(() =>
        Promise.resolve(
          usersResponse([
            {
              username: "first-user",
              displayName: "First User",
              profileImage: null,
            },
            {
              username: "second-user",
              displayName: "Second User",
              profileImage: "https://example.com/second-user.jpg",
            },
          ]),
        ),
      );
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      const searchInput = screen.getByRole("searchbox", { name: "Search users" });
      await user.type(searchInput, " other user ");

      expect(searchInput).toHaveValue(" other user ");
      expect(await screen.findByText("First User")).toBeInTheDocument();
      expect(screen.getByText("@first-user")).toBeInTheDocument();
      expect(screen.getByText("Second User")).toBeInTheDocument();
      expect(screen.getByText("@second-user")).toBeInTheDocument();
      await waitFor(() => {
        const requestedQueries = vi.mocked(apiFetch).mock.calls.map(([input]) => {
          const requestUrl = new URL(input.toString(), "http://localhost");

          return requestUrl.searchParams.get("query");
        });

        expect(requestedQueries.at(-1)).toBe("other user");
      });
    });

    it("does not search when the query contains only whitespace", async () => {
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      const searchInput = screen.getByRole("searchbox", { name: "Search users" });
      await user.type(searchInput, "   ");

      expect(searchInput).toHaveValue("   ");
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it("shows an empty state when the search has no matching users", async () => {
      vi.mocked(apiFetch).mockImplementation(() => Promise.resolve(usersResponse([])));
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("searchbox", { name: "Search users" }), "missing user");

      expect(await screen.findByText("No users found")).toBeInTheDocument();
    });

    it("shows a loading state while the user search is pending", async () => {
      const pendingSearchResponse = new Promise<Response>(() => undefined);
      vi.mocked(apiFetch).mockReturnValue(pendingSearchResponse);
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("searchbox", { name: "Search users" }), "other");

      expect(screen.getByRole("status")).toHaveTextContent("Searching users...");
    });

    it("shows the user-facing error from an invalid search response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 400 }));
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("searchbox", { name: "Search users" }), "invalid");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Invalid user search");
      expect(alert).not.toHaveTextContent("Failed to search users");
    });

    it("shows a generic fallback when the user search request rejects", async () => {
      const transportError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(transportError);
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("searchbox", { name: "Search users" }), "other");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Failed to search users");
      expect(alert).not.toHaveTextContent(transportError.message);
    });
  });

  describe("conversation creation", () => {
    it("opens the conversation returned after selecting a user", async () => {
      vi.mocked(apiFetch).mockImplementation(() => Promise.resolve(usersResponse([targetUser])));
      vi.mocked(createConversation).mockResolvedValue({
        id: 42,
        participants: [
          {
            username: "current-user",
            displayName: "Current User",
            profileImage: null,
          },
          targetUser,
        ],
        createdAt: "2026-09-07T01:00:00.000Z",
        lastActivityAt: "2026-09-07T01:00:00.000Z",
      });
      const user = userEvent.setup();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<UserSearch />} />
              <Route path="/conversations/42" element={<h1>Conversation 42</h1>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await user.type(screen.getByRole("searchbox", { name: "Search users" }), "target");
      await user.click(await screen.findByRole("button", { name: /Target User @target-user/ }));

      expect(vi.mocked(createConversation).mock.calls[0]?.[0]).toBe("target-user");
      expect(await screen.findByRole("heading", { name: "Conversation 42" })).toBeInTheDocument();
    });

    it("disables all users while the conversation mutation is pending", async () => {
      vi.mocked(apiFetch).mockImplementation(() =>
        Promise.resolve(
          usersResponse([
            targetUser,
            {
              username: "other-user",
              displayName: "Other User",
              profileImage: null,
            },
          ]),
        ),
      );
      const pendingConversation = new Promise<never>(() => undefined);
      vi.mocked(createConversation).mockReturnValue(pendingConversation);
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("searchbox", { name: "Search users" }), "target");
      const targetUserButton = await screen.findByRole("button", {
        name: /Target User @target-user/,
      });
      const otherUserButton = screen.getByRole("button", {
        name: /Other User @other-user/,
      });

      await user.click(targetUserButton);

      await waitFor(() => {
        expect(targetUserButton).toBeDisabled();
        expect(otherUserButton).toBeDisabled();
      });
    });

    it("shows the mutation error without navigating when opening a conversation fails", async () => {
      vi.mocked(apiFetch).mockImplementation(() => Promise.resolve(usersResponse([targetUser])));
      const mutationError = new Error("Failed to create conversation");
      vi.mocked(createConversation).mockRejectedValue(mutationError);
      const user = userEvent.setup();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<UserSearch />} />
              <Route path="/conversations/:conversationId" element={<h1>Conversation</h1>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await user.type(screen.getByRole("searchbox", { name: "Search users" }), "target");
      await user.click(await screen.findByRole("button", { name: /Target User @target-user/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent(mutationError.message);
      expect(screen.queryByRole("heading", { name: "Conversation" })).not.toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    });
  });
});
