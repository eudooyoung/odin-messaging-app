import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { logout } from "./logout.ts";

export function LogoutButton() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  return (
    <>
      <button
        type="button"
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
      >
        Log out
      </button>
      {logoutMutation.isError && <p role="alert">{logoutMutation.error.message}</p>}
    </>
  );
}
