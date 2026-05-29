// Centralized auth helpers: token storage, role normalization, expiry check, logout.

const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const USERNAME_KEY = "username";

export const normalizeRole = (raw) => {
  if (!raw) return "";
  const r = String(raw).toUpperCase();
  return r.startsWith("ROLE_") ? r.slice(5) : r;
};

export const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const getRole = () => normalizeRole(localStorage.getItem(ROLE_KEY));
export const getUsername = () => localStorage.getItem(USERNAME_KEY) || "";

// Decode JWT payload without verifying signature (only used for client-side
// expiry hint; the backend is the real source of truth).
const decodePayload = (token) => {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "===".slice((padded.length + 3) % 4));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token = getToken()) => {
  if (!token) return true;
  const payload = decodePayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 <= Date.now();
};

export const isAuthenticated = () => {
  const token = getToken();
  return Boolean(token) && !isTokenExpired(token);
};

export const saveSession = ({ token, role, username }) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (role) localStorage.setItem(ROLE_KEY, normalizeRole(role));
  if (username) localStorage.setItem(USERNAME_KEY, username);
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USERNAME_KEY);
};

export const logout = (navigate) => {
  localStorage.clear();
  if (navigate) {
    navigate("/login", { replace: true });
  } else {
    window.location.href = "/login";
  }
};

export const homePathForRole = (role) => {
  const r = normalizeRole(role);
  if (r === "ADMIN") return "/admin";
  if (r === "TEACHER" || r === "STUDENT") return "/dashboard";
  return "/login";
};
