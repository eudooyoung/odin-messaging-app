import { zodResolver } from "@hookform/resolvers/zod";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
import { FormField } from "@/components/FormField.tsx";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { authMeQueryOptions, type AuthUser } from "@/features/auth/authMeQuery.ts";
import {
  USER_PROFILE_QUERY_ERROR_MESSAGE,
  type UserProfile,
  userProfileQueryOptions,
} from "./userProfileQuery.ts";
import { updateUserProfile } from "./updateUserProfile.ts";

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be at most 50 characters"),
  bio: z.string().trim().max(300, "Bio must be at most 300 characters"),
  profileImage: z.string(),
});

type ProfileInput = z.infer<typeof profileSchema>;

const syncUpdatedProfileToCache = async (
  queryClient: QueryClient,
  username: string,
  updatedProfile: UserProfile,
) => {
  const profileQueryKey = userProfileQueryOptions(username).queryKey;

  await queryClient.cancelQueries({ queryKey: profileQueryKey, exact: true });
  await queryClient.cancelQueries({
    queryKey: authMeQueryOptions.queryKey,
    exact: true,
  });
  queryClient.setQueryData(profileQueryKey, updatedProfile);
  queryClient.setQueryData<AuthUser | null>(authMeQueryOptions.queryKey, (user) =>
    user ? { ...user, displayName: updatedProfile.displayName } : user,
  );
};

export function ProfilePage() {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<AuthUser>(authMeQueryOptions.queryKey);
  const username = currentUser?.username ?? "";
  const {
    data: profile,
    isPending,
    isError,
    error,
  } = useQuery({
    ...userProfileQueryOptions(username),
    enabled: username.length > 0,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    resetOptions: {
      keepDirtyValues: true,
    },
    values: {
      displayName: profile?.displayName ?? "",
      bio: profile?.bio ?? "",
      profileImage: profile?.profileImage ?? "",
    },
  });
  const updateProfileMutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      updateUserProfile({
        displayName: input.displayName,
        bio: input.bio || null,
        profileImage: input.profileImage || null,
      }),
    onSuccess: async (updatedProfile) => {
      await syncUpdatedProfileToCache(queryClient, username, updatedProfile);
      reset(
        {
          displayName: updatedProfile.displayName,
          bio: updatedProfile.bio ?? "",
          profileImage: updatedProfile.profileImage ?? "",
        },
        { keepDirtyValues: false },
      );
    },
  });

  if (isPending) {
    return <p role="status">Loading profile...</p>;
  }

  if (isError) {
    return (
      <UserFacingErrorMessage error={error} fallbackMessage={USER_PROFILE_QUERY_ERROR_MESSAGE} />
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit((input) => updateProfileMutation.mutate(input))}>
      <Link to="/">Back to conversations</Link>

      <FormField
        id="display-name"
        type="text"
        label="Display name"
        error={errors.displayName?.message}
        {...register("displayName")}
      />

      <label htmlFor="bio">Bio</label>
      <textarea
        id="bio"
        aria-invalid={Boolean(errors.bio)}
        aria-describedby={errors.bio ? "bio-error" : undefined}
        {...register("bio")}
      />
      {errors.bio && (
        <p id="bio-error" role="alert">
          {errors.bio.message}
        </p>
      )}

      <FormField
        id="profile-image"
        type="url"
        label="Profile image"
        {...register("profileImage")}
      />

      <button type="submit" disabled={updateProfileMutation.isPending}>
        Save profile
      </button>

      {updateProfileMutation.isSuccess && <p role="status">Profile updated</p>}

      {updateProfileMutation.isError && <p role="alert">{updateProfileMutation.error.message}</p>}
    </form>
  );
}
