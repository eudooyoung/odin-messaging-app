import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { MESSAGES_QUERY_ERROR_MESSAGE, messagesQueryOptions } from "./messagesQuery.ts";

const LOAD_OLDER_MESSAGES_ERROR_MESSAGE = "Failed to load older messages";
const MESSAGE_STATE_CLASS_NAME =
  "flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center font-body text-sm text-neutral-500";

type MessageListProps = {
  conversationId: number;
  currentUserId: number;
};

export function MessageList({ conversationId, currentUserId }: MessageListProps) {
  const scrollRegionRef = useRef<HTMLElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const initialScroll = useRef({ conversationId, complete: false });
  const [visibleConversationId, setVisibleConversationId] = useState<number | null>(null);
  const previousList = useRef<{
    conversationId: number;
    latestMessageId: number | undefined;
    messageCount: number;
    pageCount: number;
    scrollHeight: number;
    clientHeight: number;
  } | null>(null);
  const paginationScroll = useRef<{
    conversationId: number;
    pageCount: number;
    scrollTop: number;
    scrollHeight: number;
  } | null>(null);
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
  const showMessages = visibleConversationId === conversationId;

  useLayoutEffect(() => {
    if (initialScroll.current.conversationId !== conversationId) {
      initialScroll.current = { conversationId, complete: false };
      setVisibleConversationId(null);
    }
    if (
      initialScroll.current.complete ||
      !hasMessages ||
      fetchStatus !== "idle" ||
      isFetchingNextPage
    ) {
      return;
    }

    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) return;

    scrollRegion.scrollTop = scrollRegion.scrollHeight;
    initialScroll.current.complete = true;
    setVisibleConversationId(conversationId);
  }, [conversationId, fetchStatus, hasMessages, isFetchingNextPage]);

  useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion || !hasMessages) {
      previousList.current = null;
      return;
    }

    const previous = previousList.current;
    if (
      initialScroll.current.complete &&
      previous?.conversationId === conversationId &&
      previous.pageCount === pageCount &&
      previous.messageCount < messageCount &&
      previous.latestMessageId !== latestMessageId &&
      !isFetchingNextPage &&
      scrollRegion.scrollTop >= previous.scrollHeight - previous.clientHeight
    ) {
      scrollRegion.scrollTop = scrollRegion.scrollHeight;
    }

    previousList.current = {
      conversationId,
      latestMessageId,
      messageCount,
      pageCount,
      scrollHeight: scrollRegion.scrollHeight,
      clientHeight: scrollRegion.clientHeight,
    };
  }, [
    conversationId,
    data,
    hasMessages,
    isFetchingNextPage,
    latestMessageId,
    messageCount,
    pageCount,
  ]);

  useLayoutEffect(() => {
    const previous = paginationScroll.current;
    if (!previous) return;
    if (previous.conversationId !== conversationId || isFetchNextPageError) {
      paginationScroll.current = null;
      return;
    }
    if (pageCount <= previous.pageCount) return;

    const scrollRegion = scrollRegionRef.current;
    if (scrollRegion) {
      scrollRegion.scrollTop =
        previous.scrollTop + scrollRegion.scrollHeight - previous.scrollHeight;
    }
    paginationScroll.current = null;
  }, [conversationId, isFetchNextPageError, pageCount]);

  const handleLoadOlderMessages = useCallback(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion || paginationScroll.current) return;
    paginationScroll.current = {
      conversationId,
      pageCount,
      scrollTop: scrollRegion.scrollTop,
      scrollHeight: scrollRegion.scrollHeight,
    };
    void fetchNextPage();
  }, [conversationId, fetchNextPage, pageCount]);

  useEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    const sentinel = topSentinelRef.current;
    if (
      !scrollRegion ||
      !sentinel ||
      !hasNextPage ||
      fetchStatus !== "idle" ||
      initialScroll.current.conversationId !== conversationId ||
      !initialScroll.current.complete ||
      isFetchingNextPage ||
      isFetchNextPageError ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    let active = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          active &&
          entry?.isIntersecting &&
          fetchStatus === "idle" &&
          initialScroll.current.conversationId === conversationId &&
          initialScroll.current.complete &&
          !isFetchingNextPage &&
          !isFetchNextPageError
        ) {
          handleLoadOlderMessages();
        }
      },
      { root: scrollRegion },
    );
    observer.observe(sentinel);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [
    conversationId,
    fetchStatus,
    handleLoadOlderMessages,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  ]);

  if (isPending) {
    return (
      <p className={MESSAGE_STATE_CLASS_NAME} role="status">
        Loading messages...
      </p>
    );
  }

  if (isLoadingError) {
    return <UserFacingErrorMessage error={error} fallbackMessage={MESSAGES_QUERY_ERROR_MESSAGE} />;
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
      className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {hasNextPage && !isFetchNextPageError && (
        <div ref={topSentinelRef} aria-hidden="true" className="h-0" />
      )}
      {isFetchingNextPage && (
        <p className="px-6 py-2 text-center text-xs text-neutral-500" role="status">
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
        className="flex flex-col gap-4 px-6 py-6"
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
    </section>
  );
}
