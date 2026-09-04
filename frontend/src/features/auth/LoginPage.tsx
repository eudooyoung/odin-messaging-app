import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { UserFacingError } from "@/api/UserFacingError.ts";
import { authMeQueryOptions } from "./authMeQuery.ts";
import { GENERAL_LOGIN_ERROR_MESSAGE, login } from "./login.ts";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

type LoginInput = z.infer<typeof loginSchema>;

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
      await queryClient.query(authMeQueryOptions);
      navigate("/");
    },
  });

  return (
    <form onSubmit={handleSubmit((input) => loginMutation.mutate(input))}>
      <label htmlFor="username">Username</label>
      <input
        id="username"
        type="text"
        aria-invalid={Boolean(errors.username)}
        aria-describedby={errors.username ? "username-error" : undefined}
        {...register("username")}
      />
      {errors.username && (
        <p id="username-error" role="alert">
          {errors.username.message}
        </p>
      )}

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        aria-invalid={Boolean(errors.password)}
        aria-describedby={errors.password ? "password-error" : undefined}
        {...register("password")}
      />
      {errors.password && (
        <p id="password-error" role="alert">
          {errors.password.message}
        </p>
      )}

      <button type="submit" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "Logging in..." : "Log in"}
      </button>

      {loginMutation.isError && (
        <p role="alert">
          {loginMutation.error instanceof UserFacingError
            ? loginMutation.error.message
            : GENERAL_LOGIN_ERROR_MESSAGE}
        </p>
      )}
    </form>
  );
}
