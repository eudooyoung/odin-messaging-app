import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number(),
  APP_DEBUG: z.string().transform((value) => value === "true"),
  NODE_ENV: z.enum(["development", "test", "production"]),
  JWT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1),
});
