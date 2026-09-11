import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";
import { QueryErrorMessage } from "@/components/QueryErrorMessage.tsx";
import { AUTH_QUERY_FALLBACK_MESSAGE, authMeQueryOptions } from "@/features/auth/authMeQuery.ts";

export function GuestOnlyRoute() {
  const { data: currentUser, isPending, isError, error } = useQuery(authMeQueryOptions);
  const isUnauthenticated = currentUser === null;

  if (isPending) {
    return <p role="status">Loading...</p>;
  }

  if (isError) {
    return <QueryErrorMessage error={error} fallbackMessage={AUTH_QUERY_FALLBACK_MESSAGE} />;
  }

  if (isUnauthenticated) {
    return <Outlet />;
  }

  if (currentUser) {
    return <Navigate to="/" />;
  }
}
