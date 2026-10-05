import { useInfiniteQuery } from "@tanstack/react-query";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { MESSAGES_QUERY_ERROR_MESSAGE, messagesQueryOptions } from "./messagesQuery.ts";
import { useMessagesScroll } from "./useMessagesScroll";

const LOAD_OLDER_MESSAGES_ERROR_MESSAGE = "Failed to load older messages";
const MESSAGE_STATE_CLASS_NAME =
  "flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center font-body text-sm text-neutral-500";

type MessagesProps = {
  conversationId: number;
  currentUserId: number;
};

export function Messages({ conversationId, currentUserId }: MessagesProps) {
  const {
    data,
    fetchStatus,
    isPending,
    isLoadingError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(messagesQueryOptions(conversationId));
  const messages = data?.pages.flatMap((page) => page.messages).reverse();
  const hasMessages = Boolean(messages?.length);
  const messageCount = messages?.length ?? 0;
  const latestMessageId = data?.pages[0]?.messages[0]?.id;
  const pageCount = data?.pages.length ?? 0;
  const { scrollRegionRef, sentinelRef, handleLoadOlderMessages, showMessages } = useMessagesScroll(
    {
      conversationId,
      data,
      hasMessages,
      messageCount,
      latestMessageId,
      pageCount,
      fetchStatus,
      hasNextPage,
      isFetchNextPageError,
      isFetchingNextPage,
      fetchNextPage,
    },
  );

  if (isPending) {
    return (
      <p className={MESSAGE_STATE_CLASS_NAME} role="status">
        Loading messages...
      </p>
    );
  }

  if (isLoadingError) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-8 text-center font-body text-sm text-danger-700">
        <UserFacingErrorMessage error={error} fallbackMessage={MESSAGES_QUERY_ERROR_MESSAGE} />
      </div>
    );
  }

  if (!messages) {
    return null;
  }

  if (messages.length === 0) {
    return <p className={MESSAGE_STATE_CLASS_NAME}>No messages yet</p>;
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return (
    <section
      ref={scrollRegionRef}
      aria-label="Messages"
      className="min-h-0 flex-1 scrollbar-none overflow-y-auto [&::-webkit-scrollbar]:hidden"
    >
      {hasNextPage && !isFetchNextPageError && (
        <div ref={sentinelRef} aria-hidden="true" className="h-0" />
      )}
      {isFetchingNextPage && (
        <p className="px-6 py-2 text-center font-body text-xs text-neutral-500" role="status">
          Loading older messages...
        </p>
      )}
      {isFetchNextPageError && (
        <div className="flex flex-wrap items-center justify-center gap-2 px-6 py-2">
          <p className="text-xs text-danger-700" role="alert">
            {LOAD_OLDER_MESSAGES_ERROR_MESSAGE}
          </p>
          {hasNextPage && (
            <button
              className="rounded-md border border-primary-600 px-3 py-1 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              type="button"
              disabled={isFetchingNextPage}
              onClick={handleLoadOlderMessages}
            >
              Load older messages
            </button>
          )}
        </div>
      )}
      <ul
        className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-8 py-6"
        style={{ visibility: showMessages ? "visible" : "hidden" }}
      >
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
    </section>
  );
}
