import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { GuestOnlyRoute } from "./GuestOnlyRoute.tsx";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

describe("GuestOnlyRoute", () => {
  it("renders the guest-only child route when unauthenticated", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isPending: false,
    } as ReturnType<typeof useQuery>);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<h1>Guest content</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(useQuery).toHaveBeenCalledWith(authMeQueryOptions);
    expect(screen.getByRole("heading", { name: "Guest content" })).toBeInTheDocument();
  });

  it("redirects home without rendering the guest-only child when authenticated", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        id: 1,
        username: "current-user",
        displayName: "Current User",
      },
      isPending: false,
    } as ReturnType<typeof useQuery>);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<h1>Guest content</h1>} />
          </Route>
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Guest content" })).not.toBeInTheDocument();
  });

  it("shows a loading state without rendering the guest-only child while auth is pending", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isPending: true,
    } as ReturnType<typeof useQuery>);

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<h1>Guest content</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(useQuery).toHaveBeenCalledWith(authMeQueryOptions);
    expect(screen.queryByRole("heading", { name: "Guest content" })).not.toBeInTheDocument();
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
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<GuestOnlyRoute />}>
            <Route path="/login" element={<h1>Guest content</h1>} />
          </Route>
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(useQuery).toHaveBeenCalledWith(authMeQueryOptions);
    expect(screen.queryByRole("heading", { name: "Guest content" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to check authentication");
  });
});
