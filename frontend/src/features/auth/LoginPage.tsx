import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { FormField } from "@/components/FormField.tsx";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { authMeQueryOptions } from "./authMeQuery.ts";
import { GENERAL_LOGIN_ERROR_MESSAGE, login } from "./login.ts";

const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(30, "Username must be at most 30 characters"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password must be at most 128 characters"),
});

type LoginInput = z.infer<typeof loginSchema>;

async function syncAuthAfterLogin(queryClient: QueryClient) {
  await queryClient.cancelQueries(
    { queryKey: authMeQueryOptions.queryKey, exact: true },
    { silent: true },
  );
  await queryClient.query(authMeQueryOptions);
}

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await syncAuthAfterLogin(queryClient);
      navigate("/");
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 font-body text-neutral-900">
      <form
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"
        onSubmit={handleSubmit((input) => loginMutation.mutate(input))}
      >
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-neutral-900">
          Log in
        </h1>

        <div className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2 [&>label]:text-sm [&>label]:font-medium [&>label]:text-neutral-700 [&>p]:text-sm [&>p]:text-danger-600">
            <FormField
              id="username"
              label="Username"
              type="text"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 transition outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 aria-invalid:border-danger-500 aria-invalid:focus:border-danger-500 aria-invalid:focus:ring-danger-100"
              error={errors.username?.message}
              {...register("username")}
            />
          </div>

          <div className="flex flex-col gap-2 [&>label]:text-sm [&>label]:font-medium [&>label]:text-neutral-700 [&>p]:text-sm [&>p]:text-danger-600">
            <FormField
              id="password"
              label="Password"
              type="password"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 transition outline-none placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 aria-invalid:border-danger-500 aria-invalid:focus:border-danger-500 aria-invalid:focus:ring-danger-100"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>
        </div>

        <button
          className="mt-6 w-full rounded-md bg-primary-500 px-4 py-2.5 font-body font-semibold text-white transition hover:bg-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:bg-primary-300"
          type="submit"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? "Logging in..." : "Log in"}
        </button>

        <Link
          className="mt-4 block text-center font-body text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          to="/register"
        >
          Register
        </Link>

        {loginMutation.isError && (
          <div className="mt-4 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 font-body text-sm text-danger-700 [&>p]:m-0">
            <UserFacingErrorMessage
              error={loginMutation.error}
              fallbackMessage={GENERAL_LOGIN_ERROR_MESSAGE}
            />
          </div>
        )}
      </form>
    </main>
  );
}
