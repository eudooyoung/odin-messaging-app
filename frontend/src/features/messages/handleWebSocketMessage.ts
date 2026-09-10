import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { syncMessageToCache } from "./syncMessagesToCache.ts";

const messageCreatedEventSchema = z.object({
  type: z.literal("message.created"),
  payload: z.object({
    conversationId: z.number().int().positive(),
    message: z.object({
      id: z.number().int().positive(),
      content: z.string(),
      sender: z.object({
        username: z.string(),
        displayName: z.string(),
        profileImage: z.string().nullable(),
      }),
      createdAt: z.iso.datetime(),
    }),
  }),
});

export const handleWebSocketMessage = (
  queryClient: QueryClient,
  event: MessageEvent<string>,
) => {
  let receivedEvent: unknown;

  try {
    receivedEvent = JSON.parse(event.data) as unknown;
  } catch {
    return;
  }

  const result = messageCreatedEventSchema.safeParse(receivedEvent);

  if (!result.success) {
    return;
  }

  syncMessageToCache(
    queryClient,
    result.data.payload.conversationId,
    result.data.payload.message,
  );
};
