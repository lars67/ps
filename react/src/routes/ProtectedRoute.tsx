import React, { ComponentType } from "react";
import { Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { useAppSelector } from "../store/useAppSelector";

const ProtectedRoutes = () => {
  const token = useAppSelector((state) => state.user.token);
  const isAuthenticated = !!token;
  const location = useLocation();
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location }} replace />
  );
};

export default ProtectedRoutes;
