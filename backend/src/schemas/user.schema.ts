import { z } from "zod";

export const updateUserProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(300).nullable().optional(),
  profileImage: z.string().trim().nullable().optional(),
});
