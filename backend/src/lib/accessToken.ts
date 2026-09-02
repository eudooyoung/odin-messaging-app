import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.config.js";

export const createAccessToken = (userId: number) =>
  jwt.sign({ sub: String(userId), tokenType: "access" }, env.jwtSecret, {
    expiresIn: "15m",
    jwtid: randomUUID(),
  });
