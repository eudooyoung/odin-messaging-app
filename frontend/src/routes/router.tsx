import { LoginPage } from "@/features/auth/LoginPage.tsx";
import { RegisterPage } from "@/features/auth/RegisterPage.tsx";
import { ConversationEmptyState } from "@/features/conversations/ConversationEmptyState.tsx";
import { ConversationPage } from "@/features/conversations/ConversationPage.tsx";
import { ProfilePage } from "@/features/users/ProfilePage.tsx";
import { UserProfilePage } from "@/features/users/UserProfilePage.tsx";
import { createBrowserRouter } from "react-router";
import { GuestOnlyRoute } from "./GuestOnlyRoute.tsx";
import { MessagingLayout } from "./MessagingLayout.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";
import { ProtectedRoute } from "./ProtectedRoute.tsx";

const routes = [
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MessagingLayout />,
        children: [
          {
            index: true,
            element: <ConversationEmptyState />,
          },
          {
            path: "conversations/:conversationId",
            element: <ConversationPage />,
          },
          {
            path: "users/:handle",
            element: <UserProfilePage />,
          },
          {
            path: "profile",
            element: <ProfilePage />,
          },
        ],
      },
    ],
  },
  {
    element: <GuestOnlyRoute />,
    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
];

export const router = createBrowserRouter(routes);
