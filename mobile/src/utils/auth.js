// AsyncStorage-backed session helpers (mobile mirror of frontend/src/utils/auth.js).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";

const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const USERNAME_KEY = "username";

export const normalizeRole = (raw) => {
  if (!raw) return "";
  const r = String(raw).toUpperCase();
  return r.startsWith("ROLE_") ? r.slice(5) : r;
};

export const getToken = async () => (await AsyncStorage.getItem(TOKEN_KEY)) || "";
export const getRole = async () => normalizeRole(await AsyncStorage.getItem(ROLE_KEY));
export const getUsername = async () => (await AsyncStorage.getItem(USERNAME_KEY)) || "";

const decodePayload = (token) => {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const padFix = padded + "===".slice((padded.length + 3) % 4);
    const json = Buffer.from(padFix, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;
  const payload = decodePayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 <= Date.now();
};

export const isAuthenticated = async () => {
  const token = await getToken();
  return Boolean(token) && !isTokenExpired(token);
};

export const saveSession = async ({ token, role, username }) => {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  if (role) await AsyncStorage.setItem(ROLE_KEY, normalizeRole(role));
  if (username) await AsyncStorage.setItem(USERNAME_KEY, username);
};

export const clearSession = async () => {
  await AsyncStorage.multiRemove([TOKEN_KEY, ROLE_KEY, USERNAME_KEY]);
};

export const homeRouteForRole = (role) => {
  const r = normalizeRole(role);
  if (r === "TEACHER" || r === "STUDENT") return "Dashboard";
  return "Login";
};
