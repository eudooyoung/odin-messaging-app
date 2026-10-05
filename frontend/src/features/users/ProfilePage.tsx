import { zodResolver } from "@hookform/resolvers/zod";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
import { FormField } from "@/components/FormField.tsx";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { authMeQueryOptions } from "@/features/auth/authMeQuery.ts";
import type { AuthUser } from "@/features/auth/auth.type.ts";
import type { UpdatedUserProfile, UserProfile } from "./user.type.ts";
import { USER_PROFILE_QUERY_ERROR_MESSAGE, userProfileQueryOptions } from "./userProfileQuery.ts";
import { updateUserProfile } from "./updateUserProfile.ts";

const profileSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(
      /^[a-z0-9_.]+$/,
      "Handle can only contain lowercase letters, numbers, underscores, and periods",
    )
    .refine(
      (handle) => !handle.startsWith(".") && !handle.endsWith("."),
      "Handle cannot start or end with a period",
    )
    .refine((handle) => !handle.includes(".."), "Handle cannot contain consecutive periods"),
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
  previousHandle: string,
  updatedProfile: UpdatedUserProfile,
) => {
  const previousProfileQueryKey = userProfileQueryOptions(previousHandle).queryKey;
  const updatedProfileQueryKey = userProfileQueryOptions(updatedProfile.handle).queryKey;

  await queryClient.cancelQueries({ queryKey: previousProfileQueryKey, exact: true });
  await queryClient.cancelQueries({
    queryKey: authMeQueryOptions.queryKey,
    exact: true,
  });
  const currentUser = queryClient.getQueryData<AuthUser | null>(authMeQueryOptions.queryKey);
  if (!currentUser) {
    return;
  }

  const publicProfile: UserProfile = {
    id: currentUser.id,
    handle: updatedProfile.handle,
    displayName: updatedProfile.displayName,
    bio: updatedProfile.bio,
    profileImage: updatedProfile.profileImage,
  };
  queryClient.setQueryData(updatedProfileQueryKey, publicProfile);
  queryClient.setQueryData<AuthUser>(authMeQueryOptions.queryKey, {
    ...currentUser,
    handle: updatedProfile.handle,
    displayName: updatedProfile.displayName,
  });
};

export function ProfilePage() {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<AuthUser>(authMeQueryOptions.queryKey);
  const handle = currentUser?.handle ?? "";
  const {
    data: profile,
    isPending,
    isError,
    error,
  } = useQuery({
    ...userProfileQueryOptions(handle),
    enabled: handle.length > 0,
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
      handle: profile?.handle ?? "",
      displayName: profile?.displayName ?? "",
      bio: profile?.bio ?? "",
      profileImage: profile?.profileImage ?? "",
    },
  });
  const updateProfileMutation = useMutation({
    mutationFn: (input: ProfileInput) =>
      updateUserProfile({
        handle: input.handle,
        displayName: input.displayName,
        bio: input.bio || null,
        profileImage: input.profileImage || null,
      }),
    onSuccess: async (updatedProfile) => {
      await syncUpdatedProfileToCache(queryClient, handle, updatedProfile);
      reset(
        {
          handle: updatedProfile.handle,
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
      <Link aria-label="Close profile" to="/">
        ←
      </Link>

      <FormField
        id="handle"
        type="text"
        label="Handle"
        error={errors.handle?.message}
        {...register("handle")}
      />

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
