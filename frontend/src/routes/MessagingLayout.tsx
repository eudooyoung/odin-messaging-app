import { Outlet, useMatch } from "react-router";
import { MessagingSidebar } from "./MessagingSidebar.tsx";

export function MessagingLayout() {
  const isHomeRoute = useMatch({ path: "/", end: true }) !== null;

  return (
    <main className="flex h-dvh min-h-0 overflow-hidden bg-white font-body text-neutral-900">
      <MessagingSidebar isHomeRoute={isHomeRoute} />
      <section
        className={`h-full min-h-0 min-w-0 flex-1 overflow-y-auto ${isHomeRoute ? "hidden md:block" : "block"}`}
      >
        <Outlet />
      </section>
    </main>
  );
}
