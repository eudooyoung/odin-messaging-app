import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { env } from "@/config/env.config.js";
import UnauthorizedError from "@/errors/unauthorizedError.js";

const getCookieValue = (cookieHeader: string | undefined, name: string) => {
  const cookie = cookieHeader
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  if (!cookie) {
    return undefined;
  }

  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return undefined;
  }
};

const createAuthenticationError = () =>
  new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");

export const authenticateAccessToken: RequestHandler = (req, res, next) => {
  const accessToken = getCookieValue(req.headers.cookie, "accessToken");

  if (!accessToken) {
    return next(createAuthenticationError());
  }

  try {
    const payload = jwt.verify(accessToken, env.jwtSecret);

    if (
      typeof payload === "string" ||
      payload.tokenType !== "access" ||
      typeof payload.sub !== "string"
    ) {
      return next(createAuthenticationError());
    }

    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId < 1) {
      return next(createAuthenticationError());
    }

    res.locals.userId = userId;
    next();
  } catch {
    next(createAuthenticationError());
  }
};
