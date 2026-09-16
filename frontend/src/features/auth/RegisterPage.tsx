import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { FormField } from "@/components/FormField.tsx";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { GENERAL_REGISTER_ERROR_MESSAGE, registerUser } from "./registerUser.ts";

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
    mutationFn: registerUser,
    onSuccess: () => {
      navigate("/login");
    },
  });

  return (
    <form onSubmit={handleSubmit((input) => registerMutation.mutate(input))}>
      <FormField
        id="username"
        label="Username"
        type="text"
        error={errors.username?.message}
        {...register("username")}
      />

      <FormField
        id="display-name"
        label="Display name"
        type="text"
        error={errors.displayName?.message}
        {...register("displayName")}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        error={errors.password?.message}
        {...register("password")}
      />

      <button type="submit" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? "Registering..." : "Register"}
      </button>

      <Link to="/login">Log in</Link>

      {registerMutation.isError && (
        <UserFacingErrorMessage
          error={registerMutation.error}
          fallbackMessage={GENERAL_REGISTER_ERROR_MESSAGE}
        />
      )}
    </form>
  );
}
