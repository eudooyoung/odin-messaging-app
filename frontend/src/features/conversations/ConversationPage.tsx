import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { MessageComposer } from "@/features/messages/MessageComposer.tsx";
import { Messages } from "@/features/messages/Messages.tsx";
import { CONVERSATION_QUERY_ERROR_MESSAGE, conversationQueryOptions } from "./conversationQuery.ts";

export function ConversationPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<{ id: number }>(authMeQueryOptions.queryKey);
  const parsedConversationId = Number(conversationId);
  const isValidConversationId = Number.isInteger(parsedConversationId) && parsedConversationId > 0;
  const {
    data: conversation,
    isPending,
    isError,
    error,
  } = useQuery({
    ...conversationQueryOptions(parsedConversationId),
    enabled: isValidConversationId,
  });

  if (!isValidConversationId) {
    return <p role="alert">Invalid conversation</p>;
  }

  if (isPending) {
    return <p role="status">Loading conversation...</p>;
  }

  if (isError) {
    return (
      <UserFacingErrorMessage error={error} fallbackMessage={CONVERSATION_QUERY_ERROR_MESSAGE} />
    );
  }

  const otherUser = currentUser
    ? conversation?.participants.find((participant) => participant.id !== currentUser.id)
    : undefined;

  if (!currentUser || !otherUser) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-6 py-4">
        <Link
          aria-label="Close conversation"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-neutral-600 transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          to="."
          onClick={(event) => {
            event.preventDefault();
            navigate(-1);
          }}
        >
          ←
        </Link>
        {otherUser.profileImage ? (
          <img
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            src={otherUser.profileImage}
            alt={`${otherUser.displayName} profile`}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 font-heading text-sm font-semibold text-primary-700"
          >
            {otherUser.displayName.charAt(0)}
          </span>
        )}
        <Link
          className="group min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          to={`/users/${encodeURIComponent(otherUser.handle)}`}
        >
          <h1 className="truncate font-heading text-base font-semibold text-neutral-900 transition-colors group-hover:text-primary-700 group-focus-visible:text-primary-700">
            {otherUser.displayName}
          </h1>
        </Link>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <Messages conversationId={parsedConversationId} currentUserId={currentUser.id} />
      </div>
      <div className="shrink-0 border-t border-neutral-200 bg-neutral-50 px-6 py-4">
        <MessageComposer conversationId={parsedConversationId} />
      </div>
    </div>
  );
}
