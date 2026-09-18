import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { createConversation } from "@/features/conversations/createConversation.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { UserSearch } from "./UserSearch.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/features/conversations/createConversation.ts", () => ({
  createConversation: vi.fn(),
}));

describe("UserSearch", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    queryClient.clear();
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });

  const usersResponse = (users: unknown[]) => jsonResponse(users);

  const renderUserSearch = (queryClient: QueryClient) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UserSearch />
        </MemoryRouter>
      </QueryClientProvider>,
    );

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

      const searchInput = screen.getByRole("combobox", { name: "Search users" });
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

      const searchInput = screen.getByRole("combobox", { name: "Search users" });
      await user.type(searchInput, "   ");

      expect(searchInput).toHaveValue("   ");
      expect(apiFetch).not.toHaveBeenCalled();
    });

    it("shows an empty state when the search has no matching users", async () => {
      vi.mocked(apiFetch).mockImplementation(() => Promise.resolve(usersResponse([])));
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "missing user");

      expect(await screen.findByText("No users found")).toBeInTheDocument();
    });

    it("shows a loading state while the user search is pending", async () => {
      const pendingSearchResponse = new Promise<Response>(() => undefined);
      vi.mocked(apiFetch).mockReturnValue(pendingSearchResponse);
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "other");

      expect(screen.getByRole("status")).toHaveTextContent("Searching users...");
    });

    it("shows the user-facing error from an invalid search response", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 400 }));
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "invalid");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Invalid user search");
      expect(alert).not.toHaveTextContent("Failed to search users");
    });

    it("shows a generic fallback when the user search request rejects", async () => {
      const transportError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(transportError);
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "other");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Failed to search users");
      expect(alert).not.toHaveTextContent(transportError.message);
    });
  });

  describe("keyboard navigation", () => {
    it("activates search results with ArrowDown and selects the active user with Enter", async () => {
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
              profileImage: null,
            },
          ]),
        ),
      );
      vi.mocked(createConversation).mockReturnValue(new Promise<never>(() => undefined));
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      const combobox = screen.getByRole("combobox", { name: "Search users" });
      await user.type(combobox, "user");
      const listbox = await screen.findByRole("listbox");
      const firstOption = screen.getByRole("option", { name: /First User @first-user/ });
      const secondOption = screen.getByRole("option", { name: /Second User @second-user/ });

      expect(listbox).toContainElement(firstOption);
      expect(listbox).toContainElement(secondOption);
      expect(firstOption.id).not.toBe("");
      expect(secondOption.id).not.toBe("");

      await user.keyboard("{ArrowDown}");

      expect(firstOption).toHaveAttribute("aria-selected", "true");
      expect(secondOption).toHaveAttribute("aria-selected", "false");
      expect(combobox).toHaveAttribute("aria-activedescendant", firstOption.id);

      await user.keyboard("{ArrowDown}");

      expect(firstOption).toHaveAttribute("aria-selected", "false");
      expect(secondOption).toHaveAttribute("aria-selected", "true");
      expect(combobox).toHaveAttribute("aria-activedescendant", secondOption.id);

      await user.keyboard("{Enter}");

      expect(createConversation).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createConversation).mock.calls[0]?.[0]).toBe("second-user");
    });

    it("moves to the previous search result with ArrowUp and selects it with Enter", async () => {
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
              profileImage: null,
            },
          ]),
        ),
      );
      vi.mocked(createConversation).mockReturnValue(new Promise<never>(() => undefined));
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      const combobox = screen.getByRole("combobox", { name: "Search users" });
      await user.type(combobox, "user");
      const firstOption = await screen.findByRole("option", {
        name: /First User @first-user/,
      });
      const secondOption = screen.getByRole("option", { name: /Second User @second-user/ });

      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");

      expect(firstOption).toHaveAttribute("aria-selected", "true");
      expect(secondOption).toHaveAttribute("aria-selected", "false");
      expect(combobox).toHaveAttribute("aria-activedescendant", firstOption.id);

      await user.keyboard("{Enter}");

      expect(createConversation).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createConversation).mock.calls[0]?.[0]).toBe("first-user");
    });

    it("closes the search results with Escape and reopens them from the first option", async () => {
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
              profileImage: null,
            },
          ]),
        ),
      );
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      const combobox = screen.getByRole("combobox", { name: "Search users" });
      await user.type(combobox, "user");
      await screen.findByRole("listbox");
      await user.keyboard("{ArrowDown}");

      await user.keyboard("{Escape}");

      expect(combobox).toHaveValue("user");
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      expect(combobox).not.toHaveAttribute("aria-activedescendant");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

      await user.keyboard("{ArrowDown}");

      const firstOption = await screen.findByRole("option", {
        name: /First User @first-user/,
      });
      expect(combobox).toHaveAttribute("aria-expanded", "true");
      expect(firstOption).toHaveAttribute("aria-selected", "true");
      expect(combobox).toHaveAttribute("aria-activedescendant", firstOption.id);
    });

    it("scrolls the active option into view when keyboard navigation moves beyond the visible results", async () => {
      const searchResults = Array.from({ length: 8 }, (_, index) => ({
        username: `user-${index + 1}`,
        displayName: `User ${index + 1}`,
        profileImage: null,
      }));
      vi.mocked(apiFetch).mockImplementation(() =>
        Promise.resolve(usersResponse(searchResults)),
      );
      const scrolledOptions: HTMLElement[] = [];
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(function (this: HTMLElement) {
          scrolledOptions.push(this);
        }),
      });
      const user = userEvent.setup();

      try {
        renderUserSearch(queryClient);

        const combobox = screen.getByRole("combobox", { name: "Search users" });
        await user.type(combobox, "user");
        const firstOption = await screen.findByRole("option", { name: /User 1 @user-1/ });
        const lastOption = screen.getByRole("option", { name: /User 8 @user-8/ });

        await user.keyboard("{ArrowDown}".repeat(searchResults.length));

        expect(lastOption).toHaveAttribute("aria-selected", "true");
        expect(scrolledOptions.at(-1)).toBe(lastOption);

        scrolledOptions.length = 0;
        await user.keyboard("{ArrowUp}".repeat(searchResults.length - 1));

        expect(firstOption).toHaveAttribute("aria-selected", "true");
        expect(scrolledOptions.at(-1)).toBe(firstOption);
      } finally {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    });
  });

  describe("dropdown interactions", () => {
    it("closes the search results only when clicking outside UserSearch", async () => {
      vi.mocked(apiFetch).mockImplementation(() =>
        Promise.resolve(
          usersResponse([
            {
              username: "target-user",
              displayName: "Target User",
              profileImage: null,
            },
          ]),
        ),
      );
      const user = userEvent.setup();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <UserSearch />
            <button type="button">Outside UserSearch</button>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const combobox = screen.getByRole("combobox", { name: "Search users" });
      await user.type(combobox, "target");
      const listbox = await screen.findByRole("listbox");

      await user.click(combobox);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      await user.click(listbox);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Outside UserSearch" }));

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(combobox).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("conversation creation", () => {
    const targetUser = {
      username: "target-user",
      displayName: "Target User",
      profileImage: null,
    };

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

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "target");
      await user.click(await screen.findByRole("option", { name: /Target User @target-user/ }));

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

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "target");
      const targetUserOption = await screen.findByRole("option", {
        name: /Target User @target-user/,
      });
      const otherUserOption = screen.getByRole("option", {
        name: /Other User @other-user/,
      });

      await user.click(targetUserOption);

      await waitFor(() => {
        expect(targetUserOption).toBeDisabled();
        expect(otherUserOption).toBeDisabled();
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

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "target");
      await user.click(await screen.findByRole("option", { name: /Target User @target-user/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent(mutationError.message);
      expect(screen.queryByRole("heading", { name: "Conversation" })).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Search users" })).toBeInTheDocument();
    });
  });
});
