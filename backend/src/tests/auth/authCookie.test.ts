import { describe, expect, it } from "vitest";
import { getAuthCookieOptions } from "@/config/authCookie.config.js";

describe("getAuthCookieOptions", () => {
  const nonProductionEnvs = ["test", "development"] as const;

  it.each(nonProductionEnvs)("returns non-secure lax cookie options in %s", (nodeEnv) => {
    const options = getAuthCookieOptions(nodeEnv);

    expect(options.accessToken).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    expect(options.refreshToken).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });

  it("returns secure cross-site cookie options in production", () => {
    const options = getAuthCookieOptions("production");

    expect(options.accessToken).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    expect(options.refreshToken).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  });
});
