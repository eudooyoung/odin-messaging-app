import "dotenv/config";
import { envSchema } from "@/config/env.schema";

const parsedEnv = envSchema.parse(process.env);

export const env = {
  port: parsedEnv.PORT,
  dbURL: parsedEnv.DATABASE_URL,
  testDbURL: parsedEnv.TEST_DATABASE_URL,
  debug: parsedEnv.APP_DEBUG,
  jwtSecret: parsedEnv.JWT_SECRET,
  nodeEnv: parsedEnv.NODE_ENV,
};
