import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { router } from "./router.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

describe("router", () => {
  it("renders the conversation list and user search at the root route for an authenticated user", async () => {
    vi.mocked(apiFetch).mockImplementation((input) => {
      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (input === "/conversations?limit=20") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              conversations: [],
              nextCursor: null,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();

    await router.navigate("/");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/auth/me", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations?limit=20", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("renders the login page under the guest-only route for an unauthenticated user", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const queryClient = new QueryClient();

    await router.navigate("/login");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("textbox", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("renders the register page under the guest-only route for an unauthenticated user", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const queryClient = new QueryClient();

    await router.navigate("/register");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("textbox", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });

  it("renders the conversation page under the protected route", async () => {
    vi.mocked(apiFetch).mockImplementation((input) => {
      if (input === "/auth/me") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              username: "current-user",
              displayName: "Current User",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      if (input === "/conversations/1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
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
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();

    await router.navigate("/conversations/1");
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Other User" })).toBeInTheDocument();
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/auth/me", {
      signal: expect.any(AbortSignal),
    });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/conversations/1", {
      signal: expect.any(AbortSignal),
    });

    queryClient.clear();
  });
});
