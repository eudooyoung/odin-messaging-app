import type { Express } from "express";
import request from "supertest";
import { getCookiePair, getSetCookie } from "@/tests/helpers/cookie.js";
import type { LoginInput } from "@/types/api.types.js";

const loginAndGetCookie = async (
  app: Express,
  credentials: LoginInput,
  cookieName: "accessToken" | "refreshToken",
) => {
  const response = await request(app).post("/auth/login").send(credentials);

  return getCookiePair(getSetCookie(response.get("Set-Cookie"), cookieName));
};

export const loginAndGetAccessCookie = (app: Express, credentials: LoginInput) =>
  loginAndGetCookie(app, credentials, "accessToken");

export const loginAndGetRefreshCookie = (app: Express, credentials: LoginInput) =>
  loginAndGetCookie(app, credentials, "refreshToken");
