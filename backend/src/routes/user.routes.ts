import { Router } from "express";
import {
  getUserProfileController,
  updateUserProfileController,
} from "@/controllers/user.controller.js";
import { authenticateAccessToken } from "@/middleware/accessToken.authentication.middleware.js";
import { validateUpdateUserProfile } from "@/middleware/updateUserProfile.validation.middleware.js";

const userRouter = Router();

userRouter.patch(
  "/me",
  authenticateAccessToken,
  validateUpdateUserProfile,
  updateUserProfileController,
);
userRouter.get("/:username", authenticateAccessToken, getUserProfileController);

export default userRouter;
