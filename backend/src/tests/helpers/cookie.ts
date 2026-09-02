export const getSetCookie = (cookies: string[] | undefined, name: string) => {
  const cookie = cookies?.find((candidate) => candidate.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`${name} cookie was not set`);
  }

  return cookie;
};

export const getCookiePair = (cookie: string) => {
  const separatorIndex = cookie.indexOf(";");

  return separatorIndex === -1 ? cookie : cookie.slice(0, separatorIndex);
};

export const getCookieValue = (cookiePair: string) =>
  cookiePair.slice(cookiePair.indexOf("=") + 1);
