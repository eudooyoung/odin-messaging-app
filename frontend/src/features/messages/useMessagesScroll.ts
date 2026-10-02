import type { FetchStatus, InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import type { MessagesPage } from "./message.type";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type UseMessagesScrollParams = {
  conversationId: number;
  data: InfiniteData<MessagesPage> | undefined;
  hasMessages: boolean;
  messageCount: number;
  latestMessageId: number | undefined;
  pageCount: number;
  fetchStatus: FetchStatus;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: UseInfiniteQueryResult<InfiniteData<MessagesPage>>["fetchNextPage"];
};

type MessagesSnapshot = {
  conversationId: number;
  latestMessageId: number | undefined;
  messageCount: number;
  pageCount: number;
  scrollHeight: number;
  clientHeight: number;
};

type ScrollSnapshot = {
  conversationId: number;
  pageCount: number;
  scrollTop: number;
  scrollHeight: number;
};

export const useMessagesScroll = ({
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
}: UseMessagesScrollParams) => {
  const scrollRegionRef = useRef<HTMLElement>(null);
  const initialScrollRef = useRef({ conversationId, complete: false });
  const messagesSnapshotRef = useRef<MessagesSnapshot | null>(null);
  const scrollSnapshotRef = useRef<ScrollSnapshot | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleConversationId, setVisibleConversationId] = useState<number | null>(null);
  const showMessages = visibleConversationId === conversationId;

  // initial scroll effect
  useLayoutEffect(() => {
    if (initialScrollRef.current.conversationId !== conversationId) {
      initialScrollRef.current = { conversationId, complete: false };
      setVisibleConversationId(null);
    }
    if (
      initialScrollRef.current.complete ||
      !hasMessages ||
      fetchStatus !== "idle" ||
      isFetchingNextPage
    ) {
      return;
    }

    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) return;

    scrollRegion.scrollTop = scrollRegion.scrollHeight;
    initialScrollRef.current.complete = true;
    setVisibleConversationId(conversationId);
  }, [conversationId, fetchStatus, hasMessages, isFetchingNextPage]);

  // follow new messages effect
  useLayoutEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion || !hasMessages) {
      messagesSnapshotRef.current = null;
      return;
    }

    const messagesSnapshot = messagesSnapshotRef.current;
    if (messagesSnapshot !== null) {
      const isInitialized =
        initialScrollRef.current.complete && messagesSnapshot.conversationId === conversationId;
      const hasNewMessage =
        messagesSnapshot.pageCount === pageCount &&
        messagesSnapshot.messageCount < messageCount &&
        messagesSnapshot.latestMessageId !== latestMessageId &&
        !isFetchingNextPage;
      const wasAtBottom =
        scrollRegion.scrollTop >= messagesSnapshot.scrollHeight - messagesSnapshot.clientHeight;

      if (isInitialized && hasNewMessage && wasAtBottom) {
        scrollRegion.scrollTop = scrollRegion.scrollHeight;
      }
    }

    messagesSnapshotRef.current = {
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

  // preserve scroll effect
  useLayoutEffect(() => {
    const scrollSnapshot = scrollSnapshotRef.current;
    if (!scrollSnapshot) return;
    if (scrollSnapshot.conversationId !== conversationId || isFetchNextPageError) {
      scrollSnapshotRef.current = null;
      return;
    }
    if (pageCount <= scrollSnapshot.pageCount) return;

    const scrollRegion = scrollRegionRef.current;
    if (scrollRegion) {
      scrollRegion.scrollTop =
        scrollSnapshot.scrollTop + scrollRegion.scrollHeight - scrollSnapshot.scrollHeight;
    }
    scrollSnapshotRef.current = null;
  }, [conversationId, isFetchNextPageError, pageCount]);

  const handleLoadOlderMessages = useCallback(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion || scrollSnapshotRef.current) return;
    scrollSnapshotRef.current = {
      conversationId,
      pageCount,
      scrollTop: scrollRegion.scrollTop,
      scrollHeight: scrollRegion.scrollHeight,
    };
    void fetchNextPage();
  }, [conversationId, fetchNextPage, pageCount]);

  // register auto load effect
  useEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    const sentinel = sentinelRef.current;
    if (!scrollRegion || !sentinel) return;

    const isInitialScrollComplete =
      initialScrollRef.current.conversationId === conversationId &&
      initialScrollRef.current.complete;
    const canObserveOlderMessages =
      hasNextPage && fetchStatus === "idle" && !isFetchingNextPage && !isFetchNextPageError;
    const isObserverSupported = typeof IntersectionObserver !== "undefined";
    if (!isInitialScrollComplete || !canObserveOlderMessages || !isObserverSupported) {
      return;
    }

    let active = true;
    const observer = new IntersectionObserver(
      ([sentinelEntry]) => {
        const isInitialScrollComplete =
          initialScrollRef.current.conversationId === conversationId &&
          initialScrollRef.current.complete;
        const canLoadOlderMessages =
          fetchStatus === "idle" && !isFetchingNextPage && !isFetchNextPageError;
        if (
          active &&
          sentinelEntry?.isIntersecting &&
          isInitialScrollComplete &&
          canLoadOlderMessages
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

  return { scrollRegionRef, sentinelRef, handleLoadOlderMessages, showMessages };
};
