import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";

export function GuestOnlyRoute() {
  const { data: currentUser, isPending, isError } = useQuery(authMeQueryOptions);

  if (isPending) {
    return <p role="status">Loading...</p>;
  }

  if (isError) {
    return <p role="alert">Failed to check authentication</p>;
  }

  if (currentUser === null) {
    return <Outlet />;
  }

  if (currentUser) {
    return <Navigate to="/" />;
  }
}
