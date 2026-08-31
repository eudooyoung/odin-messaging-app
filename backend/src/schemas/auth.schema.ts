import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().min(1).max(30),
  displayName: z.string().trim().min(1).max(50),
  password: z.string().min(12).max(128),
});

export const loginSchema = registerSchema.pick({
  username: true,
  password: true,
});
