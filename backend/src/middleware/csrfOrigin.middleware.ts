import type { RequestHandler } from "express";
import { env } from "@/config/env.config.js";
import ForbiddenError from "@/errors/forbiddenError.js";

export const csrfOriginMiddleware: RequestHandler = (req, _res, next) => {
  if (
    ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
    req.headers.origin !== env.frontendOrigin
  ) {
    return next(new ForbiddenError("Request origin forbidden"));
  }

  next();
};
