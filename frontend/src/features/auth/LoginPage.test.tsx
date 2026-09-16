import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { authMeQueryOptions, type AuthUser } from "./authMeQuery.ts";
import { login } from "./login.ts";
import { LoginPage } from "./LoginPage.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("./login.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./login.ts")>();

  return {
    ...actual,
    login: vi.fn(),
  };
});

let queryClient: QueryClient;

const currentUser: AuthUser = {
  id: 1,
  username: "existing-user",
  displayName: "Existing User",
};

const createAuthMeResponse = (user: AuthUser) =>
  new Response(JSON.stringify(user), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  queryClient = new QueryClient();
});

afterEach(() => {
  queryClient.clear();
});

const renderLoginPage = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<h1>Register</h1>} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const submitLogin = async (
  queryClient: QueryClient,
  input: { username: string; password: string },
) => {
  const user = userEvent.setup();
  renderLoginPage(queryClient);

  await user.type(screen.getByRole("textbox", { name: "Username" }), input.username);
  await user.type(screen.getByLabelText("Password"), input.password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
};

describe("LoginPage", () => {
  it("shows a registration link and navigates to register when clicked", async () => {
    const user = userEvent.setup();
    renderLoginPage(queryClient);

    const registerLink = screen.getByRole("link", { name: "Register" });
    expect(registerLink).toBeInTheDocument();
    await user.click(registerLink);

    expect(await screen.findByRole("heading", { name: "Register" })).toBeInTheDocument();
  });

  describe("validation", () => {
    it("shows an error and does not submit when username is empty", async () => {
      const user = userEvent.setup();

      renderLoginPage(queryClient);

      await user.type(screen.getByLabelText("Password"), "secure-password");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Username is required");
      expect(login).not.toHaveBeenCalled();
    });

    it("shows an error and does not submit when password is shorter than 12 characters", async () => {
      const user = userEvent.setup();

      renderLoginPage(queryClient);

      await user.type(screen.getByRole("textbox", { name: "Username" }), "existing-user");
      await user.type(screen.getByLabelText("Password"), "a".repeat(11));
      await user.click(screen.getByRole("button", { name: "Log in" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Password must be at least 12 characters",
      );
      expect(login).not.toHaveBeenCalled();
    });
  });

  describe("login lifecycle", () => {
    it("disables the button and shows a pending label while pending", async () => {
      const pendingLoginResponse = new Promise<Response>(() => undefined);
      vi.mocked(login).mockReturnValue(pendingLoginResponse);

      await submitLogin(queryClient, {
        username: "existing-user",
        password: "secure-password",
      });

      expect(await screen.findByRole("button", { name: "Logging in..." })).toBeDisabled();
    });

    it("waits for the current user before navigating home after success", async () => {
      let resolveAuthMe: (response: Response) => void = () => undefined;
      const authMeResponse = new Promise<Response>((resolve) => {
        resolveAuthMe = resolve;
      });
      vi.mocked(login).mockResolvedValue(new Response(null, { status: 204 }));
      vi.mocked(apiFetch).mockReturnValue(authMeResponse);

      await submitLogin(queryClient, {
        username: "existing-user",
        password: "secure-password",
      });

      await waitFor(() => {
        expect(queryClient.getQueryState(authMeQueryOptions.queryKey)!.fetchStatus).toBe(
          "fetching",
        );
      });
      expect(screen.queryByRole("heading", { name: "Home" })).not.toBeInTheDocument();

      resolveAuthMe(createAuthMeResponse(currentUser));

      expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
      expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toEqual(currentUser);
    });

    it("starts a fresh auth request after login when an earlier request is pending", async () => {
      const pendingAuthMeResponse = new Promise<Response>(() => undefined);
      vi.mocked(apiFetch)
        .mockReturnValueOnce(pendingAuthMeResponse)
        .mockResolvedValueOnce(createAuthMeResponse(currentUser));
      vi.mocked(login).mockResolvedValue(new Response(null, { status: 204 }));

      void queryClient.query(authMeQueryOptions).catch(() => undefined);

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledOnce();
      });

      await submitLogin(queryClient, {
        username: "existing-user",
        password: "secure-password",
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledTimes(2);
      });
      expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
      expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toEqual(currentUser);
    });
  });

  describe("login errors", () => {
    it("shows the user-facing message and stays on the login page", async () => {
      vi.mocked(login).mockRejectedValue(new UserFacingError("Login failed"));

      await submitLogin(queryClient, {
        username: "existing-user",
        password: "wrong-password",
      });

      expect(await screen.findByRole("alert")).toHaveTextContent("Login failed");
      expect(screen.queryByRole("heading", { name: "Home" })).not.toBeInTheDocument();
    });

    it("shows a generic fallback and re-enables the button after an unexpected error", async () => {
      vi.mocked(login).mockRejectedValue(new Error("Unexpected login failure"));

      await submitLogin(queryClient, {
        username: "existing-user",
        password: "secure-password",
      });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Something went wrong. Please try again.",
      );
      expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    });
  });
});
