import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.config.js";

export const createAccessToken = (userId: number) =>
  jwt.sign({ sub: String(userId), tokenType: "access" }, env.jwtSecret, {
    expiresIn: "15m",
    jwtid: randomUUID(),
  });

export const verifyAccessToken = (accessToken: string) => {
  try {
    const payload = jwt.verify(accessToken, env.jwtSecret);

    if (
      typeof payload === "string" ||
      payload.tokenType !== "access" ||
      typeof payload.sub !== "string"
    ) {
      return undefined;
    }

    const userId = Number(payload.sub);

    return Number.isInteger(userId) && userId > 0 ? userId : undefined;
  } catch {
    return undefined;
  }
};
