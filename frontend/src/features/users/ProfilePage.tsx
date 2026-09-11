import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  authMeQueryOptions,
  type AuthUser,
} from "@/features/auth/authMeQuery.ts";
import { userProfileQueryOptions } from "./userProfileQuery.ts";
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

export function ProfilePage() {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<AuthUser>(authMeQueryOptions.queryKey);
  const username = currentUser?.username ?? "";
  const { data: profile, isPending, isError, error } = useQuery({
    ...userProfileQueryOptions(username),
    enabled: username.length > 0,
  });
  const {
    register,
    handleSubmit,
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
        ...input,
        bio: input.bio === "" ? null : input.bio,
        profileImage: input.profileImage === "" ? null : input.profileImage,
      }),
    onSuccess: async (updatedProfile) => {
      const profileQueryKey = userProfileQueryOptions(username).queryKey;

      await queryClient.cancelQueries({ queryKey: profileQueryKey, exact: true });
      await queryClient.cancelQueries({
        queryKey: authMeQueryOptions.queryKey,
        exact: true,
      });
      queryClient.setQueryData(profileQueryKey, updatedProfile);
      queryClient.setQueryData<AuthUser | null>(
        authMeQueryOptions.queryKey,
        (user) =>
          user
            ? { ...user, displayName: updatedProfile.displayName }
            : user,
      );
    },
  });

  if (isPending) {
    return <p role="status">Loading profile...</p>;
  }

  if (isError) {
    return <p role="alert">{error.message}</p>;
  }

  if (!profile) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit((input) => updateProfileMutation.mutate(input))}>
      <label htmlFor="display-name">Display name</label>
      <input
        id="display-name"
        type="text"
        aria-invalid={Boolean(errors.displayName)}
        aria-describedby={errors.displayName ? "display-name-error" : undefined}
        {...register("displayName")}
      />
      {errors.displayName && (
        <p id="display-name-error" role="alert">
          {errors.displayName.message}
        </p>
      )}

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

      <label htmlFor="profile-image">Profile image</label>
      <input id="profile-image" type="url" {...register("profileImage")} />

      <button type="submit" disabled={updateProfileMutation.isPending}>
        Save profile
      </button>

      {updateProfileMutation.isSuccess && <p role="status">Profile updated</p>}

      {updateProfileMutation.isError && (
        <p role="alert">{updateProfileMutation.error.message}</p>
      )}
    </form>
  );
}
