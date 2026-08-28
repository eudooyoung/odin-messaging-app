import { env } from "@/config/env.config.js";
import type { ErrorRequestHandler } from "express";
import CustomError from "./customError.js";

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (env.debug) {
    console.error(error);
  }

  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
      },
    });
  }

  return res.status(500).json({
    error: {
      message: "Internal Server Error",
    },
  });
};

export default errorHandler;
