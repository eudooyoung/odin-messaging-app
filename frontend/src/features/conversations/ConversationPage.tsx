import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { UserFacingError } from "@/api/UserFacingError.ts";
import {
  CONVERSATION_QUERY_ERROR_MESSAGE,
  conversationQueryOptions,
} from "./conversationQuery.ts";

export function ConversationPage() {
  const { conversationId } = useParams();
  const parsedConversationId = Number(conversationId);
  const isValidConversationId =
    Number.isInteger(parsedConversationId) && parsedConversationId > 0;
  const {
    data: conversation,
    isPending,
    isError,
    error,
  } = useQuery({
    ...conversationQueryOptions(parsedConversationId),
    enabled: isValidConversationId,
  });

  if (!isValidConversationId) {
    return <p role="alert">Invalid conversation</p>;
  }

  if (isPending) {
    return <p role="status">Loading conversation...</p>;
  }

  if (isError) {
    return (
      <p role="alert">
        {error instanceof UserFacingError
          ? error.message
          : CONVERSATION_QUERY_ERROR_MESSAGE}
      </p>
    );
  }

  const otherUser = conversation?.participants[1];

  if (!otherUser) {
    return null;
  }

  return (
    <>
      <h1>{otherUser.displayName}</h1>
      <p>@{otherUser.username}</p>
    </>
  );
}
