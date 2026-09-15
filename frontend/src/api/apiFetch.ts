const REFRESH_PATH = "/auth/refresh";
const API_URL = import.meta.env.VITE_API_URL;
let pendingRefresh: Promise<Response> | undefined;

const refreshAccessToken = () => {
  pendingRefresh ??= fetch(`${API_URL}${REFRESH_PATH}`, {
    method: "POST",
    credentials: "include",
  }).finally(() => {
    pendingRefresh = undefined;
  });

  return pendingRefresh;
};

export const apiFetch = async (path: string, init: RequestInit = {}) => {
  const requestUrl = `${API_URL}${path}`;
  const requestInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? "include",
  };
  const response = await fetch(requestUrl, requestInit);

  if (response.status !== 401 || path === REFRESH_PATH) {
    return response;
  }

  const refreshResponse = await refreshAccessToken();

  if (!refreshResponse.ok) {
    if (refreshResponse.status !== 401) {
      return refreshResponse;
    }
    return response;
  }

  return fetch(requestUrl, requestInit);
};
