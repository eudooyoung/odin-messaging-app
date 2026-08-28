import { config } from "dotenv";

config();

const dbEnv = process.env.DB_ENV || "dev";
config({
  path: [`.env.${dbEnv}`],
  override: true,
});

export const env = {
  port: Number(process.env.PORT),
  dbURL: process.env.DATABASE_URL,
  debug: process.env.APP_DEBUG === "true",
  jwtSecret: process.env.JWT_SECRET,
};
