import "dotenv/config";

export const env = {
  port: Number(process.env.PORT),
  dbURL: process.env.DATABASE_URL,
  debug: process.env.APP_DEBUG === "true",
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV,
};
