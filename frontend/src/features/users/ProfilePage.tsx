import { zodResolver } from "@hookform/resolvers/zod";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
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

const fieldWrapperClassName =
  "flex flex-col gap-2 [&>label]:text-sm [&>label]:font-medium [&>label]:text-neutral-700 [&>p]:text-sm [&>p]:text-danger-700";
const inputClassName =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 transition-colors focus-visible:border-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 aria-invalid:border-danger-500 aria-invalid:focus-visible:outline-danger-600";

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
  const navigate = useNavigate();
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
    return (
      <p className="px-8 py-10 text-sm text-neutral-500" role="status">
        Loading profile...
      </p>
    );
  }

  if (isError) {
    return (
      <div className="px-8 py-10 text-sm text-danger-700">
        <UserFacingErrorMessage error={error} fallbackMessage={USER_PROFILE_QUERY_ERROR_MESSAGE} />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-8 py-10 font-body"
      onSubmit={handleSubmit((input) => updateProfileMutation.mutate(input))}
    >
      <header className="flex items-center gap-3 pb-6">
        <Link
          aria-label="Close profile"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          to="."
          onClick={(event) => {
            event.preventDefault();
            navigate(-1);
          }}
        >
          ←
        </Link>
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-neutral-900">
          Profile
        </h2>
      </header>

      <div className={fieldWrapperClassName}>
        <FormField
          id="handle"
          type="text"
          label="Profile ID"
          error={errors.handle?.message}
          className={inputClassName}
          {...register("handle")}
        />
        <span className="text-sm text-neutral-500">Used in your @ID and profile URL.</span>
      </div>

      <div className={fieldWrapperClassName}>
        <FormField
          id="display-name"
          type="text"
          label="Display name"
          error={errors.displayName?.message}
          className={inputClassName}
          {...register("displayName")}
        />
      </div>

      <div className={fieldWrapperClassName}>
        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          className={`${inputClassName} min-h-32 resize-y`}
          aria-invalid={Boolean(errors.bio)}
          aria-describedby={errors.bio ? "bio-error" : undefined}
          {...register("bio")}
        />
        {errors.bio && (
          <p id="bio-error" role="alert">
            {errors.bio.message}
          </p>
        )}
      </div>

      <div className={fieldWrapperClassName}>
        <FormField
          id="profile-image"
          type="url"
          label="Profile image"
          className={inputClassName}
          {...register("profileImage")}
        />
      </div>

      <div className="flex flex-col items-start gap-4 pt-6">
        <button
          className="self-end rounded-md bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
          type="submit"
          disabled={updateProfileMutation.isPending}
        >
          Save profile
        </button>

        {updateProfileMutation.isSuccess && (
          <p
            className="w-full rounded-md border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700"
            role="status"
          >
            Profile updated
          </p>
        )}

        {updateProfileMutation.isError && (
          <p
            className="w-full rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
            role="alert"
          >
            {updateProfileMutation.error.message}
          </p>
        )}
      </div>
    </form>
  );
}
