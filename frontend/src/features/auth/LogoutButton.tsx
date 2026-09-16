import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { UserFacingErrorMessage } from "@/components/UserFacingErrorMessage.tsx";
import { GENERAL_LOGOUT_ERROR_MESSAGE, logout } from "./logout.ts";

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
      {logoutMutation.isError && (
        <UserFacingErrorMessage
          error={logoutMutation.error}
          fallbackMessage={GENERAL_LOGOUT_ERROR_MESSAGE}
        />
      )}
    </>
  );
}
