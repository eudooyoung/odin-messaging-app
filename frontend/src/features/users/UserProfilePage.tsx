import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import type { AuthUser } from "@/features/auth/auth.type.ts";
import { conversationsQueryOptions } from "@/features/conversations/conversationsQuery.ts";
import { createConversation } from "@/features/conversations/createConversation.ts";
import {
  USER_PROFILE_QUERY_ERROR_MESSAGE,
  UserProfileNotFoundError,
  userProfileQueryOptions,
} from "./userProfileQuery.ts";

export function UserProfilePage() {
  const { handle = "" } = useParams<{ handle: string }>();
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<AuthUser | null>(authMeQueryOptions.queryKey);
  const navigate = useNavigate();
  const {
    data: profile,
    isPending,
    isError,
    error,
  } = useQuery({
    ...userProfileQueryOptions(handle),
    enabled: handle.length > 0,
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
    return (
      <p className="px-8 py-10 font-body text-sm text-neutral-500" role="status">
        Loading profile...
      </p>
    );
  }

  if (isError && error instanceof UserProfileNotFoundError) {
    return (
      <p className="px-8 py-10 text-sm text-danger-700" role="alert">
        {error.message}
      </p>
    );
  }

  if (isError) {
    return (
      <div className="px-8 py-10 text-sm text-danger-700">
        <UserFacingErrorMessage error={error} fallbackMessage={USER_PROFILE_QUERY_ERROR_MESSAGE} />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const isCurrentUserProfile = currentUser?.id === profile.id;

  return (
    <main className="flex min-h-full flex-col font-body">
      <header className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-18 w-full max-w-2xl items-center gap-3 px-8 py-4">
          <Link
            aria-label="Close profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            to="."
            onClick={(event) => {
              event.preventDefault();
              navigate(-1);
            }}
          >
            ←
          </Link>
          <h2 className="min-w-0 truncate font-heading text-2xl font-semibold tracking-tight text-neutral-900">
            {profile.displayName}
          </h2>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-8 py-10">
        <div className="flex min-w-0 items-center gap-5">
          {profile.profileImage && (
            <img
              className="h-20 w-20 shrink-0 rounded-full object-cover"
              src={profile.profileImage}
              alt={`${profile.displayName} profile`}
            />
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm break-words text-neutral-500">@{profile.handle}</p>
          </div>
        </div>
        <p className="text-base leading-relaxed break-words whitespace-pre-wrap text-neutral-700">
          {profile.bio}
        </p>
        {!isCurrentUserProfile && (
          <>
            <button
              className="self-start rounded-md bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
              type="button"
              disabled={createConversationMutation.isPending}
              onClick={() => createConversationMutation.mutate(profile.handle)}
            >
              Message
            </button>
            {createConversationMutation.isError && (
              <div className="w-full rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                <UserFacingErrorMessage
                  error={createConversationMutation.error}
                  fallbackMessage="Failed to create conversation"
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
