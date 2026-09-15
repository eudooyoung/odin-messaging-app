import { afterAll, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./apiFetch.ts";

const REFRESH_PATH = "/auth/refresh";
const PROTECTED_PATH = "/protected-resource";

const { apiUrl } = vi.hoisted(() => {
  const apiUrl = "http://localhost:3000";
  vi.stubEnv("VITE_API_URL", apiUrl);

  return { apiUrl };
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("apiFetch", () => {
  it("build the API URL and include credentials", async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
    const resourcePath = "/resource";

    const result = await apiFetch(resourcePath);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(`${apiUrl}${resourcePath}`, {
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

    const result = await apiFetch(PROTECTED_PATH);

    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual([
      `${apiUrl}${PROTECTED_PATH}`,
      `${apiUrl}${REFRESH_PATH}`,
      `${apiUrl}${PROTECTED_PATH}`,
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${apiUrl}${REFRESH_PATH}`, {
      method: "POST",
      credentials: "include",
    });
    expect(result).toBe(retryResponse);
  });

  describe("when the initial request returns 401", () => {
    it("does not attempt token refresh for a non-401 error response", async () => {
      const forbiddenResponse = new Response(null, { status: 403 });
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(forbiddenResponse);

      const result = await apiFetch(PROTECTED_PATH);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result).toBe(forbiddenResponse);
    });

    it("does not attempt token refresh for the refresh endpoint itself", async () => {
      const unauthorizedResponse = new Response(null, { status: 401 });
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(unauthorizedResponse);

      const result = await apiFetch(REFRESH_PATH, { method: "POST" });

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result).toBe(unauthorizedResponse);
    });

    it("shares only one refresh when different requests receive 401 concurrently", async () => {
      //#region Define request URLs and mock response state
      const firstResourceUrl = `${apiUrl}${PROTECTED_PATH}-1`;
      const secondResourceUrl = `${apiUrl}${PROTECTED_PATH}-2`;
      const refreshUrl = `${apiUrl}${REFRESH_PATH}`;
      const successfulResponses = new Map([
        [firstResourceUrl, new Response(null, { status: 200 })],
        [secondResourceUrl, new Response(null, { status: 200 })],
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

        const successfulResponse = successfulResponses.get(requestUrl);
        if (!successfulResponse) {
          return Promise.reject(new Error(`Unexpected request: ${requestUrl}`));
        }

        return Promise.resolve(successfulResponse);
      });
      //#endregion

      //#region Start both requests and verify they share one pending refresh
      const firstRequest = apiFetch(`${PROTECTED_PATH}-1`);
      const secondRequest = apiFetch(`${PROTECTED_PATH}-2`);

      await vi.waitFor(() => {
        const pendingRefreshCalls = fetchMock.mock.calls.filter(
          ([input]) => getRequestUrl(input) === refreshUrl,
        );

        expect(pendingRefreshCalls).toHaveLength(1);
      });
      //#endregion

      //#region Complete the refresh and verify both requests retry successfully
      resolveRefresh(new Response(null, { status: 204 }));
      const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);
      const refreshCalls = fetchMock.mock.calls.filter(
        ([input]) => getRequestUrl(input) === refreshUrl,
      );
      const firstCalls = fetchMock.mock.calls.filter(
        ([input]) => getRequestUrl(input) === firstResourceUrl,
      );
      const secondCalls = fetchMock.mock.calls.filter(
        ([input]) => getRequestUrl(input) === secondResourceUrl,
      );

      expect(refreshCalls).toHaveLength(1);
      expect(firstCalls).toHaveLength(2);
      expect(secondCalls).toHaveLength(2);
      expect(firstResponse).toBe(successfulResponses.get(firstResourceUrl));
      expect(secondResponse).toBe(successfulResponses.get(secondResourceUrl));
      //#endregion
    });

    it("returns the refresh failure when refresh fails with a non-401 status", async () => {
      const unauthorizedResponse = new Response(null, { status: 401 });
      const refreshResponse = new Response(null, { status: 500 });
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(unauthorizedResponse)
        .mockResolvedValueOnce(refreshResponse);

      const result = await apiFetch(PROTECTED_PATH);

      expect(fetchMock).toHaveBeenCalledTimes(2);

      expect(result).toBe(refreshResponse);
    });

    it("does not retry the initial request when refresh returns 401", async () => {
      const unauthorizedResponse = new Response(null, { status: 401 });
      const refreshResponse = new Response(null, { status: 401 });
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(unauthorizedResponse)
        .mockResolvedValueOnce(refreshResponse);

      const result = await apiFetch(PROTECTED_PATH);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toBe(unauthorizedResponse);
    });

    it("does not refresh again after the retried request returns 401", async () => {
      const firstUnauthorizedResponse = new Response(null, { status: 401 });
      const refreshResponse = new Response(null, { status: 204 });
      const retryUnauthorizedResponse = new Response(null, { status: 401 });
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(firstUnauthorizedResponse)
        .mockResolvedValueOnce(refreshResponse)
        .mockResolvedValueOnce(retryUnauthorizedResponse);

      const result = await apiFetch(PROTECTED_PATH);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(result).toBe(retryUnauthorizedResponse);
    });
  });
});
