import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { GENERAL_REGISTER_ERROR_MESSAGE, registerUser } from "./registerUser.ts";
import { RegisterPage } from "./RegisterPage.tsx";

vi.mock("./registerUser.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./registerUser.ts")>();

  return {
    ...actual,
    registerUser: vi.fn(),
  };
});

describe("RegisterPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

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

  const validRegistrationInput = {
    username: "new-user",
    displayName: "New User",
    password: "secure-password",
  };

  const submitRegistration = async (
    queryClient: QueryClient,
    input: typeof validRegistrationInput,
  ) => {
    const user = userEvent.setup();
    renderRegisterPage(queryClient);

    await user.type(screen.getByRole("textbox", { name: "Username" }), input.username);
    await user.type(screen.getByRole("textbox", { name: "Display name" }), input.displayName);
    await user.type(screen.getByLabelText("Password"), input.password);
    await user.click(screen.getByRole("button", { name: "Register" }));
  };

  it("shows a login link and navigates to login when clicked", async () => {
    const user = userEvent.setup();

    renderRegisterPage(queryClient);

    const loginLink = screen.getByRole("link", { name: "Log in" });

    expect(loginLink).toBeInTheDocument();

    await user.click(loginLink);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  describe("validation", () => {
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
      "shows an error and does not submit when $caseName",
      async ({ username, displayName, password, expectedMessage }) => {
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
        expect(registerUser).not.toHaveBeenCalled();
      },
    );
  });

  describe("registration lifecycle", () => {
    it("submits valid details and navigates to login after success", async () => {
      vi.mocked(registerUser).mockResolvedValue(new Response(null, { status: 201 }));

      await submitRegistration(queryClient, validRegistrationInput);

      expect(vi.mocked(registerUser).mock.calls[0]?.[0]).toEqual(validRegistrationInput);
      expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
    });

    it("disables the button and shows a pending label while pending", async () => {
      const pendingRegistration = new Promise<Response>(() => undefined);
      vi.mocked(registerUser).mockReturnValue(pendingRegistration);

      await submitRegistration(queryClient, validRegistrationInput);

      expect(await screen.findByRole("button", { name: "Registering..." })).toBeDisabled();
    });
  });

  describe("registration errors", () => {
    it("shows the user-facing message and re-enables registration", async () => {
      vi.mocked(registerUser).mockRejectedValue(new UserFacingError("Username already exists"));

      await submitRegistration(queryClient, {
        username: "existing-user",
        displayName: "Existing User",
        password: "secure-password",
      });

      expect(await screen.findByRole("alert")).toHaveTextContent("Username already exists");
      expect(screen.getByRole("button", { name: "Register" })).toBeEnabled();
    });

    it("shows the generic fallback and re-enables registration for an unexpected error", async () => {
      vi.mocked(registerUser).mockRejectedValue(new TypeError("Failed to fetch"));

      await submitRegistration(queryClient, validRegistrationInput);

      expect(await screen.findByRole("alert")).toHaveTextContent(GENERAL_REGISTER_ERROR_MESSAGE);
      expect(screen.getByRole("button", { name: "Register" })).toBeEnabled();
    });
  });
});
