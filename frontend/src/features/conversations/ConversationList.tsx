import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import {
  CONVERSATIONS_QUERY_ERROR_MESSAGE,
  conversationsQueryOptions,
} from "./conversationsQuery.ts";

const LOAD_MORE_CONVERSATIONS_ERROR_MESSAGE = "Failed to load more conversations";

export function ConversationList() {
  const {
    data,
    isPending,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(conversationsQueryOptions);
  const conversations = data?.pages.flatMap((page) => page.conversations);

  if (isPending) {
    return (
      <p className="text-sm text-neutral-500" role="status">
        Loading conversations...
      </p>
    );
  }

  if (isError && !isFetchNextPageError) {
    return (
      <UserFacingErrorMessage error={error} fallbackMessage={CONVERSATIONS_QUERY_ERROR_MESSAGE} />
    );
  }

  if (!conversations) {
    return null;
  }

  if (conversations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
        No conversations yet
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <Link
              className="group flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none focus-visible:ring-inset"
              to={`/conversations/${conversation.id}`}
            >
              <h2 className="truncate font-heading text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
                {conversation.otherUser.displayName}
              </h2>
              <p className="truncate text-xs text-neutral-500">
                @{conversation.otherUser.username}
              </p>
              {conversation.lastMessage && (
                <p className="truncate text-sm text-neutral-600">
                  {conversation.lastMessage.content}
                </p>
              )}
              <time className="text-xs text-neutral-400" dateTime={conversation.lastActivityAt}>
                {new Date(conversation.lastActivityAt).toLocaleString()}
              </time>
            </Link>
          </li>
        ))}
      </ul>
      {isFetchNextPageError && (
        <p className="mt-3 text-sm text-danger-700" role="alert">
          {LOAD_MORE_CONVERSATIONS_ERROR_MESSAGE}
        </p>
      )}
      {hasNextPage && (
        <button
          className="mt-3 w-full rounded-md border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
          type="button"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load more
        </button>
      )}
    </>
  );
}
