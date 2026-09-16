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
  username: z.string().min(1, "Username is required"),
  password: z.string().min(12, "Password must be at least 12 characters"),
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
    <form onSubmit={handleSubmit((input) => loginMutation.mutate(input))}>
      <FormField
        id="username"
        label="Username"
        type="text"
        error={errors.username?.message}
        {...register("username")}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        error={errors.password?.message}
        {...register("password")}
      />

      <button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "Logging in..." : "Log in"}
      </button>

      <Link to="/register">Register</Link>

      {loginMutation.isError && (
        <UserFacingErrorMessage
          error={loginMutation.error}
          fallbackMessage={GENERAL_LOGIN_ERROR_MESSAGE}
        />
      )}
    </form>
  );
}
