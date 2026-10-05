export type PublicUserIdentity = {
  id: number;
  handle: string;
  displayName: string;
  profileImage: string | null;
};

export type UserSearchResult = {
  handle: string;
  displayName: string;
  profileImage: string | null;
};

export type UserProfile = {
  id: number;
  handle: string;
  displayName: string;
  bio: string | null;
  profileImage: string | null;
};

export type UpdateUserProfileInput = {
  handle?: string;
  displayName?: string;
  bio?: string | null;
  profileImage?: string | null;
};

export type UpdatedUserProfile = {
  username: string;
  handle: string;
  displayName: string;
  bio: string | null;
  profileImage: string | null;
};
