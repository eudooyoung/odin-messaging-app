import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import {
  USER_PROFILE_QUERY_ERROR_MESSAGE,
  UserProfileNotFoundError,
  userProfileQueryOptions,
} from "./userProfileQuery.ts";

export function UserProfilePage() {
  const { username = "" } = useParams<{ username: string }>();
  const { data: profile, isPending, isError, error } = useQuery({
    ...userProfileQueryOptions(username),
    enabled: username.length > 0,
  });

  if (isPending) {
    return <p role="status">Loading profile...</p>;
  }

  if (isError && error instanceof UserProfileNotFoundError) {
    return <p role="alert">{error.message}</p>;
  }

  if (isError) {
    return (
      <UserFacingErrorMessage error={error} fallbackMessage={USER_PROFILE_QUERY_ERROR_MESSAGE} />
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <main>
      {profile.profileImage && (
        <img src={profile.profileImage} alt={`${profile.displayName} profile`} />
      )}
      <h1>{profile.displayName}</h1>
      <p>@{profile.username}</p>
      <p>{profile.bio}</p>
    </main>
  );
}
