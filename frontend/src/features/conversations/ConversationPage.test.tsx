import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions, type AuthUser } from "@/features/auth/authMeQuery.ts";
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

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

    if (
      input === "/conversations/42/messages" &&
      init?.method === "POST" &&
      createdMessage
    ) {
      return Promise.resolve(jsonResponse(createdMessage, 201));
    }

    return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
  });
};

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
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
  const recoveredMessagesResponse = deferred<Response>();

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

    if (
      input === "/conversations/42/messages" &&
      init?.method === "POST"
    ) {
      return Promise.resolve(jsonResponse(createdMessage, 201));
    }

    if (input === "/conversations/42/messages?cursor=10&limit=20") {
      return Promise.resolve(
        jsonResponse({ messages: [olderMessage], nextCursor: null }),
      );
    }

    return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
  });

  return {
    getFirstPageRequestCount: () =>
      vi.mocked(apiFetch).mock.calls.filter(
        ([requestInput]) =>
          requestInput === "/conversations/42/messages?limit=20",
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

describe("ConversationPage", () => {
  describe("successful rendering", () => {
    it("loads the route conversation and shows the other participant", async () => {
      arrangeConversationPageRequests();
      const queryClient = new QueryClient();
      const currentUser: AuthUser = {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      };
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
      expect(screen.getByText("@other-user")).toBeInTheDocument();
      expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe("/conversations/42");

      queryClient.clear();
    });

    it("renders the message list for the route conversation", async () => {
      arrangeConversationPageRequests({
        messages: [conversationMessage],
      });
      const queryClient = new QueryClient();
      const currentUser: AuthUser = {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      };
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(await screen.findByText("Hello from the conversation")).toBeInTheDocument();
      expect(apiFetch).toHaveBeenCalledWith("/conversations/42/messages?limit=20", {
        signal: expect.any(AbortSignal),
      });

      queryClient.clear();
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
      const queryClient = new QueryClient();
      const currentUser: AuthUser = {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      };
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient);

      expect(await screen.findByText(conversationMessage.content)).toBeInTheDocument();
      const messageInput = await screen.findByRole("textbox", { name: "Message" });
      await user.type(messageInput, "Hello!");
      await user.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith("/conversations/42/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Hello!" }),
        });
      });
      await waitFor(() => {
        expect(screen.getByText(conversationMessage.content)).toBeInTheDocument();
        expect(screen.getByText(createdMessage.content)).toBeInTheDocument();
      });

      queryClient.clear();
    });

    it("recovers the messages query and pagination after sending a message following an initial load error", async () => {
      const { getFirstPageRequestCount, resolveRecoveredMessages } =
        arrangeMessagesRecoveryRequests({
          createdMessage: createdAfterErrorMessage,
          recoveredMessage: conversationMessage,
          olderMessage,
        });
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const currentUser: AuthUser = {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      };
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Failed to load messages",
      );

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

      await user.click(
        screen.getByRole("button", { name: "Load older messages" }),
      );

      expect(await screen.findByText(olderMessage.content)).toBeInTheDocument();
      expect(screen.getByText(createdAfterErrorMessage.content)).toBeInTheDocument();

      queryClient.clear();
    });

    it("identifies the other participant by the current user's username", async () => {
      arrangeConversationPageRequests({
        conversation: {
          ...defaultConversation,
          participants: [...defaultConversation.participants].reverse(),
        },
      });
      const queryClient = new QueryClient();
      const currentUser: AuthUser = {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      };
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
      expect(screen.getByText("@other-user")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Current User" })).not.toBeInTheDocument();

      queryClient.clear();
    });
  });

  describe("conversation query states", () => {
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
        const queryClient = new QueryClient();

        renderConversationPage(queryClient, `/conversations/${conversationId}`);

        expect(await screen.findByRole("alert")).toHaveTextContent("Invalid conversation");
        expect(apiFetch).not.toHaveBeenCalled();

        queryClient.clear();
      },
    );
  });
});
