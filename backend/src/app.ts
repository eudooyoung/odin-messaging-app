import express from "express";
import errorHandler from "./errors/errorHandler.js";
import cors from "cors";
import authRouter from "./routes/auth.routes.js";

export const createApp = () => {
  const app = express();

  app
    .use(express.json())
    .use(express.urlencoded({ extended: true }))
    .use(cors())
    .use("/auth", authRouter)

    .use(errorHandler);

  return app;
};
