import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { LoginPage } from "./LoginPage.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const renderLoginPage = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("LoginPage", () => {
  it("submits the username and password to POST /auth/login", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 204 }));
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderLoginPage(queryClient);

    const usernameInput = screen.getByRole("textbox", { name: "Username" });
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Log in" });

    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    await user.type(usernameInput, "existing-user");
    await user.type(passwordInput, "secure-password");
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "existing-user",
          password: "secure-password",
        }),
      });
    });

    queryClient.clear();
  });

  it("shows a validation message and does not submit when username is empty", async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderLoginPage(queryClient);

    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username is required");
    expect(apiFetch).not.toHaveBeenCalled();

    queryClient.clear();
  });

  it("shows a validation message and does not submit when password is shorter than 12 characters", async () => {
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderLoginPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "existing-user");
    await user.type(screen.getByLabelText("Password"), "a".repeat(11));
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 12 characters",
    );
    expect(apiFetch).not.toHaveBeenCalled();

    queryClient.clear();
  });

  it("disables the login button and shows a pending label while login is in progress", async () => {
    const pendingLoginResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch).mockReturnValue(pendingLoginResponse);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderLoginPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "existing-user");
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("button", { name: "Logging in..." })).toBeDisabled();
    expect(apiFetch).toHaveBeenCalledOnce();

    queryClient.clear();
  });

  it("refetches the current user before navigating home after login succeeds", async () => {
    const currentUser = {
      id: 1,
      username: "existing-user",
      displayName: "Existing User",
    };
    let resolveAuthMe: (response: Response) => void = () => undefined;
    const authMeResponse = new Promise<Response>((resolve) => {
      resolveAuthMe = resolve;
    });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockReturnValueOnce(authMeResponse);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderLoginPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "existing-user");
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenNthCalledWith(2, "/auth/me", {
        signal: expect.any(AbortSignal),
      });
    });
    expect(screen.queryByRole("heading", { name: "Home" })).not.toBeInTheDocument();

    resolveAuthMe(
      new Response(JSON.stringify(currentUser), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(queryClient.getQueryData(["auth", "me"])).toEqual(currentUser);

    queryClient.clear();
  });

  it("shows a login failure without refetching auth or navigating when login returns 401", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderLoginPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "existing-user");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Login failed");
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledWith("/auth/login", expect.any(Object));
    expect(screen.queryByRole("heading", { name: "Home" })).not.toBeInTheDocument();

    queryClient.clear();
  });

  it.each([
    {
      caseName: "login returns 500",
      arrangeFailure: () =>
        vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 })),
    },
    {
      caseName: "the network request fails",
      arrangeFailure: () => vi.mocked(apiFetch).mockRejectedValue(new TypeError("Failed to fetch")),
    },
  ])("shows an unexpected error message when $caseName", async ({ arrangeFailure }) => {
    arrangeFailure();
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderLoginPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "existing-user");
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    expect(apiFetch).toHaveBeenCalledOnce();

    queryClient.clear();
  });
});
