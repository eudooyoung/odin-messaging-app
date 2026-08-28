import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import "@testing-library/user-event";

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
