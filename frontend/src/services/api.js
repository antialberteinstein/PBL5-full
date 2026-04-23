import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  timeout: 10000,
});

const faceApi = axios.create({
  baseURL: import.meta.env.VITE_FACE_API_BASE || "http://127.0.0.1:8000",
  timeout: 300000,
});

// ─── Interceptor: tự động gắn Bearer token ───────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor: xử lý 401 (hết hạn token) ──────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// ════════════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  verifyOtp: (data) => api.post("/auth/verify-otp", data),
  resendOtp: (username) => api.post("/auth/resend-otp", { username }),
};

// ════════════════════════════════════════════════════════════════════════════
// USER / PROFILE
// ════════════════════════════════════════════════════════════════════════════
export const userAPI = {
  getProfile: () => api.get("/users/me"),
  updateProfile: (id, data) => api.patch(`/profiles/${id}`, data),
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
  getMyClasses: () => api.get("/classes"),
  getClassById: (id) => api.get(`/classes/${id}`),
  createClass: (data) => api.post("/classes", data),
  updateClass: (id, data) => api.put(`/classes/${id}`, data),
  deleteClass: (id) => api.delete(`/classes/${id}`),
  getStudents: (classId) => api.get(`/classes/${classId}/students`),
  removeStudent: (classId, studentUsername) =>
    api.delete(`/classes/${classId}/students/${studentUsername}`),
  getJoinRequests: (classId) => api.get(`/classes/${classId}/requests`),
  approveRequest: (classId, studentUsername) =>
    api.put(`/classes/${classId}/requests/${studentUsername}/approve`),
  rejectRequest: (classId, studentUsername) =>
    api.put(`/classes/${classId}/requests/${studentUsername}/reject`),

  // ✨ THÊM MỚI Ở ĐÂY: API Cho Giáo viên Import danh sách sinh viên từ Excel
  /** POST /api/teacher-class/:classId/import-students */
  importStudentsExcel: (classId, formData) =>
    api.post(`/teacher-class/${classId}/import-students`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ════════════════════════════════════════════════════════════════════════════
// STUDENT ACTIONS
// ════════════════════════════════════════════════════════════════════════════
export const studentAPI = {
  joinClass: (data) => api.post("/student/join", data),
  quitClass: (classId) => api.delete(`/student/quit/${classId}`),
  checkin: (data) => api.post("/attendance/checkin", data),
  registerLocalFace: (username) =>
    faceApi.post("/register", { class_id: username }),
  verifyLocalFace: (signal) => faceApi.post("/verify", {}, { signal }),
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
  manualCheckin: (data) => api.put("/attendance/manual", data),
  markAllPresent: (attendanceId) =>
    api.post(`/attendance/${attendanceId}/mark-all-present`),
  teacherCheckin: (attendanceId, data) =>
    api.post(`/attendance/${attendanceId}/teacher-checkin`, data),
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
  getStats: () => api.get("/admin/stats"),
  approveFace: (username) => api.put(`/admin/face/${username}/approve`),
  rejectFace: (username) => api.put(`/admin/face/${username}/reject`),

  // ✨ THÊM MỚI Ở ĐÂY: Các API dành riêng cho Admin tạo tài khoản
  /** POST /api/admin/create-user */
  createUser: (data) => api.post("/admin/create-user", data),

  /** POST /api/admin/import-excel */
  importExcel: (formData) =>
    api.post("/admin/import-excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default api;
