import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { AUTH_QUERY_FALLBACK_MESSAGE, authMeQueryOptions } from "@/features/auth/authMeQuery.ts";

export function GuestOnlyRoute() {
  const { data: currentUser, isPending, isError, error } = useQuery(authMeQueryOptions);
  const isUnauthenticated = currentUser === null;

  if (isPending) {
    return <p role="status">Loading...</p>;
  }

  if (isError) {
    return <UserFacingErrorMessage error={error} fallbackMessage={AUTH_QUERY_FALLBACK_MESSAGE} />;
  }

  if (isUnauthenticated) {
    return <Outlet />;
  }

  if (currentUser) {
    return <Navigate to="/" />;
  }
}
