import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { GuestOnlyRoute } from "./GuestOnlyRoute.tsx";
import { ProtectedRoute } from "./ProtectedRoute.tsx";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

class WebSocketStub {
  static instances: WebSocketStub[] = [];

  eventListeners = new Map<string, Set<EventListener>>();
  addEventListener = vi.fn((eventType: string, listener: EventListener) => {
    const listeners = this.eventListeners.get(eventType) ?? new Set();
    listeners.add(listener);
    this.eventListeners.set(eventType, listeners);
  });
  removeEventListener = vi.fn(
    (eventType: string, listener: EventListener) => {
      this.eventListeners.get(eventType)?.delete(listener);
    },
  );
  close = vi.fn(() => {
    for (const listener of this.eventListeners.get("close") ?? []) {
      listener(
        new CloseEvent("close", {
          code: 1000,
          wasClean: true,
        }),
      );
    }
  });

  constructor() {
    WebSocketStub.instances.push(this);
  }
}

afterEach(() => {
  WebSocketStub.instances = [];
  vi.unstubAllGlobals();
});

describe("ProtectedRoute", () => {
  it("renders the protected child route when the current user is authenticated", () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      },
      isPending: false,
    } as ReturnType<typeof useQuery>);
    const queryClient = new QueryClient();

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

    expect(useQuery).toHaveBeenCalledWith(authMeQueryOptions);
    expect(screen.getByRole("heading", { name: "Protected content" })).toBeInTheDocument();
    expect(WebSocketStub.instances).toHaveLength(1);

    queryClient.clear();
  });

  it("disconnects without reconnecting when the authenticated user becomes unauthenticated", async () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      },
      isPending: false,
    } as ReturnType<typeof useQuery>);
    const queryClient = new QueryClient();
    const renderRoutes = () => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/protected"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<h1>Protected content</h1>} />
            </Route>
            <Route path="/login" element={<h1>Login</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(renderRoutes());

    expect(screen.getByRole("heading", { name: "Protected content" })).toBeInTheDocument();
    expect(WebSocketStub.instances).toHaveLength(1);
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

    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useQuery>);
    rerender(renderRoutes());

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(webSocket.removeEventListener).toHaveBeenCalledWith(
      "message",
      messageListener,
    );
    expect(webSocket.close).toHaveBeenCalledOnce();
    expect(WebSocketStub.instances).toHaveLength(1);

    queryClient.clear();
  });

  it("does not connect on a guest route", () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useQuery>);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route element={<GuestOnlyRoute />}>
              <Route path="/login" element={<h1>Login</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(WebSocketStub.instances).toHaveLength(0);

    queryClient.clear();
  });

  it("keeps the same connection while navigating between protected routes", async () => {
    vi.stubGlobal("WebSocket", WebSocketStub);
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      },
      isPending: false,
    } as ReturnType<typeof useQuery>);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/first"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route
                path="/first"
                element={
                  <>
                    <h1>First protected route</h1>
                    <Link to="/second">Go to second route</Link>
                  </>
                }
              />
              <Route
                path="/second"
                element={<h1>Second protected route</h1>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "First protected route" }),
    ).toBeInTheDocument();
    expect(WebSocketStub.instances).toHaveLength(1);

    await user.click(
      screen.getByRole("link", { name: "Go to second route" }),
    );

    expect(
      screen.getByRole("heading", { name: "Second protected route" }),
    ).toBeInTheDocument();
    expect(WebSocketStub.instances).toHaveLength(1);

    queryClient.clear();
  });

  it("shows a loading state without rendering the protected child while auth is pending", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isPending: true,
    } as ReturnType<typeof useQuery>);

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<h1>Protected content</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(useQuery).toHaveBeenCalledWith(authMeQueryOptions);
    expect(screen.queryByRole("heading", { name: "Protected content" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("shows an auth error without rendering or redirecting when the auth query fails", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("Failed to check authentication"),
    } as ReturnType<typeof useQuery>);

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<h1>Protected content</h1>} />
          </Route>
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(useQuery).toHaveBeenCalledWith(authMeQueryOptions);
    expect(screen.queryByRole("heading", { name: "Protected content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to check authentication");
  });

  it("redirects to login without rendering the protected child when unauthenticated", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useQuery>);

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<h1>Protected content</h1>} />
          </Route>
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Protected content" })).not.toBeInTheDocument();
  });
});
