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

  eventListeners = new Map<string, EventListener>();
  close = vi.fn(() => {
    this.emitClose({ code: 1000, wasClean: true });
  });

  constructor() {
    WebSocketStub.instances.push(this);
  }

  addEventListener(eventType: string, listener: EventListener) {
    this.eventListeners.set(eventType, listener);
  }

  removeEventListener(eventType: string, listener: EventListener) {
    if (this.eventListeners.get(eventType) === listener) {
      this.eventListeners.delete(eventType);
    }
  }

  emitOpen() {
    const openListener = this.eventListeners.get("open");
    if (!openListener) {
      throw new Error("Expected a WebSocket open listener");
    }

    openListener(new Event("open"));
  }

  emitMessage(event: MessageEvent) {
    this.eventListeners.get("message")?.(event);
  }

  emitClose(init: CloseEventInit = { code: 1006, wasClean: false }) {
    this.eventListeners.get("close")?.(new CloseEvent("close", init));
  }
}

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const currentUserSender = {
  username: "current-user",
  displayName: "Current User",
  profileImage: null,
};

const otherUserSender = {
  username: "other-user",
  displayName: "Other User",
  profileImage: null,
};

const createMessagesResponse = (messages: unknown[]) =>
  new Response(JSON.stringify({ messages, nextCursor: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const createSuccessfulAuthResponse = () =>
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
  );

const createFailedAuthResponse = () => new Response(null, { status: 500 });

const createMessageCreatedEvent = () =>
  new MessageEvent("message", {
    data: JSON.stringify({
      type: "message.created",
      payload: {
        conversationId: 42,
        message: {
          id: 11,
          content: "Hello from the other user",
          sender: otherUserSender,
          createdAt: "2026-09-08T02:00:00.000Z",
        },
      },
    }),
  });

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
    const messageEvent = createMessageCreatedEvent();
    webSocket.emitMessage(messageEvent);
    expect(handleWebSocketMessage).toHaveBeenCalledWith(queryClient, messageEvent);

    queryClient.clear();
  });

  it("refetches cached messages when the connection opens", async () => {
    // Arrange
    vi.stubGlobal("WebSocket", WebSocketStub);
    const cachedMessage = {
      id: 10,
      content: "Message loaded before connecting",
      sender: currentUserSender,
      createdAt: "2026-09-08T01:00:00.000Z",
    };
    const missedMessage = {
      id: 11,
      content: "Message missed while connecting",
      sender: otherUserSender,
      createdAt: "2026-09-08T02:00:00.000Z",
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(createMessagesResponse([cachedMessage]))
      .mockResolvedValueOnce(createMessagesResponse([missedMessage, cachedMessage]));
    const queryClient = new QueryClient();
    const queryOptions = messagesQueryOptions(42);
    await queryClient.infiniteQuery(queryOptions);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );

    const [webSocket] = WebSocketStub.instances;

    // Act
    webSocket.emitOpen();

    // Assert
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
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

  it("refetches messages after a pending initial fetch completes", async () => {
    // Arrange
    vi.stubGlobal("WebSocket", WebSocketStub);
    const pendingInitialMessagesResponse = deferred<Response>();
    const initialMessagesResponse = createMessagesResponse([]);
    const recoveryMessagesResponse = createMessagesResponse([]);
    vi.mocked(apiFetch)
      .mockReturnValueOnce(pendingInitialMessagesResponse.promise)
      .mockResolvedValueOnce(recoveryMessagesResponse);
    const queryClient = new QueryClient();

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

    // Act: open while the initial fetch is pending
    webSocket.emitOpen();

    // Assert: no recovery fetch yet
    expect(apiFetch).toHaveBeenCalledOnce();

    // Act: complete the initial fetch
    pendingInitialMessagesResponse.resolve(initialMessagesResponse);

    // Assert: recovery fetch starts
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    queryClient.clear();
  });

  it("waits for auth recovery before reconnecting after an unexpected close", async () => {
    // Arrange
    vi.stubGlobal("WebSocket", WebSocketStub);
    const authResponse = deferred<Response>();
    const queryClient = new QueryClient();
    vi.mocked(apiFetch).mockReturnValue(authResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    // Act: close the connection
    webSocket.emitClose();

    // Assert: reconnect waits for auth recovery
    expect(WebSocketStub.instances).toHaveLength(1);

    // Act: complete auth recovery
    authResponse.resolve(createSuccessfulAuthResponse());

    // Assert: reconnect succeeds
    await waitFor(() => {
      expect(WebSocketStub.instances).toHaveLength(2);
    });

    unmount();
    queryClient.clear();
  });

  it("does not reconnect when auth recovery returns null", async () => {
    // Arrange
    vi.stubGlobal("WebSocket", WebSocketStub);
    const authResponse = deferred<Response>();
    const queryClient = new QueryClient();
    vi.mocked(apiFetch).mockReturnValue(authResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    // Act
    webSocket.emitClose();
    authResponse.resolve(new Response(null, { status: 401 }));

    // Assert
    await waitFor(() => {
      expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toBeNull();
    });
    expect(WebSocketStub.instances).toHaveLength(1);

    unmount();
    queryClient.clear();
  });

  it("retries auth recovery after a delay when auth recovery fails", async () => {
    // Arrange
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    const recoveredAuthResponse = deferred<Response>();
    const queryClient = new QueryClient();
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(createFailedAuthResponse())
      .mockReturnValueOnce(recoveredAuthResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    // Act: close the connection
    webSocket.emitClose();

    // Assert: the first recovery fails
    await vi.advanceTimersByTimeAsync(0);
    expect(apiFetch).toHaveBeenCalledOnce();

    // Act: advance 999ms
    await vi.advanceTimersByTimeAsync(999);

    // Assert: no retry yet
    expect(apiFetch).toHaveBeenCalledOnce();

    // Act: advance the final 1ms
    await vi.advanceTimersByTimeAsync(1);

    // Assert: retry starts and waits for recovery
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(WebSocketStub.instances).toHaveLength(1);

    // Act: complete recovery
    recoveredAuthResponse.resolve(createSuccessfulAuthResponse());
    await vi.advanceTimersByTimeAsync(0);

    // Assert: reconnect succeeds
    expect(WebSocketStub.instances).toHaveLength(2);

    unmount();
    queryClient.clear();
  });

  it("continues auth recovery retries while ProtectedRoute shows an error", async () => {
    // Arrange
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(apiFetch).mockResolvedValue(createFailedAuthResponse());
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

    const [webSocket] = WebSocketStub.instances;

    // Act: fail auth recovery
    await act(async () => {
      webSocket.emitClose();
      await vi.advanceTimersByTimeAsync(0);
    });

    // Assert: the route shows the error
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to check authentication");

    // Act: reach the retry delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Assert: recovery retries while mounted
    expect(apiFetch).toHaveBeenCalledTimes(2);

    queryClient.clear();
  });

  it("does not retry auth recovery after unmounting while a retry is delayed", async () => {
    // Arrange
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    const authResponse = deferred<Response>();
    const queryClient = new QueryClient();
    vi.mocked(apiFetch).mockReturnValueOnce(authResponse.promise);
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );
    const [webSocket] = WebSocketStub.instances;

    // Act: schedule an auth recovery retry
    webSocket.emitClose();
    authResponse.resolve(createFailedAuthResponse());
    await vi.advanceTimersByTimeAsync(0);

    // Assert: the first recovery completed
    expect(apiFetch).toHaveBeenCalledOnce();

    // Act: unmount before the retry delay
    unmount();
    await vi.advanceTimersByTimeAsync(1000);

    // Assert: no retry starts
    expect(apiFetch).toHaveBeenCalledOnce();

    queryClient.clear();
  });

  it("does not reconnect when unmount cleanup closes the WebSocket", () => {
    // Arrange
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", WebSocketStub);
    const queryClient = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );

    // Act
    unmount();
    vi.runOnlyPendingTimers();

    // Assert
    expect(WebSocketStub.instances).toHaveLength(1);

    queryClient.clear();
  });

  it("stops forwarding messages and closes the connection when unmounted", () => {
    // Arrange
    vi.stubGlobal("WebSocket", WebSocketStub);
    const queryClient = new QueryClient();

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <AuthenticatedWebSocket />
      </QueryClientProvider>,
    );

    const [webSocket] = WebSocketStub.instances;

    // Act
    unmount();
    webSocket.emitMessage(createMessageCreatedEvent());

    // Assert
    expect(handleWebSocketMessage).not.toHaveBeenCalled();
    expect(webSocket.close).toHaveBeenCalledOnce();

    queryClient.clear();
  });
});
