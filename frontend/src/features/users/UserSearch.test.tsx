import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { createConversation } from "@/features/conversations/createConversation.ts";
import { UserSearch } from "./UserSearch.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/features/conversations/createConversation.ts", () => ({
  createConversation: vi.fn(),
}));

const renderUserSearch = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserSearch />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("UserSearch", () => {
  it("searches with the entered query and renders the matching users", async () => {
    vi.mocked(apiFetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
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
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderUserSearch(queryClient);

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "other user");

    expect(await screen.findByText("First User")).toBeInTheDocument();
    expect(screen.getByText("@first-user")).toBeInTheDocument();
    expect(screen.getByText("Second User")).toBeInTheDocument();
    expect(screen.getByText("@second-user")).toBeInTheDocument();
    await waitFor(() => {
      const requestedQueries = vi.mocked(apiFetch).mock.calls.map(([input]) => {
        const requestUrl = new URL(input.toString(), "http://localhost");

        return requestUrl.searchParams.get("query");
      });

      expect(requestedQueries).toContain("other user");
    });

    queryClient.clear();
  });

  it("shows an empty state when the search has no matching users", async () => {
    vi.mocked(apiFetch).mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderUserSearch(queryClient);

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "missing user");

    expect(await screen.findByText("No users found")).toBeInTheDocument();

    queryClient.clear();
  });

  it("shows a loading state while the user search is pending", async () => {
    const pendingSearchResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch).mockReturnValue(pendingSearchResponse);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderUserSearch(queryClient);

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "other");

    expect(screen.getByRole("status")).toHaveTextContent("Searching users...");

    queryClient.clear();
  });

  it("shows the user-facing error from an invalid search response", async () => {
    vi.mocked(apiFetch).mockImplementation(() =>
      Promise.resolve(new Response(null, { status: 400 })),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const user = userEvent.setup();

    renderUserSearch(queryClient);

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "invalid");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid user search");
    expect(alert).not.toHaveTextContent("Failed to search users");

    queryClient.clear();
  });

  it("shows a generic fallback when the user search request rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const user = userEvent.setup();

    renderUserSearch(queryClient);

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "other");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to search users");
    expect(alert).not.toHaveTextContent(transportError.message);

    queryClient.clear();
  });

  it("opens the conversation returned after selecting a user", async () => {
    vi.mocked(apiFetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            {
              username: "target-user",
              displayName: "Target User",
              profileImage: null,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    vi.mocked(createConversation).mockResolvedValue({
      id: 42,
      participants: [
        {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        {
          username: "target-user",
          displayName: "Target User",
          profileImage: null,
        },
      ],
      createdAt: "2026-09-07T01:00:00.000Z",
      lastActivityAt: "2026-09-07T01:00:00.000Z",
    });
    const queryClient = new QueryClient();
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

    expect(createConversation).toHaveBeenCalledOnce();
    expect(vi.mocked(createConversation).mock.calls[0]?.[0]).toBe("target-user");
    expect(await screen.findByRole("heading", { name: "Conversation 42" })).toBeInTheDocument();

    queryClient.clear();
  });

  it("disables the selected user while the conversation mutation is pending", async () => {
    vi.mocked(apiFetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            {
              username: "target-user",
              displayName: "Target User",
              profileImage: null,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    const pendingConversation = new Promise<never>(() => undefined);
    vi.mocked(createConversation).mockReturnValue(pendingConversation);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderUserSearch(queryClient);

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "target");
    const targetUserButton = await screen.findByRole("button", {
      name: /Target User @target-user/,
    });

    await user.click(targetUserButton);

    await waitFor(() => {
      expect(targetUserButton).toBeDisabled();
    });

    queryClient.clear();
  });

  it("shows the mutation error without navigating when opening a conversation fails", async () => {
    vi.mocked(apiFetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            {
              username: "target-user",
              displayName: "Target User",
              profileImage: null,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    const mutationError = new Error("Failed to create conversation");
    vi.mocked(createConversation).mockRejectedValue(mutationError);
    const queryClient = new QueryClient();
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

    queryClient.clear();
  });
});
