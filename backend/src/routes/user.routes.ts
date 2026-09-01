import { Router } from "express";
import {
  getUserProfileController,
  searchUsersController,
  updateUserProfileController,
} from "@/controllers/user.controller.js";
import { authenticateAccessToken } from "@/middleware/accessToken.authentication.middleware.js";
import { validateSearchUsers } from "@/middleware/searchUsers.validation.middleware.js";
import { validateUpdateUserProfile } from "@/middleware/updateUserProfile.validation.middleware.js";

const userRouter = Router();

userRouter.patch(
  "/me",
  authenticateAccessToken,
  validateUpdateUserProfile,
  updateUserProfileController,
);
userRouter.get("/", authenticateAccessToken, validateSearchUsers, searchUsersController);
userRouter.get("/:username", authenticateAccessToken, getUserProfileController);

export default userRouter;
