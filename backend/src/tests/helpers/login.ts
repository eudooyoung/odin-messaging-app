import type { Express } from "express";
import request from "supertest";
import { getCookiePair, getSetCookie } from "@/tests/helpers/cookie.js";
import type { LoginInput } from "@/types/api.types.js";

export const loginAndGetRefreshCookie = async (
  app: Express,
  credentials: LoginInput,
) => {
  const response = await request(app).post("/auth/login").send(credentials);

  return getCookiePair(
    getSetCookie(response.get("Set-Cookie"), "refreshToken"),
  );
};
