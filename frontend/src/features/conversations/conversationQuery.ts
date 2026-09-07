import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

export const CONVERSATION_QUERY_ERROR_MESSAGE = "Failed to load conversation";

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

      if (!response.ok) {
        throw new UserFacingError(CONVERSATION_QUERY_ERROR_MESSAGE);
      }

      return response.json() as Promise<Conversation>;
    },
  });
