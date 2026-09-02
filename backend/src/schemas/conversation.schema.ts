import { z } from "zod";

export const createConversationSchema = z.object({
  targetUsername: z.string().trim().min(1).max(30),
});

export const getConversationsQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const getConversationParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
