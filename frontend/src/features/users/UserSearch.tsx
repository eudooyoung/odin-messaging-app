import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { conversationsQueryOptions } from "@/features/conversations/conversationsQuery.ts";
import { createConversation } from "@/features/conversations/createConversation.ts";
import { USERS_QUERY_ERROR_MESSAGE, usersQueryOptions } from "./usersQuery.ts";

export function UserSearch() {
  const [query, setQuery] = useState("");
  const searchQuery = query.trim();
  const hasQuery = searchQuery.length > 0;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createConversationMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({
        queryKey: conversationsQueryOptions.queryKey,
        exact: true,
      });
      navigate(`/conversations/${conversation.id}`);
    },
  });
  const {
    data: users,
    isPending,
    isError,
    error,
  } = useQuery({
    ...usersQueryOptions(searchQuery),
    enabled: hasQuery,
  });
  const hasUsers = !isPending && !isError && Boolean(users?.length);
  const showEmptyState = !isPending && !isError && users?.length === 0;
  const isCreatingConversation = createConversationMutation.isPending;

  return (
    <>
      <label htmlFor="user-search">Search users</label>
      <input
        id="user-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {hasQuery && isPending && <p role="status">Searching users...</p>}

      {isError && (
        <UserFacingErrorMessage error={error} fallbackMessage={USERS_QUERY_ERROR_MESSAGE} />
      )}

      {createConversationMutation.isError && (
        <p role="alert">{createConversationMutation.error.message}</p>
      )}

      {showEmptyState && <p>No users found</p>}

      {hasUsers && (
        <ul>
          {users?.map((user) => (
            <li key={user.username}>
              <button
                type="button"
                disabled={isCreatingConversation}
                onClick={() => createConversationMutation.mutate(user.username)}
              >
                <span>{user.displayName}</span> <span>@{user.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
