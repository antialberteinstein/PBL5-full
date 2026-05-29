// REST client. baseURL is driven entirely by config.yaml — loadConfig()
// MUST resolve before any API call runs (App.jsx awaits it at boot).

import axios from "axios";
import { backendBaseUrl, getConfig } from "../config";
import { clearSession, getToken } from "../utils/auth";

let _api = null;
let _navRef = null;

export const setNavigationRef = (ref) => {
  _navRef = ref;
};

const buildClient = () => {
  const cfg = getConfig();
  const client = axios.create({
    baseURL: backendBaseUrl(),
    timeout: cfg.backend.timeoutMs ?? 10000,
  });

  client.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        await clearSession();
        if (_navRef?.isReady?.()) {
          _navRef.reset({ index: 0, routes: [{ name: "Login" }] });
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
};

const api = () => {
  if (!_api) _api = buildClient();
  return _api;
};

// ──────────────────────────────────────────────────────────────
// Endpoint groups — names mirror frontend/src/services/api.js
// ──────────────────────────────────────────────────────────────

export const authAPI = {
  login: (data) => api().post("/auth/login", data),
};

export const userAPI = {
  getProfile: () => api().get("/users/me"),
  updateMyProfile: (data) => api().put("/users/me/profile", data),
  changePassword: (data) => api().put("/users/me/password", data),
};

export const classAPI = {
  getMyClasses: () => api().get("/classes"),
  getClassById: (id) => api().get(`/classes/${id}`),
  getStudents: (classId) => api().get(`/classes/${classId}/students`),
};

export const studentAPI = {
  joinClass: (data) => api().post("/student-class/join", data),
  quitClass: (classId) => api().delete(`/student/quit/${classId}`),
  checkin: (data) => api().post("/attendance/checkin", data),
  markFaceRegistered: (registered = true) =>
    api().put("/student-class/face-registered", null, { params: { registered } }),
  getCurrentStudent: () => api().get("/student-class/me"),
  getMyJoinedClasses: () => api().get("/student-class/my-joined-classes"),
};

export const teacherAPI = {
  getMyClasses: () => api().get("/teacher-class/my-classes"),
};

export const attendanceAPI = {
  getAttendanceList: (classId, date) =>
    api().get(`/attendance/${classId}`, { params: { date } }),
  getAttendedStudents: (attendanceId) =>
    api().get(`/attendance/${attendanceId}/attended-students`),
  getAbsentStudents: (attendanceId) =>
    api().get(`/attendance/${attendanceId}/absent-students`),
};

export default api;
