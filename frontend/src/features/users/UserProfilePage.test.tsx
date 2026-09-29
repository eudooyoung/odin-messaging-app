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
import { USER_PROFILE_QUERY_ERROR_MESSAGE, UserProfileNotFoundError } from "./userProfileQuery.ts";

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

const renderUserProfilePage = (handle: string, initialEntries = [`/users/${handle}`]) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/users/:handle" element={<UserProfilePage />} />
          <Route path="/conversations/:conversationId" element={<ConversationRoute />} />
          <Route path="/profile" element={<h1>Edit profile</h1>} />
          <Route path="/" element={<h1>Messages</h1>} />
          <Route path="/previous" element={<h1>Previous page</h1>} />
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
        id: 2,
        handle: "profile-user",
        displayName: "Profile User",
        bio: "Hello, I'm a profile user.",
        profileImage: "https://example.com/profile-user.jpg",
      };
      vi.mocked(apiFetch).mockResolvedValue(jsonResponse(profile));

      renderUserProfilePage(profile.handle);

      expect(await screen.findByRole("heading", { name: profile.displayName })).toBeInTheDocument();
      expect(screen.getByText(`@${profile.handle}`)).toBeInTheDocument();
      expect(screen.getByText(profile.bio)).toBeInTheDocument();
      expect(screen.getByRole("img")).toHaveAttribute("src", profile.profileImage);
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    });

    it("navigates explicitly to messages from a read-only profile", async () => {
      const profile = {
        id: 2,
        handle: "profile-user",
        displayName: "Profile User",
        bio: "Hello, I'm a profile user.",
        profileImage: null,
      };
      vi.mocked(apiFetch).mockResolvedValue(jsonResponse(profile));
      const user = userEvent.setup();

      renderUserProfilePage(profile.handle, ["/previous", `/users/${profile.handle}`]);

      await user.click(await screen.findByRole("link", { name: "Close profile" }));

      expect(await screen.findByRole("heading", { name: "Messages" })).toBeInTheDocument();
    });

    it("shows the current user's profile without a Message button or redirecting to edit", async () => {
      const profile = {
        id: currentUser.id,
        handle: "changed-handle",
        displayName: currentUser.displayName,
        bio: "Current user bio",
        profileImage: null,
      };
      queryClient.setQueryData(authMeQueryOptions.queryKey, currentUser);
      vi.mocked(apiFetch).mockResolvedValue(jsonResponse(profile));

      renderUserProfilePage(profile.handle);

      expect(await screen.findByRole("heading", { name: profile.displayName })).toBeInTheDocument();
      expect(screen.getByText(`@${profile.handle}`)).toBeInTheDocument();
      expect(screen.getByText(profile.bio)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Message" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Edit profile" })).not.toBeInTheDocument();
    });
  });

  describe("messaging", () => {
    const targetProfile = {
      id: 2,
      handle: "target-user",
      displayName: "Target User",
      bio: "Target user bio",
      profileImage: null,
    };

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
            username: targetProfile.handle,
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

      renderUserProfilePage(targetProfile.handle);

      await user.click(await screen.findByRole("button", { name: "Message" }));

      expect(
        await screen.findByRole("heading", { name: `Conversation ${conversation.id}` }),
      ).toBeInTheDocument();
      expect(createConversation).toHaveBeenCalledTimes(1);
      const [targetHandle] = vi.mocked(createConversation).mock.calls[0]!;
      expect(targetHandle).toBe(targetProfile.handle);
      expect(queryClient.getQueryState(conversationsQueryOptions.queryKey)?.isInvalidated).toBe(
        true,
      );
    });

    it("disables messaging and prevents duplicate conversations while the mutation is pending", async () => {
      vi.mocked(createConversation).mockReturnValue(new Promise<never>(() => undefined));
      const user = userEvent.setup();

      renderUserProfilePage(targetProfile.handle);

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

        renderUserProfilePage(targetProfile.handle);

        const messageButton = await screen.findByRole("button", { name: "Message" });
        await user.click(messageButton);

        expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
        expect(
          screen.getByRole("heading", { name: targetProfile.displayName }),
        ).toBeInTheDocument();
        expect(screen.getByText(`@${targetProfile.handle}`)).toBeInTheDocument();
        expect(messageButton).toBeEnabled();
      },
    );
  });
});
