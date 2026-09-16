import { useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { AUTH_QUERY_FALLBACK_MESSAGE, authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { AuthenticatedWebSocket } from "@/features/messages/AuthenticatedWebSocket.tsx";

function ClearSessionCacheOnAuthEnd() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const isNonAuthQuery = ({ queryKey }: Query) => queryKey[0] !== "auth";
    const clearSessionCache = () => {
      if (queryClient.getQueryData(authMeQueryOptions.queryKey) === null) {
        queryClient.removeQueries({
          predicate: isNonAuthQuery,
        });
      }
    };
    return clearSessionCache;
  }, [queryClient]);

  return null;
}

export function ProtectedRoute() {
  const { data: currentUser, isPending, isError, error } = useQuery(authMeQueryOptions);
  const authError = (
    <UserFacingErrorMessage error={error} fallbackMessage={AUTH_QUERY_FALLBACK_MESSAGE} />
  );
  const isAuthStateUnknown = currentUser === undefined;
  const isUnauthenticated = currentUser === null;

  if (isPending) {
    return <p role="status">Loading...</p>;
  }

  if (isAuthStateUnknown) {
    return authError;
  }

  if (isUnauthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      {isError && authError}
      <ClearSessionCacheOnAuthEnd />
      <AuthenticatedWebSocket />
      <Outlet />
    </>
  );
}
