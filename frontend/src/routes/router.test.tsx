import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { conversationsQueryOptions } from "@/features/conversations/conversationsQuery.ts";
import { messagesQueryOptions } from "@/features/messages/messagesQuery.ts";
import { router } from "./router.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

class WebSocketStub {
  static instances: WebSocketStub[] = [];

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();

  constructor() {
    WebSocketStub.instances.push(this);
  }

  emitMessage(data: string) {
    const messageListener = this.addEventListener.mock.calls.find(
      ([eventType]) => eventType === "message",
    )?.[1];

    if (typeof messageListener !== "function") {
      throw new Error("Expected a WebSocket message listener");
    }

    messageListener(new MessageEvent("message", { data }));
  }
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", WebSocketStub);
});

afterEach(() => {
  WebSocketStub.instances = [];
  vi.unstubAllGlobals();
});

describe("router", () => {
  it("renders the conversation list and user search at the root route for an authenticated user", async () => {
    vi.mocked(apiFetch).mockImplementation((input) => {
      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (input === "/conversations?limit=20") {
        return Promise.resolve(
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
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();

    await router.navigate("/");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/auth/me", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations?limit=20", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("logs out from the main screen, clears the previous user's cache, and navigates to login", async () => {
    let isAuthenticated = true;
    vi.mocked(apiFetch).mockImplementation((input, init) => {
      if (input === "/conversations?limit=20") {
        return Promise.resolve(
          new Response(JSON.stringify({ conversations: [], nextCursor: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (input === "/auth/logout" && init?.method === "POST") {
        isAuthenticated = false;
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (input === "/auth/me") {
        return Promise.resolve(
          isAuthenticated
            ? new Response(
                JSON.stringify({
                  id: 1,
                  username: "current-user",
                  displayName: "Current User",
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                },
              )
            : new Response(null, { status: 401 }),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "me"], {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    });
    queryClient.setQueryData(["previous-user", "private-data"], {
      value: "private data",
    });
    const user = userEvent.setup();

    await router.navigate("/");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    const logoutButton = screen.getByRole("button", { name: "Log out" });

    await user.click(logoutButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/auth/logout", {
        method: "POST",
      });
      expect(queryClient.getQueryData(["previous-user", "private-data"])).toBeUndefined();
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();

    queryClient.clear();
  });

  it("clears the previous user's cache when auth ends before another user logs in", async () => {
    const userA = {
      id: 1,
      username: "user-a",
      displayName: "User A",
    };
    const userB = {
      id: 2,
      username: "user-b",
      displayName: "User B",
    };
    const userAConversations = {
      pages: [
        {
          conversations: [
            {
              id: 10,
              otherUser: {
                username: "user-a-friend",
                displayName: "User A Friend",
                profileImage: null,
              },
              lastMessage: null,
              lastActivityAt: "2026-09-10T01:00:00.000Z",
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [null],
    };
    const userAMessages = {
      pages: [
        {
          messages: [
            {
              id: 100,
              content: "Private message for User A",
              sender: {
                username: "user-a-friend",
                displayName: "User A Friend",
                profileImage: null,
              },
              createdAt: "2026-09-10T01:00:00.000Z",
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [null],
    };
    let authState: "user-a" | "unauthenticated" | "user-b-pending" | "user-b" =
      "user-a";
    let resolveUserB: (response: Response) => void = () => undefined;
    const pendingUserBResponse = new Promise<Response>((resolve) => {
      resolveUserB = resolve;
    });
    let resolveUserBConversations: (response: Response) => void = () => undefined;
    const pendingUserBConversations = new Promise<Response>((resolve) => {
      resolveUserBConversations = resolve;
    });
    vi.mocked(apiFetch).mockImplementation((input, init) => {
      if (input === "/auth/me") {
        if (authState === "user-a") {
          return Promise.resolve(
            new Response(JSON.stringify(userA), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (authState === "unauthenticated") {
          return Promise.resolve(new Response(null, { status: 401 }));
        }

        if (authState === "user-b-pending") {
          return pendingUserBResponse;
        }

        return Promise.resolve(
          new Response(JSON.stringify(userB), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (input === "/auth/login" && init?.method === "POST") {
        authState = "user-b-pending";
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      if (input === "/conversations?limit=20") {
        if (authState === "user-a") {
          return Promise.resolve(
            new Response(JSON.stringify(userAConversations.pages[0]), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return pendingUserBConversations;
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();
    const messagesQueryKey = messagesQueryOptions(10).queryKey;
    queryClient.setQueryData(authMeQueryOptions.queryKey, userA);
    queryClient.setQueryData(conversationsQueryOptions.queryKey, userAConversations);
    queryClient.setQueryData(messagesQueryKey, userAMessages);
    const user = userEvent.setup();

    await router.navigate("/");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("User A Friend")).toBeInTheDocument();
    expect(queryClient.getQueryData(messagesQueryKey)).toEqual(userAMessages);
    await waitFor(() => {
      expect(
        queryClient.getQueryState(authMeQueryOptions.queryKey)?.fetchStatus,
      ).toBe("idle");
      expect(
        queryClient.getQueryState(conversationsQueryOptions.queryKey)?.fetchStatus,
      ).toBe("idle");
    });

    authState = "unauthenticated";
    act(() => {
      queryClient.setQueryData(authMeQueryOptions.queryKey, null);
    });

    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
    await waitFor(() => {
      expect(queryClient.getQueryData(conversationsQueryOptions.queryKey)).toBeUndefined();
      expect(queryClient.getQueryData(messagesQueryKey)).toBeUndefined();
    });
    const logoutCalls = vi
      .mocked(apiFetch)
      .mock.calls.filter(
        ([input, init]) => input === "/auth/logout" && init?.method === "POST",
      );
    expect(logoutCalls).toHaveLength(0);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "user-b");
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
        signal: expect.any(AbortSignal),
      });
      expect(screen.getByRole("button", { name: "Logging in..." })).toBeDisabled();
    });
    expect(queryClient.getQueryData(conversationsQueryOptions.queryKey)).toBeUndefined();
    expect(queryClient.getQueryData(messagesQueryKey)).toBeUndefined();

    authState = "user-b";
    resolveUserB(
      new Response(JSON.stringify(userB), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await screen.findByText("Loading conversations...")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(screen.queryByText("User A Friend")).not.toBeInTheDocument();
    expect(screen.queryByText("Private message for User A")).not.toBeInTheDocument();

    resolveUserBConversations(
      new Response(JSON.stringify({ conversations: [], nextCursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();

    queryClient.clear();
  });

  it("disables logout and prevents duplicate requests while the mutation is pending", async () => {
    const pendingLogoutResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch).mockImplementation((input, init) => {
      if (input === "/conversations?limit=20") {
        return Promise.resolve(
          new Response(JSON.stringify({ conversations: [], nextCursor: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (input === "/auth/logout" && init?.method === "POST") {
        return pendingLogoutResponse;
      }

      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(["auth", "me"], {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    });
    const user = userEvent.setup();

    await router.navigate("/");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    const logoutButton = screen.getByRole("button", { name: "Log out" });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(logoutButton).toBeDisabled();
    });
    await user.click(logoutButton);

    const logoutCalls = vi
      .mocked(apiFetch)
      .mock.calls.filter(
        ([input, init]) => input === "/auth/logout" && init?.method === "POST",
      );
    expect(logoutCalls).toHaveLength(1);

    queryClient.clear();
  });

  it.each([
    {
      caseName: "the server returns an HTTP error",
      createFailure: () => Promise.resolve(new Response(null, { status: 500 })),
      expectedMessage: "Logout failed",
    },
    {
      caseName: "the request fails in transport",
      createFailure: () => Promise.reject(new TypeError("Failed to fetch")),
      expectedMessage: "Failed to fetch",
    },
  ])(
    "keeps the authenticated screen and allows retrying when $caseName",
    async ({ createFailure, expectedMessage }) => {
      vi.mocked(apiFetch).mockImplementation((input, init) => {
        if (input === "/conversations?limit=20") {
          return Promise.resolve(
            new Response(JSON.stringify({ conversations: [], nextCursor: null }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        if (input === "/auth/logout" && init?.method === "POST") {
          return createFailure();
        }

        if (input === "/auth/me") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                username: "current-user",
                displayName: "Current User",
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          );
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      const queryClient = new QueryClient();
      const previousUserData = { value: "private data" };
      queryClient.setQueryData(["auth", "me"], {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      });
      queryClient.setQueryData(["previous-user", "private-data"], previousUserData);
      const user = userEvent.setup();

      await router.navigate("/");
      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      const logoutButton = screen.getByRole("button", { name: "Log out" });
      await user.click(logoutButton);

      expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
      expect(logoutButton).toBeEnabled();
      expect(router.state.location.pathname).toBe("/");
      expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
      expect(queryClient.getQueryData(["previous-user", "private-data"])).toEqual(
        previousUserData,
      );

      await user.click(logoutButton);

      await waitFor(() => {
        const logoutCalls = vi
          .mocked(apiFetch)
          .mock.calls.filter(
            ([input, init]) => input === "/auth/logout" && init?.method === "POST",
          );
        expect(logoutCalls).toHaveLength(2);
        expect(logoutButton).toBeEnabled();
      });

      queryClient.clear();
    },
  );

  it("navigates from the main screen to the current user's profile", async () => {
    vi.mocked(apiFetch).mockImplementation((input) => {
      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (input === "/conversations?limit=20") {
        return Promise.resolve(
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
      }

      if (input === "/users/current-user") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              username: "current-user",
              displayName: "Current User",
              bio: null,
              profileImage: null,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    await router.navigate("/");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "My profile" }));

    expect(router.state.location.pathname).toBe("/profile");
    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue(
      "Current User",
    );
    expect(screen.getByRole("button", { name: "Save profile" })).toBeInTheDocument();

    queryClient.clear();
  });

  it("renders the login page under the guest-only route for an unauthenticated user", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const queryClient = new QueryClient();

    await router.navigate("/login");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("textbox", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("renders the register page under the guest-only route for an unauthenticated user", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const queryClient = new QueryClient();

    await router.navigate("/register");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("textbox", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("renders the profile page under the protected route for an authenticated user", async () => {
    vi.mocked(apiFetch).mockImplementation((input) => {
      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (input === "/users/current-user") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              username: "current-user",
              displayName: "Current User",
              bio: "Current bio",
              profileImage: "https://example.com/current-user.jpg",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();

    await router.navigate("/profile");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue(
      "Current User",
    );
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("Current bio");
    expect(screen.getByRole("textbox", { name: "Profile image" })).toHaveValue(
      "https://example.com/current-user.jpg",
    );
    expect(screen.getByRole("button", { name: "Save profile" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/auth/me", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/users/current-user", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("redirects an unauthenticated user from the profile route to login", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const queryClient = new QueryClient();

    await router.navigate("/profile");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("textbox", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/auth/me", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/auth/me", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("renders the conversation page under the protected route", async () => {
    vi.mocked(apiFetch).mockImplementation((input) => {
      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (input === "/conversations/1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
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
      }

      if (input === "/conversations/1/messages?limit=20") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              messages: [
                {
                  id: 10,
                  content: "Hello from the protected route",
                  sender: {
                    username: "other-user",
                    displayName: "Other User",
                    profileImage: null,
                  },
                  createdAt: "2026-09-04T01:00:00.000Z",
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
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();

    await router.navigate("/conversations/1");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
    expect(await screen.findByText("Hello from the protected route")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/auth/me", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations/1", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(3, "/conversations/1/messages?limit=20", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("shows only messages received for the current conversation", async () => {
    vi.mocked(apiFetch).mockImplementation((input) => {
      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (input === "/conversations/1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
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
      }

      if (input === "/conversations/1/messages?limit=20") {
        return Promise.resolve(
          new Response(JSON.stringify({ messages: [], nextCursor: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();

    await router.navigate("/conversations/1");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
    expect(await screen.findByText("No messages yet")).toBeInTheDocument();
    expect(WebSocketStub.instances).toHaveLength(1);
    const [webSocket] = WebSocketStub.instances;

    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    act(() => {
      webSocket.emitMessage(
        JSON.stringify({
          type: "message.created",
          payload: {
            conversationId: 2,
            message: {
              id: 20,
              content: "Message for another conversation",
              sender: {
                username: "another-user",
                displayName: "Another User",
                profileImage: null,
              },
              createdAt: "2026-09-08T01:00:00.000Z",
            },
          },
        }),
      );
    });

    expect(screen.queryByText("Message for another conversation")).not.toBeInTheDocument();

    act(() => {
      webSocket.emitMessage(
        JSON.stringify({
          type: "message.created",
          payload: {
            conversationId: 1,
            message: {
              id: 11,
              content: "New message for the current conversation",
              sender: {
                username: "other-user",
                displayName: "Other User",
                profileImage: null,
              },
              createdAt: "2026-09-08T02:00:00.000Z",
            },
          },
        }),
      );
    });

    expect(await screen.findByText("New message for the current conversation")).toBeInTheDocument();
    expect(screen.queryByText("Message for another conversation")).not.toBeInTheDocument();

    queryClient.clear();
  });
});
