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
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 transition-colors focus-visible:border-primary-500 focus-visible:ring-1 focus-visible:ring-primary-200 focus-visible:outline-none aria-invalid:border-danger-500 aria-invalid:focus-visible:border-danger-500 aria-invalid:focus-visible:ring-danger-200";

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
      <p
        className="flex h-full items-center justify-center px-8 py-10 text-center font-body text-sm text-neutral-500"
        role="status"
      >
        Loading profile...
      </p>
    );
  }

  if (!isError && !profile) {
    return null;
  }

  return (
    <div className="flex min-h-full flex-col font-body">
      <header className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-18 w-full max-w-2xl items-center gap-3 px-8 py-4">
          <Link
            aria-label="Close profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            to="."
            onClick={(event) => {
              event.preventDefault();
              navigate(-1);
            }}
          >
            ×
          </Link>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-neutral-900">
            Profile
          </h2>
        </div>
      </header>
      {isError ? (
        <div className="flex flex-1 items-center justify-center px-8 py-10 text-center font-body text-sm text-danger-700">
          <UserFacingErrorMessage
            error={error}
            fallbackMessage={USER_PROFILE_QUERY_ERROR_MESSAGE}
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-10">
          <form
            className="flex flex-col gap-6 rounded-lg border border-primary-200 bg-primary-50 p-4 md:p-6"
            onSubmit={handleSubmit((input) => updateProfileMutation.mutate(input))}
          >
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
              <FormField
                as="textarea"
                id="bio"
                label="Bio"
                error={errors.bio?.message}
                className={`${inputClassName} min-h-32 resize-none`}
                {...register("bio")}
              />
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

            <div className="flex flex-col items-start gap-4 pt-2">
              <button
                className="self-start rounded-md bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
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
                <div className="w-full rounded-md border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                  <UserFacingErrorMessage
                    error={updateProfileMutation.error}
                    fallbackMessage="Failed to update profile"
                  />
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
