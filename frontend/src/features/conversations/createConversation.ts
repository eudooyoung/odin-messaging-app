import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

type Conversation = {
  id: number;
  participants: {
    username: string;
    displayName: string;
    profileImage: string | null;
  }[];
  createdAt: string;
  lastActivityAt: string;
};

export async function createConversation(targetUsername: string) {
  const response = await apiFetch("/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUsername }),
  });

  if (response.status === 400) {
    throw new UserFacingError("Cannot start conversation");
  }

  if (response.status === 404) {
    throw new UserFacingError("User not found");
  }

  if (!response.ok) {
    throw new UserFacingError("Failed to create conversation");
  }

  return response.json() as Promise<Conversation>;
}
