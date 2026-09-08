import { infiniteQueryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

const MESSAGES_QUERY_ERROR_MESSAGE = "Failed to load messages";
const MESSAGES_FORBIDDEN_ERROR_MESSAGE =
  "You do not have access to this conversation";
const CONVERSATION_NOT_FOUND_ERROR_MESSAGE = "Conversation not found";

type MessagesPage = {
  messages: {
    id: number;
    content: string;
    sender: {
      username: string;
      displayName: string;
      profileImage: string | null;
    };
    createdAt: string;
  }[];
  nextCursor: number | null;
};

export const messagesQueryOptions = (conversationId: number) =>
  infiniteQueryOptions({
    queryKey: ["conversations", conversationId, "messages"] as const,
    initialPageParam: null as number | null,
    queryFn: async ({ signal, pageParam }): Promise<MessagesPage> => {
      const path =
        pageParam === null
          ? `/conversations/${conversationId}/messages`
          : `/conversations/${conversationId}/messages?cursor=${pageParam}`;
      const response = await apiFetch(path, { signal });

      if (response.status === 403) {
        throw new UserFacingError(MESSAGES_FORBIDDEN_ERROR_MESSAGE);
      }

      if (response.status === 404) {
        throw new UserFacingError(CONVERSATION_NOT_FOUND_ERROR_MESSAGE);
      }

      if (!response.ok) {
        throw new UserFacingError(MESSAGES_QUERY_ERROR_MESSAGE);
      }

      return response.json() as Promise<MessagesPage>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
