const REFRESH_PATH = "/auth/refresh";

const isRefreshRequest = (input: string | Request | URL) => {
  const requestUrl = input instanceof Request ? input.url : input.toString();

  return new URL(requestUrl, window.location.origin).pathname === REFRESH_PATH;
};

const cloneRequestInput = (input: string | Request | URL) =>
  input instanceof Request ? input.clone() : input;

export const apiFetch = async (input: string | Request | URL, init: RequestInit = {}) => {
  const requestInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? "include",
  };
  const response = await fetch(cloneRequestInput(input), requestInit);

  if (response.status !== 401 || isRefreshRequest(input)) {
    return response;
  }

  const refreshResponse = await fetch(REFRESH_PATH, {
    method: "POST",
    credentials: "include",
  });

  if (!refreshResponse.ok) {
    return response;
  }

  return fetch(cloneRequestInput(input), requestInit);
};
