import {
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { type MessagesPage, messagesQueryOptions } from "./messagesQuery.ts";

type Message = MessagesPage["messages"][number];

const getPendingMessagesFetch = (
  queryClient: QueryClient,
  queryKey: QueryKey,
) => {
  const isCurrentMessagesFetching =
    queryClient.isFetching({ queryKey, exact: true }) > 0;
  const messagesQueryState = queryClient.getQueryState(queryKey);
  const shouldRecoverInitialFetchError =
    messagesQueryState?.status === "error" &&
    messagesQueryState.data === undefined;

  if (!isCurrentMessagesFetching && !shouldRecoverInitialFetchError) {
    return null;
  }

  return queryClient.refetchQueries(
    { queryKey, exact: true },
    { cancelRefetch: false },
  );
};

export const syncMessageToCache = (
  queryClient: QueryClient,
  conversationId: number,
  message: Message,
) => {
  const queryKey = messagesQueryOptions(conversationId).queryKey;
  const pendingMessagesFetch = getPendingMessagesFetch(
    queryClient,
    queryKey,
  );
  const addMessageToCache = () => {
    queryClient.setQueryData<InfiniteData<MessagesPage, number | null>>(
      queryKey,
      (currentData) => {
        if (!currentData || currentData.pages.length === 0) {
          return {
            pages: [{ messages: [message], nextCursor: null }],
            pageParams: [null],
          };
        }

        if (
          currentData.pages.some((page) =>
            page.messages.some((cachedMessage) => cachedMessage.id === message.id),
          )
        ) {
          return currentData;
        }

        const [firstPage, ...remainingPages] = currentData.pages;

        return {
          ...currentData,
          pages: [
            {
              ...firstPage,
              messages: [message, ...firstPage.messages],
            },
            ...remainingPages,
          ],
        };
      },
    );
  };

  addMessageToCache();
  void pendingMessagesFetch?.then(addMessageToCache);
};
