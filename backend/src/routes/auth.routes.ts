import { Router } from "express";
import {
  loginController,
  logoutController,
  refreshController,
  registerController,
} from "@/controllers/auth.controller.js";
import { validateLogin } from "@/middleware/login.validation.middleware.js";
import { validateRegister } from "@/middleware/register.validation.middleware.js";

const authRouter = Router();

authRouter.post("/register", validateRegister, registerController);
authRouter.post("/login", validateLogin, loginController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);

export default authRouter;
