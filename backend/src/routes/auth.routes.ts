import { Router } from "express";
import {
  getMeController,
  loginController,
  logoutController,
  refreshController,
  registerController,
} from "@/controllers/auth.controller.js";
import { authenticateAccessToken } from "@/middleware/accessToken.authentication.middleware.js";
import { validateLogin } from "@/middleware/login.validation.middleware.js";
import { validateRegister } from "@/middleware/register.validation.middleware.js";

const authRouter = Router();

authRouter
  .post("/register", validateRegister, registerController)
  .post("/login", validateLogin, loginController)
  .post("/refresh", refreshController)
  .post("/logout", logoutController)
  .get("/me", authenticateAccessToken, getMeController);

export default authRouter;
