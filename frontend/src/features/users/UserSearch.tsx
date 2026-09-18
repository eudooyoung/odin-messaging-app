import { useQuery } from "@tanstack/react-query";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { USERS_QUERY_ERROR_MESSAGE, usersQueryOptions } from "./usersQuery.ts";

const USER_SEARCH_LISTBOX_ID = "user-search-results";
const getUserSearchOptionId = (index: number) => `user-search-option-${index}`;

export function UserSearch() {
  const [query, setQuery] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const userSearchRef = useRef<HTMLElement>(null);
  const searchQuery = query.trim();
  const hasQuery = searchQuery.length > 0;
  const navigate = useNavigate();
  const {
    data: users,
    isPending,
    isError,
    error,
  } = useQuery({
    ...usersQueryOptions(searchQuery),
    enabled: hasQuery,
  });
  const hasUsers = !isPending && !isError && Boolean(users?.length);
  const showEmptyState = !isPending && !isError && users?.length === 0;
  const activeOption = users?.[activeOptionIndex];
  const isListboxOpen = isDropdownOpen && hasUsers;
  const isSearchPanelOpen =
    isDropdownOpen && hasQuery && (isPending || isError || showEmptyState || hasUsers);

  useEffect(() => {
    optionRefs.current[activeOptionIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeOptionIndex]);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const isClickOutsideUserSearch =
        event.target instanceof Node && !userSearchRef.current?.contains(event.target);
      if (isClickOutsideUserSearch) {
        setIsDropdownOpen(false);
        setActiveOptionIndex(-1);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isDropdownOpen]);

  const selectUser = (username: string) => navigate(`/users/${encodeURIComponent(username)}`);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && users?.length) {
      event.preventDefault();
      setIsDropdownOpen(true);
      setActiveOptionIndex((currentIndex) => Math.min(currentIndex + 1, users.length - 1));
      return;
    }

    if (event.key === "ArrowUp" && activeOptionIndex > 0) {
      event.preventDefault();
      setActiveOptionIndex((currentIndex) => currentIndex - 1);
      return;
    }

    if (event.key === "Escape" && isDropdownOpen) {
      event.preventDefault();
      setIsDropdownOpen(false);
      setActiveOptionIndex(-1);
      return;
    }

    if (event.key === "Enter" && activeOption) {
      event.preventDefault();
      selectUser(activeOption.username);
    }
  };

  return (
    <section ref={userSearchRef} className="flex w-full min-w-0 flex-col gap-2">
      <label className="text-sm font-medium text-neutral-700" htmlFor="user-search">
        Search users
      </label>
      <div className="relative">
        <input
          aria-activedescendant={
            activeOption ? getUserSearchOptionId(activeOptionIndex) : undefined
          }
          aria-autocomplete="list"
          aria-controls={USER_SEARCH_LISTBOX_ID}
          aria-expanded={isSearchPanelOpen}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          id="user-search"
          role="combobox"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveOptionIndex(-1);
            setIsDropdownOpen(event.target.value.trim().length > 0);
          }}
          onKeyDown={handleKeyDown}
        />

        {isSearchPanelOpen && (
          <div className="absolute top-full right-0 left-0 z-20 mt-2 max-h-60 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-lg">
            {isPending && (
              <p className="px-3 py-2 text-sm text-neutral-500" role="status">
                Searching users...
              </p>
            )}

            {isError && (
              <div className="bg-danger-50 px-3 py-2 text-sm text-danger-700 [&>p]:m-0">
                <UserFacingErrorMessage error={error} fallbackMessage={USERS_QUERY_ERROR_MESSAGE} />
              </div>
            )}

            {showEmptyState && <p className="px-3 py-2 text-sm text-neutral-500">No users found</p>}

            {isListboxOpen && (
              <ul
                className="divide-y divide-neutral-200"
                id={USER_SEARCH_LISTBOX_ID}
                role="listbox"
              >
                {users?.map((user, index) => (
                  <li key={user.username} role="presentation">
                    <button
                      aria-label={`${user.displayName} @${user.username}`}
                      aria-selected={activeOptionIndex === index}
                      className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none focus-visible:ring-inset ${activeOptionIndex === index ? "bg-neutral-100" : ""}`}
                      id={getUserSearchOptionId(index)}
                      ref={(option) => {
                        optionRefs.current[index] = option;
                      }}
                      role="option"
                      tabIndex={-1}
                      type="button"
                      onClick={() => selectUser(user.username)}
                    >
                      <span
                        className={`min-w-0 truncate text-sm font-medium transition-colors ${activeOptionIndex === index ? "text-primary-600" : "text-neutral-900"}`}
                      >
                        {user.displayName}
                      </span>
                      <span className="min-w-0 truncate text-xs text-neutral-500">
                        @{user.username}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
