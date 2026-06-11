import axios from "axios";
import { getToken, clearSession } from "../utils/auth.js";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  timeout: 10000,
});

// Base URL for backend WebSocket endpoints (ws:// or wss://)
export const backendWsBase = (() => {
  const base = import.meta.env.VITE_BACKEND_BASE || "http://localhost:8080";
  return base.replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://").replace(/\/$/, "");
})();

// ─── Interceptor: tự động gắn Bearer token ───────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor: xử lý 401 / 403 / 5xx ─────────────────────────────────────
// 401 = không có / hết hạn token  → wipe session + về /login
// 403 = có token nhưng sai quyền  → giữ session, redirect tới /403
// 5xx = lỗi server                → redirect /500 (chỉ khi đang ở route nội bộ)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const path = window.location.pathname;
    const errorRoutes = ["/login", "/401", "/403", "/404", "/500"];

    if (status === 401) {
      if (!errorRoutes.includes(path)) {
        clearSession();
        window.location.href = "/login";
      }
    } else if (status === 403) {
      if (!errorRoutes.includes(path)) {
        window.location.href = "/403";
      }
    } else if (status >= 500 && status < 600) {
      if (!errorRoutes.includes(path)) {
        window.location.href = "/500";
      }
    }
    return Promise.reject(error);
  },
);

// ════════════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  login: (data) => api.post("/auth/login", data),
};

// ════════════════════════════════════════════════════════════════════════════
// USER / PROFILE
// ════════════════════════════════════════════════════════════════════════════
export const userAPI = {
  getProfile: () => api.get("/users/me"),
  updateMyProfile: (data) => api.put("/users/me/profile", data),
  changePassword: (data) => api.put("/users/me/password", data),
  uploadFaceImage: (formData) =>
    api.post("/users/me/face", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getUserByUsername: (username) => api.get(`/users/${username}`),
};

// ════════════════════════════════════════════════════════════════════════════
// CLASS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════
export const classAPI = {
  getAllClasses: () => api.get("/classes"),
  getMyClasses: () => api.get("/classes"),
  getClassById: (id) => api.get(`/classes/${id}`),
  createClass: (data) => api.post("/classes/create", data),
  updateClass: (id, data) => api.put(`/classes/${id}`, data),
  deleteClass: (id) => api.delete(`/classes/${id}`),
  getStudents: (classId) => api.get(`/classes/${classId}/students`),
  removeStudent: (classId, studentUsername) =>
    api.delete(`/classes/${classId}/students/${studentUsername}`),
  getJoinRequests: (classId) =>
    api.get(`/teacher-class/${classId}/pending-students`),
  approveRequest: (classId, mssv) =>
    api.post("/teacher-class/approve-student", { classId, mssv }),
  rejectRequest: (classId, mssv) =>
    api.post("/teacher-class/reject-student", { classId, mssv }),

  importStudentsExcel: (classId, formData) =>
    api.post(`/teacher-class/${classId}/import-students`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ════════════════════════════════════════════════════════════════════════════
// STUDENT ACTIONS
// ════════════════════════════════════════════════════════════════════════════
export const studentAPI = {
  joinClass: (data) => api.post("/student-class/join", data),
  quitClass: (classId) => api.delete(`/student/quit/${classId}`),
  checkin: (data) => api.post("/attendance/checkin", data),
  markFaceRegistered: (registered = true) =>
    api.put("/student-class/face-registered", null, { params: { registered } }),
  getCurrentStudent: () => api.get("/student-class/me"),
};

// ════════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ════════════════════════════════════════════════════════════════════════════
export const attendanceAPI = {
  createSession: (data) => api.post("/attendance/create", data),
  getAttendanceList: (classId, date) =>
    api.get(`/attendance/${classId}`, { params: { date } }),
  getAttendedStudents: (attendanceId) =>
    api.get(`/attendance/${attendanceId}/attended-students`),

  // API xem danh sách vắng
  getAbsentStudents: (attendanceId) =>
    api.get(`/attendance/${attendanceId}/absent-students`),

  manualCheckin: (data) => api.put("/attendance/manual", data),
  markAllPresent: (attendanceId) =>
    api.post(`/attendance/${attendanceId}/mark-all-present`),
  teacherCheckin: (attendanceId, data) =>
    api.post(`/attendance/${attendanceId}/teacher-checkin`, data),

  // API mới: Lấy báo cáo cá nhân
  getStudentAttendanceReport: (classId, studentId) =>
    api.get(`/attendance/report/${classId}`, { params: { studentId } }),

  // ✨ API MỚI: XÓA ĐIỂM DANH (BỎ TICK)
  removeCheckin: (attendanceId, studentUsername) =>
    api.delete(`/attendance/${attendanceId}/remove-checkin/${studentUsername}`),

  // RESET TOÀN BỘ ĐIỂM DANH CỦA 1 BUỔI (TEST/DEMO)
  resetAttendance: (attendanceId) =>
    api.post(`/attendance/${attendanceId}/reset`),

  // ĐÓNG ĐIỂM DANH: backend gom tổng kết rồi gửi thông báo Discord
  closeAttendance: (attendanceId) =>
    api.post(`/attendance/${attendanceId}/close`),
};

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
export const notificationAPI = {
  getAll: () => api.get("/notifications"),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put("/notifications/read-all"),
};

// ════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════
export const adminAPI = {
  getAllUsers: () => api.get("/admin/users"),
  getStudents: () => api.get("/admin/students"),
  getTeachers: () => api.get("/admin/teachers"),
  getStats: () => api.get("/admin/stats"),
  approveFace: (username) => api.put(`/admin/face/${username}/approve`),
  rejectFace: (username) => api.put(`/admin/face/${username}/reject`),
  createUser: (data) => api.post("/admin/create-user", data),
  getStats: () => api.get("/admin/stats"),
  importExcel: (formData) =>
    api.post("/admin/import-excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  listImportJobs: () => api.get("/admin/import-jobs"),
  getImportJob: (id) => api.get(`/admin/import-jobs/${id}`),

  getAllClasses: () => api.get("/admin/classes"),
  getStudentsInClass: (classId) =>
    api.get(`/admin/classes/${classId}/students`),
  deleteClass: (classId) => api.delete(`/admin/classes/${classId}`),

  resetPassword: (username, newPassword) =>
    api.put(`/admin/users/${username}/reset-password`, { newPassword }),
  deleteUser: (username) => api.delete(`/admin/users/${username}`),
};

// ════════════════════════════════════════════════════════════════════════════
// CCTV / CAMERA (ADMIN)
// ════════════════════════════════════════════════════════════════════════════
export const cameraAPI = {
  getCameras: () => api.get("/admin/cameras"),
  createCamera: (data) => api.post("/admin/cameras", data),
  updateCamera: (id, data) => api.put(`/admin/cameras/${id}`, data),
  deleteCamera: (id) => api.delete(`/admin/cameras/${id}`),
};

// ════════════════════════════════════════════════════════════════════════════
// ROOM & SCHEDULE
// ════════════════════════════════════════════════════════════════════════════
export const roomAPI = {
  getAllRooms: () => api.get("/rooms"),
  createRoom: (data) => api.post("/rooms", data),
};

export const scheduleAPI = {
  getRoomSchedule: (roomId) => api.get(`/schedules/room/${roomId}`),
  getClassSchedule: (classId) => api.get(`/schedules/class/${classId}`),
  assignSchedule: (data) => api.post("/schedules", data),
  deleteSchedule: (scheduleId) => api.delete(`/schedules/${scheduleId}`),
  getCurrentCamera: (classId) => api.get(`/schedules/class/${classId}/current-camera`),
};

export default api;
