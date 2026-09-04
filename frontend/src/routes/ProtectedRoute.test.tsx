import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { ProtectedRoute } from "./ProtectedRoute.tsx";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

describe("ProtectedRoute", () => {
  it("renders the protected child route when the current user is authenticated", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      },
      isPending: false,
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
    expect(screen.getByRole("heading", { name: "Protected content" })).toBeInTheDocument();
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
      error: new Error("Failed to fetch current user"),
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
