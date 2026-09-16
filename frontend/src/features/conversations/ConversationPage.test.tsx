import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions, type AuthUser } from "@/features/auth/authMeQuery.ts";
import { createDeferred } from "@/tests/createDeferred.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { ConversationPage } from "./ConversationPage.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

const renderConversationPage = (queryClient: QueryClient, initialEntry = "/conversations/42") =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/conversations/:conversationId" element={<ConversationPage />} />
          <Route path="/" element={<h1>Conversations</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ConversationPage", () => {
  describe("successful rendering", () => {
    const currentUser: AuthUser = {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    };

    const defaultConversation = {
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
    };

    const conversationMessage = {
      id: 10,
      content: "Hello from the conversation",
      sender: {
        username: "other-user",
        displayName: "Other User",
        profileImage: null,
      },
      createdAt: "2026-09-04T01:00:00.000Z",
    };

    const arrangeConversationPageRequests = ({
      conversation = defaultConversation,
      messages = [] as (typeof conversationMessage)[],
      createdMessage,
    }: {
      conversation?: typeof defaultConversation;
      messages?: (typeof conversationMessage)[];
      createdMessage?: typeof conversationMessage;
    } = {}) => {
      vi.mocked(apiFetch).mockImplementation((input, init) => {
        if (input === "/conversations/42") {
          return Promise.resolve(jsonResponse(conversation));
        }

        if (input === "/conversations/42/messages?limit=20") {
          return Promise.resolve(jsonResponse({ messages, nextCursor: null }));
        }

        if (input === "/conversations/42/messages" && init?.method === "POST" && createdMessage) {
          return Promise.resolve(jsonResponse(createdMessage, 201));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
    };

    it("shows a link back to conversations and navigates home when clicked", async () => {
      arrangeConversationPageRequests();
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient);

      const backLink = await screen.findByRole("link", {
        name: "Back to conversations",
      });

      await user.click(backLink);

      expect(await screen.findByRole("heading", { name: "Conversations" })).toBeInTheDocument();
    });

    it("loads the route conversation and shows the other participant", async () => {
      arrangeConversationPageRequests();
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
      expect(screen.getByText("@other-user")).toBeInTheDocument();
    });

    it("renders the message list for the route conversation", async () => {
      arrangeConversationPageRequests({
        messages: [conversationMessage],
      });
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(await screen.findByText("Hello from the conversation")).toBeInTheDocument();
    });

    it("shows the newly sent message while preserving the existing messages", async () => {
      const createdMessage = {
        id: 11,
        content: "Hello!",
        sender: {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        createdAt: "2026-09-08T01:00:00.000Z",
      };
      arrangeConversationPageRequests({
        messages: [conversationMessage],
        createdMessage,
      });
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient);

      expect(await screen.findByText(conversationMessage.content)).toBeInTheDocument();
      const messageInput = await screen.findByRole("textbox", { name: "Message" });
      await user.type(messageInput, "Hello!");
      await user.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => {
        expect(screen.getByText(conversationMessage.content)).toBeInTheDocument();
        expect(screen.getByText(createdMessage.content)).toBeInTheDocument();
      });
    });

    it("recovers the messages query and pagination after sending a message following an initial load error", async () => {
      const createdAfterErrorMessage = {
        id: 11,
        content: "New message after the load error",
        sender: {
          username: "current-user",
          displayName: "Current User",
          profileImage: null,
        },
        createdAt: "2026-09-08T01:00:00.000Z",
      };
      const olderMessage = {
        id: 9,
        content: "An older conversation message",
        sender: {
          username: "other-user",
          displayName: "Other User",
          profileImage: null,
        },
        createdAt: "2026-09-03T01:00:00.000Z",
      };
      const arrangeMessagesRecoveryRequests = ({
        createdMessage,
        recoveredMessage,
        olderMessage,
      }: {
        createdMessage: typeof conversationMessage;
        recoveredMessage: typeof conversationMessage;
        olderMessage: typeof conversationMessage;
      }) => {
        let isInitialMessagesRequest = true;
        const recoveredMessagesResponse = createDeferred<Response>();

        vi.mocked(apiFetch).mockImplementation((input, init) => {
          if (input === "/conversations/42") {
            return Promise.resolve(jsonResponse(defaultConversation));
          }

          if (input === "/conversations/42/messages?limit=20") {
            if (isInitialMessagesRequest) {
              isInitialMessagesRequest = false;
              return Promise.resolve(new Response(null, { status: 500 }));
            }

            return recoveredMessagesResponse.promise;
          }

          if (input === "/conversations/42/messages" && init?.method === "POST") {
            return Promise.resolve(jsonResponse(createdMessage, 201));
          }

          if (input === "/conversations/42/messages?cursor=10&limit=20") {
            return Promise.resolve(jsonResponse({ messages: [olderMessage], nextCursor: null }));
          }

          return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
        });

        return {
          getFirstPageRequestCount: () =>
            vi
              .mocked(apiFetch)
              .mock.calls.filter(
                ([requestInput]) => requestInput === "/conversations/42/messages?limit=20",
              ).length,
          resolveRecoveredMessages: () =>
            recoveredMessagesResponse.resolve(
              jsonResponse({
                messages: [createdMessage, recoveredMessage],
                nextCursor: 10,
              }),
            ),
        };
      };
      const { getFirstPageRequestCount, resolveRecoveredMessages } =
        arrangeMessagesRecoveryRequests({
          createdMessage: createdAfterErrorMessage,
          recoveredMessage: conversationMessage,
          olderMessage,
        });
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient);

      expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load messages");

      await user.type(
        screen.getByRole("textbox", { name: "Message" }),
        createdAfterErrorMessage.content,
      );
      await user.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText(createdAfterErrorMessage.content)).toBeInTheDocument();

      await waitFor(() => {
        expect(getFirstPageRequestCount()).toBe(2);
      });

      resolveRecoveredMessages();

      expect(await screen.findByText(conversationMessage.content)).toBeInTheDocument();
      expect(screen.getByText(createdAfterErrorMessage.content)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Load older messages" }));

      expect(await screen.findByText(olderMessage.content)).toBeInTheDocument();
      expect(screen.getByText(createdAfterErrorMessage.content)).toBeInTheDocument();
    });

    it("identifies the other participant by the current user's username", async () => {
      arrangeConversationPageRequests({
        conversation: {
          ...defaultConversation,
          participants: [...defaultConversation.participants].reverse(),
        },
      });
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
      expect(screen.getByText("@other-user")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Current User" })).not.toBeInTheDocument();
    });
  });

  describe("conversation query states", () => {
    it("shows a loading state while the conversation query is pending", () => {
      const pendingConversationResponse = new Promise<Response>(() => undefined);
      vi.mocked(apiFetch).mockReturnValue(pendingConversationResponse);

      renderConversationPage(queryClient);

      expect(screen.getByRole("status")).toHaveTextContent("Loading conversation...");
    });

    it("shows the generic fallback when the conversation request rejects", async () => {
      const transportError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(transportError);

      renderConversationPage(queryClient);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Failed to load conversation");
      expect(alert).not.toHaveTextContent(transportError.message);
    });
  });

  describe("route parameters", () => {
    it.each([
      { caseName: "not a number", conversationId: "invalid" },
      { caseName: "zero", conversationId: "0" },
      { caseName: "negative", conversationId: "-1" },
      { caseName: "a decimal", conversationId: "1.5" },
    ])(
      "shows an invalid conversation error without querying when the id is $caseName",
      async ({ conversationId }) => {
        renderConversationPage(queryClient, `/conversations/${conversationId}`);

        expect(await screen.findByRole("alert")).toHaveTextContent("Invalid conversation");
        expect(apiFetch).not.toHaveBeenCalled();
      },
    );
  });
});
