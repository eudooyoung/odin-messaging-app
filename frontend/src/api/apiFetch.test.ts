import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "./apiFetch.ts";

describe("apiFetch", () => {
  it("forwards a request with included credentials and returns a non-401 response", async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    const result = await apiFetch("/users/me");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/users/me", {
      credentials: "include",
    });
    expect(result).toBe(response);
  });

  it("refreshes after a 401 response and retries the original request once", async () => {
    const unauthorizedResponse = new Response(null, { status: 401 });
    const refreshResponse = new Response(null, { status: 204 });
    const retryResponse = new Response(null, { status: 200 });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorizedResponse)
      .mockResolvedValueOnce(refreshResponse)
      .mockResolvedValueOnce(retryResponse);

    const result = await apiFetch("/conversations");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/conversations", {
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/conversations", {
      credentials: "include",
    });
    expect(result).toBe(retryResponse);
  });

  it("returns the original 401 response when refresh fails", async () => {
    const unauthorizedResponse = new Response(null, { status: 401 });
    const refreshResponse = new Response(null, { status: 401 });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(unauthorizedResponse)
      .mockResolvedValueOnce(refreshResponse);

    const result = await apiFetch("/conversations");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    expect(result).toBe(unauthorizedResponse);
  });

  it("does not refresh when the refresh request itself returns 401", async () => {
    const unauthorizedResponse = new Response(null, { status: 401 });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(unauthorizedResponse);

    const result = await apiFetch("/auth/refresh", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    expect(result).toBe(unauthorizedResponse);
  });

  it("does not refresh again when the retried request returns 401", async () => {
    const firstUnauthorizedResponse = new Response(null, { status: 401 });
    const refreshResponse = new Response(null, { status: 204 });
    const retryUnauthorizedResponse = new Response(null, { status: 401 });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(firstUnauthorizedResponse)
      .mockResolvedValueOnce(refreshResponse)
      .mockResolvedValueOnce(retryUnauthorizedResponse);

    const result = await apiFetch("/conversations");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/conversations", {
      credentials: "include",
    });
    expect(result).toBe(retryUnauthorizedResponse);
  });
});
