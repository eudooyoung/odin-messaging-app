import { apiFetch } from "@/api/apiFetch.ts";
import { UserFacingError } from "@/api/UserFacingError.ts";

type Message = {
  id: number;
  content: string;
  sender: {
    username: string;
    displayName: string;
    profileImage: string | null;
  };
  createdAt: string;
};

export async function createMessage(conversationId: number, content: string) {
  const response = await apiFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (response.status === 403) {
    throw new UserFacingError("You do not have access to this conversation");
  }

  if (response.status === 404) {
    throw new UserFacingError("Conversation not found");
  }

  if (response.status !== 201) {
    throw new UserFacingError("Failed to send message");
  }

  return response.json() as Promise<Message>;
}
