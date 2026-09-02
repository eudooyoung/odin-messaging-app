import type { RequestHandler } from "express";
import UnauthorizedError from "@/errors/unauthorizedError.js";
import { verifyAccessToken } from "@/lib/accessToken.js";
import { getCookieValue } from "@/lib/cookie.js";

const createAuthenticationError = () =>
  new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");

export const authenticateAccessToken: RequestHandler = (req, res, next) => {
  const accessToken = getCookieValue(req.headers.cookie, "accessToken");

  if (!accessToken) {
    return next(createAuthenticationError());
  }

  const userId = verifyAccessToken(accessToken);

  if (!userId) {
    return next(createAuthenticationError());
  }

  res.locals.userId = userId;
  next();
};
