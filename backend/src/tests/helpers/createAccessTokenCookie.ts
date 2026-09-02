import { createAccessToken } from "@/lib/accessToken.js";

export const createAccessTokenCookie = (userId: number) =>
  `accessToken=${createAccessToken(userId)}`;
