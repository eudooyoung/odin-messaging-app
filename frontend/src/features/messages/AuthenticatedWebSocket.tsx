import { type Query, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { handleWebSocketMessage } from "./handleWebSocketMessage.ts";
import { authMeQueryOptions } from "../auth/authMeQuery";

const getWebSocketUrl = () => {
  const apiUrl = new URL(import.meta.env.VITE_API_URL);
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return apiUrl.toString();
};

const isMessagesQuery = (query: Query) => {
  const { queryKey } = query;
  return (
    queryKey.length === 3 &&
    queryKey[0] === "conversations" &&
    typeof queryKey[1] === "number" &&
    queryKey[2] === "messages"
  );
};

const isMessageQueryPendingAtWebSocketOpen = (query: Query) => {
  const { state } = query;
  return state.fetchStatus === "fetching" && state.data === undefined;
};

const createWebSocketConnection = (
  queryClient: QueryClient,
  onUnexpectedClose: () => void | Promise<void>,
) => {
  const webSocket = new WebSocket(getWebSocketUrl());
  let isConnectionActive = true;

  const handleWebSocketOpen = async () => {
    const messageQueryKeysPendingAtWebSocketOpen = queryClient
      .getQueryCache()
      .findAll({ predicate: isMessagesQuery })
      .filter(isMessageQueryPendingAtWebSocketOpen)
      .map(({ queryKey }) => queryKey);

    await queryClient.refetchQueries({
      predicate: isMessagesQuery,
    });

    if (!isConnectionActive) {
      return;
    }

    await Promise.all(
      messageQueryKeysPendingAtWebSocketOpen.map((queryKey) =>
        queryClient.refetchQueries({ queryKey, exact: true }),
      ),
    );
  };

  const handleMessage = (event: MessageEvent<string>) => {
    handleWebSocketMessage(queryClient, event);
  };

  const handleWebSocketClose = () => {
    isConnectionActive = false;
    removeWebSocketListeners();
    void onUnexpectedClose();
  };

  const removeWebSocketListeners = () => {
    webSocket.removeEventListener("open", handleWebSocketOpen);
    webSocket.removeEventListener("message", handleMessage);
    webSocket.removeEventListener("close", handleWebSocketClose);
  };

  webSocket.addEventListener("open", handleWebSocketOpen);
  webSocket.addEventListener("message", handleMessage);
  webSocket.addEventListener("close", handleWebSocketClose);

  return () => {
    isConnectionActive = false;
    removeWebSocketListeners();
    webSocket.close();
  };
};

const AUTH_RECOVERY_RETRY_DELAY_MS = 1000;

export const AuthenticatedWebSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let shouldReconnect = true;
    let authRecoveryRetryTimerId: number | undefined;
    let disconnectCurrentConnection: () => void = () => undefined;

    const startConnection = () => {
      disconnectCurrentConnection = createWebSocketConnection(queryClient, () => {
        void recoverAuthAndReconnect();
      });
    };

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

        authRecoveryRetryTimerId = setTimeout(() => {
          authRecoveryRetryTimerId = undefined;
          void recoverAuthAndReconnect();
        }, AUTH_RECOVERY_RETRY_DELAY_MS);
      }
    };

    startConnection();

    return () => {
      shouldReconnect = false;
      if (authRecoveryRetryTimerId !== undefined) {
        clearTimeout(authRecoveryRetryTimerId);
      }
      disconnectCurrentConnection();
    };
  }, [queryClient]);

  return null;
};
