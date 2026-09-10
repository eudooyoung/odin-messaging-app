import { QueryClient, QueryClientProvider, useInfiniteQuery } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { ProtectedRoute } from "@/routes/ProtectedRoute.tsx";
import { AuthenticatedWebSocket } from "./AuthenticatedWebSocket.tsx";
import { handleWebSocketMessage } from "./handleWebSocketMessage.ts";
import { messagesQueryOptions } from "./messagesQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("./handleWebSocketMessage.ts", () => ({
  handleWebSocketMessage: vi.fn(),
}));

class WebSocketStub {
  static instances: WebSocketStub[] = [];

  eventListeners = new Map<string, Set<EventListener>>();
  addEventListener = vi.fn((eventType: string, listener: EventListener) => {
    const listeners = this.eventListeners.get(eventType) ?? new Set();
    listeners.add(listener);
    this.eventListeners.set(eventType, listeners);
  });
  removeEventListener = vi.fn((eventType: string, listener: EventListener) => {
    this.eventListeners.get(eventType)?.delete(listener);
  });
  close = vi.fn(() => {
    this.emitClose({ code: 1000, wasClean: true });
  });

  constructor() {
    WebSocketStub.instances.push(this);
  }

  emitOpen() {
    const openListeners = this.eventListeners.get("open");
    if (!openListeners || openListeners.size === 0) {
      throw new Error("Expected a WebSocket open listener");
    }

    for (const listener of openListeners) {
      listener(new Event("open"));
    }
  }

  emitClose(init: CloseEventInit = { code: 1006, wasClean: false }) {
    for (const listener of this.eventListeners.get("close") ?? []) {
      listener(new CloseEvent("close", init));
    }
  }
}

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const MessagesQuerySubscriber = ({ conversationId }: { conversationId: number }) => {
  useInfiniteQuery(messagesQueryOptions(conversationId));

  return null;
};

afterEach(() => {
  WebSocketStub.instances = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AuthenticatedWebSocket", () => {
  it("connects and forwards received messages to the WebSocket message handler", () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );

    expect(WebSocketStub.instances).toHaveLength(1);
    const [webSocket] = WebSocketStub.instances;
    expect(webSocket?.addEventListener).toHaveBeenCalledWith("message", expect.any(Function));
    const messageListener = webSocket?.addEventListener.mock.calls.find(
      ([eventType]) => eventType === "message",
    )?.[1];
    const messageEvent = new MessageEvent("message", {
      data: JSON.stringify({
        type: "message.created",
        payload: {
          conversationId: 42,
          message: {
            id: 11,
            content: "Hello from the other user",
            sender: {
              username: "other-user",
              displayName: "Other User",
              profileImage: null,
            },
            createdAt: "2026-09-08T02:00:00.000Z",
          },
        },
      }),
    });

    if (typeof messageListener !== "function") {
      throw new Error("Expected a WebSocket message listener");
    }

    messageListener(messageEvent);

    expect(handleWebSocketMessage).toHaveBeenCalledWith(queryClient, messageEvent);

    queryClient.clear();
  });

  it("refetches cached messages when the connection opens to recover messages missed before connecting", async () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    const cachedMessage = {
      id: 10,
      content: "Message loaded before connecting",
      sender: {
        username: "current-user",
        displayName: "Current User",
        profileImage: null,
      },
      createdAt: "2026-09-08T01:00:00.000Z",
    };
    const missedMessage = {
      id: 11,
      content: "Message missed while connecting",
      sender: {
        username: "other-user",
        displayName: "Other User",
        profileImage: null,
      },
      createdAt: "2026-09-08T02:00:00.000Z",
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [cachedMessage], nextCursor: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [missedMessage, cachedMessage],
            nextCursor: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const queryClient = new QueryClient();
    const queryOptions = messagesQueryOptions(42);
    await queryClient.infiniteQuery(queryOptions);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );

    const [webSocket] = WebSocketStub.instances;
    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    webSocket.emitOpen();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations/42/messages?limit=20", {
      signal: expect.any(AbortSignal),
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(queryOptions.queryKey)).toEqual({
        pages: [
          {
            messages: [missedMessage, cachedMessage],
            nextCursor: null,
          },
        ],
        pageParams: [null],
      });
    });

    queryClient.clear();
  });

  it("refetches messages after a pending initial fetch completes to recover messages missed before connecting", async () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    const initialMessagesResponse = deferred<Response>();
    const recoveryMessagesResponse = deferred<Response>();
    const initialMessage = {
      id: 10,
      content: "Message returned by the initial request",
      sender: {
        username: "current-user",
        displayName: "Current User",
        profileImage: null,
      },
      createdAt: "2026-09-08T01:00:00.000Z",
    };
    const missedMessage = {
      id: 11,
      content: "Message created before the WebSocket opened",
      sender: {
        username: "other-user",
        displayName: "Other User",
        profileImage: null,
      },
      createdAt: "2026-09-08T02:00:00.000Z",
    };
    vi.mocked(apiFetch)
      .mockReturnValueOnce(initialMessagesResponse.promise)
      .mockReturnValueOnce(recoveryMessagesResponse.promise);
    const queryClient = new QueryClient();
    const queryOptions = messagesQueryOptions(42);

    render(
      <QueryClientProvider client={queryClient}>
        <MessagesQuerySubscriber conversationId={42} />
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledOnce();
    });
    const [webSocket] = WebSocketStub.instances;
    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    webSocket.emitOpen();
    expect(apiFetch).toHaveBeenCalledOnce();

    initialMessagesResponse.resolve(
      new Response(JSON.stringify({ messages: [initialMessage], nextCursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations/42/messages?limit=20", {
      signal: expect.any(AbortSignal),
    });

    recoveryMessagesResponse.resolve(
      new Response(
        JSON.stringify({
          messages: [missedMessage, initialMessage],
          nextCursor: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await waitFor(() => {
      expect(queryClient.getQueryData(queryOptions.queryKey)).toEqual({
        pages: [
          {
            messages: [missedMessage, initialMessage],
            nextCursor: null,
          },
        ],
        pageParams: [null],
      });
    });

    queryClient.clear();
  });

  it("waits for auth recovery before reconnecting after an unexpected close", async () => {
    const authResponse = deferred<Response>();
    const queryClient = new QueryClient();
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(apiFetch).mockReturnValue(authResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    webSocket.emitOpen();
    webSocket.emitClose();

    expect(WebSocketStub.instances).toHaveLength(1);

    authResponse.resolve(
      new Response(
        JSON.stringify({
          id: 1,
          username: "user",
          displayName: "User",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await waitFor(() => {
      expect(WebSocketStub.instances).toHaveLength(2);
    });

    unmount();
    queryClient.clear();
  });

  it("does not reconnect when auth recovery returns null", async () => {
    const authResponse = deferred<Response>();
    const queryClient = new QueryClient();
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(apiFetch).mockReturnValue(authResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    webSocket.emitOpen();
    webSocket.emitClose();

    expect(WebSocketStub.instances).toHaveLength(1);

    authResponse.resolve(new Response(null, { status: 401 }));

    await waitFor(() => {
      expect(queryClient.getQueryData(["auth", "me"])).toBeNull();
    });

    expect(WebSocketStub.instances).toHaveLength(1);

    unmount();
    queryClient.clear();
  });

  it("retries auth recovery after a delay when auth recovery fails", async () => {
    const recoveredAuthResponse = deferred<Response>();
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    const queryClient = new QueryClient();
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockReturnValueOnce(recoveredAuthResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    webSocket.emitOpen();
    webSocket.emitClose();

    expect(WebSocketStub.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(0);

    expect(queryClient.getQueryState(["auth", "me"])?.status).toBe("error");
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(WebSocketStub.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(999);

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(WebSocketStub.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(WebSocketStub.instances).toHaveLength(1);

    recoveredAuthResponse.resolve(
      new Response(
        JSON.stringify({
          id: 1,
          username: "user",
          displayName: "User",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(WebSocketStub.instances).toHaveLength(2);

    unmount();
    queryClient.clear();
  });

  it("retries auth recovery after a temporary failure while mounted under ProtectedRoute", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const currentUser = {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    };
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnMount: false,
          retry: false,
        },
      },
    });
    queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/protected"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<h1>Protected content</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Protected content" }),
    ).toBeInTheDocument();
    expect(WebSocketStub.instances).toHaveLength(1);
    const [webSocket] = WebSocketStub.instances;

    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    await act(async () => {
      webSocket.emitClose();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to check authentication");
    expect(webSocket.close).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(apiFetch).toHaveBeenCalledTimes(2);

    queryClient.clear();
  });

  it("does not retry auth recovery after unmounting while a retry is delayed", async () => {
    const authResponse = deferred<Response>();
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    const queryClient = new QueryClient();
    vi.mocked(apiFetch).mockReturnValueOnce(authResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    webSocket.emitOpen();
    webSocket.emitClose();

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(WebSocketStub.instances).toHaveLength(1);

    authResponse.resolve(new Response(null, { status: 500 }));
    await vi.advanceTimersByTimeAsync(0);

    expect(queryClient.getQueryState(["auth", "me"])?.status).toBe("error");
    expect(apiFetch).toHaveBeenCalledOnce();

    unmount();
    await vi.advanceTimersByTimeAsync(1000);

    expect(apiFetch).toHaveBeenCalledOnce();
    expect(WebSocketStub.instances).toHaveLength(1);

    queryClient.clear();
  });

  it("does not reconnect when unmount cleanup closes the WebSocket", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    const queryClient = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    webSocket.emitOpen();
    unmount();
    vi.runOnlyPendingTimers();

    expect(WebSocketStub.instances).toHaveLength(1);

    queryClient.clear();
  });

  it("removes the message listener and closes the connection when unmounted", () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    const queryClient = new QueryClient();

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );

    const [webSocket] = WebSocketStub.instances;
    if (!webSocket) {
      throw new Error("Expected a WebSocket connection");
    }

    const messageListener = webSocket.addEventListener.mock.calls.find(
      ([eventType]) => eventType === "message",
    )?.[1];

    if (typeof messageListener !== "function") {
      throw new Error("Expected a WebSocket message listener");
    }

    unmount();

    expect(webSocket.removeEventListener).toHaveBeenCalledWith("message", messageListener);
    expect(webSocket.close).toHaveBeenCalledOnce();

    queryClient.clear();
  });
});
