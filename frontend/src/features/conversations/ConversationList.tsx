import { useInfiniteQuery } from "@tanstack/react-query";
import { UserFacingError } from "@/api/UserFacingError.ts";
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
    return <p role="status">Loading conversations...</p>;
  }

  if (isError && !isFetchNextPageError) {
    return (
      <p role="alert">
        {error instanceof UserFacingError
          ? error.message
          : CONVERSATIONS_QUERY_ERROR_MESSAGE}
      </p>
    );
  }

  if (!conversations) {
    return null;
  }

  if (conversations.length === 0) {
    return <p>No conversations yet</p>;
  }

  return (
    <>
      <ul>
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <h2>{conversation.otherUser.displayName}</h2>
            <p>@{conversation.otherUser.username}</p>
            {conversation.lastMessage && <p>{conversation.lastMessage.content}</p>}
            <time dateTime={conversation.lastActivityAt}>
              {new Date(conversation.lastActivityAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ul>
      {isFetchNextPageError && (
        <p role="alert">{LOAD_MORE_CONVERSATIONS_ERROR_MESSAGE}</p>
      )}
      {hasNextPage && (
        <button
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
