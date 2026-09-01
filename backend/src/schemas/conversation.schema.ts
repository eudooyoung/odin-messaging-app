import { z } from "zod";

export const createConversationSchema = z.object({
  targetUsername: z.string().trim().min(1).max(30),
});
