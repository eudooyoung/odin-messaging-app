import { infiniteQueryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";
import type { ConversationsPage } from "./conversation.type.ts";

export const CONVERSATIONS_QUERY_ERROR_MESSAGE = "Failed to load conversations";
const CONVERSATIONS_PAGE_LIMIT = 20;

export const conversationsQueryOptions = infiniteQueryOptions({
  queryKey: ["conversations"] as const,
  initialPageParam: null as number | null,
  queryFn: async ({ signal, pageParam }): Promise<ConversationsPage> => {
    const path =
      pageParam === null
        ? `/conversations?limit=${CONVERSATIONS_PAGE_LIMIT}`
        : `/conversations?cursor=${pageParam}&limit=${CONVERSATIONS_PAGE_LIMIT}`;
    const response = await apiFetch(path, { signal });

    if (!response.ok) {
      throw new UserFacingError(CONVERSATIONS_QUERY_ERROR_MESSAGE);
    }

    return response.json() as Promise<ConversationsPage>;
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
