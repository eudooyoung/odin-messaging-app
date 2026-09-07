import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { USERS_QUERY_ERROR_MESSAGE, usersQueryOptions } from "./usersQuery.ts";

export function UserSearch() {
  const [query, setQuery] = useState("");
  const {
    data: users,
    isPending,
    isError,
    error,
  } = useQuery({
    ...usersQueryOptions(query),
    enabled: query.length > 0,
  });

  return (
    <>
      <label htmlFor="user-search">Search users</label>
      <input
        id="user-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {query.length > 0 && isPending && <p role="status">Searching users...</p>}

      {isError && (
        <p role="alert">
          {error instanceof UserFacingError ? error.message : USERS_QUERY_ERROR_MESSAGE}
        </p>
      )}

      {!isPending && !isError && users?.length === 0 && <p>No users found</p>}

      {!isPending && !isError && users && users.length > 0 && (
        <ul>
          {users.map((user) => (
            <li key={user.username}>
              <p>{user.displayName}</p>
              <p>@{user.username}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
