import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "@/components/FormField.tsx";

describe("FormField", () => {
  it("renders a labeled input with its native props when there is no error", () => {
    render(<FormField id="username" label="Username" type="text" name="username" />);

    const input = screen.getByRole("textbox", { name: "Username" });
    expect(input).toHaveAttribute("id", "username");
    expect(input).toHaveAttribute("name", "username");
    expect(input).toHaveAttribute("type", "text");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("connects the invalid input to its validation error", () => {
    render(
      <FormField id="username" label="Username" name="username" error="Username is required" />,
    );

    const input = screen.getByRole("textbox", { name: "Username" });
    const alert = screen.getByRole("alert");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "username-error");
    expect(alert).toHaveAttribute("id", "username-error");
    expect(alert).toHaveTextContent("Username is required");
  });
});
