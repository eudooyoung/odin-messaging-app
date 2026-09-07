import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserSearch } from "./UserSearch.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const renderUserSearch = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <UserSearch />
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
});
