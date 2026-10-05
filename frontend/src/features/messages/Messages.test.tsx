import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { Messages } from "./Messages.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("Messages", () => {
  let queryClient: QueryClient;

  const latestMessage = {
    id: 10,
    content: "Latest message",
    sender: {
      id: 2,
      handle: "other-handle",
      displayName: "Other User",
      profileImage: null,
    },
    createdAt: "2026-09-07T02:00:00.000Z",
  };

  const olderMessage = {
    id: 9,
    content: "Older message",
    sender: {
      id: 1,
      handle: "current-handle",
      displayName: "Current User",
      profileImage: null,
    },
    createdAt: "2026-09-07T01:00:00.000Z",
  };

  const messagesResponse = (messages: (typeof latestMessage)[], nextCursor: number | null) =>
    jsonResponse({ messages, nextCursor });

  const mockScrollDimensions = (scrollHeightCalculation: (element: Element) => number) => {
    const scrollHeight = vi
      .spyOn(Element.prototype, "scrollHeight", "get")
      .mockImplementation(function (this: Element) {
        if (this.getAttribute("aria-label") !== "Messages") return 0;
        return scrollHeightCalculation(this);
      });
    const clientHeight = vi
      .spyOn(Element.prototype, "clientHeight", "get")
      .mockImplementation(function (this: Element) {
        return this.getAttribute("aria-label") === "Messages" ? 200 : 0;
      });

    return () => {
      scrollHeight.mockRestore();
      clientHeight.mockRestore();
    };
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderMessageList = (queryClient: QueryClient, conversationId = 42) =>
    render(
      <QueryClientProvider client={queryClient}>
        <Messages conversationId={conversationId} currentUserId={1} />
      </QueryClientProvider>,
    );

  describe("initial page", () => {
    it("shows a loading state while the messages query is pending", () => {
      const pendingMessagesResponse = new Promise<Response>(() => undefined);
      vi.mocked(apiFetch).mockReturnValue(pendingMessagesResponse);

      renderMessageList(queryClient);

      expect(screen.getByRole("status")).toHaveTextContent("Loading messages...");
    });

    it("renders message content without repeating sender identity", async () => {
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([latestMessage, olderMessage], null));

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
      expect(screen.getByText(olderMessage.content)).toBeInTheDocument();
      expect(screen.queryByText(latestMessage.sender.displayName)).not.toBeInTheDocument();
      expect(screen.queryByText(`@${latestMessage.sender.handle}`)).not.toBeInTheDocument();
      expect(screen.queryByText(olderMessage.sender.displayName)).not.toBeInTheDocument();
      expect(screen.queryByText(`@${olderMessage.sender.handle}`)).not.toBeInTheDocument();
    });

    it("renders messages from oldest to latest when the query data is newest first", async () => {
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([latestMessage, olderMessage], null));

      renderMessageList(queryClient);

      await screen.findByText(latestMessage.content);

      expect(screen.getAllByRole("listitem").map((listItem) => listItem.textContent)).toEqual([
        expect.stringContaining(olderMessage.content),
        expect.stringContaining(latestMessage.content),
      ]);
    });

    it("waits for background refetch and initial scroll before revealing cached messages", async () => {
      const queryKey = ["conversations", 42, "messages"] as const;
      queryClient.setQueryData(queryKey, {
        pages: [{ messages: [olderMessage], nextCursor: null }],
        pageParams: [null],
      });
      let resolveRefetch!: (response: Response) => void;
      vi.mocked(apiFetch).mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveRefetch = resolve;
        }),
      );
      const restoreScrollDimensions = mockScrollDimensions((element) =>
        element.querySelectorAll("li").length === 1 ? 600 : 1432,
      );

      try {
        renderMessageList(queryClient);

        const scrollRegion = screen.getByRole("region", { name: "Messages" });
        expect(screen.getByText(olderMessage.content)).toBeInTheDocument();
        await waitFor(() => {
          expect(apiFetch).toHaveBeenCalledOnce();
        });
        expect(screen.getByText(olderMessage.content)).not.toBeVisible();
        expect(scrollRegion.scrollHeight).toBe(600);
        expect(scrollRegion.scrollTop).toBe(0);

        await act(async () => {
          resolveRefetch(messagesResponse([latestMessage, olderMessage], null));
        });

        expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
        expect(scrollRegion.scrollHeight).toBe(1432);
        expect(scrollRegion.scrollTop).toBeGreaterThanOrEqual(
          scrollRegion.scrollHeight - scrollRegion.clientHeight,
        );
        expect(screen.getByText(olderMessage.content)).toBeVisible();
        expect(screen.getByText(latestMessage.content)).toBeVisible();
      } finally {
        restoreScrollDimensions();
      }
    });

    it("shows an empty state when the first query page has no messages", async () => {
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([], null));

      renderMessageList(queryClient);

      expect(await screen.findByText("No messages yet")).toBeInTheDocument();
    });

    it("shows the user-facing error from the messages query", async () => {
      const queryError = new UserFacingError("You do not have access to this conversation");
      vi.mocked(apiFetch).mockRejectedValue(queryError);

      renderMessageList(queryClient);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(queryError.message);
      expect(alert).not.toHaveTextContent("Failed to load messages");
    });

    it("shows the generic fallback when the messages query fails unexpectedly", async () => {
      const unexpectedError = new TypeError("Failed to fetch");
      vi.mocked(apiFetch).mockRejectedValue(unexpectedError);

      renderMessageList(queryClient);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Failed to load messages");
      expect(alert).not.toHaveTextContent(unexpectedError.message);
    });

    it("keeps the rendered messages when a background refetch fails", async () => {
      let rejectBackgroundRefetch: (reason?: unknown) => void = () => undefined;
      const backgroundRefetchResponse = new Promise<Response>((_resolve, reject) => {
        rejectBackgroundRefetch = reject;
      });
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], null))
        .mockReturnValueOnce(backgroundRefetchResponse);

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();

      let backgroundRefetch!: Promise<void>;
      await act(async () => {
        backgroundRefetch = queryClient.invalidateQueries({
          queryKey: ["conversations", 42, "messages"],
        });
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledTimes(2);
      });

      await act(async () => {
        rejectBackgroundRefetch(new TypeError("Failed to fetch"));
        await backgroundRefetch;
      });

      expect(screen.getByText(latestMessage.content)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("new messages", () => {
    it("follows a new message when the reader is at the bottom", async () => {
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([latestMessage], null));
      const newMessage = {
        ...latestMessage,
        id: 11,
        content: "New message",
        createdAt: "2026-09-07T03:00:00.000Z",
      };
      const restoreScrollDimensions = mockScrollDimensions((element) =>
        element.querySelectorAll("li").length === 1 ? 600 : 900,
      );

      try {
        renderMessageList(queryClient);

        expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
        const scrollRegion = screen.getByRole("region", { name: "Messages" });
        expect(scrollRegion.scrollTop).toBeGreaterThanOrEqual(
          scrollRegion.scrollHeight - scrollRegion.clientHeight,
        );
        scrollRegion.scrollTop = scrollRegion.scrollHeight - scrollRegion.clientHeight;
        expect(scrollRegion.scrollTop).toBe(400);

        await act(async () => {
          queryClient.setQueryData(["conversations", 42, "messages"], {
            pages: [{ messages: [newMessage, latestMessage], nextCursor: null }],
            pageParams: [null],
          });
        });

        expect(await screen.findByText(newMessage.content)).toBeInTheDocument();
        expect(scrollRegion.scrollHeight).toBe(900);
        expect(scrollRegion.scrollTop).toBeGreaterThanOrEqual(
          scrollRegion.scrollHeight - scrollRegion.clientHeight,
        );
      } finally {
        restoreScrollDimensions();
      }
    });

    it("keeps the scroll position when the reader has scrolled up", async () => {
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([latestMessage], null));
      const newMessage = {
        ...latestMessage,
        id: 11,
        content: "New message",
        createdAt: "2026-09-07T03:00:00.000Z",
      };
      const restoreScrollDimensions = mockScrollDimensions((element) =>
        element.querySelectorAll("li").length === 1 ? 600 : 900,
      );

      try {
        renderMessageList(queryClient);

        expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
        const scrollRegion = screen.getByRole("region", { name: "Messages" });
        expect(scrollRegion.scrollTop).toBeGreaterThanOrEqual(
          scrollRegion.scrollHeight - scrollRegion.clientHeight,
        );
        scrollRegion.scrollTop = 100;
        fireEvent.scroll(scrollRegion);

        await act(async () => {
          queryClient.setQueryData(["conversations", 42, "messages"], {
            pages: [{ messages: [newMessage, latestMessage], nextCursor: null }],
            pageParams: [null],
          });
        });

        expect(await screen.findByText(newMessage.content)).toBeInTheDocument();
        expect(scrollRegion.scrollHeight).toBe(900);
        expect(scrollRegion.scrollTop).toBe(100);
      } finally {
        restoreScrollDimensions();
      }
    });
  });

  describe("timestamps and date separators", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 8, 29, 22));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows one date separator before consecutive messages from the same local day", async () => {
      const latestToday = {
        ...latestMessage,
        createdAt: new Date(2026, 8, 29, 21, 42).toISOString(),
      };
      const olderToday = {
        ...olderMessage,
        createdAt: new Date(2026, 8, 29, 9, 7).toISOString(),
      };
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([latestToday, olderToday], null));

      const { container } = renderMessageList(queryClient);

      await screen.findByText(latestToday.content);

      expect(screen.getAllByText("오늘")).toHaveLength(1);
      expect(container).toHaveTextContent(/오늘.*Older message.*Latest message/);
    });

    it("starts a new separator when the local date changes and labels past dates", async () => {
      const today = {
        ...latestMessage,
        createdAt: new Date(2026, 8, 29, 21, 42).toISOString(),
      };
      const yesterday = {
        ...olderMessage,
        createdAt: new Date(2026, 8, 28, 9, 7).toISOString(),
      };
      const earlier = {
        ...olderMessage,
        id: 8,
        content: "Earlier message",
        createdAt: new Date(2026, 8, 27, 18, 30).toISOString(),
      };
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([today, yesterday, earlier], null));

      const { container } = renderMessageList(queryClient);

      await screen.findByText(today.content);

      expect(container).toHaveTextContent(
        /2026년 9월 27일.*Earlier message.*어제.*Older message.*오늘.*Latest message/,
      );
    });

    it("shows each message's time in Korean local 12-hour format without seconds", async () => {
      const eveningMessage = {
        ...latestMessage,
        createdAt: new Date(2026, 8, 29, 21, 42).toISOString(),
      };
      const morningMessage = {
        ...olderMessage,
        createdAt: new Date(2026, 8, 29, 9, 7).toISOString(),
      };
      vi.mocked(apiFetch).mockResolvedValue(
        messagesResponse([eveningMessage, morningMessage], null),
      );

      const { container } = renderMessageList(queryClient);

      await screen.findByText(eveningMessage.content);

      expect(screen.getByText("오전 9:07")).toBeInTheDocument();
      expect(screen.getByText("오후 9:42")).toBeInTheDocument();
      expect(container).toHaveTextContent(/Older message.*오전 9:07.*Latest message.*오후 9:42/);
    });
  });

  describe("pagination", () => {
    const stubTopIntersection = () => {
      let showTopSentinel: () => void = () => undefined;
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(callback: IntersectionObserverCallback) {
            this.observe = (target: Element) => {
              showTopSentinel = () =>
                callback(
                  [{ isIntersecting: true, target } as IntersectionObserverEntry],
                  this as unknown as IntersectionObserver,
                );
            };
          }

          observe(_target: Element) {}
          disconnect() {}
          unobserve() {}
        },
      );
      return () => showTopSentinel();
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("waits for a cached conversation's background refetch and initial scroll before loading older messages", async () => {
      const targetConversationId = 43;
      const olderPagePath = `/conversations/${targetConversationId}/messages?cursor=8&limit=20`;
      const oldestMessage = {
        ...olderMessage,
        id: 8,
        content: "Oldest message",
        createdAt: "2026-09-07T00:00:00.000Z",
      };
      queryClient.setQueryData(["conversations", targetConversationId, "messages"], {
        pages: [{ messages: [olderMessage], nextCursor: 8 }],
        pageParams: [null],
      });
      let resolveRefetch!: (response: Response) => void;
      const refetchResponse = new Promise<Response>((resolve) => {
        resolveRefetch = resolve;
      });
      vi.mocked(apiFetch).mockImplementation((path) => {
        if (path === "/conversations/42/messages?limit=20") {
          return Promise.resolve(messagesResponse([latestMessage], null));
        }
        if (path === `/conversations/${targetConversationId}/messages?limit=20`) {
          return refetchResponse;
        }
        if (path === olderPagePath) {
          return Promise.resolve(messagesResponse([oldestMessage], null));
        }
        throw new Error(`Unexpected messages request: ${path}`);
      });
      const showTopSentinel = stubTopIntersection();
      const restoreScrollDimensions = mockScrollDimensions(
        (element) => element.querySelectorAll("li").length * 300,
      );

      try {
        const view = renderMessageList(queryClient);
        expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();

        view.rerender(
          <QueryClientProvider client={queryClient}>
            <Messages conversationId={targetConversationId} currentUserId={1} />
          </QueryClientProvider>,
        );

        const scrollRegion = screen.getByRole("region", { name: "Messages" });
        expect(screen.getByText(olderMessage.content)).toBeInTheDocument();
        await waitFor(() => {
          expect(apiFetch).toHaveBeenCalledWith(
            `/conversations/${targetConversationId}/messages?limit=20`,
            expect.anything(),
          );
        });
        scrollRegion.scrollTop = 0;
        fireEvent.scroll(scrollRegion);

        await act(async () => {
          showTopSentinel();
        });

        expect(apiFetch).not.toHaveBeenCalledWith(olderPagePath, expect.anything());
        expect(scrollRegion.scrollTop).toBe(0);

        await act(async () => {
          resolveRefetch(messagesResponse([latestMessage, olderMessage], 8));
        });

        expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();
        expect(scrollRegion.scrollTop).toBeGreaterThanOrEqual(
          scrollRegion.scrollHeight - scrollRegion.clientHeight,
        );

        scrollRegion.scrollTop = 0;
        fireEvent.scroll(scrollRegion);
        await act(async () => {
          showTopSentinel();
        });

        expect(await screen.findByText(oldestMessage.content)).toBeInTheDocument();
      } finally {
        restoreScrollDimensions();
        vi.mocked(apiFetch).mockReset();
      }
    });

    it("loads older messages and preserves the viewport when the top becomes visible", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], 10))
        .mockResolvedValueOnce(messagesResponse([olderMessage], null));
      const showTopSentinel = stubTopIntersection();
      const restoreScrollDimensions = mockScrollDimensions((element) =>
        element.querySelectorAll("li").length === 1 ? 600 : 900,
      );

      try {
        renderMessageList(queryClient);

        await waitFor(() => {
          expect(screen.getByText(latestMessage.content)).toBeVisible();
        });
        const scrollRegion = screen.getByRole("region", { name: "Messages" });
        scrollRegion.scrollTop = 0;
        fireEvent.scroll(scrollRegion);
        const previousScrollTop = scrollRegion.scrollTop;
        const previousScrollHeight = scrollRegion.scrollHeight;

        await act(async () => {
          showTopSentinel();
        });
        expect(await screen.findByText(olderMessage.content)).toBeInTheDocument();
        expect(screen.getByText(latestMessage.content)).toBeInTheDocument();

        expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
          expect.stringContaining(olderMessage.content),
          expect.stringContaining(latestMessage.content),
        ]);
        expect(scrollRegion.scrollHeight).toBe(900);
        expect(scrollRegion.scrollTop).toBe(
          previousScrollTop + scrollRegion.scrollHeight - previousScrollHeight,
        );
      } finally {
        restoreScrollDimensions();
        vi.unstubAllGlobals();
        vi.mocked(apiFetch).mockReset();
      }
    });

    it("keeps existing messages and prevents duplicate requests while loading", async () => {
      let resolveNextPage!: (response: Response) => void;
      const nextPageResponse = new Promise<Response>((resolve) => {
        resolveNextPage = resolve;
      });
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], 10))
        .mockReturnValueOnce(nextPageResponse);
      const showTopSentinel = stubTopIntersection();

      renderMessageList(queryClient);

      await waitFor(() => {
        expect(screen.getByText(latestMessage.content)).toBeVisible();
      });
      await act(async () => {
        showTopSentinel();
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledTimes(2);
      });
      expect(screen.getByText(latestMessage.content)).toBeInTheDocument();
      await act(async () => {
        showTopSentinel();
      });

      expect(apiFetch).toHaveBeenCalledTimes(2);
      resolveNextPage(messagesResponse([olderMessage], null));
      expect(await screen.findByText(olderMessage.content)).toBeInTheDocument();
    });

    it("keeps existing messages and allows retrying after a load error", async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(messagesResponse([latestMessage], 10))
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
        .mockResolvedValueOnce(messagesResponse([olderMessage], null));
      const user = userEvent.setup();
      const showTopSentinel = stubTopIntersection();

      renderMessageList(queryClient);

      await waitFor(() => {
        expect(screen.getByText(latestMessage.content)).toBeVisible();
      });
      await act(async () => {
        showTopSentinel();
      });

      expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load older messages");
      expect(screen.getByText(latestMessage.content)).toBeInTheDocument();
      const retryButton = screen.getByRole("button", {
        name: "Load older messages",
      });
      await user.click(retryButton);

      expect(await screen.findByText(olderMessage.content)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(apiFetch).toHaveBeenCalledTimes(3);
    });

    it("does not show the load older messages button when no older messages exist", async () => {
      vi.mocked(apiFetch).mockResolvedValue(messagesResponse([latestMessage], null));

      renderMessageList(queryClient);

      expect(await screen.findByText(latestMessage.content)).toBeInTheDocument();

      expect(screen.queryByRole("button", { name: "Load older messages" })).not.toBeInTheDocument();
    });
  });
});
