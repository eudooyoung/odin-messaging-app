import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
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
