import { UserFacingError } from "@/api/UserFacingError.ts";

type UserFacingErrorMessageProps = {
  error: unknown;
  fallbackMessage: string;
};

export function UserFacingErrorMessage({ error, fallbackMessage }: UserFacingErrorMessageProps) {
  return <p role="alert">{error instanceof UserFacingError ? error.message : fallbackMessage}</p>;
}
