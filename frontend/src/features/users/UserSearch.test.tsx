import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes, useLocation, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { UserSearch } from "./UserSearch.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

function UserProfileRoute() {
  const { username } = useParams<{ username: string }>();
  const { pathname } = useLocation();

  return (
    <>
      <h1>Profile @{username}</h1>
      <p>Current path: {pathname}</p>
    </>
  );
}

function PersistentUserSearchLayout() {
  return (
    <>
      <UserSearch />
      <Outlet />
    </>
  );
}

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
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<UserSearch />} />
            <Route path="/users/:username" element={<UserProfileRoute />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const renderPersistentUserSearch = (queryClient: QueryClient) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<PersistentUserSearchLayout />}>
              <Route path="users/:username" element={<UserProfileRoute />} />
            </Route>
          </Routes>
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

      expect(
        await screen.findByRole("heading", { name: "Profile @second-user" }),
      ).toBeInTheDocument();
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

      expect(
        await screen.findByRole("heading", { name: "Profile @first-user" }),
      ).toBeInTheDocument();
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

  describe("user selection", () => {
    const targetUser = {
      username: "target-user",
      displayName: "Target User",
      profileImage: null,
    };

    it("opens the selected user's profile", async () => {
      vi.mocked(apiFetch).mockImplementation(() => Promise.resolve(usersResponse([targetUser])));
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "target");
      await user.click(await screen.findByRole("option", { name: /Target User @target-user/ }));

      expect(
        await screen.findByRole("heading", { name: "Profile @target-user" }),
      ).toBeInTheDocument();
    });

    it("encodes the selected username in the route and restores it as the route param", async () => {
      const escapedTargetUser = {
        username: "target/user?#name",
        displayName: "Escaped Target User",
        profileImage: null,
      };
      vi.mocked(apiFetch).mockImplementation(() =>
        Promise.resolve(usersResponse([escapedTargetUser])),
      );
      const user = userEvent.setup();

      renderUserSearch(queryClient);

      await user.type(screen.getByRole("combobox", { name: "Search users" }), "target");
      await user.click(
        await screen.findByRole("option", {
          name: `Escaped Target User @${escapedTargetUser.username}`,
        }),
      );

      expect(
        await screen.findByRole("heading", {
          name: `Profile @${escapedTargetUser.username}`,
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Current path: /users/target%2Fuser%3F%23name")).toBeInTheDocument();
    });

    it("closes the dropdown and clears the active option after mouse selection in a persistent layout", async () => {
      vi.mocked(apiFetch).mockImplementation(() => Promise.resolve(usersResponse([targetUser])));
      const user = userEvent.setup();

      renderPersistentUserSearch(queryClient);

      const combobox = screen.getByRole("combobox", { name: "Search users" });
      await user.type(combobox, "target");
      const targetOption = await screen.findByRole("option", {
        name: /Target User @target-user/,
      });
      await user.keyboard("{ArrowDown}");
      expect(combobox).toHaveAttribute("aria-activedescendant", targetOption.id);

      await user.click(targetOption);

      expect(
        await screen.findByRole("heading", { name: "Profile @target-user" }),
      ).toBeInTheDocument();
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      expect(combobox).not.toHaveAttribute("aria-activedescendant");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("closes the dropdown and clears the active option after keyboard selection in a persistent layout", async () => {
      vi.mocked(apiFetch).mockImplementation(() => Promise.resolve(usersResponse([targetUser])));
      const user = userEvent.setup();

      renderPersistentUserSearch(queryClient);

      const combobox = screen.getByRole("combobox", { name: "Search users" });
      await user.type(combobox, "target");
      const targetOption = await screen.findByRole("option", {
        name: /Target User @target-user/,
      });
      await user.keyboard("{ArrowDown}");
      expect(combobox).toHaveAttribute("aria-activedescendant", targetOption.id);

      await user.keyboard("{Enter}");

      expect(
        await screen.findByRole("heading", { name: "Profile @target-user" }),
      ).toBeInTheDocument();
      expect(combobox).toBeInTheDocument();
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      expect(combobox).not.toHaveAttribute("aria-activedescendant");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });
});
