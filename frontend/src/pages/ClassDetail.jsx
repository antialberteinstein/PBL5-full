import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { classAPI, attendanceAPI, studentAPI } from "../services/api";

const ClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  // 1. KIỂM TRA QUYỀN CỦA NGƯỜI DÙNG (Lấy từ localStorage lúc đăng nhập)
  // Nếu bạn lưu tên khác thì nhớ sửa lại chữ "role" cho đúng nhé
  const userRole = localStorage.getItem("role") || "STUDENT";
  const isTeacher = userRole === "TEACHER";

  // 2. MẶC ĐỊNH TAB: Nếu là Giáo viên thì mở tab Live, nếu là Sinh viên thì mở luôn tab Danh sách lớp
  const [activeTab, setActiveTab] = useState(isTeacher ? "live" : "students");

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAttendanceId, setCurrentAttendanceId] = useState(null);
  const [faceRegistering, setFaceRegistering] = useState(false);
  const [faceResult, setFaceResult] = useState("");
  const [faceError, setFaceError] = useState("");
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [attendanceRunning, setAttendanceRunning] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const verifySocketRef = useRef(null);

  const currentUsername = localStorage.getItem("username") || "";

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await classAPI.getStudents(classId);
        const realStudents = response.data.map((sv) => ({
          id: sv.username || sv.id,
          name: sv.fullName || sv.username || "Chưa cập nhật tên",
          faceRegistered: Boolean(sv.faceRegistered),
          status: "ABSENT",
          time: null,
        }));
        setStudents(realStudents);
      } catch (error) {
        console.error("Lỗi khi lấy danh sách sinh viên:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [classId]);

  useEffect(() => {
    const fetchAttendanceHistory = async () => {
      try {
        setAttendanceLoading(true);
        const response = await attendanceAPI.getAttendanceList(classId);
        const sessions = response.data || [];

        const sessionsWithStudents = await Promise.all(
          sessions.map(async (session) => {
            try {
              const attended = await attendanceAPI.getAttendedStudents(session.id);
              return {
                id: session.id,
                datetime: session.datetime,
                students: attended.data || [],
                open: false,
              };
            } catch (error) {
              console.error("Lỗi lấy danh sách điểm danh:", error);
              return {
                id: session.id,
                datetime: session.datetime,
                students: [],
                open: false,
              };
            }
          }),
        );

        setAttendanceSessions(sessionsWithStudents);
      } catch (error) {
        console.error("Lỗi lấy lịch sử điểm danh:", error);
        setAttendanceSessions([]);
      } finally {
        setAttendanceLoading(false);
      }
    };

    if (activeTab === "history") {
      fetchAttendanceHistory();
    }
  }, [classId, activeTab]);

  useEffect(() => {
    return () => {
      if (verifySocketRef.current) {
        verifySocketRef.current.close();
        verifySocketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const fetchFaceStatus = async () => {
      if (isTeacher) {
        return;
      }

      try {
        const response = await studentAPI.getCurrentStudent();
        setFaceRegistered(Boolean(response.data?.faceRegistered));
      } catch (error) {
        console.error("Lỗi khi lấy trạng thái khuôn mặt:", error);
      }
    };

    fetchFaceStatus();
  }, [isTeacher]);

  // Xử lý khi Giáo viên bấm nút "Mở điểm danh"
  const handleStartAttendance = async () => {
    if (attendanceRunning) {
      return;
    }

    try {
      setAttendanceError("");
      setAttendanceRunning(true);

      const response = await attendanceAPI.createSession({
        classId: parseInt(classId),
        datetime: new Date().toISOString(),
      });

      const newAttendanceId = response.data.id;
      setCurrentAttendanceId(newAttendanceId);

      const faceBase =
        import.meta.env.VITE_FACE_API_BASE || "http://127.0.0.1:8000";
      const wsUrl = `${faceBase.replace(/^http/, "ws").replace(/\/$/, "")}/ws/verify`;
      const socket = new WebSocket(wsUrl);
      verifySocketRef.current = socket;

      socket.onopen = () => {
        setAttendanceRunning(true);
      };

      socket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data?.status === "completed") {
            setAttendanceRunning(false);
            return;
          }

          if (!data?.class_id || !newAttendanceId) {
            return;
          }

          await attendanceAPI.teacherCheckin(newAttendanceId, {
            studentUsername: data.class_id,
            checkinTime: data.checkin_time,
          });

          const checkinTime = data.checkin_time
            ? new Date(data.checkin_time)
            : new Date();
          const timeLabel = checkinTime.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          });

          setStudents((prev) =>
            prev.map((sv) =>
              sv.id === data.class_id
                ? { ...sv, status: "PRESENT", time: timeLabel }
                : sv,
            ),
          );
        } catch (error) {
          console.error("Lỗi nhận dữ liệu verify:", error);
        }
      };

      socket.onerror = () => {
        setAttendanceError("Không thể kết nối dịch vụ điểm danh");
        setAttendanceRunning(false);
      };

      socket.onclose = () => {
        setAttendanceRunning(false);
      };
    } catch (error) {
      setAttendanceError(
        error.response?.data || "Không thể kết nối dịch vụ điểm danh",
      );
    }
  };

  // Xử lý khi Giáo viên bấm nút "Đóng điểm danh"
  const handleStopAttendance = () => {
    if (verifySocketRef.current) {
      verifySocketRef.current.close();
      verifySocketRef.current = null;
    }
    setAttendanceRunning(false);
  };

  const handleRegisterFace = async () => {
    if (!currentUsername) {
      alert("Không tìm thấy tên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setFaceRegistering(true);
      setFaceError("");
      setFaceResult("");

      await studentAPI.registerLocalFace(currentUsername);
      await studentAPI.markFaceRegistered(true);
      setFaceRegistered(true);
      setFaceResult("Đăng ký khuôn mặt thành công.");
    } catch (error) {
      setFaceError(
        error.response?.data || "Không thể kết nối dịch vụ nhận diện khuôn mặt",
      );
    } finally {
      setFaceRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* KHU VỰC HEADER LỚP HỌC */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              ></path>
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Chi tiết lớp học #{classId}
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Sĩ số: {students.length} sinh viên | Tình trạng: Đang học
            </p>
          </div>
        </div>

        {/* 3. ĐIỀU KIỆN ẨN HIỆN NÚT BẤM: Chỉ Giáo viên (isTeacher) mới nhìn thấy 2 nút này */}
        {isTeacher && (
          <div className="flex space-x-3">
            <button
              onClick={handleStopAttendance}
              disabled={!attendanceRunning}
              className="px-4 py-2 border border-red-500 text-red-500 bg-white hover:bg-red-50 font-semibold rounded-md shadow-sm transition flex items-center"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Đóng
              điểm danh
            </button>
            <button
              onClick={handleStartAttendance}
              disabled={attendanceRunning}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow-sm transition flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              Mở điểm danh
            </button>
          </div>
        )}
      </header>

      {/* THANH MENU TABS */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8">
          {/* 4. ĐIỀU KIỆN ẨN HIỆN TAB LIVE: Chỉ Giáo viên mới được xem Tab này */}
          {isTeacher && (
            <button
              onClick={() => setActiveTab("live")}
              className={`py-4 font-semibold text-sm border-b-2 transition ${
                activeTab === "live"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              🔴 Live Điểm danh
            </button>
          )}

          <button
            onClick={() => setActiveTab("students")}
            className={`py-4 font-semibold text-sm border-b-2 transition ${
              activeTab === "students"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            👥 Danh sách lớp
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-4 font-semibold text-sm border-b-2 transition ${
              activeTab === "history"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📅 Lịch sử buổi học
          </button>
        </div>
      </div>

      {/* NỘI DUNG CHÍNH */}
      <main className="flex-1 p-6 lg:p-8">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray-500">
            <svg
              className="animate-spin h-8 w-8 text-indigo-600 mr-3"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Đang tải dữ liệu...
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            Chưa có sinh viên nào trong lớp này.
          </div>
        ) : (
          <>
            {isTeacher && attendanceError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 mb-4 text-sm">
                {attendanceError}
              </div>
            )}
            {/* --- TAB 1: LIVE QUAN SÁT ĐIỂM DANH (CHỈ GIÁO VIÊN MỚI THẤY VÀ MỚI RENDER VÀO ĐÂY) --- */}
            {isTeacher && activeTab === "live" && (
              <div>
                {/* ... (Toàn bộ phần code giao diện Live sinh viên thẻ xanh, xám giữ nguyên như cũ) ... */}
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800">
                    Trạng thái sinh viên hôm nay
                  </h2>
                  <div className="flex space-x-4 text-sm font-medium">
                    <span className="flex items-center text-green-600">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>{" "}
                      Đã có mặt (0)
                    </span>
                    <span className="flex items-center text-gray-500">
                      <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>{" "}
                      Chưa đến ({students.length})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {students.map((sv, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition hover:shadow-md ${sv.status === "PRESENT" ? "bg-green-50 border-green-200" : "bg-white border-gray-200 opacity-80"}`}
                    >
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 relative overflow-hidden ${sv.status === "PRESENT" ? "bg-green-200 text-green-700" : "bg-gray-200 text-gray-500"}`}
                      >
                        <span className="font-bold text-lg uppercase">
                          {sv.name ? sv.name.charAt(0) : "S"}
                        </span>
                      </div>
                      <p
                        className={`font-bold text-sm truncate w-full ${sv.status === "PRESENT" ? "text-green-700" : "text-gray-700"}`}
                      >
                        {sv.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">
                        {sv.id}
                      </p>
                      {sv.status === "PRESENT" ? (
                        <span className="mt-3 px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-md border border-green-200">
                          Vào lúc {sv.time}
                        </span>
                      ) : (
                        <span className="mt-3 px-2 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-md border border-gray-200">
                          Chưa điểm danh
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- TAB 2: DANH SÁCH LỚP CHUNG (AI CŨNG THẤY) --- */}
            {activeTab === "students" && (
              <div>
                {!isTeacher && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">
                          Đăng ký khuôn mặt
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          ID đăng ký sẽ là tên đăng nhập của bạn: {currentUsername || "(chưa có)"}
                        </p>
                      </div>
                      {!faceRegistered ? (
                        <button
                          onClick={handleRegisterFace}
                          disabled={faceRegistering}
                          className={`px-4 py-2 rounded-md text-sm font-semibold transition ${faceRegistering ? "bg-gray-300 text-gray-600" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                        >
                          {faceRegistering ? "Đang mở camera..." : "Bắt đầu đăng ký"}
                        </button>
                      ) : (
                        <div className="px-4 py-2 rounded-md text-sm font-semibold text-green-700 bg-green-50 border border-green-200">
                          Đã đăng ký khuôn mặt
                        </div>
                      )}
                    </div>

                    {faceError && (
                      <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {faceError}
                      </div>
                    )}

                    {faceResult && (
                      <div className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                        {faceResult}
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          MSSV
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Họ và Tên
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Đã đăng ký mặt
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tỉ lệ vắng
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((sv, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {sv.id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                            {sv.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`px-2 py-1 text-xs font-bold rounded-full ${sv.faceRegistered ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {sv.faceRegistered ? "Đã đăng ký" : "Chưa"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                              0%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* --- TAB 3: LỊCH SỬ (AI CŨNG THẤY) --- */}
        {activeTab === "history" && (
          <div>
            {attendanceLoading ? (
              <div className="text-center text-gray-500 py-12">
                Đang tải lịch sử điểm danh...
              </div>
            ) : attendanceSessions.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                Chưa có buổi điểm danh nào.
              </div>
            ) : (
              <div className="space-y-4">
                {attendanceSessions.map((session) => {
                  const dateLabel = session.datetime
                    ? new Date(session.datetime).toLocaleString("vi-VN")
                    : "Không rõ thời gian";

                  return (
                    <div
                      key={session.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-200"
                    >
                      <button
                        onClick={() =>
                          setAttendanceSessions((prev) =>
                            prev.map((item) =>
                              item.id === session.id
                                ? { ...item, open: !item.open }
                                : item,
                            ),
                          )
                        }
                        className="w-full px-4 py-3 flex items-center justify-between text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Buổi #{session.id}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{dateLabel}</p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600">
                          {session.open ? "Thu gọn" : "Mở"}
                        </span>
                      </button>

                      {session.open && (
                        <div className="border-t border-gray-200">
                          {session.students.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-gray-500">
                              Không có sinh viên đã điểm danh.
                            </div>
                          ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    MSSV
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Họ và Tên
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {session.students.map((sv, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm font-semibold text-gray-900">
                                      {sv.username || sv.id}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-gray-700">
                                      {sv.fullName || sv.username || "Chưa cập nhật"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ClassDetail;
