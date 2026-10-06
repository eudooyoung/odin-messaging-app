import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 py-10 text-center font-body text-neutral-900">
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <Link
        className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        to="/"
      >
        Go home
      </Link>
    </main>
  );
}
