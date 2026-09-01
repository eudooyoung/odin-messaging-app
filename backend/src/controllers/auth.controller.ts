import { getAuthCookieOptions } from "@/config/authCookie.option";
import { env } from "@/config/env.config";
import {
  loginService,
  logoutService,
  refreshService,
  registerService,
} from "@/services/auth.service";
import type {
  LoginHandler,
  LogoutHandler,
  RefreshHandler,
  RegisterHandler,
} from "@/types/handler.types";

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

export const registerController: RegisterHandler = async (req, res) => {
  const { username, password, displayName } = req.body;
  const user = await registerService({ username, password, displayName });

  res.status(201).json(user);
};

export const loginController: LoginHandler = async (req, res) => {
  const { username, password } = req.body;
  const { accessToken, refreshToken } = await loginService({ username, password });
  const cookieOptions = getAuthCookieOptions(env.nodeEnv);

  res.cookie("accessToken", accessToken, cookieOptions.accessToken);
  res.cookie("refreshToken", refreshToken, cookieOptions.refreshToken);

  res.status(204).end();
};

export const refreshController: RefreshHandler = async (req, res) => {
  const currentRefreshToken = getCookieValue(req.headers.cookie, "refreshToken");
  const { accessToken, refreshToken } = await refreshService(currentRefreshToken);
  const cookieOptions = getAuthCookieOptions(env.nodeEnv);

  res.cookie("accessToken", accessToken, cookieOptions.accessToken);
  res.cookie("refreshToken", refreshToken, cookieOptions.refreshToken);

  res.status(204).end();
};

export const logoutController: LogoutHandler = async (req, res) => {
  const refreshToken = getCookieValue(req.headers.cookie, "refreshToken");

  await logoutService(refreshToken);

  const cookieOptions = getAuthCookieOptions(env.nodeEnv);

  res.clearCookie("accessToken", cookieOptions.accessToken);
  res.clearCookie("refreshToken", cookieOptions.refreshToken);

  res.status(204).end();
};
