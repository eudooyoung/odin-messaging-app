import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import type { ConversationDetail } from "./conversation.type.ts";

export const CONVERSATION_QUERY_ERROR_MESSAGE = "Failed to load conversation";
const CONVERSATION_FORBIDDEN_ERROR_MESSAGE = "You do not have access to this conversation";
const CONVERSATION_NOT_FOUND_ERROR_MESSAGE = "Conversation not found";

export const conversationQueryOptions = (conversationId: number) =>
  queryOptions({
    queryKey: ["conversations", conversationId] as const,
    queryFn: async ({ signal }): Promise<ConversationDetail> => {
      const response = await apiFetch(`/conversations/${conversationId}`, { signal });

      if (response.status === 403) {
        throw new UserFacingError(CONVERSATION_FORBIDDEN_ERROR_MESSAGE);
      }

      if (response.status === 404) {
        throw new UserFacingError(CONVERSATION_NOT_FOUND_ERROR_MESSAGE);
      }

      if (!response.ok) {
        throw new UserFacingError(CONVERSATION_QUERY_ERROR_MESSAGE);
      }

      return response.json() as Promise<ConversationDetail>;
    },
  });
