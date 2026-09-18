import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { conversationsQueryOptions } from "@/features/conversations/conversationsQuery.ts";
import { createConversation } from "@/features/conversations/createConversation.ts";
import { createTestQueryClient } from "@/tests/createTestQueryClient.ts";
import { jsonResponse } from "@/tests/jsonResponse.ts";
import { UserProfilePage } from "./UserProfilePage.tsx";
import {
  USER_PROFILE_QUERY_ERROR_MESSAGE,
  UserProfileNotFoundError,
  type UserProfile,
} from "./userProfileQuery.ts";

vi.mock("@/api/apiFetch.ts", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/features/conversations/createConversation.ts", () => ({
  createConversation: vi.fn(),
}));

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

function ConversationRoute() {
  const { conversationId } = useParams<{ conversationId: string }>();

  return <h1>Conversation {conversationId}</h1>;
}

const renderUserProfilePage = (username: string) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/users/${username}`]}>
        <Routes>
          <Route path="/users/:username" element={<UserProfilePage />} />
          <Route path="/conversations/:conversationId" element={<ConversationRoute />} />
          <Route path="/profile" element={<h1>Edit profile</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("UserProfilePage", () => {
  const currentUser = {
    id: 1,
    username: "current-user",
    displayName: "Current User",
  };

  describe("profile display", () => {
    it("shows a loading state while the requested profile is pending", () => {
      vi.mocked(apiFetch).mockReturnValue(new Promise<Response>(() => undefined));

      renderUserProfilePage("profile-user");

      expect(screen.getByRole("status")).toHaveTextContent("Loading profile...");
    });

    it("shows a clear not found state when the requested profile does not exist", async () => {
      vi.mocked(apiFetch).mockRejectedValue(new UserProfileNotFoundError());

      renderUserProfilePage("missing-user");

      expect(await screen.findByRole("alert")).toHaveTextContent("Profile not found");
    });

    it("shows a generic profile loading error when the profile query fails unexpectedly", async () => {
      vi.mocked(apiFetch).mockRejectedValue(new TypeError("Failed to fetch"));

      renderUserProfilePage("profile-user");

      expect(await screen.findByRole("alert")).toHaveTextContent(USER_PROFILE_QUERY_ERROR_MESSAGE);
    });

    it("shows the requested user's profile as read-only information", async () => {
      const profile = {
        username: "profile-user",
        displayName: "Profile User",
        bio: "Hello, I'm a profile user.",
        profileImage: "https://example.com/profile-user.jpg",
      } satisfies UserProfile;
      vi.mocked(apiFetch).mockResolvedValue(jsonResponse(profile));

      renderUserProfilePage(profile.username);

      expect(await screen.findByRole("heading", { name: profile.displayName })).toBeInTheDocument();
      expect(screen.getByText(`@${profile.username}`)).toBeInTheDocument();
      expect(screen.getByText(profile.bio)).toBeInTheDocument();
      expect(screen.getByRole("img")).toHaveAttribute("src", profile.profileImage);
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    });

    it("shows the current user's profile without a Message button or redirecting to edit", async () => {
      const profile = {
        username: currentUser.username,
        displayName: currentUser.displayName,
        bio: "Current user bio",
        profileImage: null,
      } satisfies UserProfile;
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      vi.mocked(apiFetch).mockResolvedValue(jsonResponse(profile));

      renderUserProfilePage(profile.username);

      expect(await screen.findByRole("heading", { name: profile.displayName })).toBeInTheDocument();
      expect(screen.getByText(`@${profile.username}`)).toBeInTheDocument();
      expect(screen.getByText(profile.bio)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Edit profile" })).not.toBeInTheDocument();
    });
  });

  describe("messaging", () => {
    const targetProfile = {
      username: "target-user",
      displayName: "Target User",
      bio: "Target user bio",
      profileImage: null,
    } satisfies UserProfile;

    beforeEach(() => {
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      vi.mocked(apiFetch).mockResolvedValue(jsonResponse(targetProfile));
    });

    it("opens a conversation after messaging another user", async () => {
      const conversation = {
        id: 42,
        participants: [
          {
            username: currentUser.username,
            displayName: currentUser.displayName,
            profileImage: null,
          },
          {
            username: targetProfile.username,
            displayName: targetProfile.displayName,
            profileImage: targetProfile.profileImage,
          },
        ],
        createdAt: "2026-09-18T01:00:00.000Z",
        lastActivityAt: "2026-09-18T01:00:00.000Z",
      };
      queryClient.setQueryData(conversationsQueryOptions.queryKey, {
        pages: [],
        pageParams: [],
      });
      vi.mocked(createConversation).mockResolvedValue(conversation);
      const user = userEvent.setup();

      renderUserProfilePage(targetProfile.username);

      await user.click(await screen.findByRole("button", { name: "Message" }));

      expect(
        await screen.findByRole("heading", { name: `Conversation ${conversation.id}` }),
      ).toBeInTheDocument();
      expect(createConversation).toHaveBeenCalledTimes(1);
      const [targetUsername] = vi.mocked(createConversation).mock.calls[0]!;
      expect(targetUsername).toBe(targetProfile.username);
      expect(queryClient.getQueryState(conversationsQueryOptions.queryKey)?.isInvalidated).toBe(
        true,
      );
    });

    it("disables messaging and prevents duplicate conversations while the mutation is pending", async () => {
      vi.mocked(createConversation).mockReturnValue(new Promise<never>(() => undefined));
      const user = userEvent.setup();

      renderUserProfilePage(targetProfile.username);

      const messageButton = await screen.findByRole("button", { name: "Message" });
      await user.click(messageButton);

      await waitFor(() => {
        expect(messageButton).toBeDisabled();
      });
      await user.click(messageButton);

      expect(createConversation).toHaveBeenCalledOnce();
    });

    it.each([
      {
        caseName: "a user-facing error",
        mutationError: new UserFacingError("Cannot start conversation"),
        expectedMessage: "Cannot start conversation",
      },
      {
        caseName: "an unexpected error",
        mutationError: new TypeError("Failed to fetch"),
        expectedMessage: "Failed to create conversation",
      },
    ])(
      "keeps the profile usable and shows the appropriate message for $caseName",
      async ({ mutationError, expectedMessage }) => {
        vi.mocked(createConversation).mockRejectedValue(mutationError);
        const user = userEvent.setup();

        renderUserProfilePage(targetProfile.username);

        const messageButton = await screen.findByRole("button", { name: "Message" });
        await user.click(messageButton);

        expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
        expect(
          screen.getByRole("heading", { name: targetProfile.displayName }),
        ).toBeInTheDocument();
        expect(screen.getByText(`@${targetProfile.username}`)).toBeInTheDocument();
        expect(messageButton).toBeEnabled();
      },
    );
  });
});
