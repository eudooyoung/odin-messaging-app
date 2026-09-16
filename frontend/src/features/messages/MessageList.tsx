import { useInfiniteQuery } from "@tanstack/react-query";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { MESSAGES_QUERY_ERROR_MESSAGE, messagesQueryOptions } from "./messagesQuery.ts";

const LOAD_OLDER_MESSAGES_ERROR_MESSAGE = "Failed to load older messages";

type MessageListProps = {
  conversationId: number;
};

export function MessageList({ conversationId }: MessageListProps) {
  const {
    data,
    isPending,
    isLoadingError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(messagesQueryOptions(conversationId));
  const messages = data?.pages.flatMap((page) => page.messages).reverse();

  if (isPending) {
    return <p role="status">Loading messages...</p>;
  }

  if (isLoadingError) {
    return (
      <UserFacingErrorMessage error={error} fallbackMessage={MESSAGES_QUERY_ERROR_MESSAGE} />
    );
  }

  if (!messages) {
    return null;
  }

  if (messages.length === 0) {
    return <p>No messages yet</p>;
  }

  return (
    <>
      {hasNextPage && (
        <button
          type="button"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          Load older messages
        </button>
      )}
      <ul>
        {messages.map((message) => (
          <li key={message.id}>
            <p>{message.sender.displayName}</p>
            <p>@{message.sender.username}</p>
            <p>{message.content}</p>
          </li>
        ))}
      </ul>
      {isFetchNextPageError && (
        <p role="alert">{LOAD_OLDER_MESSAGES_ERROR_MESSAGE}</p>
      )}
    </>
  );
}
