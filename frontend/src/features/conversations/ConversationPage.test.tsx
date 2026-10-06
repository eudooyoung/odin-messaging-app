import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import type { AuthUser } from "@/features/auth/auth.type.ts";
import { createDeferred } from "@/tests/createDeferred.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { conversationQueryOptions } from "./conversationQuery.ts";
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
  vi.unstubAllGlobals();
});

const renderConversationPage = (
  queryClient: QueryClient,
  initialEntry: string | string[] = "/conversations/42",
) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={Array.isArray(initialEntry) ? initialEntry : [initialEntry]}>
        <Routes>
          <Route path="/conversations/:conversationId" element={<ConversationPage />} />
          <Route path="/users/other-handle" element={<h1>Other User public profile</h1>} />
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
      handle: "current-handle",
      displayName: "Current User",
    };

    const defaultConversation: {
      id: number;
      participants: {
        id: number;
        handle: string;
        displayName: string;
        profileImage: string | null;
      }[];
      createdAt: string;
      lastActivityAt: string;
    } = {
      id: 42,
      participants: [
        {
          id: 1,
          handle: "current-handle",
          displayName: "Current User",
          profileImage: null,
        },
        {
          id: 2,
          handle: "other-handle",
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
        id: 2,
        handle: "other-handle",
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

    it.each([
      { entry: "the conversation list", history: ["/", "/conversations/42"] },
      {
        entry: "a public profile",
        history: ["/users/other-handle", "/conversations/42"],
      },
      { entry: "a direct entry", history: ["/conversations/42"] },
    ])("returns to the conversation list on mobile from $entry", async ({ history }) => {
      vi.stubGlobal("innerWidth", 375);
      arrangeConversationPageRequests();
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient, history);

      await user.click(await screen.findByRole("link", { name: "Close conversation" }));

      expect(await screen.findByRole("heading", { name: "Conversations" })).toBeInTheDocument();
    });

    it("returns to the previous history entry on desktop when the close icon is clicked", async () => {
      vi.stubGlobal("innerWidth", 1024);
      arrangeConversationPageRequests();
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient, ["/users/other-handle", "/conversations/42"]);

      const closeLink = await screen.findByRole("link", {
        name: "Close conversation",
      });
      expect(closeLink).toHaveTextContent("←");
      expect(screen.queryByText("Back to conversations")).not.toBeInTheDocument();

      await user.click(closeLink);

      expect(
        await screen.findByRole("heading", { name: "Other User public profile" }),
      ).toBeInTheDocument();
    });

    it("loads the route conversation and shows the other participant", async () => {
      arrangeConversationPageRequests();
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
      expect(
        screen.queryByRole("img", { name: "Other User profile" }),
      ).not.toBeInTheDocument();
    });

    it("opens the other participant's public profile from the header identity", async () => {
      arrangeConversationPageRequests();
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      const user = userEvent.setup();

      renderConversationPage(queryClient);

      const identityLink = await screen.findByRole("link", {
        name: "Other User",
      });
      await user.click(identityLink);

      expect(
        await screen.findByRole("heading", { name: "Other User public profile" }),
      ).toBeInTheDocument();
    });

    it("focuses the message textarea when the conversation opens", async () => {
      arrangeConversationPageRequests();
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      const messageInput = await screen.findByRole("textbox", { name: "Message" });
      expect(document.activeElement).toBe(messageInput);
    });

    it("refocuses the message textarea when the conversation route changes", async () => {
      const nextConversation = {
        ...defaultConversation,
        id: 43,
        participants: defaultConversation.participants.map((participant) =>
          participant.id === 2 ? { ...participant, displayName: "Next User" } : participant,
        ),
      };
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/conversations/42") {
          return Promise.resolve(jsonResponse(defaultConversation));
        }
        if (input === "/conversations/43") {
          return Promise.resolve(jsonResponse(nextConversation));
        }
        if (
          input === "/conversations/42/messages?limit=20" ||
          input === "/conversations/43/messages?limit=20"
        ) {
          return Promise.resolve(jsonResponse({ messages: [], nextCursor: null }));
        }
        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      queryClient.setQueryData(conversationQueryOptions(43).queryKey, nextConversation);
      const user = userEvent.setup();

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/conversations/42"]}>
            <Link to="/conversations/43">Open conversation B</Link>
            <Routes>
              <Route path="/conversations/:conversationId" element={<ConversationPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
      const messageInput = screen.getByRole("textbox", { name: "Message" });
      expect(document.activeElement).toBe(messageInput);

      await user.click(screen.getByRole("link", { name: "Open conversation B" }));

      expect(await screen.findByRole("heading", { name: "Next User" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Message" })).toBe(messageInput);
      expect(document.activeElement).toBe(messageInput);
    });

    it("shows the other participant's profile image when available", async () => {
      const profileImage = "https://example.com/other-user.jpg";
      arrangeConversationPageRequests({
        conversation: {
          ...defaultConversation,
          participants: defaultConversation.participants.map((participant) =>
            participant.id === 2 ? { ...participant, profileImage } : participant,
          ),
        },
      });
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

      renderConversationPage(queryClient);

      expect(
        await screen.findByRole("img", { name: "Other User profile" }),
      ).toHaveAttribute("src", profileImage);
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
          id: currentUser.id,
          handle: currentUser.handle,
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

    it("recovers the messages query after sending a message following an initial load error", async () => {
      const createdAfterErrorMessage = {
        id: 11,
        content: "New message after the load error",
        sender: {
          id: currentUser.id,
          handle: currentUser.handle,
          displayName: "Current User",
          profileImage: null,
        },
        createdAt: "2026-09-08T01:00:00.000Z",
      };
      const arrangeMessagesRecoveryRequests = ({
        createdMessage,
        recoveredMessage,
      }: {
        createdMessage: typeof conversationMessage;
        recoveredMessage: typeof conversationMessage;
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
                nextCursor: null,
              }),
            ),
        };
      };
      const { getFirstPageRequestCount, resolveRecoveredMessages } =
        arrangeMessagesRecoveryRequests({
          createdMessage: createdAfterErrorMessage,
          recoveredMessage: conversationMessage,
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

    });

    it("identifies the other participant by id even when the current user's username differs", async () => {
      arrangeConversationPageRequests();
      queryClient.setQueryData<typeof currentUser>(authMeQueryOptions.queryKey, {
        ...currentUser,
        username: "other-handle",
      });

      renderConversationPage(queryClient);

      expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
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
