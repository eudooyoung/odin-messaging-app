import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { MessagingLayout } from "./MessagingLayout.tsx";

vi.mock("@/features/auth/LogoutButton.tsx", () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}));

vi.mock("@/features/conversations/ConversationList.tsx", () => ({
  ConversationList: () => <p>Conversation list</p>,
}));

vi.mock("@/features/users/UserSearch.tsx", () => ({
  UserSearch: () => <input aria-label="Search users" type="search" />,
}));

describe("MessagingLayout", () => {
  it("collapses and expands the desktop sidebar", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MessagingLayout />
      </MemoryRouter>,
    );

    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    expect(screen.getByText("Conversation list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.queryByRole("searchbox", { name: "Search users" })).not.toBeInTheDocument();
    expect(screen.queryByText("Conversation list")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    expect(screen.getByText("Conversation list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});
