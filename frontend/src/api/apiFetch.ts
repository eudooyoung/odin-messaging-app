const REFRESH_PATH = "/auth/refresh";
const API_URL = import.meta.env.VITE_API_URL;

const resolveRequestInput = (input: string | Request | URL) => {
  if (typeof input !== "string") {
    return input;
  }

  return new URL(input, API_URL).toString();
};

const isRefreshRequest = (input: string | Request | URL) => {
  const requestUrl = input instanceof Request ? input.url : input.toString();

  return new URL(requestUrl, window.location.origin).pathname === REFRESH_PATH;
};

const cloneRequestInput = (input: string | Request | URL) =>
  input instanceof Request ? input.clone() : input;

export const apiFetch = async (input: string | Request | URL, init: RequestInit = {}) => {
  const resolvedInput = resolveRequestInput(input);
  const requestInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? "include",
  };
  const response = await fetch(cloneRequestInput(resolvedInput), requestInit);

  if (response.status !== 401 || isRefreshRequest(resolvedInput)) {
    return response;
  }

  const refreshResponse = await fetch(resolveRequestInput(REFRESH_PATH), {
    method: "POST",
    credentials: "include",
  });

  if (!refreshResponse.ok) {
    return response;
  }

  return fetch(cloneRequestInput(resolvedInput), requestInit);
};
