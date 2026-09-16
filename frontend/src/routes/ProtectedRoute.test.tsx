import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  constructor() {
    WebSocketStub.instances.push(this);
  }

  addEventListener() {
    return undefined;
  }

  removeEventListener() {
    return undefined;
  }

  close() {
    return undefined;
  }
}

afterEach(() => {
  WebSocketStub.instances = [];
  vi.unstubAllGlobals();
});

describe("ProtectedRoute", () => {
  describe("when authenticated", () => {
    let queryClient: QueryClient;

    const authenticatedUser = {
      id: 1,
      username: "current-user",
      displayName: "Current User",
    };

    beforeEach(() => {
      queryClient = new QueryClient();
    });

    afterEach(() => {
      queryClient.clear();
    });

    it("renders the protected child route", () => {
      vi.stubGlobal("WebSocket", WebSocketStub);
      vi.mocked(useQuery).mockReturnValue({
        data: authenticatedUser,
        isPending: false,
      } as ReturnType<typeof useQuery>);
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

      expect(screen.getByRole("heading", { name: "Protected content" })).toBeInTheDocument();
    });

    it("redirects to login when the user becomes unauthenticated", async () => {
      vi.stubGlobal("WebSocket", WebSocketStub);
      vi.mocked(useQuery).mockReturnValue({
        data: authenticatedUser,
        isPending: false,
      } as ReturnType<typeof useQuery>);
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

      vi.mocked(useQuery).mockReturnValue({
        data: null,
        isPending: false,
      } as ReturnType<typeof useQuery>);
      rerender(renderRoutes());

      expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    });

    it("keeps the same connection while navigating between protected routes", async () => {
      vi.stubGlobal("WebSocket", WebSocketStub);
      vi.mocked(useQuery).mockReturnValue({
        data: authenticatedUser,
        isPending: false,
      } as ReturnType<typeof useQuery>);
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
                <Route path="/second" element={<h1>Second protected route</h1>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const [webSocket] = WebSocketStub.instances;

      await user.click(screen.getByRole("link", { name: "Go to second route" }));

      expect(screen.getByRole("heading", { name: "Second protected route" })).toBeInTheDocument();
      expect(WebSocketStub.instances).toEqual([webSocket]);
    });
  });

  describe("when auth state is unresolved", () => {
    it("shows a loading state without rendering the protected child while pending", () => {
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

      expect(screen.queryByRole("heading", { name: "Protected content" })).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    });

    it("shows an auth error without rendering or redirecting when the query fails", () => {
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

      expect(screen.queryByRole("heading", { name: "Protected content" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("Failed to check authentication");
    });
  });

  describe("when unauthenticated", () => {
    it("redirects to login without rendering the protected child", () => {
      vi.stubGlobal("WebSocket", WebSocketStub);
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
      expect(WebSocketStub.instances).toHaveLength(0);
    });
  });
});
