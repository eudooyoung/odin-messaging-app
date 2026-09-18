import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { authMeQueryOptions, type AuthUser } from "@/features/auth/authMeQuery.ts";
import { conversationsQueryOptions } from "@/features/conversations/conversationsQuery.ts";
import { createConversation } from "@/features/conversations/createConversation.ts";
import {
  USER_PROFILE_QUERY_ERROR_MESSAGE,
  UserProfileNotFoundError,
  userProfileQueryOptions,
} from "./userProfileQuery.ts";

export function UserProfilePage() {
  const { username = "" } = useParams<{ username: string }>();
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<AuthUser | null>(authMeQueryOptions.queryKey);
  const navigate = useNavigate();
  const { data: profile, isPending, isError, error } = useQuery({
    ...userProfileQueryOptions(username),
    enabled: username.length > 0,
  });
  const createConversationMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({
        queryKey: conversationsQueryOptions.queryKey,
        exact: true,
      });
      navigate(`/conversations/${conversation.id}`);
    },
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

  const isCurrentUserProfile = currentUser?.username === profile.username;

  return (
    <main>
      {profile.profileImage && (
        <img src={profile.profileImage} alt={`${profile.displayName} profile`} />
      )}
      <h1>{profile.displayName}</h1>
      <p>@{profile.username}</p>
      <p>{profile.bio}</p>
      {!isCurrentUserProfile && (
        <>
          <button
            type="button"
            disabled={createConversationMutation.isPending}
            onClick={() => createConversationMutation.mutate(profile.username)}
          >
            Message
          </button>
          {createConversationMutation.isError && (
            <UserFacingErrorMessage
              error={createConversationMutation.error}
              fallbackMessage="Failed to create conversation"
            />
          )}
        </>
      )}
    </main>
  );
}
