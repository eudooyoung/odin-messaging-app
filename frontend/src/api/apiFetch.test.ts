import { afterAll, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./apiFetch.ts";

const { apiUrl } = vi.hoisted(() => {
  const apiUrl = "http://localhost:3000";
  vi.stubEnv("VITE_API_URL", apiUrl);

  return { apiUrl };
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("apiFetch", () => {
  it("resolves a relative path against VITE_API_URL and includes credentials", async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    const result = await apiFetch("/users/me");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/users/me`, {
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
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${apiUrl}/conversations`, {
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${apiUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${apiUrl}/conversations`, {
      credentials: "include",
    });
    expect(result).toBe(retryResponse);
  });

  it("shares one refresh when different requests receive 401 concurrently", async () => {
    const conversationsUrl = `${apiUrl}/conversations`;
    const userProfileUrl = `${apiUrl}/users/current-user`;
    const refreshUrl = `${apiUrl}/auth/refresh`;
    const retryResponses = new Map([
      [conversationsUrl, new Response(null, { status: 200 })],
      [userProfileUrl, new Response(null, { status: 200 })],
    ]);
    const requestAttempts = new Map<string, number>();
    let resolveRefresh: (response: Response) => void = () => undefined;
    const pendingRefreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const getRequestUrl = (input: string | URL | Request) =>
      input instanceof Request ? input.url : input.toString();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const requestUrl = getRequestUrl(input);

      if (requestUrl === refreshUrl) {
        return pendingRefreshResponse;
      }

      const attempt = (requestAttempts.get(requestUrl) ?? 0) + 1;
      requestAttempts.set(requestUrl, attempt);

      if (attempt === 1) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }

      const retryResponse = retryResponses.get(requestUrl);
      if (!retryResponse) {
        return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
      }

      return Promise.resolve(retryResponse);
    });

    const conversationsRequest = apiFetch("/conversations");
    const userProfileRequest = apiFetch("/users/current-user");

    await Promise.resolve();
    const refreshCallCountBeforeResolution = fetchMock.mock.calls.filter(
      ([input]) => getRequestUrl(input) === refreshUrl,
    ).length;
    resolveRefresh(new Response(null, { status: 204 }));

    const [conversationsResponse, userProfileResponse] = await Promise.all([
      conversationsRequest,
      userProfileRequest,
    ]);

    expect(refreshCallCountBeforeResolution).toBe(1);
    expect(
      fetchMock.mock.calls.filter(([input]) => getRequestUrl(input) === refreshUrl),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([input]) => getRequestUrl(input) === conversationsUrl),
    ).toHaveLength(2);
    expect(
      fetchMock.mock.calls.filter(([input]) => getRequestUrl(input) === userProfileUrl),
    ).toHaveLength(2);
    expect(conversationsResponse).toBe(retryResponses.get(conversationsUrl));
    expect(userProfileResponse).toBe(retryResponses.get(userProfileUrl));
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
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${apiUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    expect(result).toBe(unauthorizedResponse);
  });

  it("does not refresh when the refresh request itself returns 401", async () => {
    const unauthorizedResponse = new Response(null, { status: 401 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(unauthorizedResponse);

    const result = await apiFetch("/auth/refresh", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}/auth/refresh`, {
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
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${apiUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, `${apiUrl}/conversations`, {
      credentials: "include",
    });
    expect(result).toBe(retryUnauthorizedResponse);
  });

  it("preserves an absolute URL input", async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const absoluteUrl = "https://example.com/users/me";

    const result = await apiFetch(absoluteUrl);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(absoluteUrl, {
      credentials: "include",
    });
    expect(result).toBe(response);
  });

  it("preserves a Request input", async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const request = new Request("https://example.com/users/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Updated User" }),
    });

    const result = await apiFetch(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    const forwardedRequest = fetchMock.mock.calls[0]?.[0];
    expect(forwardedRequest).toBeInstanceOf(Request);
    expect((forwardedRequest as Request).url).toBe(request.url);
    expect((forwardedRequest as Request).method).toBe(request.method);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ credentials: "include" });
    expect(result).toBe(response);
  });
});
