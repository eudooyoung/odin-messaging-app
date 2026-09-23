import { z } from "zod";

export const createConversationSchema = z.object({
  targetHandle: z
    .string()
    .min(3)
    .max(30)
    .regex(/^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9_.]+$/),
});

export const getConversationsQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const getConversationParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
