import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { RegisterPage } from "./RegisterPage.tsx";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const renderRegisterPage = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("RegisterPage", () => {
  it("submits valid registration details and navigates to login after a 201 response", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          username: "new-user",
          displayName: "New User",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderRegisterPage(queryClient);

    const usernameInput = screen.getByRole("textbox", { name: "Username" });
    const displayNameInput = screen.getByRole("textbox", { name: "Display name" });
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Register" });

    expect(usernameInput).toBeInTheDocument();
    expect(displayNameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    await user.type(usernameInput, "new-user");
    await user.type(displayNameInput, "New User");
    await user.type(passwordInput, "secure-password");
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledOnce();
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/auth/register",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const requestInit = vi.mocked(apiFetch).mock.calls[0]?.[1];
    expect(JSON.parse(requestInit?.body as string)).toEqual({
      username: "new-user",
      displayName: "New User",
      password: "secure-password",
    });
    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();

    queryClient.clear();
  });

  it.each([
    {
      caseName: "username is empty",
      username: "",
      displayName: "New User",
      password: "secure-password",
      expectedMessage: "Username is required",
    },
    {
      caseName: "display name is empty",
      username: "new-user",
      displayName: "",
      password: "secure-password",
      expectedMessage: "Display name is required",
    },
    {
      caseName: "password is shorter than 12 characters",
      username: "new-user",
      displayName: "New User",
      password: "a".repeat(11),
      expectedMessage: "Password must be at least 12 characters",
    },
  ])(
    "shows a validation message and does not submit when $caseName",
    async ({ username, displayName, password, expectedMessage }) => {
      const queryClient = new QueryClient();
      const user = userEvent.setup();

      renderRegisterPage(queryClient);

      if (username) {
        await user.type(screen.getByRole("textbox", { name: "Username" }), username);
      }
      if (displayName) {
        await user.type(screen.getByRole("textbox", { name: "Display name" }), displayName);
      }
      await user.type(screen.getByLabelText("Password"), password);
      await user.click(screen.getByRole("button", { name: "Register" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
      expect(apiFetch).not.toHaveBeenCalled();

      queryClient.clear();
    },
  );

  it("disables the register button and shows a pending label while registration is in progress", async () => {
    const pendingRegisterResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch).mockReturnValue(pendingRegisterResponse);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderRegisterPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "new-user");
    await user.type(screen.getByRole("textbox", { name: "Display name" }), "New User");
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("button", { name: "Registering..." })).toBeDisabled();
    expect(apiFetch).toHaveBeenCalledOnce();

    queryClient.clear();
  });

  it("shows a username conflict error and re-enables registration when registration returns 409", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 409 }));
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderRegisterPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), "existing-user");
    await user.type(screen.getByRole("textbox", { name: "Display name" }), "Existing User");
    await user.type(screen.getByLabelText("Password"), "secure-password");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username already exists");
    expect(screen.getByRole("button", { name: "Register" })).toBeEnabled();
    expect(apiFetch).toHaveBeenCalledOnce();

    queryClient.clear();
  });

  it.each([
    {
      caseName: "registration returns 500",
      arrangeFailure: () =>
        vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 })),
    },
    {
      caseName: "the network request fails",
      arrangeFailure: () => vi.mocked(apiFetch).mockRejectedValue(new TypeError("Failed to fetch")),
    },
  ])(
    "shows an unexpected error and re-enables registration when $caseName",
    async ({ arrangeFailure }) => {
      arrangeFailure();
      const queryClient = new QueryClient();
      const user = userEvent.setup();

      renderRegisterPage(queryClient);

      await user.type(screen.getByRole("textbox", { name: "Username" }), "new-user");
      await user.type(screen.getByRole("textbox", { name: "Display name" }), "New User");
      await user.type(screen.getByLabelText("Password"), "secure-password");
      await user.click(screen.getByRole("button", { name: "Register" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Something went wrong. Please try again.",
      );
      expect(screen.getByRole("button", { name: "Register" })).toBeEnabled();
      expect(apiFetch).toHaveBeenCalledOnce();

      queryClient.clear();
    },
  );
});
