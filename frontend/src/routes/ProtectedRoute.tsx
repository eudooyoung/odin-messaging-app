import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { AUTH_QUERY_ERROR_MESSAGE, authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import { AuthenticatedWebSocket } from "@/features/messages/AuthenticatedWebSocket.tsx";

function ClearSessionCacheOnAuthEnd() {
  const queryClient = useQueryClient();

  useEffect(
    () => () => {
      if (queryClient.getQueryData(authMeQueryOptions.queryKey) === null) {
        queryClient.removeQueries({
          predicate: ({ queryKey }) => queryKey[0] !== "auth",
        });
      }
    },
    [queryClient],
  );

  return null;
}

export function ProtectedRoute() {
  const { data: currentUser, isPending, isError, error } = useQuery(authMeQueryOptions);

  if (isPending) {
    return <p role="status">Loading...</p>;
  }

  if (isError && !currentUser) {
    return (
      <p role="alert">
        {error instanceof UserFacingError ? error.message : AUTH_QUERY_ERROR_MESSAGE}
      </p>
    );
  }

  if (currentUser === null) {
    return <Navigate to="/login" />;
  }

  if (currentUser) {
    return (
      <>
        {isError && (
          <p role="alert">
            {error instanceof UserFacingError ? error.message : AUTH_QUERY_ERROR_MESSAGE}
          </p>
        )}
        <ClearSessionCacheOnAuthEnd />
        <AuthenticatedWebSocket />
        <Outlet />
      </>
    );
  }
}
