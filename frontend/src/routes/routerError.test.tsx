import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { router } from "./router.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/features/users/ProfilePage.tsx", () => ({
  ProfilePage: () => {
    throw new Error("Unexpected route render failure");
  },
}));

vi.mock("@/features/auth/RegisterPage.tsx", () => ({
  RegisterPage: () => {
    throw new Error("Unexpected route render failure");
  },
}));

describe("route error fallback", () => {
  let queryClient: QueryClient;
  const currentUser = {
    id: 1,
    username: "current-user",
    handle: "current-user",
    displayName: "Current User",
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.stubGlobal(
      "WebSocket",
      class {
        addEventListener() {
          return undefined;
        }

        removeEventListener() {
          return undefined;
        }

        close() {
          return undefined;
        }
      },
    );
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it.each([
    { caseName: "protected", path: "/profile", authUser: currentUser },
    { caseName: "guest", path: "/register", authUser: null },
  ])(
    "shows a user-facing error and allows returning home after a $caseName route crashes",
    async ({ path, authUser }) => {
      queryClient.setQueryData(authMeQueryOptions.queryKey, authUser);
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return Promise.resolve(
            authUser ? jsonResponse(authUser) : new Response(null, { status: 401 }),
          );
        }

        if (input === "/conversations?limit=20") {
          return Promise.resolve(jsonResponse({ conversations: [], nextCursor: null }));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      const user = userEvent.setup();

      await router.navigate(path);
      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );

      expect(
        await screen.findByRole("heading", { name: "Something went wrong" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Unexpected Application Error!")).not.toBeInTheDocument();
      expect(screen.queryByText("Unexpected route render failure")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
      const homeLink = screen.getByRole("link", { name: /home/i });
      expect(homeLink).toHaveAttribute("href", "/");

      await user.click(homeLink);

      const destination = authUser ? "Select a conversation" : "Log in";
      expect(await screen.findByRole("heading", { name: destination })).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Something went wrong" }),
      ).not.toBeInTheDocument();
    },
  );
});
