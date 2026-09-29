import { useInfiniteQuery } from "@tanstack/react-query";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { MESSAGES_QUERY_ERROR_MESSAGE, messagesQueryOptions } from "./messagesQuery.ts";

const LOAD_OLDER_MESSAGES_ERROR_MESSAGE = "Failed to load older messages";

type MessageListProps = {
  conversationId: number;
  currentUserId: number;
};

export function MessageList({ conversationId, currentUserId }: MessageListProps) {
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
    return <UserFacingErrorMessage error={error} fallbackMessage={MESSAGES_QUERY_ERROR_MESSAGE} />;
  }

  if (!messages) {
    return null;
  }

  if (messages.length === 0) {
    return <p>No messages yet</p>;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return (
    <>
      {hasNextPage && (
        <button type="button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          Load older messages
        </button>
      )}
      <ul className="flex flex-col gap-4 px-6 py-6">
        {messages.map((message, index) => {
          const isOwnMessage = message.sender.id === currentUserId;
          const messageDate = new Date(message.createdAt);
          const previousMessage = messages[index - 1];
          const startsNewDay =
            !previousMessage ||
            new Date(previousMessage.createdAt).toDateString() !== messageDate.toDateString();
          const dateLabel =
            messageDate.toDateString() === today.toDateString()
              ? "오늘"
              : messageDate.toDateString() === yesterday.toDateString()
                ? "어제"
                : `${messageDate.getFullYear()}년 ${messageDate.getMonth() + 1}월 ${messageDate.getDate()}일`;
          const hour = messageDate.getHours();
          const timeLabel = `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:${String(messageDate.getMinutes()).padStart(2, "0")}`;

          return (
            <li
              className={`flex flex-col gap-1 ${isOwnMessage ? "items-end" : "items-start"}`}
              key={message.id}
            >
              {startsNewDay && (
                <div className="flex w-full items-center gap-3 py-2 text-xs text-neutral-500">
                  <span aria-hidden="true" className="h-px flex-1 bg-neutral-200" />
                  <span>{dateLabel}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-neutral-200" />
                </div>
              )}
              <p className="text-sm font-semibold text-neutral-900">{message.sender.displayName}</p>
              <p className="text-xs text-neutral-500">@{message.sender.handle}</p>
              <p
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 wrap-anywhere whitespace-pre-wrap ${isOwnMessage ? "bg-primary-600 text-white" : "bg-neutral-100 text-neutral-900"}`}
              >
                {message.content}
              </p>
              <time className="text-xs text-neutral-500" dateTime={message.createdAt}>
                {timeLabel}
              </time>
            </li>
          );
        })}
      </ul>
      {isFetchNextPageError && <p role="alert">{LOAD_OLDER_MESSAGES_ERROR_MESSAGE}</p>}
    </>
  );
}
