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
  const {
    data: currentUser,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery(authMeQueryOptions);
  const authError = (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 py-10 text-center font-body text-sm text-danger-700">
      <UserFacingErrorMessage error={error} fallbackMessage={AUTH_QUERY_FALLBACK_MESSAGE} />
      <button
        className="rounded-md bg-primary-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
        type="button"
        disabled={isFetching}
        onClick={() => {
          void refetch();
        }}
      >
        Retry
      </button>
    </div>
  );
  const isAuthStateUnknown = currentUser === undefined;
  const isUnauthenticated = currentUser === null;

  if (isPending) {
    return (
      <p
        className="flex min-h-dvh items-center justify-center px-8 py-10 text-center font-body text-sm text-neutral-500"
        role="status"
      >
        Loading...
      </p>
    );
  }

  if (isError || isAuthStateUnknown) {
    return authError;
  }

  if (isUnauthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      <ClearSessionCacheOnAuthEnd />
      <AuthenticatedWebSocket />
      <Outlet />
    </>
  );
}
