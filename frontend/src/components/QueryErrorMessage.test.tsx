import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { QueryErrorMessage } from "./QueryErrorMessage.tsx";

describe("QueryErrorMessage", () => {
  it("shows a user-facing error message in an alert", () => {
    const error = new UserFacingError("The requested resource is unavailable");

    render(<QueryErrorMessage error={error} fallbackMessage="Failed to load resource" />);

    expect(screen.getByRole("alert")).toHaveTextContent(error.message);
  });

  it("shows the fallback message in an alert for any other error", () => {
    const error = new TypeError("Failed to fetch");

    render(<QueryErrorMessage error={error} fallbackMessage="Failed to load resource" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to load resource");
    expect(alert).not.toHaveTextContent(error.message);
  });
});
