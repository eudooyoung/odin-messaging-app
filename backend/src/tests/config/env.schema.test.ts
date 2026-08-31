import { describe, expect, it } from "vitest";
import { envSchema } from "@/config/env.schema.js";

const validEnv = {
  PORT: "3000",
  APP_DEBUG: "true",
  NODE_ENV: "test",
  JWT_SECRET: "jwt-secret",
  DATABASE_URL: "postgresql://user:password@localhost:5432/app",
  TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/app_test",
};

describe("envSchema", () => {
  it("parses and transforms valid environment variables", () => {
    expect(envSchema.parse(validEnv)).toEqual({
      PORT: 3000,
      APP_DEBUG: true,
      NODE_ENV: "test",
      JWT_SECRET: validEnv.JWT_SECRET,
      DATABASE_URL: validEnv.DATABASE_URL,
      TEST_DATABASE_URL: validEnv.TEST_DATABASE_URL,
    });
  });

  it("rejects input without NODE_ENV", () => {
    const input: Record<string, string> = { ...validEnv };
    delete input.NODE_ENV;

    expect(() => envSchema.parse(input)).toThrow();
  });

  it("rejects an unsupported NODE_ENV", () => {
    expect(() =>
      envSchema.parse({
        ...validEnv,
        NODE_ENV: "staging",
      }),
    ).toThrow();
  });
});
