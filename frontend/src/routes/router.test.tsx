import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { conversationsQueryOptions } from "@/features/conversations/conversationsQuery.ts";
import { messagesQueryOptions } from "@/features/messages/messagesQuery.ts";
import { createDeferred } from "@/tests/createDeferred.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { router } from "./router.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("router", () => {
  let queryClient: QueryClient;

  const currentUser = {
    id: 1,
    username: "current-user",
    displayName: "Current User",
  };

  const emptyConversationsPage = {
    conversations: [],
    nextCursor: null,
  };

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
    queryClient = new QueryClient();
  });

  afterEach(() => {
    queryClient.clear();
    WebSocketStub.instances = [];
    vi.unstubAllGlobals();
  });

  const renderRouterAt = async (path: string) => {
    await router.navigate(path);

    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  };

  const expectLoginPage = async () => {
    expect(await screen.findByRole("textbox", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  };

  describe("guest routes", () => {
    it("renders the login page under the guest-only route for an unauthenticated user", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));

      await renderRouterAt("/login");

      await expectLoginPage();
    });

    it("renders the register page under the guest-only route for an unauthenticated user", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));

      await renderRouterAt("/register");

      expect(await screen.findByRole("textbox", { name: "Username" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
    });
  });

  describe("protected routes", () => {
    it("redirects an unauthenticated user from the profile route to login", async () => {
      vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));

      await renderRouterAt("/profile");

      await expectLoginPage();
    });

    it("renders the messaging sidebar and empty selection state at the root route", async () => {
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(jsonResponse(currentUser));
        }

        if (input === "/conversations?limit=20") {
          return Promise.resolve(jsonResponse(emptyConversationsPage));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      await renderRouterAt("/");

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Search users" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "My profile" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
      expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();
    });
  });

  describe("session lifecycle", () => {
    it("logs out from the main screen and navigates to login", async () => {
      let isAuthenticated = true;
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/conversations?limit=20") {
          return Promise.resolve(jsonResponse(emptyConversationsPage));
        }

        if (input === "/auth/logout") {
          isAuthenticated = false;
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        if (input === "/auth/me") {
          return Promise.resolve(
            isAuthenticated ? jsonResponse(currentUser) : new Response(null, { status: 401 }),
          );
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      await renderRouterAt("/");

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      const logoutButton = screen.getByRole("button", { name: "Log out" });

      await user.click(logoutButton);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe("/login");
      });
      expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
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
      let authState: "user-a" | "unauthenticated" | "user-b-pending" | "user-b" = "user-a";
      const pendingUserB = createDeferred<Response>();
      const pendingUserBConversations = createDeferred<Response>();
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          if (authState === "user-a") {
            return Promise.resolve(jsonResponse(userA));
          }

          if (authState === "unauthenticated") {
            return Promise.resolve(new Response(null, { status: 401 }));
          }

          if (authState === "user-b-pending") {
            return pendingUserB.promise;
          }

          return Promise.resolve(jsonResponse(userB));
        }

        if (input === "/auth/login") {
          authState = "user-b-pending";
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        if (input === "/conversations?limit=20") {
          if (authState === "user-a") {
            return Promise.resolve(jsonResponse(userAConversations.pages[0]));
          }

          return pendingUserBConversations.promise;
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      const messagesQueryKey = messagesQueryOptions(10).queryKey;
      queryClient.setQueryData(authMeQueryOptions.queryKey, userA);
      queryClient.setQueryData(conversationsQueryOptions.queryKey, userAConversations);
      queryClient.setQueryData(messagesQueryKey, userAMessages);
      const user = userEvent.setup();

      await renderRouterAt("/");

      expect(await screen.findByText("User A Friend")).toBeInTheDocument();
      expect(queryClient.getQueryData(messagesQueryKey)).toEqual(userAMessages);
      await waitFor(() => {
        expect(queryClient.getQueryState(authMeQueryOptions.queryKey)!.fetchStatus).toBe("idle");
        expect(queryClient.getQueryState(conversationsQueryOptions.queryKey)!.fetchStatus).toBe(
          "idle",
        );
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

      await user.type(screen.getByRole("textbox", { name: "Username" }), "user-b");
      await user.type(screen.getByLabelText("Password"), "secure-password");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Logging in..." })).toBeDisabled();
      });
      expect(queryClient.getQueryData(conversationsQueryOptions.queryKey)).toBeUndefined();
      expect(queryClient.getQueryData(messagesQueryKey)).toBeUndefined();

      authState = "user-b";
      pendingUserB.resolve(jsonResponse(userB));

      expect(await screen.findByText("Loading conversations...")).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/");
      expect(screen.queryByText("User A Friend")).not.toBeInTheDocument();
      expect(screen.queryByText("Private message for User A")).not.toBeInTheDocument();

      pendingUserBConversations.resolve(jsonResponse(emptyConversationsPage));
      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    });
  });

  describe("app integration", () => {
    const conversation = {
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
    };

    it("renders the profile page outside the messaging layout", async () => {
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(jsonResponse(currentUser));
        }

        if (input === "/conversations?limit=20") {
          return Promise.resolve(jsonResponse(emptyConversationsPage));
        }

        if (input === "/users/current-user") {
          return Promise.resolve(
            jsonResponse({
              username: currentUser.username,
              displayName: currentUser.displayName,
              bio: null,
              profileImage: null,
            }),
          );
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      const user = userEvent.setup();

      await renderRouterAt("/");

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Search users" })).toBeInTheDocument();
      await user.click(screen.getByRole("link", { name: "My profile" }));

      expect(router.state.location.pathname).toBe("/profile");
      expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue(
        "Current User",
      );
      expect(screen.getByRole("button", { name: "Save profile" })).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Search users" })).not.toBeInTheDocument();
      expect(screen.queryByText("No conversations yet")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "My profile" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
    });

    it("refreshes the persistent conversation list after creating a conversation", async () => {
      const targetUser = {
        username: "target-user",
        displayName: "Target User",
        profileImage: null,
      };
      const createdConversation = {
        id: 42,
        participants: [
          {
            username: currentUser.username,
            displayName: currentUser.displayName,
            profileImage: null,
          },
          targetUser,
        ],
        createdAt: "2026-09-17T01:00:00.000Z",
        lastActivityAt: "2026-09-17T01:00:00.000Z",
      };
      const refreshedConversationsPage = {
        conversations: [
          {
            id: createdConversation.id,
            otherUser: targetUser,
            lastMessage: null,
            lastActivityAt: createdConversation.lastActivityAt,
          },
        ],
        nextCursor: null,
      };
      let conversationListRequestCount = 0;
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(jsonResponse(currentUser));
        }

        if (input === "/conversations?limit=20") {
          conversationListRequestCount += 1;
          return Promise.resolve(
            jsonResponse(
              conversationListRequestCount === 1
                ? emptyConversationsPage
                : refreshedConversationsPage,
            ),
          );
        }

        if (input.toString().startsWith("/users?query=")) {
          return Promise.resolve(jsonResponse([targetUser]));
        }

        if (input === "/conversations") {
          return Promise.resolve(jsonResponse(createdConversation, 201));
        }

        if (input === "/conversations/42") {
          return Promise.resolve(jsonResponse(createdConversation));
        }

        if (input === "/conversations/42/messages?limit=20") {
          return Promise.resolve(jsonResponse({ messages: [], nextCursor: null }));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      const user = userEvent.setup();

      await renderRouterAt("/");

      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      await user.type(screen.getByRole("combobox", { name: "Search users" }), "target");
      await user.click(await screen.findByRole("option", { name: /Target User @target-user/ }));

      expect(await screen.findByRole("link", { name: /Target User/ })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
      expect(screen.getByText("No messages yet")).toBeInTheDocument();
    });

    it("updates and reorders the persistent conversation list after sending a message", async () => {
      const firstOtherUser = {
        username: "first-user",
        displayName: "First User",
        profileImage: null,
      };
      const secondOtherUser = {
        username: "second-user",
        displayName: "Second User",
        profileImage: null,
      };
      const secondConversation = {
        id: 2,
        participants: [
          {
            username: currentUser.username,
            displayName: currentUser.displayName,
            profileImage: null,
          },
          secondOtherUser,
        ],
        createdAt: "2026-09-01T00:00:00.000Z",
        lastActivityAt: "2026-09-15T01:00:00.000Z",
      };
      const sentMessage = {
        id: 20,
        content: "Newest message from the sender",
        sender: {
          username: currentUser.username,
          displayName: currentUser.displayName,
          profileImage: null,
        },
        createdAt: "2026-09-17T02:00:00.000Z",
      };
      const initialConversationsPage = {
        conversations: [
          {
            id: 1,
            otherUser: firstOtherUser,
            lastMessage: {
              id: 10,
              content: "First conversation message",
              senderId: 2,
              createdAt: "2026-09-16T01:00:00.000Z",
            },
            lastActivityAt: "2026-09-16T01:00:00.000Z",
          },
          {
            id: secondConversation.id,
            otherUser: secondOtherUser,
            lastMessage: {
              id: 11,
              content: "Older second conversation message",
              senderId: 3,
              createdAt: secondConversation.lastActivityAt,
            },
            lastActivityAt: secondConversation.lastActivityAt,
          },
        ],
        nextCursor: null,
      };
      const refreshedConversationsPage = {
        conversations: [
          {
            id: secondConversation.id,
            otherUser: secondOtherUser,
            lastMessage: {
              id: sentMessage.id,
              content: sentMessage.content,
              senderId: currentUser.id,
              createdAt: sentMessage.createdAt,
            },
            lastActivityAt: sentMessage.createdAt,
          },
          initialConversationsPage.conversations[0],
        ],
        nextCursor: null,
      };
      let conversationListRequestCount = 0;
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(jsonResponse(currentUser));
        }

        if (input === "/conversations?limit=20") {
          conversationListRequestCount += 1;
          return Promise.resolve(
            jsonResponse(
              conversationListRequestCount === 1
                ? initialConversationsPage
                : refreshedConversationsPage,
            ),
          );
        }

        if (input === "/conversations/2") {
          return Promise.resolve(jsonResponse(secondConversation));
        }

        if (input === "/conversations/2/messages?limit=20") {
          return Promise.resolve(jsonResponse({ messages: [], nextCursor: null }));
        }

        if (input === "/conversations/2/messages") {
          return Promise.resolve(jsonResponse(sentMessage, 201));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      const user = userEvent.setup();
      const getConversationPaths = () =>
        screen
          .getAllByRole("link")
          .map((link) => link.getAttribute("href"))
          .filter((href): href is string => href?.startsWith("/conversations/") ?? false);

      await renderRouterAt("/");

      expect(await screen.findByRole("link", { name: /First User/ })).toBeInTheDocument();
      expect(getConversationPaths()).toEqual(["/conversations/1", "/conversations/2"]);
      await user.click(screen.getByRole("link", { name: /Second User/ }));
      await user.type(await screen.findByRole("textbox", { name: "Message" }), sentMessage.content);
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(
        await screen.findByRole("link", { name: new RegExp(sentMessage.content) }),
      ).toBeInTheDocument();
      expect(getConversationPaths()).toEqual(["/conversations/2", "/conversations/1"]);
    });

    it("updates the persistent conversation list after receiving a WebSocket message", async () => {
      const receivedMessage = {
        id: 11,
        content: "Newest message from the receiver event",
        sender: {
          username: "other-user",
          displayName: "Other User",
          profileImage: null,
        },
        createdAt: "2026-09-08T02:00:00.000Z",
      };
      const initialConversationsPage = {
        conversations: [
          {
            id: conversation.id,
            otherUser: conversation.participants[1],
            lastMessage: {
              id: 10,
              content: "Previous sidebar message",
              senderId: 2,
              createdAt: conversation.lastActivityAt,
            },
            lastActivityAt: conversation.lastActivityAt,
          },
        ],
        nextCursor: null,
      };
      const refreshedConversationsPage = {
        conversations: [
          {
            id: conversation.id,
            otherUser: conversation.participants[1],
            lastMessage: {
              id: receivedMessage.id,
              content: receivedMessage.content,
              senderId: 2,
              createdAt: receivedMessage.createdAt,
            },
            lastActivityAt: receivedMessage.createdAt,
          },
        ],
        nextCursor: null,
      };
      let conversationListRequestCount = 0;
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(jsonResponse(currentUser));
        }

        if (input === "/conversations?limit=20") {
          conversationListRequestCount += 1;
          return Promise.resolve(
            jsonResponse(
              conversationListRequestCount === 1
                ? initialConversationsPage
                : refreshedConversationsPage,
            ),
          );
        }

        if (input === "/conversations/1") {
          return Promise.resolve(jsonResponse(conversation));
        }

        if (input === "/conversations/1/messages?limit=20") {
          return Promise.resolve(jsonResponse({ messages: [], nextCursor: null }));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });

      await renderRouterAt("/conversations/1");

      expect(
        await screen.findByRole("link", { name: /Previous sidebar message/ }),
      ).toBeInTheDocument();
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
              conversationId: conversation.id,
              message: receivedMessage,
            },
          }),
        );
      });

      expect(
        await screen.findByText(receivedMessage.content, { selector: "section p" }),
      ).toBeInTheDocument();
      expect(
        await screen.findByRole("link", { name: new RegExp(receivedMessage.content) }),
      ).toBeInTheDocument();
    });

    it("renders the messaging sidebar alongside the conversation page", async () => {
      const existingMessage = {
        id: 10,
        content: "Hello from the protected route",
        sender: {
          username: "other-user",
          displayName: "Other User",
          profileImage: null,
        },
        createdAt: "2026-09-04T01:00:00.000Z",
      };
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(jsonResponse(currentUser));
        }

        if (input === "/conversations?limit=20") {
          return Promise.resolve(jsonResponse(emptyConversationsPage));
        }

        if (input === "/conversations/1") {
          return Promise.resolve(jsonResponse(conversation));
        }

        if (input === "/conversations/1/messages?limit=20") {
          return Promise.resolve(
            jsonResponse({
              messages: [existingMessage],
              nextCursor: null,
            }),
          );
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      await renderRouterAt("/conversations/1");

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
      expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Search users" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "My profile" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
      expect(await screen.findByText("Hello from the protected route")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Message" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    });

    it("connects the protected app WebSocket and shows a new message", async () => {
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(jsonResponse(currentUser));
        }

        if (input === "/conversations?limit=20") {
          return Promise.resolve(jsonResponse(emptyConversationsPage));
        }

        if (input === "/conversations/1") {
          return Promise.resolve(jsonResponse(conversation));
        }

        if (input === "/conversations/1/messages?limit=20") {
          return Promise.resolve(jsonResponse({ messages: [], nextCursor: null }));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      await renderRouterAt("/conversations/1");

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

      expect(
        await screen.findByText("New message for the current conversation"),
      ).toBeInTheDocument();
    });
  });
});
