import { z } from "zod";

export const envSchema = z
  .object({
    PORT: z.coerce.number(),
    APP_DEBUG: z.enum(["true", "false"]).transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "test", "production"]),
    JWT_SECRET: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "test" && !env.TEST_DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        message: "TEST_DATABASE_URL is required in test environment",
        path: ["TEST_DATABASE_URL"],
      });
    }
  });
