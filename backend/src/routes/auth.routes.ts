import { Router } from "express";
import { registerController } from "@/controller/auth.controller.js";
import { validateRegister } from "@/middleware/register.validation.middleware.js";

const authRouter = Router();

authRouter.post("/register", validateRegister, registerController);

export default authRouter;
