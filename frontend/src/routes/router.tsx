import { LoginPage } from "@/features/auth/LoginPage.tsx";
import { RegisterPage } from "@/features/auth/RegisterPage.tsx";
import { ConversationList } from "@/features/conversations/ConversationList.tsx";
import { ConversationPage } from "@/features/conversations/ConversationPage.tsx";
import { UserSearch } from "@/features/users/UserSearch.tsx";
import { createBrowserRouter } from "react-router";
import { GuestOnlyRoute } from "./GuestOnlyRoute.tsx";
import { ProtectedRoute } from "./ProtectedRoute.tsx";

const routes = [
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: (
          <>
            <UserSearch />
            <ConversationList />
          </>
        ),
      },
      {
        path: "/conversations/:conversationId",
        element: <ConversationPage />,
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
