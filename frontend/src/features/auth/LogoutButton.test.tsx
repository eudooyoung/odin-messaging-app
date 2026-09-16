import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { logout } from "./logout.ts";
import { LogoutButton } from "./LogoutButton.tsx";

vi.mock("./logout.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./logout.ts")>();

  return {
    ...actual,
    logout: vi.fn(),
  };
});

describe("LogoutButton", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderLogoutButton = (queryClient: QueryClient) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<LogoutButton />} />
            <Route path="/login" element={<h1>Login</h1>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  describe("logout lifecycle", () => {
    it("runs the logout mutation when clicked", async () => {
      vi.mocked(logout).mockResolvedValue(new Response(null, { status: 204 }));
      const user = userEvent.setup();
      renderLogoutButton(queryClient);

      await user.click(screen.getByRole("button", { name: "Log out" }));

      await waitFor(() => {
        expect(logout).toHaveBeenCalled();
      });
    });

    it("disables the button while logout is pending", async () => {
      const pendingLogout = new Promise<Response>(() => undefined);
      vi.mocked(logout).mockReturnValue(pendingLogout);
      const user = userEvent.setup();
      renderLogoutButton(queryClient);

      await user.click(screen.getByRole("button", { name: "Log out" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Log out" })).toBeDisabled();
      });
    });

    it("clears the query cache and navigates to login after success", async () => {
      const cachedQueryKey = ["test", "session-data"];
      queryClient.setQueryData(cachedQueryKey, { value: "cached" });
      vi.mocked(logout).mockResolvedValue(new Response(null, { status: 204 }));
      const user = userEvent.setup();
      renderLogoutButton(queryClient);

      await user.click(screen.getByRole("button", { name: "Log out" }));

      expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
      expect(queryClient.getQueryData(cachedQueryKey)).toBeUndefined();
    });
  });

  describe("logout errors", () => {
    it("shows the user-facing error and stays on the current route", async () => {
      vi.mocked(logout).mockRejectedValue(new UserFacingError("Logout failed"));
      const user = userEvent.setup();
      renderLogoutButton(queryClient);

      await user.click(screen.getByRole("button", { name: "Log out" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Logout failed");
      expect(screen.queryByRole("heading", { name: "Login" })).not.toBeInTheDocument();
    });

    it("shows the generic fallback without exposing an unexpected error", async () => {
      const transportError = new TypeError("Failed to fetch");
      vi.mocked(logout).mockRejectedValue(transportError);
      const user = userEvent.setup();
      renderLogoutButton(queryClient);

      await user.click(screen.getByRole("button", { name: "Log out" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Something went wrong. Please try again.");
      expect(alert).not.toHaveTextContent(transportError.message);
    });
  });
});
