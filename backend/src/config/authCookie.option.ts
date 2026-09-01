import type { NodeEnv } from "@/types/env.types";
import type { CookieOptions } from "express";

export const getAuthCookieOptions = (nodeEnv: NodeEnv | undefined) => {
  const isProduction = nodeEnv === "production";
  const sameSite: CookieOptions["sameSite"] = isProduction ? "none" : "lax";

  return {
    accessToken: {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: "/",
      maxAge: 15 * 60 * 1000,
    },
    refreshToken: {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      path: "/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };
};
