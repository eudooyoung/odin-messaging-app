import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { createMessage } from "./createMessage.ts";
import { syncMessageToCache } from "./syncMessagesToCache.ts";

const SEND_MESSAGE_ERROR_MESSAGE = "Failed to send message";
const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000, "Message must be at most 2000 characters"),
});

type MessageInput = z.infer<typeof messageSchema>;

type MessageComposerProps = {
  conversationId: number;
};

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });
  const createMessageMutation = useMutation({
    mutationFn: (content: string) => createMessage(conversationId, content),
    onSuccess: (message) => {
      syncMessageToCache(queryClient, conversationId, message);
      reset();
    },
  });

  return (
    <>
      <form onSubmit={handleSubmit(({ content }) => createMessageMutation.mutate(content))}>
        <label htmlFor="message-content">Message</label>
        <input
          id="message-content"
          type="text"
          disabled={createMessageMutation.isPending}
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? "message-content-error" : undefined}
          {...register("content")}
        />
        {errors.content && (
          <p id="message-content-error" role="alert">
            {errors.content.message}
          </p>
        )}
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
