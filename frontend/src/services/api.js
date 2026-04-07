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
// AUTH (Khớp 100% với AuthController của Khang)
// ════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  /** POST /api/auth/register */
  register: (data) => api.post("/auth/register", data),
  // data: { username, password, role, email }

  /** POST /api/auth/login */
  login: (data) => api.post("/auth/login", data),
  // data: { username, password } → response: { token }

  /** POST /api/auth/verify-otp */
  verifyOtp: (data) => api.post("/auth/verify-otp", data),
  // data: { username, otpCode }

  /** POST /api/auth/resend-otp (Lưu ý: Nút này trên FE tạm thời chưa gọi được vì BE Khang chưa viết hàm này) */
  resendOtp: (username) => api.post("/auth/resend-otp", { username }),
};

// ════════════════════════════════════════════════════════════════════════════
// USER / PROFILE
// ════════════════════════════════════════════════════════════════════════════
export const userAPI = {
  /** GET /api/users/me */
  getProfile: () => api.get("/users/me"),

  /** ĐÃ SỬA: PATCH /api/profiles/:id (Khớp với ProfileController của Khang) */
  updateProfile: (id, data) => api.patch(`/profiles/${id}`, data),
  // data: { fullName, birth }

  /** PUT /api/users/me/password */
  changePassword: (data) => api.put("/users/me/password", data),
  // data: { currentPassword, newPassword }

  /** POST /api/users/me/face  (multipart) */
  uploadFaceImage: (formData) =>
    api.post("/users/me/face", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  /** GET /api/users/:username  (Teacher xem profile Student) */
  getUserByUsername: (username) => api.get(`/users/${username}`),
};

// ════════════════════════════════════════════════════════════════════════════
// CLASS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════
export const classAPI = {
  /** GET /api/classes  — danh sách lớp của user hiện tại */
  getMyClasses: () => api.get("/classes"),

  /** GET /api/classes/:id */
  getClassById: (id) => api.get(`/classes/${id}`),

  /** POST /api/classes  (Teacher only) */
  createClass: (data) => api.post("/classes", data),
  // data: { name }

  /** PUT /api/classes/:id  (Teacher only) */
  updateClass: (id, data) => api.put(`/classes/${id}`, data),
  // data: { name }

  /** DELETE /api/classes/:id  (Teacher only) */
  deleteClass: (id) => api.delete(`/classes/${id}`),

  /** GET /api/classes/:id/students */
  getStudents: (classId) => api.get(`/classes/${classId}/students`),

  /** DELETE /api/classes/:id/students/:studentUsername  (Teacher only) */
  removeStudent: (classId, studentUsername) =>
    api.delete(`/classes/${classId}/students/${studentUsername}`),

  /** GET /api/classes/:id/requests  — danh sách xin vào lớp */
  getJoinRequests: (classId) => api.get(`/classes/${classId}/requests`),

  /** PUT /api/classes/:id/requests/:studentUsername/approve */
  approveRequest: (classId, studentUsername) =>
    api.put(`/classes/${classId}/requests/${studentUsername}/approve`),

  /** PUT /api/classes/:id/requests/:studentUsername/reject */
  rejectRequest: (classId, studentUsername) =>
    api.put(`/classes/${classId}/requests/${studentUsername}/reject`),
};

// ════════════════════════════════════════════════════════════════════════════
// STUDENT ACTIONS
// ════════════════════════════════════════════════════════════════════════════
export const studentAPI = {
  /** POST /api/student/join  — sinh viên xin vào lớp */
  joinClass: (data) => api.post("/student/join", data),
  // data: { classId }

  /** DELETE /api/student/quit/:classId  — sinh viên rời lớp */
  quitClass: (classId) => api.delete(`/student/quit/${classId}`),

  /** ĐÃ SỬA: POST /api/attendance/checkin (Khớp với AttendanceController của Khang) */
  checkin: (data) => api.post("/attendance/checkin", data),
  // data: { attendanceId }

  /** POST /register  (local face-recognition service) */
  registerLocalFace: (username) =>
    faceApi.post("/register", { class_id: username }),

  /** POST /verify  (local face-recognition service) */
  verifyLocalFace: (signal) => faceApi.post("/verify", {}, { signal }),

  /** PUT /api/student-class/face-registered */
  markFaceRegistered: (registered = true) =>
    api.put("/student-class/face-registered", null, {
      params: { registered },
    }),

  /** GET /api/student-class/me */
  getCurrentStudent: () => api.get("/student-class/me"),
};

// ════════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ════════════════════════════════════════════════════════════════════════════
export const attendanceAPI = {
  /** ĐÃ SỬA: POST /api/attendance/create (Khớp với AttendanceController của Khang) */
  createSession: (data) => api.post("/attendance/create", data),
  // data: { classId, datetime }

  /** GET /api/attendance/:classId?date=YYYY-MM-DD */
  getAttendanceList: (classId, date) =>
    api.get(`/attendance/${classId}`, { params: { date } }),

  /** GET /api/attendance/:attendanceId/attended-students */
  getAttendedStudents: (attendanceId) =>
    api.get(`/attendance/${attendanceId}/attended-students`),

  /** PUT /api/attendance/manual  (Teacher — điểm danh thủ công cho 1 sinh viên) */
  manualCheckin: (data) => api.put("/attendance/manual", data),
  // data: { attendanceId, studentUsername, status } status: PRESENT | ABSENT | LATE

  /** POST /api/attendance/:attendanceId/mark-all-present */
  markAllPresent: (attendanceId) =>
    api.post(`/attendance/${attendanceId}/mark-all-present`),

  /** POST /api/attendance/:attendanceId/teacher-checkin */
  teacherCheckin: (attendanceId, data) =>
    api.post(`/attendance/${attendanceId}/teacher-checkin`, data),
};

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════
export const notificationAPI = {
  /** GET /api/notifications */
  getAll: () => api.get("/notifications"),

  /** PUT /api/notifications/:id/read */
  markAsRead: (id) => api.put(`/notifications/${id}/read`),

  /** PUT /api/notifications/read-all */
  markAllAsRead: () => api.put("/notifications/read-all"),
};

// ════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════
export const adminAPI = {
  /** GET /api/admin/users */
  getAllUsers: () => api.get("/admin/users"),

  /** GET /api/admin/stats */
  getStats: () => api.get("/admin/stats"),

  /** PUT /api/admin/face/:username/approve */
  approveFace: (username) => api.put(`/admin/face/${username}/approve`),

  /** PUT /api/admin/face/:username/reject */
  rejectFace: (username) => api.put(`/admin/face/${username}/reject`),
};

export default api;
