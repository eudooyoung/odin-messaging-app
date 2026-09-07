import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { ConversationPage } from "./ConversationPage.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const renderConversationPage = (queryClient: QueryClient, initialEntry = "/conversations/42") =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/conversations/:conversationId" element={<ConversationPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ConversationPage", () => {
  it("loads the route conversation and shows the other participant", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 42,
          participants: [
            {
              username: "current-user",
              displayName: "Current User",
              profileImage: null,
            },
            {
              username: "other-user",
              displayName: "Other User",
              profileImage: null,
            },
          ],
          createdAt: "2026-09-01T00:00:00.000Z",
          lastActivityAt: "2026-09-04T01:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();
    queryClient.setQueryData(authMeQueryOptions.queryKey, {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    });

    renderConversationPage(queryClient);

    expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
    expect(screen.getByText("@other-user")).toBeInTheDocument();
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe("/conversations/42");

    queryClient.clear();
  });

  it("identifies the other participant by the current user's username", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 42,
          participants: [
            {
              username: "other-user",
              displayName: "Other User",
              profileImage: null,
            },
            {
              username: "current-user",
              displayName: "Current User",
              profileImage: null,
            },
          ],
          createdAt: "2026-09-01T00:00:00.000Z",
          lastActivityAt: "2026-09-04T01:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();
    queryClient.setQueryData(authMeQueryOptions.queryKey, {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    });

    renderConversationPage(queryClient);

    expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
    expect(screen.getByText("@other-user")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current User" })).not.toBeInTheDocument();

    queryClient.clear();
  });

  it("shows a loading state while the conversation query is pending", () => {
    const pendingConversationResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch).mockReturnValue(pendingConversationResponse);
    const queryClient = new QueryClient();

    renderConversationPage(queryClient);

    expect(screen.getByRole("status")).toHaveTextContent("Loading conversation...");

    queryClient.clear();
  });

  it.each([
    {
      status: 403,
      expectedMessage: "You do not have access to this conversation",
    },
    {
      status: 404,
      expectedMessage: "Conversation not found",
    },
  ])(
    "shows the status-specific user-facing message for a $status response",
    async ({ status, expectedMessage }) => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status }));
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      renderConversationPage(queryClient);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(expectedMessage);
      expect(alert).not.toHaveTextContent("Failed to load conversation");

      queryClient.clear();
    },
  );

  it("shows the generic user-facing error for an unhandled HTTP failure", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    renderConversationPage(queryClient);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load conversation");

    queryClient.clear();
  });

  it("shows the generic fallback when the conversation request rejects", async () => {
    const transportError = new TypeError("Failed to fetch");
    vi.mocked(apiFetch).mockRejectedValue(transportError);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    renderConversationPage(queryClient);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load conversation");
    expect(alert).not.toHaveTextContent(transportError.message);

    queryClient.clear();
  });

  it.each([
    { caseName: "not a number", conversationId: "invalid" },
    { caseName: "zero", conversationId: "0" },
    { caseName: "negative", conversationId: "-1" },
    { caseName: "a decimal", conversationId: "1.5" },
  ])(
    "shows an invalid conversation error without querying when the id is $caseName",
    async ({ conversationId }) => {
      const queryClient = new QueryClient();

      renderConversationPage(queryClient, `/conversations/${conversationId}`);

      expect(await screen.findByRole("alert")).toHaveTextContent("Invalid conversation");
      expect(apiFetch).not.toHaveBeenCalled();

      queryClient.clear();
    },
  );
});
