import { LoginPage } from "@/features/auth/LoginPage.tsx";
import { RegisterPage } from "@/features/auth/RegisterPage.tsx";
import { ConversationPage } from "@/features/conversations/ConversationPage.tsx";
import { ProfilePage } from "@/features/users/ProfilePage.tsx";
import { UserProfilePage } from "@/features/users/UserProfilePage.tsx";
import { createBrowserRouter } from "react-router";
import { GuestOnlyRoute } from "./GuestOnlyRoute.tsx";
import { MessagingLayout } from "./MessagingLayout.tsx";
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
            element: <p>Select a conversation</p>,
          },
          {
            path: "conversations/:conversationId",
            element: <ConversationPage />,
          },
          {
            path: "users/:username",
            element: <UserProfilePage />,
          },
        ],
      },
      {
        path: "/profile",
        element: <ProfilePage />,
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
];

export const router = createBrowserRouter(routes);
