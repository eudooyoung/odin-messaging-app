import {
  getUserProfileService,
  searchUsersService,
  updateUserProfileService,
} from "@/services/user.service.js";
import type {
  GetUserProfileHandler,
  SearchUsersHandler,
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

export const searchUsersController: SearchUsersHandler = async (_req, res) => {
  const users = await searchUsersService(res.locals.query);

  res.status(200).json(users);
};
