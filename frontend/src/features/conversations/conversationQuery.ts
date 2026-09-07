import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

export const CONVERSATION_QUERY_ERROR_MESSAGE = "Failed to load conversation";
const CONVERSATION_FORBIDDEN_ERROR_MESSAGE =
  "You do not have access to this conversation";
const CONVERSATION_NOT_FOUND_ERROR_MESSAGE = "Conversation not found";

type Conversation = {
  id: number;
  participants: {
    username: string;
    displayName: string;
    profileImage: string | null;
  }[];
  createdAt: string;
  lastActivityAt: string;
};

export const conversationQueryOptions = (conversationId: number) =>
  queryOptions({
    queryKey: ["conversations", conversationId] as const,
    queryFn: async ({ signal }): Promise<Conversation> => {
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

      return response.json() as Promise<Conversation>;
    },
  });
