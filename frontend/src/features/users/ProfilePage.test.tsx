import { type QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { authMeQueryOptions, type AuthUser } from "@/features/auth/authMeQuery.ts";
import { createDeferred } from "@/tests/createDeferred.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { ProfilePage } from "./ProfilePage.tsx";
import { type UserProfile, userProfileQueryOptions } from "./userProfileQuery.ts";
import { updateUserProfile } from "./updateUserProfile.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("./updateUserProfile.ts", () => ({
  updateUserProfile: vi.fn(),
}));

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

const currentUser: AuthUser = {
  id: 1,
  username: "current-user",
  displayName: "Current User",
};

const baseProfile: UserProfile = {
  username: currentUser.username,
  displayName: "Current User",
  bio: "Current bio",
  profileImage: null,
};

const profileQueryKey = userProfileQueryOptions(currentUser.username).queryKey;

const profileResponse = (profile: UserProfile) => jsonResponse(profile);

const renderProfilePage = (queryClient: QueryClient, observer?: ReactNode) => {
  queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfilePage />
        {observer}
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const submitProfileChanges = async (
  user: ReturnType<typeof userEvent.setup>,
  changes: {
    displayName: string;
    bio?: string;
    profileImage?: string;
  },
) => {
  const displayNameInput = await screen.findByRole("textbox", {
    name: "Display name",
  });
  await user.clear(displayNameInput);
  if (changes.displayName) {
    await user.type(displayNameInput, changes.displayName);
  }

  const bioInput =
    changes.bio === undefined ? undefined : screen.getByRole("textbox", { name: "Bio" });
  if (bioInput) {
    await user.clear(bioInput);
    if (changes.bio) {
      await user.type(bioInput, changes.bio);
    }
  }

  const profileImageInput =
    changes.profileImage === undefined
      ? undefined
      : screen.getByRole("textbox", { name: "Profile image" });
  if (profileImageInput) {
    await user.clear(profileImageInput);
    if (changes.profileImage) {
      await user.type(profileImageInput, changes.profileImage);
    }
  }

  const submitButton = screen.getByRole("button", { name: "Save profile" });
  await user.click(submitButton);

  return { displayNameInput, bioInput, profileImageInput, submitButton };
};

const ProfileQueryObserver = () => {
  const { data: profile } = useQuery(userProfileQueryOptions(currentUser.username));

  return <output data-testid="profile-query-display-name">{profile?.displayName}</output>;
};

describe("ProfilePage", () => {
  describe("profile loading and form state", () => {
    it("loads the current user's profile and shows a loading state while it is pending", () => {
      const pendingProfileResponse = new Promise<Response>(() => undefined);
      vi.mocked(apiFetch).mockReturnValue(pendingProfileResponse);

      renderProfilePage(queryClient);

      expect(screen.getByRole("status")).toHaveTextContent("Loading profile...");
    });

    it("shows the current profile values as the initial form values", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        profileResponse({
          ...baseProfile,
          bio: "Hello from my profile.",
          profileImage: "https://example.com/current-user.jpg",
        }),
      );
      renderProfilePage(queryClient);

      expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue(
        "Current User",
      );
      expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("Hello from my profile.");
      expect(screen.getByRole("textbox", { name: "Profile image" })).toHaveValue(
        "https://example.com/current-user.jpg",
      );
    });

    it("shows empty inputs when the profile bio and profile image are null", async () => {
      vi.mocked(apiFetch).mockResolvedValue(
        profileResponse({
          ...baseProfile,
          bio: null,
          profileImage: null,
        }),
      );
      renderProfilePage(queryClient);

      expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue(
        "Current User",
      );
      expect(screen.getByRole("textbox", { name: "Bio" })).toHaveValue("");
      expect(screen.getByRole("textbox", { name: "Profile image" })).toHaveValue("");
    });

    it("preserves unsaved form values after a profile refetch updates the query data", async () => {
      const refreshedProfile = {
        ...baseProfile,
        displayName: "Server User",
        bio: "Server bio",
      };
      vi.mocked(apiFetch)
        .mockResolvedValueOnce(profileResponse(baseProfile))
        .mockResolvedValueOnce(profileResponse(refreshedProfile));
      const user = userEvent.setup();

      renderProfilePage(queryClient, <ProfileQueryObserver />);

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

      await act(async () => {
        await queryClient.refetchQueries({ queryKey: profileQueryKey, exact: true });
      });

      await waitFor(() => {
        expect(screen.getByTestId("profile-query-display-name")).toHaveTextContent("Server User");
      });
      expect(queryClient.getQueryData(profileQueryKey)).toEqual(refreshedProfile);
      expect(displayNameInput).toHaveValue("Unsaved User");
      expect(bioInput).toHaveValue("Unsaved bio");
    });

    it("shows the profile query fallback in an alert when the request fails", async () => {
      vi.mocked(apiFetch).mockRejectedValue(new TypeError("Failed to fetch"));

      renderProfilePage(queryClient);

      expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load profile");
    });
  });

  describe("validation", () => {
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
          profileResponse({
            ...baseProfile,
            profileImage: "https://example.com/current-user.jpg",
          }),
        );
        const user = userEvent.setup();

        renderProfilePage(queryClient);

        const input = await screen.findByRole("textbox", { name: fieldName });
        await user.clear(input);
        await user.type(input, value);
        await user.click(screen.getByRole("button", { name: "Save profile" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
        expect(updateUserProfile).not.toHaveBeenCalled();
      },
    );
  });

  describe("successful update", () => {
    it("updates the profile and related caches after a successful submission", async () => {
      const updatedProfile = {
        ...baseProfile,
        displayName: "Updated User",
        bio: null,
        profileImage: null,
      };
      vi.mocked(apiFetch).mockResolvedValue(
        profileResponse({
          ...baseProfile,
          profileImage: "https://example.com/current-user.jpg",
        }),
      );
      vi.mocked(updateUserProfile).mockResolvedValue(updatedProfile);
      const user = userEvent.setup();

      renderProfilePage(queryClient);

      const { displayNameInput, bioInput, profileImageInput } =
        await submitProfileChanges(user, {
          displayName: " Updated User ",
          bio: "",
          profileImage: "",
        });

      expect(await screen.findByRole("status")).toHaveTextContent("Profile updated");
      expect(updateUserProfile).toHaveBeenCalledWith({
        displayName: "Updated User",
        bio: null,
        profileImage: null,
      });
      expect(queryClient.getQueryData(profileQueryKey)).toEqual(updatedProfile);
      expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toEqual({
        ...currentUser,
        displayName: "Updated User",
      });
      expect(displayNameInput).toHaveValue(updatedProfile.displayName);
      expect(bioInput).toHaveValue(updatedProfile.bio ?? "");
      expect(profileImageInput).toHaveValue(updatedProfile.profileImage ?? "");
    });
  });

  describe("update lifecycle", () => {
    it("keeps the saved profile when an older profile refetch finishes afterward", async () => {
      const updatedProfile = {
        ...baseProfile,
        displayName: "Saved User",
        bio: "Saved bio",
      };
      let profileGetCount = 0;
      const pendingProfileRefetch = createDeferred<Response>();
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/users/current-user") {
          profileGetCount += 1;

          if (profileGetCount === 1) {
            return Promise.resolve(profileResponse(baseProfile));
          }

          return pendingProfileRefetch.promise;
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      vi.mocked(updateUserProfile).mockResolvedValue(updatedProfile);
      const user = userEvent.setup();

      renderProfilePage(queryClient, <ProfileQueryObserver />);

      const displayNameInput = await screen.findByRole("textbox", {
        name: "Display name",
      });
      const bioInput = screen.getByRole("textbox", { name: "Bio" });
      await user.clear(displayNameInput);
      await user.type(displayNameInput, "Saved User");
      await user.clear(bioInput);
      await user.type(bioInput, "Saved bio");

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

      await act(async () => {
        pendingProfileRefetch.resolve(profileResponse(baseProfile));
        await refetchPromise;
      });

      await waitFor(() => {
        expect(queryClient.getQueryData(profileQueryKey)).toEqual(updatedProfile);
        expect(screen.getByTestId("profile-query-display-name")).toHaveTextContent("Saved User");
      });
      expect(displayNameInput).toHaveValue("Saved User");
      expect(bioInput).toHaveValue("Saved bio");
    });

    it("keeps the saved display name when an older auth refetch finishes afterward", async () => {
      const AuthQueryObserver = () => {
        const { data: user } = useQuery(authMeQueryOptions);

        return <output data-testid="auth-me-display-name">{user?.displayName}</output>;
      };
      const profile = {
        ...baseProfile,
        bio: null,
      };
      const updatedProfile = {
        ...profile,
        displayName: "Saved User",
      };
      const pendingAuthRefetch = createDeferred<Response>();
      vi.mocked(apiFetch).mockImplementation((input) => {
        if (input === "/auth/me") {
          return pendingAuthRefetch.promise;
        }

        if (input === "/users/current-user") {
          return Promise.resolve(profileResponse(profile));
        }

        return Promise.reject(new Error(`Unexpected request: ${input.toString()}`));
      });
      vi.mocked(updateUserProfile).mockResolvedValue(updatedProfile);
      const user = userEvent.setup();

      renderProfilePage(queryClient, <AuthQueryObserver />);

      await waitFor(() => {
        expect(queryClient.getQueryState(authMeQueryOptions.queryKey)?.fetchStatus).toBe(
          "fetching",
        );
      });
      await submitProfileChanges(user, { displayName: "Saved User" });

      expect(await screen.findByText("Profile updated")).toBeInTheDocument();
      await waitFor(() => {
        expect(queryClient.getQueryData(authMeQueryOptions.queryKey)).toEqual({
          ...currentUser,
          displayName: "Saved User",
        });
        expect(screen.getByTestId("auth-me-display-name")).toHaveTextContent("Saved User");
      });

      await act(async () => {
        pendingAuthRefetch.resolve(
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
    });

    it("disables submission and prevents duplicate updates while the request is pending", async () => {
      const pendingUpdate = new Promise<never>(() => undefined);
      vi.mocked(apiFetch).mockResolvedValue(profileResponse(baseProfile));
      vi.mocked(updateUserProfile).mockReturnValue(pendingUpdate);
      const user = userEvent.setup();

      renderProfilePage(queryClient);

      const { submitButton } = await submitProfileChanges(user, {
        displayName: "Updated User",
      });

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
      await user.click(submitButton);

      expect(updateUserProfile).toHaveBeenCalledOnce();
    });

    it("shows the mutation error and preserves unsaved form values", async () => {
      const mutationError = new UserFacingError("Failed to update profile");
      vi.mocked(apiFetch).mockResolvedValue(
        profileResponse({
          ...baseProfile,
          profileImage: "https://example.com/current-user.jpg",
        }),
      );
      vi.mocked(updateUserProfile).mockRejectedValue(mutationError);
      const user = userEvent.setup();

      renderProfilePage(queryClient);

      const { displayNameInput, bioInput, profileImageInput } =
        await submitProfileChanges(user, {
          displayName: "Unsaved User",
          bio: "Unsaved bio",
          profileImage: "https://example.com/unsaved.jpg",
        });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        mutationError.message,
      );
      expect(displayNameInput).toHaveValue("Unsaved User");
      expect(bioInput).toHaveValue("Unsaved bio");
      expect(profileImageInput).toHaveValue("https://example.com/unsaved.jpg");
    });
  });
});
