import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { classAPI, attendanceAPI, studentAPI, scheduleAPI, backendWsBase } from "../services/api";
import { getToken } from "../utils/auth.js";

const ClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  const userRole = localStorage.getItem("role") || "STUDENT";
  const isTeacher = userRole === "TEACHER";

  const [activeTab, setActiveTab] = useState("students");

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentAttendanceId, setCurrentAttendanceId] = useState(null);
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

  const [newStudentId, setNewStudentId] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  // ✨ STATE MỚI: Theo dõi thay đổi điểm danh (Draft) & Trạng thái lưu
  const [draftChanges, setDraftChanges] = useState({}); // Cấu trúc: { [sessionId]: { [username]: boolean } }
  const [isSaving, setIsSaving] = useState(false);
  // Bộ lọc lịch sử theo từng buổi: { [sessionId]: { query, status } }
  // status: "all" | "present" | "spoof" | "absent"
  const [sessionFilters, setSessionFilters] = useState({});

  const verifySocketRef = useRef(null);
  const liveFrameUrlRef = useRef(null);
  const currentUsername = localStorage.getItem("username") || "";

  // ── Lịch học & auto mở/đóng điểm danh ────────────────────────────────────
  const [classSchedules, setClassSchedules] = useState([]);
  const [autoModeEnabled, setAutoModeEnabled] = useState(true);
  const [autoStatus, setAutoStatus] = useState({ inWindow: false, current: null });
  const [resettingSessionId, setResettingSessionId] = useState(null);

  const attendanceRunningRef = useRef(false);
  const openedByAutoRef = useRef(false);
  const lastAutoWindowRef = useRef(null);
  const startingRef = useRef(false);

  useEffect(() => {
    attendanceRunningRef.current = attendanceRunning;
  }, [attendanceRunning]);

  // Map tiết → phút trong ngày (1 tiết = 60 phút, nghỉ trưa 30 phút sau tiết 5)
  const PERIOD_START_MIN = {
    1: 7 * 60,
    2: 8 * 60,
    3: 9 * 60,
    4: 10 * 60,
    5: 11 * 60,
    6: 12 * 60 + 30,
    7: 13 * 60 + 30,
    8: 14 * 60 + 30,
    9: 15 * 60 + 30,
    10: 16 * 60 + 30,
  };
  const periodEndMin = (p) => PERIOD_START_MIN[p] + 60;
  const formatMinutes = (m) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const currentDayOfWeekBackend = () => {
    const d = new Date().getDay(); // 0=Sun .. 6=Sat
    return d === 0 ? 8 : d + 1;     // backend: 2=Mon .. 8=Sun
  };
  const currentMinuteOfDay = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const findActiveSchedule = (schedules) => {
    const dow = currentDayOfWeekBackend();
    const minute = currentMinuteOfDay();
    return (schedules || []).find(
      (s) =>
        s.dayOfWeek === dow &&
        PERIOD_START_MIN[s.startPeriod] !== undefined &&
        PERIOD_START_MIN[s.endPeriod] !== undefined &&
        minute >= PERIOD_START_MIN[s.startPeriod] &&
        minute < periodEndMin(s.endPeriod),
    );
  };

  // Format Date -> "YYYY-MM-DDTHH:mm:ss" (LocalDateTime.parse() Java-compatible, không có 'Z')
  const formatLocalDateTimeForBackend = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

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

  const buildAttendedStudent = (studentUsername, checkinTime, imageUrl, spoof = false) => {
    const matchedStudent = students.find(
      (sv) => sv.username === studentUsername,
    );
    return {
      mssv: matchedStudent?.id || studentUsername,
      fullName: matchedStudent?.name || studentUsername,
      username: studentUsername,
      checkinTime,
      imageUrl: imageUrl || null,
      spoof: Boolean(spoof),
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

  // Phân loại trạng thái 1 sinh viên trong buổi điểm danh.
  // "present" = có mặt & không gian lận, "spoof" = nghi gian lận, "absent" = vắng.
  const getAttendanceStatus = (sv) => {
    if (!sv?.isPresent) return "absent";
    return sv?.spoof ? "spoof" : "present";
  };

  const getSessionFilter = (sessionId) =>
    sessionFilters[sessionId] || { query: "", status: "all" };

  const updateSessionFilter = (sessionId, patch) =>
    setSessionFilters((prev) => ({
      ...prev,
      [sessionId]: { ...getSessionFilter(sessionId), ...patch },
    }));

  // Áp dụng tìm kiếm (tên/MSSV) + lọc trạng thái cho danh sách sinh viên 1 buổi.
  const applySessionFilter = (sessionId, studentList) => {
    const { query, status } = getSessionFilter(sessionId);
    const q = query.trim().toLowerCase();
    return studentList.filter((sv) => {
      const matchesText =
        !q ||
        String(sv.fullName || "").toLowerCase().includes(q) ||
        String(sv.mssv || "").toLowerCase().includes(q) ||
        String(sv.username || "").toLowerCase().includes(q);
      const matchesStatus =
        status === "all" || getAttendanceStatus(sv) === status;
      return matchesText && matchesStatus;
    });
  };

  const upsertHistoryStudent = (attendanceId, datetime, attendedStudent) => {
    if (
      !isTeacher &&
      attendedStudent.username !== currentUsername &&
      attendedStudent.mssv !== currentUsername
    ) {
      return;
    }

    setAttendanceSessions((prev) => {
      const nextStudent = {
        ...attendedStudent,
        imageUrl: attendedStudent.imageUrl || null,
        isPresent: true,
      };
      const existingSession = prev.find(
        (session) => session.id === attendanceId,
      );

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

        const existing = session.students.find(
          (sv) =>
            sv.username === nextStudent.username ||
            sv.mssv === nextStudent.mssv,
        );
        const studentsWithoutDuplicate = session.students.filter(
          (sv) =>
            sv.username !== nextStudent.username &&
            sv.mssv !== nextStudent.mssv,
        );

        // Preserve ảnh/thời gian đã có nếu lần update mới không kèm theo
        const merged = {
          ...nextStudent,
          imageUrl: nextStudent.imageUrl || existing?.imageUrl || null,
          checkinTime: nextStudent.checkinTime || existing?.checkinTime || null,
        };

        return {
          ...session,
          datetime: session.datetime || datetime,
          students: [...studentsWithoutDuplicate, merged],
        };
      });
    });
  };

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
              const [attendedRes, absentRes] = await Promise.all([
                attendanceAPI.getAttendedStudents(session.id),
                attendanceAPI.getAbsentStudents(session.id),
              ]);

              const attendedList = (attendedRes.data || []).map((sv) => ({
                ...sv,
                isPresent: true,
              }));
              const absentList = (absentRes.data || []).map((sv) => ({
                ...sv,
                isPresent: false,
              }));

              let studentsData = [...attendedList, ...absentList];
              studentsData.sort((a, b) => a.mssv.localeCompare(b.mssv));

              if (!isTeacher) {
                studentsData = studentsData.filter(
                  (sv) =>
                    sv.username === currentUsername ||
                    sv.mssv === currentUsername ||
                    sv.id === currentUsername,
                );
              }

              return {
                id: session.id,
                datetime: session.datetime,
                students: studentsData,
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

    const handleStartAttendance = async (options) => {
    const auto = options && options.auto === true;
    if (attendanceRunningRef.current || startingRef.current) return;
    startingRef.current = true;
    try {
      setAttendanceError("");

      // Lấy camera hiện tại theo lịch
      let camera = null;
      try {
        const camRes = await scheduleAPI.getCurrentCamera(classId);
        camera = camRes.data;
      } catch (err) {
        setAttendanceError("Không thể tìm thấy phòng học hiện tại. Vui lòng đảm bảo lớp này có lịch học ngay lúc này.");
        startingRef.current = false;
        return;
      }

      if (!camera) {
        setAttendanceError("Phòng học hiện tại chưa được gán Camera/AI Server.");
        startingRef.current = false;
        return;
      }

      attendanceRunningRef.current = true;
      openedByAutoRef.current = auto;
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

      const token = getToken();
      const wsUrl = `${backendWsBase}/ws/verify_stream_local?classId=${classId}&token=${token}`;
      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      verifySocketRef.current = socket;

      socket.onopen = () => {
        startingRef.current = false;
        attendanceRunningRef.current = true;
        setAttendanceRunning(true);
        const studentIds = students.map((sv) => sv.username).filter(Boolean);
        socket.send(
          JSON.stringify({ type: "allowlist", student_ids: studentIds }),
        );
      };
      socket.onmessage = async (event) => {
        try {
          if (typeof event.data === "string") {
            const data = JSON.parse(event.data);
            if (data?.status === "completed") {
              attendanceRunningRef.current = false;
              openedByAutoRef.current = false;
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

              // checkin_time từ AI server có format "YYYY-MM-DDTHH:mm:ss" (không 'Z') -
              // đúng định dạng LocalDateTime.parse() của Java
              const capturedAt = data.checkin_time || formatLocalDateTimeForBackend(new Date());
              // is_real === false nghĩa là AI nghi ngờ khuôn mặt giả mạo -> gian lận.
              const isSpoof = data.is_real === false;
              const checkinResponse = await attendanceAPI.teacherCheckin(
                newAttendanceId,
                {
                  studentUsername: data.student_id,
                  checkinTime: capturedAt,
                  imageUrl: data.image_url,
                  isSpoof,
                  antispoofScore:
                    typeof data.antispoof_score === "number"
                      ? data.antispoof_score
                      : null,
                },
              );
              const storedImageUrl = checkinResponse.data?.imageUrl || null;

              const timeLabel = formatAttendanceTime(data.checkin_time);

              setStudents((prev) =>
                prev.map((sv) =>
                  sv.username === data.student_id
                    ? { ...sv, status: "PRESENT", time: timeLabel, spoof: isSpoof }
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
                  isSpoof,
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
        startingRef.current = false;
        attendanceRunningRef.current = false;
        openedByAutoRef.current = false;
        setAttendanceRunning(false);
      };
      socket.onclose = () => {
        startingRef.current = false;
        attendanceRunningRef.current = false;
        openedByAutoRef.current = false;
        setAttendanceRunning(false);
      };
    } catch (error) {
      setAttendanceError(
        error.response?.data || "Không thể kết nối dịch vụ điểm danh",
      );
      startingRef.current = false;
      attendanceRunningRef.current = false;
      openedByAutoRef.current = false;
      setAttendanceRunning(false);
    }
  };

  const handleStopAttendance = () => {
    // Đóng điểm danh -> backend gom tổng kết & gửi thông báo Discord (không chặn UI).
    if (currentAttendanceId) {
      attendanceAPI.closeAttendance(currentAttendanceId).catch(() => {});
    }
    if (verifySocketRef.current) {
      if (verifySocketRef.current.readyState === WebSocket.OPEN) {
        // Clear allowlist trước khi stop để AI server không tiếp tục nhận diện
        // (AI server sẽ chuyển sentinel về ["????"] khi nhận empty list)
        verifySocketRef.current.send(JSON.stringify({ type: "allowlist", student_ids: [] }));
        verifySocketRef.current.send(JSON.stringify({ type: "stop" }));
      }
      verifySocketRef.current.close();
      verifySocketRef.current = null;
    }
    attendanceRunningRef.current = false;
    openedByAutoRef.current = false;
    startingRef.current = false;
    setAttendanceRunning(false);
    if (liveFrameUrlRef.current) {
      URL.revokeObjectURL(liveFrameUrlRef.current);
      liveFrameUrlRef.current = null;
    }
    setLiveFrameUrl("");
  };

  // Auto mở/đóng theo lịch (chạy mỗi 30s khi auto mode bật)
  useEffect(() => {
    scheduleAPI
      .getClassSchedule(classId)
      .then((res) => setClassSchedules(res.data || []))
      .catch(() => setClassSchedules([]));
  }, [classId]);

  useEffect(() => {
    if (!isTeacher) return undefined;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const active = findActiveSchedule(classSchedules);
      setAutoStatus({ inWindow: Boolean(active), current: active || null });

      if (!autoModeEnabled) return;

      const dateKey = new Date().toDateString();
      if (active) {
        const windowKey = `${dateKey}-${active.id}`;
        if (!attendanceRunningRef.current
            && !startingRef.current
            && lastAutoWindowRef.current !== windowKey
            && students.length > 0) {
          lastAutoWindowRef.current = windowKey;
          handleStartAttendance({ auto: true });
        }
      } else if (attendanceRunningRef.current && openedByAutoRef.current) {
        handleStopAttendance();
      }
    };

    tick();
    const interval = setInterval(tick, 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isTeacher, autoModeEnabled, classSchedules, students]);

  const handleResetSession = async (sessionId) => {
    if (!window.confirm(`Reset toàn bộ điểm danh của buổi #${sessionId}? (Chỉ dùng test/demo)`)) return;
    try {
      setResettingSessionId(sessionId);
      await attendanceAPI.resetAttendance(sessionId);

      // Dừng WebSocket cũ nếu đang chạy, để GV có thể mở lại sạch
      if (attendanceRunningRef.current) {
        handleStopAttendance();
      }

      setAttendanceSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            students: s.students.map((sv) => ({
              ...sv,
              isPresent: false,
              imageUrl: null,
              checkinTime: null,
            })),
          };
        }),
      );
      setStudents((prev) => prev.map((sv) => ({ ...sv, status: "ABSENT", time: null })));
      alert("✅ Đã reset điểm danh cho buổi này.");
    } catch (error) {
      alert("❌ Lỗi reset: " + (error.response?.data || error.message));
    } finally {
      setResettingSessionId(null);
    }
  };

  // Dùng cho TAB Live nếu có mở lại
  const handleManualCheckin = async (studentUsername) => {
    if (!currentAttendanceId) {
      alert("Vui lòng mở điểm danh trước khi thao tác!");
      return;
    }

    try {
      const now = new Date();
      const checkinTime = now.toISOString();
      await attendanceAPI.teacherCheckin(currentAttendanceId, {
        studentUsername: studentUsername,
        checkinTime: formatLocalDateTimeForBackend(now),
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

  // ✨ HÀM LƯU NHÁP KHI TICK/BỎ TICK CHECKBOX
  const handleToggleDraft = (sessionId, student) => {
    setDraftChanges((prev) => {
      const sessionDrafts = prev[sessionId] || {};
      const currentDraftStatus =
        sessionDrafts[student.username] !== undefined
          ? sessionDrafts[student.username]
          : student.isPresent;

      return {
        ...prev,
        [sessionId]: {
          ...sessionDrafts,
          [student.username]: !currentDraftStatus,
        },
      };
    });
  };

  // ✨ HÀM GỬI LƯU HÀNG LOẠT (XÁC NHẬN)
  const handleConfirmChanges = async (sessionId, sessionStudents) => {
    const changes = draftChanges[sessionId];
    if (!changes || Object.keys(changes).length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      // Gọi API tương ứng cho mỗi thay đổi
      for (const username of Object.keys(changes)) {
        const newStatus = changes[username];
        const originalStatus = sessionStudents.find(
          (s) => s.username === username,
        )?.isPresent;

        if (newStatus !== originalStatus) {
          if (newStatus) {
            await attendanceAPI.teacherCheckin(sessionId, {
              studentUsername: username,
            });
          } else {
            await attendanceAPI.removeCheckin(sessionId, username);
          }
        }
      }

      alert("✅ Đã lưu thay đổi điểm danh thành công!");

      // Xóa nháp
      setDraftChanges((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });

      // Cập nhật lại UI không cần fetch lại từ đầu
      setAttendanceSessions((prev) =>
        prev.map((session) => {
          if (session.id !== sessionId) return session;
          return {
            ...session,
            students: session.students.map((sv) => {
              if (changes[sv.username] !== undefined) {
                return {
                  ...sv,
                  isPresent: changes[sv.username],
                  imageUrl: !changes[sv.username] ? null : sv.imageUrl,
                };
              }
              return sv;
            }),
          };
        }),
      );
    } catch (error) {
      alert(
        "❌ Lỗi khi lưu thay đổi: " + (error.response?.data || error.message),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStudentManually = async (e) => {
    e.preventDefault();
    if (!newStudentId.trim()) return;

    try {
      setAddingStudent(true);
      await api.post("/teacher-class/add-student", {
        classId: parseInt(classId),
        mssv: newStudentId.trim(),
      });
      alert("✅ Đã thêm sinh viên vào lớp thành công!");
      setNewStudentId("");
      fetchStudents();
    } catch (error) {
      alert(
        "❌ Lỗi: " +
          (error.response?.data ||
            "Không thể thêm sinh viên hoặc SV không tồn tại"),
      );
    } finally {
      setAddingStudent(false);
    }
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

  const handleJoinDirect = async () => {
    try {
      await studentAPI.joinClass({ classId: parseInt(classId) });
      alert("Đã gửi yêu cầu tham gia lớp!");
      navigate("/dashboard");
    } catch (error) {
      alert("Lỗi: " + (error.response?.data || "Không thể xin gia nhập"));
    }
  };

  const isMember = students.some((sv) => sv.username === currentUsername);

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
          <div className="flex items-center space-x-3">
            <div className="text-right mr-2 text-xs">
              <div className={`font-bold ${autoStatus.inWindow ? "text-green-600" : "text-gray-500"}`}>
                {autoStatus.inWindow
                  ? `🟢 Đang trong giờ học (Tiết ${autoStatus.current.startPeriod}-${autoStatus.current.endPeriod}, đến ${formatMinutes(periodEndMin(autoStatus.current.endPeriod))})`
                  : "⚪ Ngoài giờ học theo lịch"}
              </div>
              <button
                type="button"
                onClick={() => setAutoModeEnabled((v) => !v)}
                className={`mt-1 px-2 py-0.5 rounded-full border text-[11px] font-bold transition ${
                  autoModeEnabled
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                }`}
              >
                Tự động: {autoModeEnabled ? "BẬT" : "TẮT"}
              </button>
            </div>
            <button
              onClick={handleStopAttendance}
              disabled={!attendanceRunning}
              className="px-4 py-2 border border-red-500 text-red-500 bg-white hover:bg-red-50 font-semibold rounded-md shadow-sm transition disabled:opacity-50"
            >
              Đóng điểm danh
            </button>
            <button
              onClick={() => handleStartAttendance()}
              disabled={attendanceRunning}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow-sm transition disabled:opacity-50 flex items-center"
            >
              Mở điểm danh
            </button>
          </div>
        )}
      </header>

      {(isTeacher || isMember) && (
        <div className="bg-white border-b border-gray-200 px-6">
          <div className="flex space-x-8">
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
                ⏳ Chờ duyệt ({pendingStudents.length})
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
      )}

      <main className="flex-1 p-6 lg:p-8">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray-500">
            Đang tải dữ liệu...
          </div>
        ) : !isTeacher && !isMember ? (
          <div className="bg-white rounded-xl border-2 border-dashed p-16 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">
              Bạn chưa tham gia lớp này
            </h2>
            <button
              onClick={handleJoinDirect}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg"
            >
              + Gửi yêu cầu gia nhập
            </button>
          </div>
        ) : (
          <>
            {isTeacher && attendanceError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 mb-4 text-sm">
                {attendanceError}
              </div>
            )}

            {/* TAB DANH SÁCH LỚP */}
            {activeTab === "students" && (
              <div className="bg-white rounded-lg border overflow-hidden shadow-sm">
                <div className="p-4 bg-indigo-50 border-b flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <h3 className="font-bold text-indigo-800">
                    Danh sách sinh viên chính thức ({students.length})
                  </h3>
                  {isTeacher && (
                    <div className="flex flex-wrap items-center gap-3">
                      <form
                        onSubmit={handleAddStudentManually}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          required
                          value={newStudentId}
                          onChange={(e) => setNewStudentId(e.target.value)}
                          placeholder="Nhập MSSV / Tài khoản..."
                          className="border border-indigo-200 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48"
                        />
                        <button
                          type="submit"
                          disabled={addingStudent}
                          className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-md font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
                        >
                          {addingStudent ? "Đang xử lý..." : "+ Thêm tay"}
                        </button>
                      </form>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setImportResult("");
                          setShowImportModal(true);
                        }}
                        className="bg-white text-sm px-4 py-1.5 rounded-md border border-indigo-200 font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-sm"
                      >
                        📥 Nhập Excel
                      </button>
                    </div>
                  )}
                </div>

                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        MSSV
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Họ và Tên
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Trạng thái Mặt
                      </th>
                      {isTeacher && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Thao tác
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isTeacher ? 4 : 3}
                          className="px-6 py-12 text-center text-gray-500 italic"
                        >
                          Lớp học này hiện chưa có sinh viên nào.
                        </td>
                      </tr>
                    ) : (
                      students.map((sv, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800 font-mono">
                            {sv.id}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {sv.name}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`px-3 py-1 text-[10px] font-bold rounded-full border ${sv.faceRegistered ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                            >
                              {sv.faceRegistered ? "Đã ĐK" : "Chưa"}
                            </span>
                          </td>
                          {isTeacher && (
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Xóa sinh viên "${sv.name}" (${sv.id}) khỏi lớp?`)) return;
                                  try {
                                    await classAPI.removeStudent(classId, sv.username);
                                    fetchStudents();
                                  } catch (err) {
                                    alert("❌ Lỗi: " + (err.response?.data || "Không thể xóa sinh viên"));
                                  }
                                }}
                                className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition"
                              >
                                Xóa
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

              </div>
            )}

            {/* TAB CHỜ DUYỆT */}
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

            {/* TAB LỊCH SỬ TỔNG HỢP VỚI CHECKBOX */}
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
                          {new Date(session.datetime).toLocaleDateString("vi-VN", {
                            weekday: "long",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className="text-xs text-indigo-600 font-bold">
                        {session.open ? "Đóng" : "Xem chi tiết"}
                      </span>
                    </button>

                    {session.open && (
                      <div className="border-t">
                        {/* Thanh tìm kiếm + bộ lọc trạng thái cho buổi này */}
                        <div className="p-3 bg-gray-50/60 border-b flex flex-col sm:flex-row gap-2 sm:items-center">
                          <input
                            type="text"
                            value={getSessionFilter(session.id).query}
                            onChange={(e) =>
                              updateSessionFilter(session.id, {
                                query: e.target.value,
                              })
                            }
                            placeholder="Tìm theo tên hoặc MSSV..."
                            className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="flex gap-1 flex-wrap">
                            {[
                              { key: "all", label: "Tất cả" },
                              { key: "present", label: "Có mặt" },
                              { key: "spoof", label: "Nghi gian lận" },
                              { key: "absent", label: "Vắng" },
                            ].map((opt) => {
                              const active =
                                getSessionFilter(session.id).status === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() =>
                                    updateSessionFilter(session.id, {
                                      status: opt.key,
                                    })
                                  }
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                                    active
                                      ? "bg-indigo-600 border-indigo-600 text-white"
                                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-100"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
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
                                Có Mặt
                              </th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                                Ảnh Điểm Danh
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {session.students.length === 0 ? (
                              <tr>
                                <td
                                  colSpan="4"
                                  className="px-4 py-6 text-center text-sm text-gray-500 italic"
                                >
                                  {isTeacher
                                    ? "Không có dữ liệu sinh viên trong buổi này."
                                    : "Bạn vắng mặt trong buổi này."}
                                </td>
                              </tr>
                            ) : applySessionFilter(session.id, session.students)
                                .length === 0 ? (
                              <tr>
                                <td
                                  colSpan="4"
                                  className="px-4 py-6 text-center text-sm text-gray-500 italic"
                                >
                                  Không tìm thấy sinh viên phù hợp với bộ lọc.
                                </td>
                              </tr>
                            ) : (
                              applySessionFilter(session.id, session.students).map((sv, idx) => {
                                const sessionDrafts =
                                  draftChanges[session.id] || {};
                                const isCurrentlyPresent =
                                  sessionDrafts[sv.username] !== undefined
                                    ? sessionDrafts[sv.username]
                                    : sv.isPresent;

                                return (
                                  <tr
                                    key={idx}
                                    className={
                                      isCurrentlyPresent
                                        ? "bg-white"
                                        : "bg-red-50"
                                    }
                                  >
                                    <td className="px-4 py-2 text-sm font-bold">
                                      {sv.mssv}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <span>{sv.fullName}</span>
                                        {sv.spoof && (
                                          <span
                                            title="AI phát hiện khuôn mặt giả mạo (ảnh/video/mặt nạ) khi điểm danh"
                                            className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 border border-red-300"
                                          >
                                            ⚠ Nghi gian lận
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Cột Checkbox */}
                                    <td className="px-4 py-2 text-center">
                                      <button
                                        onClick={() =>
                                          isTeacher &&
                                          handleToggleDraft(session.id, sv)
                                        }
                                        disabled={!isTeacher || isSaving}
                                        className={`mx-auto w-6 h-6 rounded border flex items-center justify-center transition-colors ${
                                          isCurrentlyPresent
                                            ? "bg-green-500 border-green-600 text-white"
                                            : "bg-white border-gray-300 text-transparent"
                                        } ${isTeacher && !isSaving ? "cursor-pointer hover:bg-green-600" : "cursor-default opacity-80"}`}
                                      >
                                        ✓
                                      </button>
                                    </td>

                                    {/* Cột Ảnh + Thời gian chụp */}
                                    <td className="px-4 py-2 text-center">
                                      {sv.imageUrl ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPreviewImage({
                                                src: resolveAttendanceImageUrl(
                                                  sv.imageUrl,
                                                ),
                                                title: sv.fullName,
                                              })
                                            }
                                            className="block rounded-md border focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                          >
                                            <img
                                              src={resolveAttendanceImageUrl(
                                                sv.imageUrl,
                                              )}
                                              alt="AI Checkin"
                                              className="w-10 h-10 object-cover rounded-md"
                                            />
                                          </button>
                                          {sv.checkinTime && (
                                            <span className="text-[10px] font-mono text-gray-500">
                                              {formatAttendanceTime(sv.checkinTime)}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex flex-col items-center gap-1">
                                          <span className="text-[10px] italic text-gray-500 bg-white/50 px-2 py-1 rounded">
                                            {isCurrentlyPresent
                                              ? "Điểm danh tay"
                                              : "Vắng"}
                                          </span>
                                          {isCurrentlyPresent && sv.checkinTime && (
                                            <span className="text-[10px] font-mono text-gray-500">
                                              {formatAttendanceTime(sv.checkinTime)}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                        </div>

                        {/* NÚT XÁC NHẬN LƯU & RESET DÀNH CHO GIÁO VIÊN */}
                        {isTeacher && (
                          <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                            <button
                              onClick={() => handleResetSession(session.id)}
                              disabled={resettingSessionId === session.id}
                              className="bg-white border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-md font-semibold text-sm transition disabled:opacity-50"
                              title="Xóa toàn bộ điểm danh của buổi này (test/demo)"
                            >
                              {resettingSessionId === session.id
                                ? "Đang reset..."
                                : "🔄 Reset điểm danh"}
                            </button>
                            <button
                              onClick={() =>
                                handleConfirmChanges(
                                  session.id,
                                  session.students,
                                )
                              }
                              disabled={
                                isSaving ||
                                !draftChanges[session.id] ||
                                Object.keys(draftChanges[session.id]).length ===
                                  0
                              }
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-bold transition disabled:opacity-50 shadow-sm"
                            >
                              {isSaving
                                ? "Đang lưu..."
                                : "Xác nhận & Lưu điểm danh"}
                            </button>
                          </div>
                        )}
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
          <div className="bg-white rounded-xl shadow-xl w-[32rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              📥 Nhập sinh viên vào lớp từ Excel
            </h2>

            {/* Hướng dẫn cấu trúc file */}
            <div className="mb-4 text-xs text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-100">
              <p className="font-bold mb-1">📌 File Excel bắt buộc có cột:</p>
              <p className="font-mono text-[13px] text-blue-800 font-bold">MSSV</p>
              <p className="mt-2 text-gray-600">
                Cột A (đầu tiên) chứa MSSV sinh viên. Dòng đầu là tiêu đề (bị bỏ qua). Hệ thống sẽ tìm sinh viên theo MSSV và thêm thẳng vào lớp với trạng thái <span className="font-semibold text-green-700">APPROVED</span>.
              </p>
              <p className="mt-1 text-gray-500 italic">
                Nếu sinh viên đang chờ duyệt (PENDING) sẽ được tự động duyệt. Sinh viên đã trong lớp sẽ bị bỏ qua.
              </p>
            </div>

            {/* Vùng chọn file */}
            <div className="border-2 border-dashed border-indigo-200 rounded-lg p-6 flex flex-col items-center justify-center bg-indigo-50/40 mb-4">
              <p className="text-sm text-gray-400 mb-3">
                {selectedFile ? (
                  <span className="text-indigo-700 font-semibold">📄 {selectedFile.name}</span>
                ) : (
                  "Chưa chọn file"
                )}
              </p>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => {
                  setSelectedFile(e.target.files[0]);
                  setImportResult("");
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>

            {/* Kết quả import */}
            {importResult && (
              <div
                className={`p-3 rounded-md text-xs font-medium whitespace-pre-wrap mb-4 ${
                  importResult.startsWith("✅")
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {importResult}
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                  setImportResult("");
                }}
                className="px-4 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-md transition"
              >
                Đóng
              </button>
              <button
                onClick={handleImportExcel}
                disabled={importing || !selectedFile}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 shadow-md transition"
              >
                {importing ? "Đang xử lý..." : "Bắt đầu Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM ẢNH */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {previewImage.title}
              </p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
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
