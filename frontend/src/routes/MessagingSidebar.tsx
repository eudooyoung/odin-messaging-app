import { useState } from "react";
import { Link } from "react-router";
import leavesLogoMark from "@/assets/leaves-logo-mark.svg";
import sidebarCollapseIcon from "@/assets/sidebar-collapse.svg";
import sidebarExpandIcon from "@/assets/sidebar-expand.svg";
import { LogoutButton } from "@/features/auth/LogoutButton.tsx";
import { ConversationList } from "@/features/conversations/ConversationList.tsx";
import { UserSearch } from "@/features/users/UserSearch.tsx";

export function MessagingSidebar() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarToggleButton = (
    <button
      aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 transition-colors hover:border-primary-100 hover:bg-primary-50 hover:text-primary-700 focus-visible:border-primary-500 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary-600 ${isSidebarCollapsed ? "self-center" : ""}`}
      type="button"
      onClick={() => setIsSidebarCollapsed((isCollapsed) => !isCollapsed)}
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 bg-current"
        style={{
          maskImage: `url("${isSidebarCollapsed ? sidebarExpandIcon : sidebarCollapseIcon}")`,
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
        }}
      />
    </button>
  );

  return (
    <aside
      className={`flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-neutral-200 bg-neutral-50 transition-[width,padding] duration-200 ease-out ${isSidebarCollapsed ? "w-16 p-3" : "w-80 p-5"}`}
    >
      {isSidebarCollapsed ? (
        sidebarToggleButton
      ) : (
        <>
          <header className="flex shrink-0 items-center justify-between border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight text-primary-700">
                <Link
                  className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  to="/"
                >
                  <img className="h-6 w-6 shrink-0" src={leavesLogoMark} alt="" />
                  Leaves
                </Link>
              </h1>
            </div>
            {sidebarToggleButton}
          </header>
          <div className="mt-4 shrink-0">
            <UserSearch />
          </div>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <ConversationList />
          </div>
          <nav className="mt-4 flex shrink-0 flex-wrap gap-2 border-t border-neutral-200 pt-4 [&>p]:w-full [&>p]:text-sm [&>p]:text-danger-700">
            <Link
              className="flex min-w-0 flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              to="/profile"
            >
              My profile
            </Link>
            <LogoutButton />
          </nav>
        </>
      )}
    </aside>
  );
}
