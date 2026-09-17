import { LogoutButton } from "@/features/auth/LogoutButton.tsx";
import { ConversationList } from "@/features/conversations/ConversationList.tsx";
import { UserSearch } from "@/features/users/UserSearch.tsx";
import { Link, Outlet } from "react-router";

export function MessagingLayout() {
  return (
    <main className="flex h-dvh min-h-0 overflow-hidden bg-white font-body text-neutral-900">
      <aside className="flex min-h-0 w-80 shrink-0 flex-col gap-6 overflow-y-auto border-r border-neutral-200 bg-neutral-50 p-6">
        <UserSearch />
        <ConversationList />
        <nav className="mt-auto flex shrink-0 items-center gap-4">
          <Link to="/profile">My profile</Link>
          <LogoutButton />
        </nav>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </section>
    </main>
  );
}
