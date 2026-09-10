import { type InfiniteData, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { type MessagesPage, messagesQueryOptions } from "./messagesQuery.ts";

type Message = MessagesPage["messages"][number];

const getPendingMessagesFetch = (queryClient: QueryClient, queryKey: QueryKey) => {
  const isCurrentMessagesFetching = queryClient.isFetching({ queryKey, exact: true }) > 0;
  const messagesQueryState = queryClient.getQueryState(queryKey);
  const shouldRecoverInitialFetchError =
    messagesQueryState?.status === "error" && messagesQueryState.data === undefined;

  if (!isCurrentMessagesFetching && !shouldRecoverInitialFetchError) {
    return null;
  }

  return queryClient.refetchQueries({ queryKey, exact: true }, { cancelRefetch: false });
};

export const syncMessageToCache = (
  queryClient: QueryClient,
  conversationId: number,
  message: Message,
) => {
  const queryKey = messagesQueryOptions(conversationId).queryKey;
  const currentMessagesQuery = queryClient.getQueryCache().find({ queryKey, exact: true });
  const pendingMessagesQueryFetch = getPendingMessagesFetch(queryClient, queryKey);
  const addMessageToCache = () => {
    queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(queryKey, (currentData) => {
      const hasNoCachedPages = !currentData || currentData.pages.length === 0;
      const isMessageAlreadyCached =
        currentData?.pages.some((page) =>
          page.messages.some((cachedMessage) => cachedMessage.id === message.id),
        ) ?? false;

      if (hasNoCachedPages) {
        return {
          pages: [{ messages: [message], nextCursor: null }],
          pageParams: [null],
        };
      }

      if (isMessageAlreadyCached) {
        return currentData;
      }

      const [firstPage, ...remainingPages] = currentData.pages;
      const sortedMessages = [message, ...firstPage.messages].sort((first, second) => {
        const timeOrder = second.createdAt.localeCompare(first.createdAt);
        if (timeOrder !== 0) {
          return timeOrder;
        }
        return second.id - first.id;
      });
      const updatedFirstPage = { ...firstPage, messages: sortedMessages };
      const updatedPages = [updatedFirstPage, ...remainingPages];

      return {
        ...currentData,
        pages: updatedPages,
      };
    });
  };

  addMessageToCache();
  void pendingMessagesQueryFetch?.then(() => {
    const latestMessageQuery = queryClient.getQueryCache().find({ queryKey, exact: true });
    if (latestMessageQuery !== currentMessagesQuery) {
      return;
    }

    addMessageToCache();
  });
};
