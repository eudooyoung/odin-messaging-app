import express from "express";
import errorHandler from "./errors/errorHandler.js";
import cors from "cors";

export const createApp = () => {
  const app = express();

  app
    .use(express.json())
    .use(express.urlencoded({ extended: true }))
    .use(cors())

    .use(errorHandler);

  return app;
};
