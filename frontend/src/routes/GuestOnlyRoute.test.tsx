import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AUTH_QUERY_ERROR_MESSAGE,
  AUTH_QUERY_FALLBACK_MESSAGE,
  authMeQueryOptions,
} from "@/features/auth/authMeQuery.ts";
import { GuestOnlyRoute } from "./GuestOnlyRoute.tsx";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

const mockAuthQueryResult = (result: Partial<ReturnType<typeof useQuery>>) => {
  vi.mocked(useQuery).mockReturnValue(result as ReturnType<typeof useQuery>);
};

const renderGuestOnlyRoute = ({ includeHome = false }: { includeHome?: boolean } = {}) =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route element={<GuestOnlyRoute />}>
          <Route path="/login" element={<h1>Guest content</h1>} />
        </Route>
        {includeHome && <Route path="/" element={<h1>Home</h1>} />}
      </Routes>
    </MemoryRouter>,
  );

describe("GuestOnlyRoute", () => {
  it("renders the guest-only child route when unauthenticated", () => {
    mockAuthQueryResult({
      data: null,
      isPending: false,
    });

    renderGuestOnlyRoute();

    expect(useQuery).toHaveBeenCalledWith(authMeQueryOptions);
    expect(screen.getByRole("heading", { name: "Guest content" })).toBeInTheDocument();
  });

  it("redirects home without rendering the guest-only child when authenticated", () => {
    mockAuthQueryResult({
      data: {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      },
      isPending: false,
    });

    renderGuestOnlyRoute({ includeHome: true });

    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Guest content" })).not.toBeInTheDocument();
  });

  it("shows a loading state without rendering the guest-only child while auth is pending", () => {
    mockAuthQueryResult({
      data: undefined,
      isPending: true,
    });

    renderGuestOnlyRoute();

    expect(screen.queryByRole("heading", { name: "Guest content" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("shows an auth error without rendering or redirecting when the auth query fails", () => {
    mockAuthQueryResult({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error(AUTH_QUERY_ERROR_MESSAGE),
    });

    renderGuestOnlyRoute({ includeHome: true });

    expect(screen.queryByRole("heading", { name: "Guest content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(AUTH_QUERY_FALLBACK_MESSAGE);
  });
});
