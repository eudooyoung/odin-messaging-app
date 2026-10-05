export function ConversationEmptyState() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 py-10 text-center">
      <svg
        aria-hidden="true"
        className="mb-2 h-10 w-10 text-neutral-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
      </svg>
      <h2 className="font-heading text-xl font-semibold tracking-tight text-neutral-700">
        Select a conversation
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-neutral-500">
        Choose a conversation from the sidebar or search for someone to start chatting.
      </p>
    </div>
  );
}
