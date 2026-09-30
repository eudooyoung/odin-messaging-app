import { useEffect, useLayoutEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/FormField.tsx";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { createMessage } from "./createMessage.ts";
import { syncMessageToCache } from "./syncMessagesToCache.ts";

const SEND_MESSAGE_ERROR_MESSAGE = "Failed to send message";
const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(1000, "Message must be at most 1000 characters"),
});

type MessageInput = z.infer<typeof messageSchema>;

type MessageComposerProps = {
  conversationId: number;
};

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const queryClient = useQueryClient();
  const activeConversationId = useRef(conversationId);
  const {
    register,
    handleSubmit,
    reset,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<MessageInput>({
    resolver: zodResolver(messageSchema),
    defaultValues: { content: "" },
  });
  const createMessageMutation = useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: number; content: string }) =>
      createMessage(conversationId, content),
    onSuccess: (message, { conversationId }) => {
      syncMessageToCache(queryClient, conversationId, message);
      if (activeConversationId.current === conversationId) {
        reset();
      }
    },
  });
  const resetMutation = createMessageMutation.reset;

  useLayoutEffect(() => {
    if (activeConversationId.current !== conversationId) {
      activeConversationId.current = conversationId;
      resetMutation();
      resetField("content");
    }
  }, [conversationId, resetMutation, resetField]);

  useEffect(() => {
    setFocus("content");
  }, [conversationId, setFocus]);

  useEffect(() => {
    if (createMessageMutation.isSuccess || createMessageMutation.isError) {
      setFocus("content");
    }
  }, [createMessageMutation.isSuccess, createMessageMutation.isError, setFocus]);

  return (
    <>
      <form
        className="flex items-center gap-3"
        onSubmit={handleSubmit(({ content }) =>
          createMessageMutation.mutate({ conversationId, content }),
        )}
      >
        <div className="min-w-0 flex-1 [&>label]:sr-only [&>p]:mt-1 [&>p]:text-xs [&>p]:text-danger-700">
          <FormField
            as="textarea"
            autoFocus
            className="min-h-11 w-full min-w-0 resize-none rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-base leading-6 text-neutral-900 placeholder:text-neutral-400 focus-visible:border-primary-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-neutral-100"
            id="message-content"
            label="Message"
            rows={2}
            disabled={createMessageMutation.isPending}
            error={errors.content?.message}
            {...register("content")}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing ||
                createMessageMutation.isPending
              ) {
                return;
              }

              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
          />
        </div>
        <button
          className="h-11 shrink-0 rounded-lg bg-primary-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
          type="submit"
          disabled={createMessageMutation.isPending}
        >
          Send
        </button>
      </form>
      {createMessageMutation.isError && (
        <div className="mt-2 text-xs text-danger-700">
          <UserFacingErrorMessage
            error={createMessageMutation.error}
            fallbackMessage={SEND_MESSAGE_ERROR_MESSAGE}
          />
        </div>
      )}
    </>
  );
}
