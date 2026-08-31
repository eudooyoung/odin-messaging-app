import { getAuthCookieOptions } from "@/config/authCookie.config";
import { env } from "@/config/env.config";
import { loginService, registerService } from "@/services/auth.service";
import type { LoginHandler, RegisterHandler } from "@/types/handler.types";

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
