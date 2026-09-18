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
        className="flex min-w-0 flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:text-neutral-400"
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
