import {
  getUserProfileService,
  updateUserProfileService,
} from "@/services/user.service.js";
import type {
  GetUserProfileHandler,
  UpdateUserProfileHandler,
} from "@/types/handler.types.js";

export const getUserProfileController: GetUserProfileHandler = async (req, res) => {
  const userProfile = await getUserProfileService(req.params.username);

  res.status(200).json(userProfile);
};

export const updateUserProfileController: UpdateUserProfileHandler = async (req, res) => {
  const userProfile = await updateUserProfileService(res.locals.userId, req.body);

  res.status(200).json(userProfile);
};
