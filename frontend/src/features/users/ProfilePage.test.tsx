import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { authMeQueryOptions, type AuthUser } from "@/features/auth/authMeQuery.ts";
import { ProfilePage } from "./ProfilePage.tsx";
import { userProfileQueryOptions } from "./userProfileQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

const currentUser: AuthUser = {
  id: 1,
  username: "current-user",
  displayName: "Current User",
};

const renderProfilePage = (queryClient: QueryClient) => {
  queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const ProfileQueryObserver = () => {
  const { data: profile } = useQuery(userProfileQueryOptions(currentUser.username));

  return <output data-testid="profile-query-display-name">{profile?.displayName}</output>;
};

const AuthQueryObserver = () => {
  const { data: user } = useQuery(authMeQueryOptions);

  return <output data-testid="auth-me-display-name">{user?.displayName}</output>;
};

describe("ProfilePage", () => {
  it("loads the current user's profile and shows a loading state while it is pending", async () => {
    const pendingProfileResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch).mockReturnValue(pendingProfileResponse);
    const queryClient = new QueryClient();

    renderProfilePage(queryClient);

    expect(screen.getByRole("status")).toHaveTextContent("Loading profile...");
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/users/current-user", {
        signal: expect.any(AbortSignal),
      });
    });

    queryClient.clear();
  });

  it("shows the current profile values as the initial form values", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "current-user",
          displayName: "Current User",
          bio: "Hello from my profile.",
          profileImage: "https://example.com/current-user.jpg",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();

    renderProfilePage(queryClient);

    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue(
      "Current User",
    );
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("Hello from my profile.");
    expect(screen.getByRole("textbox", { name: "Profile image" })).toHaveValue(
      "https://example.com/current-user.jpg",
    );

    queryClient.clear();
  });

  it("shows empty inputs when the profile bio and profile image are null", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          username: "current-user",
          displayName: "Current User",
          bio: null,
          profileImage: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const queryClient = new QueryClient();

    renderProfilePage(queryClient);

    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue(
      "Current User",
    );
    expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Profile image" })).toHaveValue("");

    queryClient.clear();
  });

  it("preserves unsaved form values after a profile refetch updates the query data", async () => {
    const profile = {
      username: "current-user",
      displayName: "Current User",
      bio: "Current bio",
      profileImage: null,
    };
    const refreshedProfile = {
      ...profile,
      displayName: "Server User",
      bio: "Server bio",
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(refreshedProfile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const queryClient = new QueryClient();
    const user = userEvent.setup();
    queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
          <ProfileQueryObserver />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const displayNameInput = await screen.findByRole("textbox", {
      name: "Display name",
    });
    const bioInput = screen.getByRole("textbox", { name: "Bio" });
    expect(displayNameInput).toHaveValue("Current User");
    expect(bioInput).toHaveValue("Current bio");

    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Unsaved User");
    await user.clear(bioInput);
    await user.type(bioInput, "Unsaved bio");

    const profileQueryKey = userProfileQueryOptions("current-user").queryKey;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: profileQueryKey, exact: true });
    });

    await waitFor(() => {
      expect(screen.getByTestId("profile-query-display-name")).toHaveTextContent("Server User");
    });
    expect(queryClient.getQueryData(profileQueryKey)).toEqual(refreshedProfile);
    expect(displayNameInput).toHaveValue("Unsaved User");
    expect(bioInput).toHaveValue("Unsaved bio");

    queryClient.clear();
  });

  it.each([
    {
      caseName: "the requested profile does not exist",
      arrangeFailure: () =>
        vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 404 })),
      expectedMessage: "Profile not found",
    },
    {
      caseName: "the profile API returns another unsuccessful response",
      arrangeFailure: () =>
        vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 })),
      expectedMessage: "Failed to load profile",
    },
    {
      caseName: "the profile request fails in transport",
      arrangeFailure: () => vi.mocked(apiFetch).mockRejectedValue(new TypeError("Failed to fetch")),
      expectedMessage: "Failed to fetch",
    },
  ])(
    "shows the query error instead of a blank page when $caseName",
    async ({ arrangeFailure, expectedMessage }) => {
      arrangeFailure();
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      renderProfilePage(queryClient);

      expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);

      queryClient.clear();
    },
  );

  it.each([
    {
      caseName: "the display name is blank after trimming",
      fieldName: "Display name",
      value: "   ",
      expectedMessage: "Display name is required",
    },
    {
      caseName: "the display name is longer than 50 characters after trimming",
      fieldName: "Display name",
      value: ` ${"a".repeat(51)} `,
      expectedMessage: "Display name must be at most 50 characters",
    },
    {
      caseName: "the bio is longer than 300 characters after trimming",
      fieldName: "Bio",
      value: ` ${"a".repeat(301)} `,
      expectedMessage: "Bio must be at most 300 characters",
    },
  ])(
    "shows a validation error and does not update the profile when $caseName",
    async ({ fieldName, value, expectedMessage }) => {
      vi.mocked(apiFetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            username: "current-user",
            displayName: "Current User",
            bio: "Current bio",
            profileImage: "https://example.com/current-user.jpg",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      const queryClient = new QueryClient();
      const user = userEvent.setup();

      renderProfilePage(queryClient);

      const input = await screen.findByRole("textbox", { name: fieldName });
      await user.clear(input);
      await user.type(input, value);
      await user.click(screen.getByRole("button", { name: "Save profile" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
      expect(apiFetch).toHaveBeenCalledOnce();
      expect(apiFetch).not.toHaveBeenCalledWith(
        "/users/me",
        expect.objectContaining({ method: "PATCH" }),
      );

      queryClient.clear();
    },
  );

  it("allows empty bio and profile image values", async () => {
    const profile = {
      username: "current-user",
      displayName: "Current User",
      bio: "Current bio",
      profileImage: "https://example.com/current-user.jpg",
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...profile,
            bio: null,
            profileImage: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderProfilePage(queryClient);

    const bioInput = await screen.findByRole("textbox", { name: "Bio" });
    const profileImageInput = screen.getByRole("textbox", {
      name: "Profile image",
    });
    await user.clear(bioInput);
    await user.clear(profileImageInput);
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      "/users/me",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    queryClient.clear();
  });

  it("updates the profile and related caches after a successful submission", async () => {
    const profile = {
      username: "current-user",
      displayName: "Current User",
      bio: "Current bio",
      profileImage: "https://example.com/current-user.jpg",
    };
    const updatedProfile = {
      username: "current-user",
      displayName: "Updated User",
      bio: null,
      profileImage: null,
    };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedProfile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderProfilePage(queryClient);

    const displayNameInput = await screen.findByRole("textbox", {
      name: "Display name",
    });
    const bioInput = screen.getByRole("textbox", { name: "Bio" });
    const profileImageInput = screen.getByRole("textbox", {
      name: "Profile image",
    });
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Updated User");
    await user.clear(bioInput);
    await user.clear(profileImageInput);
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Profile updated");
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: "Updated User",
        bio: null,
        profileImage: null,
      }),
    });
    expect(queryClient.getQueryData(userProfileQueryOptions("current-user").queryKey)).toEqual(
      updatedProfile,
    );
    expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toEqual({
      ...currentUser,
      displayName: "Updated User",
    });

    queryClient.clear();
  });

  it("keeps the saved profile when an older profile refetch finishes afterward", async () => {
    const profile = {
      username: "current-user",
      displayName: "Current User",
      bio: "Current bio",
      profileImage: null,
    };
    const updatedProfile = {
      ...profile,
      displayName: "Saved User",
      bio: "Saved bio",
    };
    let profileGetCount = 0;
    let resolveProfileRefetch: ((response: Response) => void) | undefined;
    const pendingProfileRefetch = new Promise<Response>((resolve) => {
      resolveProfileRefetch = resolve;
    });
    vi.mocked(apiFetch).mockImplementation((input, init) => {
      if (input === "/users/current-user") {
        profileGetCount += 1;

        if (profileGetCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(profile), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }

        return pendingProfileRefetch;
      }

      if (input === "/users/me" && init?.method === "PATCH") {
        return Promise.resolve(
          new Response(JSON.stringify(updatedProfile), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();
    const user = userEvent.setup();
    queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
          <ProfileQueryObserver />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const displayNameInput = await screen.findByRole("textbox", {
      name: "Display name",
    });
    const bioInput = screen.getByRole("textbox", { name: "Bio" });
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Saved User");
    await user.clear(bioInput);
    await user.type(bioInput, "Saved bio");

    const profileQueryKey = userProfileQueryOptions("current-user").queryKey;
    const refetchPromise = queryClient.refetchQueries({
      queryKey: profileQueryKey,
      exact: true,
    });
    await waitFor(() => {
      expect(profileGetCount).toBe(2);
    });

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Profile updated")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("profile-query-display-name")).toHaveTextContent("Saved User");
    });
    expect(queryClient.getQueryData(profileQueryKey)).toEqual(updatedProfile);

    if (!resolveProfileRefetch) {
      throw new Error("Expected a pending profile refetch");
    }

    const resolveRefetch = resolveProfileRefetch;

    await act(async () => {
      resolveRefetch(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await refetchPromise;
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(profileQueryKey)).toEqual(updatedProfile);
      expect(screen.getByTestId("profile-query-display-name")).toHaveTextContent("Saved User");
    });
    expect(displayNameInput).toHaveValue("Saved User");
    expect(bioInput).toHaveValue("Saved bio");

    queryClient.clear();
  });

  it("keeps the saved display name when an older auth refetch finishes afterward", async () => {
    const profile = {
      username: "current-user",
      displayName: "Current User",
      bio: null,
      profileImage: null,
    };
    const updatedProfile = {
      ...profile,
      displayName: "Saved User",
    };
    let resolveAuthRefetch: ((response: Response) => void) | undefined;
    const pendingAuthRefetch = new Promise<Response>((resolve) => {
      resolveAuthRefetch = resolve;
    });
    vi.mocked(apiFetch).mockImplementation((input, init) => {
      if (input === "/auth/me") {
        return pendingAuthRefetch;
      }

      if (input === "/users/current-user") {
        return Promise.resolve(
          new Response(JSON.stringify(profile), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      if (input === "/users/me" && init?.method === "PATCH") {
        return Promise.resolve(
          new Response(JSON.stringify(updatedProfile), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
    });
    const queryClient = new QueryClient();
    const user = userEvent.setup();
    queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
          <AuthQueryObserver />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const displayNameInput = await screen.findByRole("textbox", {
      name: "Display name",
    });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/auth/me", {
        signal: expect.any(AbortSignal),
      });
      expect(queryClient.getQueryState(authMeQueryOptions.queryKey)?.fetchStatus).toBe("fetching");
    });
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Saved User");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Profile updated")).toBeInTheDocument();
    await waitFor(() => {
      expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toEqual({
        ...currentUser,
        displayName: "Saved User",
      });
      expect(screen.getByTestId("auth-me-display-name")).toHaveTextContent("Saved User");
    });

    if (!resolveAuthRefetch) {
      throw new Error("Expected a pending auth refetch");
    }

    const resolveFetch = resolveAuthRefetch;

    await act(async () => {
      resolveFetch(
        new Response(
          JSON.stringify({
            ...currentUser,
            displayName: "Current User",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(authMeQueryOptions.queryKey)?.fetchStatus).toBe("idle");
      expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toEqual({
        ...currentUser,
        displayName: "Saved User",
      });
      expect(screen.getByTestId("auth-me-display-name")).toHaveTextContent("Saved User");
    });

    queryClient.clear();
  });

  it("disables submission and prevents duplicate updates while the request is pending", async () => {
    const profile = {
      username: "current-user",
      displayName: "Current User",
      bio: "Current bio",
      profileImage: null,
    };
    const pendingUpdateResponse = new Promise<Response>(() => undefined);
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockReturnValueOnce(pendingUpdateResponse);
    const queryClient = new QueryClient();
    const user = userEvent.setup();

    renderProfilePage(queryClient);

    const displayNameInput = await screen.findByRole("textbox", {
      name: "Display name",
    });
    const submitButton = screen.getByRole("button", { name: "Save profile" });
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Updated User");
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
    await user.click(submitButton);

    const updateCalls = vi
      .mocked(apiFetch)
      .mock.calls.filter(([input, init]) => input === "/users/me" && init?.method === "PATCH");
    expect(updateCalls).toHaveLength(1);

    queryClient.clear();
  });

  it.each([
    {
      caseName: "the API rejects the profile input",
      arrangeFailure: () =>
        vi.mocked(apiFetch).mockResolvedValueOnce(new Response(null, { status: 400 })),
      expectedMessage: "Invalid profile input",
    },
    {
      caseName: "the API returns another unsuccessful response",
      arrangeFailure: () =>
        vi.mocked(apiFetch).mockResolvedValueOnce(new Response(null, { status: 500 })),
      expectedMessage: "Failed to update profile",
    },
    {
      caseName: "the profile request fails in transport",
      arrangeFailure: () =>
        vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError("Failed to fetch")),
      expectedMessage: "Failed to fetch",
    },
  ])(
    "shows the error and preserves the form values when $caseName",
    async ({ arrangeFailure, expectedMessage }) => {
      vi.mocked(apiFetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            username: "current-user",
            displayName: "Current User",
            bio: "Current bio",
            profileImage: "https://example.com/current-user.jpg",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      arrangeFailure();
      const queryClient = new QueryClient();
      const user = userEvent.setup();

      renderProfilePage(queryClient);

      const displayNameInput = await screen.findByRole("textbox", {
        name: "Display name",
      });
      const bioInput = screen.getByRole("textbox", { name: "Bio" });
      const profileImageInput = screen.getByRole("textbox", {
        name: "Profile image",
      });
      await user.clear(displayNameInput);
      await user.type(displayNameInput, "Unsaved User");
      await user.clear(bioInput);
      await user.type(bioInput, "Unsaved bio");
      await user.clear(profileImageInput);
      await user.type(profileImageInput, "https://example.com/unsaved.jpg");
      await user.click(screen.getByRole("button", { name: "Save profile" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
      expect(displayNameInput).toHaveValue("Unsaved User");
      expect(bioInput).toHaveValue("Unsaved bio");
      expect(profileImageInput).toHaveValue("https://example.com/unsaved.jpg");

      queryClient.clear();
    },
  );
});
