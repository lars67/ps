import { createBrowserRouter, useLocation } from "react-router-dom";
import { Home, Console, ErrorPage, SignInPage } from "../pages";
import { DashboardLayout, GuestLayout } from "../layouts";

import React, { ReactNode, useEffect } from "react";
import ProtectedRoute from "./ProtectedRoute";

export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    }); // Scroll to the top when the location changes
  }, [pathname]);

  return null; // This component doesn't render anything
};

type PageProps = {
  children: ReactNode;
};

// Create an HOC to wrap your route components with ScrollToTop
const PageWrapper = ({ children }: PageProps) => {
  return (
    <>
      <ScrollToTop />
      {children}
    </>
  );
};

// Create the router
const router = createBrowserRouter([
  {
    path: "login",
    element: <SignInPage />,
  },

  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <PageWrapper children={<GuestLayout />} />,
        errorElement: <ErrorPage />,
        children: [
          {
            index: true,
            path: "",
            element: <Home />,
          },
        ],
      },
      {
        path: "/console",
        element: <PageWrapper children={<DashboardLayout />} />,
        errorElement: <ErrorPage />,
        children: [
          {
            index: true,
            path: "",
            element: <Console />,
          },
        ],
      },
    ],
  },
]);

export default router;
