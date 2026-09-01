import { Router } from "express";
import {
  loginController,
  refreshController,
  registerController,
} from "@/controllers/auth.controller.js";
import { validateLogin } from "@/middleware/login.validation.middleware.js";
import { validateRegister } from "@/middleware/register.validation.middleware.js";

const authRouter = Router();

authRouter.post("/register", validateRegister, registerController);
authRouter.post("/login", validateLogin, loginController);
authRouter.post("/refresh", refreshController);

export default authRouter;
