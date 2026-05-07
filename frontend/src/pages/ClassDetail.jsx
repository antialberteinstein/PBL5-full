import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { classAPI, attendanceAPI, studentAPI } from "../services/api";

const ClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  const userRole = localStorage.getItem("role") || "STUDENT";
  const isTeacher = userRole === "TEACHER";

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
  const [liveFrameUrl, setLiveFrameUrl] = useState("");
  const [pendingStudents, setPendingStudents] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingActionMssv, setPendingActionMssv] = useState("");
  const [previewImage, setPreviewImage] = useState(null);

  const verifySocketRef = useRef(null);
  const liveFrameUrlRef = useRef(null);
  const currentUsername = localStorage.getItem("username") || "";

  const formatAttendanceTime = (value) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const buildAttendedStudent = (studentUsername, checkinTime, imageUrl) => {
    const matchedStudent = students.find((sv) => sv.username === studentUsername);
    return {
      mssv: matchedStudent?.id || studentUsername,
      fullName: matchedStudent?.name || studentUsername,
      username: studentUsername,
      checkinTime,
      imageUrl: imageUrl || null,
    };
  };

  const resolveAttendanceImageUrl = (imageUrl) => {
    if (!imageUrl) return "";
    if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("data:")) {
      return imageUrl;
    }
    if (imageUrl.startsWith("/uploads/")) {
      return `http://localhost:8080${imageUrl}`;
    }
    return imageUrl;
  };

  const upsertHistoryStudent = (attendanceId, datetime, attendedStudent) => {
    setAttendanceSessions((prev) => {
      const nextStudent = {
        ...attendedStudent,
        imageUrl: attendedStudent.imageUrl || null,
      };
      const existingSession = prev.find((session) => session.id === attendanceId);

      if (!existingSession) {
        return [
          {
            id: attendanceId,
            datetime,
            students: [nextStudent],
            open: false,
          },
          ...prev,
        ];
      }

      return prev.map((session) => {
        if (session.id !== attendanceId) return session;

        const studentsWithoutDuplicate = session.students.filter(
          (sv) =>
            sv.username !== nextStudent.username &&
            sv.mssv !== nextStudent.mssv,
        );

        return {
          ...session,
          datetime: session.datetime || datetime,
          students: [...studentsWithoutDuplicate, nextStudent],
        };
      });
    });
  };

  // Các State để quản lý Import Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await classAPI.getStudents(classId);
      const realStudents = response.data.map((sv) => ({
        id: sv.mssv || sv.username || sv.id,
        username: sv.username,
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

  useEffect(() => {
    fetchStudents();
  }, [classId]);

  const fetchPendingStudents = async () => {
    if (!isTeacher) return;

    try {
      setPendingLoading(true);
      setPendingError("");
      const response = await classAPI.getJoinRequests(classId);
      const requests = (response.data || []).map((sv) => ({
        id: sv.mssv || sv.username || sv.id,
        mssv: sv.mssv,
        username: sv.username,
        name: sv.fullName || sv.username || "Chưa cập nhật tên",
        faceRegistered: Boolean(sv.faceRegistered),
      }));
      setPendingStudents(requests);
    } catch (error) {
      setPendingStudents([]);
      setPendingError(
        error.response?.data || "Không thể tải danh sách chờ duyệt.",
      );
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    if (isTeacher && activeTab === "pending") {
      fetchPendingStudents();
    }
  }, [isTeacher, classId, activeTab]);

  useEffect(() => {
    const fetchAttendanceHistory = async () => {
      try {
        setAttendanceLoading(true);
        const response = await attendanceAPI.getAttendanceList(classId);
        const sessions = response.data || [];

        const sessionsWithStudents = await Promise.all(
          sessions.map(async (session) => {
            try {
              const attended = await attendanceAPI.getAttendedStudents(
                session.id,
              );
              return {
                id: session.id,
                datetime: session.datetime,
                students: attended.data || [], // Dữ liệu này giờ đã có imageUrl từ Backend
                open: false,
              };
            } catch (error) {
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
      if (liveFrameUrlRef.current) {
        URL.revokeObjectURL(liveFrameUrlRef.current);
        liveFrameUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const fetchFaceStatus = async () => {
      if (isTeacher) return;
      try {
        const response = await studentAPI.getCurrentStudent();
        setFaceRegistered(Boolean(response.data?.faceRegistered));
      } catch (error) {
        console.error("Lỗi khi lấy trạng thái khuôn mặt:", error);
      }
    };
    fetchFaceStatus();
  }, [isTeacher]);

  const handleStartAttendance = async () => {
    if (attendanceRunning) return;
    try {
      setAttendanceError("");
      setAttendanceRunning(true);

      setStudents((prev) =>
        prev.map((sv) => ({ ...sv, status: "ABSENT", time: null })),
      );

      const response = await attendanceAPI.createSession({
        classId: parseInt(classId),
        datetime: new Date().toISOString(),
      });
      const newAttendanceId = response.data.id;
      const newAttendanceDatetime = response.data.datetime || new Date().toISOString();
      setCurrentAttendanceId(newAttendanceId);

      const faceBase =
        import.meta.env.VITE_FACE_API_BASE || "http://127.0.0.1:8000";
      const wsUrl = `${faceBase.replace(/^http/, "ws").replace(/\/$/, "")}/ws/verify_stream_local`;
      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      verifySocketRef.current = socket;

      socket.onopen = () => {
        setAttendanceRunning(true);
        const studentIds = students.map((sv) => sv.username).filter(Boolean);
        socket.send(JSON.stringify({ type: "allowlist", student_ids: studentIds }));
      };
      socket.onmessage = async (event) => {
        try {
          if (typeof event.data === "string") {
            const data = JSON.parse(event.data);
            if (data?.status === "completed") {
              setAttendanceRunning(false);
              return;
            }

            if (data?.type === "frame") {
              if (verifySocketRef.current?.readyState === WebSocket.OPEN) {
                verifySocketRef.current.send(
                  JSON.stringify({ type: "ok", frame_id: data.frame_id }),
                );
              }
            }

            if (data?.type === "match") {
              if (!data?.student_id || !newAttendanceId) return;

              const checkinResponse = await attendanceAPI.teacherCheckin(newAttendanceId, {
                studentUsername: data.student_id,
                checkinTime: data.checkin_time,
                imageUrl: data.image_url,
              });
              const storedImageUrl = checkinResponse.data?.imageUrl || null;

              const timeLabel = formatAttendanceTime(data.checkin_time);

              setStudents((prev) =>
                prev.map((sv) =>
                  sv.username === data.student_id
                    ? { ...sv, status: "PRESENT", time: timeLabel }
                    : sv,
                ),
              );

              upsertHistoryStudent(
                newAttendanceId,
                newAttendanceDatetime,
                buildAttendedStudent(
                  data.student_id,
                  data.checkin_time || new Date().toISOString(),
                  storedImageUrl,
                ),
              );
            }
            return;
          }

          if (event.data instanceof ArrayBuffer) {
            const blob = new Blob([event.data], { type: "image/jpeg" });
            const nextUrl = URL.createObjectURL(blob);
            if (liveFrameUrlRef.current) {
              URL.revokeObjectURL(liveFrameUrlRef.current);
            }
            liveFrameUrlRef.current = nextUrl;
            setLiveFrameUrl(nextUrl);
          }
        } catch (error) {
          console.error("Lỗi nhận dữ liệu verify:", error);
        }
      };
      socket.onerror = () => {
        setAttendanceError("Không thể kết nối dịch vụ AI điểm danh.");
        setAttendanceRunning(false);
      };
      socket.onclose = () => setAttendanceRunning(false);
    } catch (error) {
      setAttendanceError(
        error.response?.data || "Không thể kết nối dịch vụ điểm danh",
      );
      setAttendanceRunning(false);
    }
  };

  const handleStopAttendance = () => {
    if (verifySocketRef.current) {
      if (verifySocketRef.current.readyState === WebSocket.OPEN) {
        verifySocketRef.current.send(JSON.stringify({ type: "stop" }));
      }
      verifySocketRef.current.close();
      verifySocketRef.current = null;
    }
    setAttendanceRunning(false);
    if (liveFrameUrlRef.current) {
      URL.revokeObjectURL(liveFrameUrlRef.current);
      liveFrameUrlRef.current = null;
    }
    setLiveFrameUrl("");
  };

  const handleManualCheckin = async (studentUsername) => {
    if (!currentAttendanceId) {
      alert("Vui lòng mở điểm danh trước khi thao tác!");
      return;
    }

    try {
      const checkinTime = new Date().toISOString();
      // ✨ CẬP NHẬT: Điểm danh tay thì imageUrl truyền null
      await attendanceAPI.teacherCheckin(currentAttendanceId, {
        studentUsername: studentUsername,
        checkinTime,
        imageUrl: null,
      });

      const timeLabel = formatAttendanceTime(checkinTime);
      setStudents((prev) =>
        prev.map((sv) =>
          sv.username === studentUsername
            ? { ...sv, status: "PRESENT", time: timeLabel }
            : sv,
        ),
      );

      upsertHistoryStudent(
        currentAttendanceId,
        new Date().toISOString(),
        buildAttendedStudent(studentUsername, checkinTime, null),
      );
    } catch (error) {
      alert("Lỗi: " + (error.response?.data || "Không thể điểm danh bằng tay"));
    }
  };

  const handleRegisterFace = async () => {
    if (!currentUsername) return alert("Không tìm thấy tên đăng nhập.");
    navigate("/register-face");
  };

  const handleApproveRequest = async (student) => {
    if (!student?.mssv) {
      alert("Không tìm thấy MSSV của sinh viên.");
      return;
    }

    try {
      setPendingActionMssv(student.mssv);
      await classAPI.approveRequest(parseInt(classId), student.mssv);
      await Promise.all([fetchPendingStudents(), fetchStudents()]);
    } catch (error) {
      setPendingError(error.response?.data || "Không thể duyệt sinh viên.");
    } finally {
      setPendingActionMssv("");
    }
  };

  const handleRejectRequest = async (student) => {
    if (!student?.mssv) {
      alert("Không tìm thấy MSSV của sinh viên.");
      return;
    }

    try {
      setPendingActionMssv(student.mssv);
      await classAPI.rejectRequest(parseInt(classId), student.mssv);
      await fetchPendingStudents();
    } catch (error) {
      setPendingError(error.response?.data || "Không thể từ chối sinh viên.");
    } finally {
      setPendingActionMssv("");
    }
  };

  const handleImportExcel = async (e) => {
    e.preventDefault();
    if (!selectedFile) return alert("Vui lòng chọn file!");
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      setImporting(true);
      setImportResult("Đang xử lý dữ liệu...");
      const response = await classAPI.importStudentsExcel(classId, formData);
      setImportResult("✅ " + response.data);
      setSelectedFile(null);
      fetchStudents();
    } catch (error) {
      setImportResult("❌ Lỗi: " + (error.response?.data || "Import thất bại"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
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

        {isTeacher && (
          <div className="flex space-x-3">
            <button
              onClick={handleStopAttendance}
              disabled={!attendanceRunning}
              className="px-4 py-2 border border-red-500 text-red-500 bg-white hover:bg-red-50 font-semibold rounded-md shadow-sm transition disabled:opacity-50"
            >
              Đóng điểm danh
            </button>
            <button
              onClick={handleStartAttendance}
              disabled={attendanceRunning}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow-sm transition disabled:opacity-50 flex items-center"
            >
              Mở điểm danh
            </button>
          </div>
        )}
      </header>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex space-x-8">
          {isTeacher && (
            <button
              onClick={() => setActiveTab("live")}
              className={`py-4 font-semibold text-sm border-b-2 transition ${activeTab === "live" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"}`}
            >
              🔴 Live Điểm danh
            </button>
          )}
          <button
            onClick={() => setActiveTab("students")}
            className={`py-4 font-semibold text-sm border-b-2 transition ${activeTab === "students" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"}`}
          >
            👥 Danh sách lớp
          </button>
          {isTeacher && (
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-4 font-semibold text-sm border-b-2 transition ${activeTab === "pending" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"}`}
            >
              ⏳ Chờ duyệt
            </button>
          )}
          <button
            onClick={() => setActiveTab("history")}
            className={`py-4 font-semibold text-sm border-b-2 transition ${activeTab === "history" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500"}`}
          >
            📅 Lịch sử buổi học
          </button>
        </div>
      </div>

      <main className="flex-1 p-6 lg:p-8">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray-500">
            Đang tải dữ liệu...
          </div>
        ) : (
          <>
            {isTeacher && attendanceError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 mb-4 text-sm">
                {attendanceError}
              </div>
            )}

            {/* TAB 1: LIVE */}
            {isTeacher && activeTab === "live" && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border p-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">
                    Live từ AI
                  </div>
                  <div className="w-full aspect-video bg-gray-100 rounded-md overflow-hidden border">
                    {liveFrameUrl ? (
                      <img
                        src={liveFrameUrl}
                        alt="AI live"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        Chưa có tín hiệu hình ảnh
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {students.map((sv, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border flex flex-col items-center text-center ${sv.status === "PRESENT" ? "bg-green-50 border-green-200" : "bg-white"}`}
                  >
                    <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center mb-3 font-bold uppercase text-gray-500">
                      {sv.name.charAt(0)}
                    </div>
                    <p className="font-bold text-sm truncate w-full">
                      {sv.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{sv.id}</p>
                    {sv.status === "PRESENT" ? (
                      <span className="mt-3 px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-md">
                        Vào lúc {sv.time}
                      </span>
                    ) : (
                      <div className="mt-3 w-full">
                        {attendanceRunning && (
                          <button
                            onClick={() => handleManualCheckin(sv.username)}
                            className="w-full px-2 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded border border-indigo-200"
                          >
                            + Điểm danh tay
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </div>
            )}

            {/* TAB 2: DANH SÁCH LỚP */}
            {activeTab === "students" && (
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        MSSV
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Họ và Tên
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Mặt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.map((sv, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 text-sm font-semibold">
                          {sv.id}
                        </td>
                        <td className="px-6 py-4 text-sm">{sv.name}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs font-bold rounded-full ${sv.faceRegistered ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                          >
                            {sv.faceRegistered ? "Đã ĐK" : "Chưa"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: CHỜ DUYỆT */}
            {isTeacher && activeTab === "pending" && (
              <div className="bg-white rounded-lg border overflow-hidden">
                {pendingError && (
                  <div className="m-4 bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 text-sm">
                    {pendingError}
                  </div>
                )}

                {pendingLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Đang tải danh sách chờ duyệt...
                  </div>
                ) : pendingStudents.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Chưa có sinh viên nào đang chờ duyệt.
                  </div>
                ) : (
                  <table className="min-w-full divide-y">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          MSSV
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Tài khoản
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Mặt
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendingStudents.map((sv) => {
                        const isProcessing = pendingActionMssv === sv.mssv;

                        return (
                          <tr key={sv.mssv || sv.username || sv.id}>
                            <td className="px-6 py-4 text-sm font-semibold">
                              {sv.id}
                            </td>
                            <td className="px-6 py-4 text-sm">{sv.name}</td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 text-xs font-bold rounded-full ${sv.faceRegistered ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                              >
                                {sv.faceRegistered ? "Đã ĐK" : "Chưa"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleRejectRequest(sv)}
                                  disabled={Boolean(pendingActionMssv)}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-md transition disabled:opacity-50"
                                >
                                  Từ chối
                                </button>
                                <button
                                  onClick={() => handleApproveRequest(sv)}
                                  disabled={Boolean(pendingActionMssv)}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition disabled:opacity-50"
                                >
                                  {isProcessing ? "Đang xử lý..." : "Duyệt"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB 3: LỊCH SỬ (ĐÃ CẬP NHẬT CỘT ẢNH) */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {attendanceSessions.map((session) => (
                  <div key={session.id} className="bg-white rounded-lg border">
                    <button
                      onClick={() =>
                        setAttendanceSessions((prev) =>
                          prev.map((s) =>
                            s.id === session.id ? { ...s, open: !s.open } : s,
                          ),
                        )
                      }
                      className="w-full px-4 py-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-bold">Buổi #{session.id}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(session.datetime).toLocaleString("vi-VN")}
                        </p>
                      </div>
                      <span className="text-xs text-indigo-600 font-bold">
                        {session.open ? "Đóng" : "Xem chi tiết"}
                      </span>
                    </button>
                    {session.open && (
                      <div className="border-t overflow-x-auto">
                        <table className="min-w-full divide-y">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                MSSV
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Họ Tên
                              </th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                                Ảnh Điểm Danh
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {session.students.map((sv, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm font-bold">
                                  {sv.mssv}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {sv.fullName}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {/* ✨ HIỂN THỊ ẢNH TỪ AI HOẶC CHỮ ĐIỂM DANH TAY */}
                                  {sv.imageUrl ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewImage({
                                          src: resolveAttendanceImageUrl(sv.imageUrl),
                                          title: sv.fullName || sv.mssv || "Ảnh điểm danh",
                                        })
                                      }
                                      className="block mx-auto rounded-md border focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                      <img
                                        src={resolveAttendanceImageUrl(sv.imageUrl)}
                                        alt="AI Checkin"
                                        className="w-12 h-12 object-cover rounded-md"
                                      />
                                    </button>
                                  ) : (
                                    <span className="text-[10px] italic text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                      Điểm danh tay
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL IMPORT EXCEL */}
      {isTeacher && showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Nhập sinh viên từ Excel</h2>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="mb-4 block w-full text-sm"
            />
            {importResult && (
              <p className="text-xs mb-4 text-indigo-600">{importResult}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="text-sm px-4 py-2"
              >
                Hủy
              </button>
              <button
                onClick={handleImportExcel}
                disabled={importing || !selectedFile}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                {importing ? "Đang xử lý..." : "Bắt đầu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {previewImage.title}
              </p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
                aria-label="Đóng ảnh phóng to"
              >
                X
              </button>
            </div>
            <div className="bg-gray-100 p-4 flex items-center justify-center">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-w-full max-h-[75vh] object-contain rounded-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassDetail;
