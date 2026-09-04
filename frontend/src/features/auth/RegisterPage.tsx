import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { apiFetch } from "@/api/apiFetch.ts";

const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  displayName: z.string().min(1, "Display name is required"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

type RegisterInput = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });
  const navigate = useNavigate();
  const registerMutation = useMutation({
    mutationFn: async (input: RegisterInput) => {
      let response: Response;

      try {
        response = await apiFetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
      } catch {
        throw new Error("Something went wrong. Please try again.");
      }

      if (response.status === 409) {
        throw new Error("Username already exists");
      }

      if (response.status !== 201) {
        throw new Error("Something went wrong. Please try again.");
      }

      return response;
    },
    onSuccess: () => {
      navigate("/login");
    },
  });

  return (
    <form onSubmit={handleSubmit((input) => registerMutation.mutate(input))}>
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

      <button type="submit" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? "Registering..." : "Register"}
      </button>

      {registerMutation.isError && <p role="alert">{registerMutation.error.message}</p>}
    </form>
  );
}
