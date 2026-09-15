import { UserFacingError } from "@/api/UserFacingError.ts";

type QueryErrorMessageProps = {
  error: unknown;
  fallbackMessage: string;
};

export function QueryErrorMessage({ error, fallbackMessage }: QueryErrorMessageProps) {
  return <p role="alert">{error instanceof UserFacingError ? error.message : fallbackMessage}</p>;
}
