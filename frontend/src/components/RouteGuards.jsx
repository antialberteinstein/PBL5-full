import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  isAuthenticated,
  getRole,
  homePathForRole,
  clearSession,
} from "../utils/auth.js";

export const RequireAuth = ({ children }) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    clearSession();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export const RequireRole = ({ allow = [], children }) => {
  if (!isAuthenticated()) {
    clearSession();
    return <Navigate to="/login" replace />;
  }
  const role = getRole();
  const allowed = allow.map((r) => r.toUpperCase());
  if (allowed.includes(role)) return children;

  if (role === "ADMIN") return <Navigate to="/admin" replace />;

  return <Navigate to="/403" replace />;
};

export const RedirectIfAuthed = ({ children }) => {
  if (isAuthenticated()) {
    return <Navigate to={homePathForRole(getRole())} replace />;
  }
  return children;
};
