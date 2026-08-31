import { Router } from "express";
import {
  loginController,
  registerController,
} from "@/controller/auth.controller.js";
import { validateLogin } from "@/middleware/login.validation.middleware.js";
import { validateRegister } from "@/middleware/register.validation.middleware.js";

const authRouter = Router();

authRouter.post("/register", validateRegister, registerController);
authRouter.post("/login", validateLogin, loginController);

export default authRouter;
