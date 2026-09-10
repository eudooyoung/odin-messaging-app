import { type Query, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { handleWebSocketMessage } from "./handleWebSocketMessage.ts";
import { authMeQueryOptions } from "../auth/authMeQuery";

const getWebSocketUrl = () => {
  const webSocketUrl = new URL(import.meta.env.VITE_API_URL);
  webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";

  return webSocketUrl.toString();
};

const messagesQueryFilter = (query: Query) => {
  const { queryKey } = query;
  return (
    queryKey.length === 3 &&
    queryKey[0] === "conversations" &&
    typeof queryKey[1] === "number" &&
    queryKey[2] === "messages"
  );
};

const createWebSocketConnection = (
  queryClient: QueryClient,
  onUnexpectedClose: () => void | Promise<void>,
) => {
  const webSocket = new WebSocket(getWebSocketUrl());
  let isConnectionActive = true;

  const handleOpen = async () => {
    const pendingInitialMessagesQueryKeys = queryClient
      .getQueryCache()
      .findAll({
        predicate: messagesQueryFilter,
      })
      .filter(({ state }) => state.fetchStatus === "fetching" && state.data === undefined)
      .map(({ queryKey }) => queryKey);

    await queryClient.refetchQueries({
      predicate: messagesQueryFilter,
    });

    if (!isConnectionActive) {
      return;
    }

    await Promise.all(
      pendingInitialMessagesQueryKeys.map((queryKey) =>
        queryClient.refetchQueries({ queryKey, exact: true }),
      ),
    );
  };

  const handleMessage = (event: MessageEvent<string>) => {
    handleWebSocketMessage(queryClient, event);
  };

  const removeListeners = () => {
    webSocket.removeEventListener("open", handleOpen);
    webSocket.removeEventListener("message", handleMessage);
    webSocket.removeEventListener("close", handleClose);
  };

  const handleClose = () => {
    isConnectionActive = false;
    removeListeners();
    void onUnexpectedClose();
  };

  webSocket.addEventListener("open", handleOpen);
  webSocket.addEventListener("message", handleMessage);
  webSocket.addEventListener("close", handleClose);

  return () => {
    isConnectionActive = false;
    removeListeners();
    webSocket.close();
  };
};

const AUTH_RECOVERY_RETRY_DELAYS_MS = 1000;

export const AuthenticatedWebSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let shouldReconnect = true;
    let authRecoveryRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let disconnectCurrentConnection: () => void = () => undefined;

    const recoverAuthAndReconnect = async () => {
      try {
        const currentUser = await queryClient.query(authMeQueryOptions);

        if (!currentUser || !shouldReconnect) {
          return;
        }

        startConnection();
      } catch {
        if (!shouldReconnect) {
          return;
        }

        authRecoveryRetryTimer = setTimeout(() => {
          authRecoveryRetryTimer = undefined;
          void recoverAuthAndReconnect();
        }, AUTH_RECOVERY_RETRY_DELAYS_MS);
      }
    };

    const startConnection = () => {
      disconnectCurrentConnection = createWebSocketConnection(queryClient, () => {
        void recoverAuthAndReconnect();
      });
    };

    startConnection();

    return () => {
      shouldReconnect = false;
      if (authRecoveryRetryTimer !== undefined) {
        clearTimeout(authRecoveryRetryTimer);
      }
      disconnectCurrentConnection();
    };
  }, [queryClient]);

  return null;
};
