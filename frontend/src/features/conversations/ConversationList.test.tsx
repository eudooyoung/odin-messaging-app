import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { ConversationList } from "./ConversationList.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const renderConversationList = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConversationList />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ConversationList", () => {
  it("renders conversations from the first query page", async () => {
    const firstActivityAt = "2026-09-04T01:00:00.000Z";
    const secondActivityAt = "2026-09-03T02:30:00.000Z";
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          conversations: [
            {
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
                createdAt: firstActivityAt,
              },
              lastActivityAt: firstActivityAt,
            },
            {
              id: 2,
              otherUser: {
                username: "second-user",
                displayName: "Second User",
                profileImage: null,
              },
              lastMessage: null,
              lastActivityAt: secondActivityAt,
            },
          ],
          nextCursor: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();

    renderConversationList(queryClient);

    expect(await screen.findByText("First User")).toBeInTheDocument();
    expect(screen.getByText("@first-user")).toBeInTheDocument();
    expect(screen.getByText("Latest message")).toBeInTheDocument();
    expect(screen.getByText(new Date(firstActivityAt).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText("Second User")).toBeInTheDocument();
    expect(screen.getByText("@second-user")).toBeInTheDocument();
    expect(screen.getByText(new Date(secondActivityAt).toLocaleString())).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();

    queryClient.clear();
  });

  it("navigates to the selected conversation", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          conversations: [
            {
              id: 42,
              otherUser: {
                username: "other-user",
                displayName: "Other User",
                profileImage: null,
              },
              lastMessage: null,
              lastActivityAt: "2026-09-04T01:00:00.000Z",
            },
          ],
          nextCursor: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<ConversationList />} />
            <Route path="/conversations/42" element={<h1>Conversation 42</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("link", { name: /Other User/ }));

    expect(await screen.findByRole("heading", { name: "Conversation 42" })).toBeInTheDocument();

    queryClient.clear();
  });

  it("loads the next page with the next cursor and appends its conversations", async () => {
    const firstPage = {
      conversations: [
        {
          id: 1,
          otherUser: {
            username: "first-user",
            displayName: "First User",
            profileImage: null,
          },
          lastMessage: null,
          lastActivityAt: "2026-09-04T01:00:00.000Z",
        },
      ],
      nextCursor: 42,
    };
    const secondPage = {
      conversations: [
        {
          id: 2,
          otherUser: {
            username: "second-user",
            displayName: "Second User",
            profileImage: null,
          },
          lastMessage: null,
          lastActivityAt: "2026-09-03T01:00:00.000Z",
        },
      ],
      nextCursor: null,
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderConversationList(queryClient);

    expect(await screen.findByText("First User")).toBeInTheDocument();
    const loadMoreButton = screen.getByRole("button", { name: "Load more" });
    expect(loadMoreButton).toBeInTheDocument();

    await user.click(loadMoreButton);

    expect(await screen.findByText("Second User")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations?cursor=42&limit=20", {
      signal: expect.any(AbortSignal),
    });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["First User", "Second User"]);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();

    queryClient.clear();
  });

  it("disables Load more while the next page is pending and re-enables it afterward", async () => {
    const firstPage = {
      conversations: [
        {
          id: 1,
          otherUser: {
            username: "first-user",
            displayName: "First User",
            profileImage: null,
          },
          lastMessage: null,
          lastActivityAt: "2026-09-04T01:00:00.000Z",
        },
      ],
      nextCursor: 42,
    };
    let resolveNextPage: (response: Response) => void = () => undefined;
    const nextPageResponse = new Promise<Response>((resolve) => {
      resolveNextPage = resolve;
    });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockReturnValueOnce(nextPageResponse);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderConversationList(queryClient);

    const loadMoreButton = await screen.findByRole("button", { name: "Load more" });

    await user.click(loadMoreButton);

    await waitFor(() => {
      expect(loadMoreButton).toBeDisabled();
    });

    resolveNextPage(
      new Response(
        JSON.stringify({
          conversations: [],
          nextCursor: 84,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await waitFor(() => {
      expect(loadMoreButton).toBeEnabled();
    });

    queryClient.clear();
  });

  it("keeps existing conversations and shows a load-more error when the next page fails", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversations: [
              {
                id: 1,
                otherUser: {
                  username: "first-user",
                  displayName: "First User",
                  profileImage: null,
                },
                lastMessage: null,
                lastActivityAt: "2026-09-04T01:00:00.000Z",
              },
            ],
            nextCursor: 42,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const user = userEvent.setup();

    renderConversationList(queryClient);

    expect(await screen.findByText("First User")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load more conversations");
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("First User")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load conversations")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();

    queryClient.clear();
  });

  it("shows an empty state when the first query page has no conversations", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          conversations: [],
          nextCursor: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();

    renderConversationList(queryClient);

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();

    queryClient.clear();
  });

  it("shows a loading state while the initial conversations query is pending", () => {
    const pendingConversationsResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch).mockReturnValue(pendingConversationsResponse);
    const queryClient = new QueryClient();

    renderConversationList(queryClient);

    expect(screen.getByRole("status")).toHaveTextContent("Loading conversations...");

    queryClient.clear();
  });

  it("shows the user-facing error from the initial conversations query", async () => {
    const queryError = new UserFacingError("Conversations are temporarily unavailable");
    vi.mocked(apiFetch).mockRejectedValue(queryError);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    renderConversationList(queryClient);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(queryError.message);
    expect(alert).not.toHaveTextContent("Failed to load conversations");

    queryClient.clear();
  });

  it("shows the generic fallback when the initial conversations request rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    renderConversationList(queryClient);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load conversations");
    expect(alert).not.toHaveTextContent(transportError.message);

    queryClient.clear();
  });
});
