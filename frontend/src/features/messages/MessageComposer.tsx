import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { createMessage } from "./createMessage.ts";

const SEND_MESSAGE_ERROR_MESSAGE = "Failed to send message";

type MessageComposerProps = {
  conversationId: number;
};

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const [messageContent, setMessageContent] = useState("");
  const createMessageMutation = useMutation({
    mutationFn: (content: string) => createMessage(conversationId, content),
    onSuccess: () => {
      setMessageContent("");
    },
  });

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          createMessageMutation.mutate(messageContent);
        }}
      >
        <label htmlFor="message-content">Message</label>
        <input
          id="message-content"
          type="text"
          value={messageContent}
          disabled={createMessageMutation.isPending}
          onChange={(event) => setMessageContent(event.target.value)}
        />
        <button type="submit" disabled={createMessageMutation.isPending}>
          Send
        </button>
      </form>
      {createMessageMutation.isError && (
        <p role="alert">
          {createMessageMutation.error instanceof UserFacingError
            ? createMessageMutation.error.message
            : SEND_MESSAGE_ERROR_MESSAGE}
        </p>
      )}
    </>
  );
}
