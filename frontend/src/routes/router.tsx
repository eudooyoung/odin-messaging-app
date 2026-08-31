import App from "@/App.tsx";
import { createBrowserRouter } from "react-router";

const routes = [
  {
    path: "/",
    element: <App />,
  },
];

export const router = createBrowserRouter(routes);
