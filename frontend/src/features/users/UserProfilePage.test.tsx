import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/api/apiFetch.ts";
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

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

afterEach(() => {
  queryClient.clear();
});

const renderUserProfilePage = (username: string) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/users/${username}`]}>
        <Routes>
          <Route path="/users/:username" element={<UserProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("UserProfilePage", () => {
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
});
