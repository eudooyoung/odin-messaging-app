import { registerService } from "@/services/auth.service";
import type { RegisterHandler } from "@/types/handler.types";

export const registerController: RegisterHandler = async (req, res) => {
  const { username, password, displayName } = req.body;
  const user = await registerService({ username, password, displayName });

  res.status(201).json(user);
};
