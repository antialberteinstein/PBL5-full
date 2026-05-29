import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI, cameraAPI, classAPI, roomAPI, scheduleAPI, backendWsBase } from "../services/api.js";
import { logout, getToken } from "../utils/auth.js";
import AdminRoomTab from "./admin/AdminRoomTab";

const CCTVViewer = ({ cam }) => {
  const [frameUrl, setFrameUrl] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!cam.enabled || !cam.id) return;

    const token = getToken();
    let wsUrl = `${backendWsBase}/ws/verify_stream_local?cameraId=${cam.id}&token=${token}`;
    let socket = null;
    
    try {
      socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data);
          if (data?.type === "frame" && socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: "ok", frame_id: data.frame_id }));
          }
        } else if (event.data instanceof ArrayBuffer) {
          const blob = new Blob([event.data], { type: "image/jpeg" });
          const nextUrl = URL.createObjectURL(blob);
          setFrameUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return nextUrl;
          });
        }
      };
    } catch (e) {
      console.error("CCTV connection error:", e);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [cam.id, cam.enabled]);

  if (!frameUrl) {
    return (
      <div className="w-full h-full flex-col items-center justify-center bg-gray-900 text-gray-500 text-xs font-mono flex">
        <p className="text-xl mb-1">📵</p>
        <p>Đang kết nối AI Server...</p>
      </div>
    );
  }

  return <img src={frameUrl} alt={cam.name} className="w-full h-full object-cover" />;
};

// Chuẩn hóa chuỗi để tìm kiếm không phân biệt dấu / hoa thường
const slug = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const DISMISSED_JOBS_KEY = "pbl5.dismissedImportJobs";
const loadDismissed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_JOBS_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const saveDismissed = (set) =>
  localStorage.setItem(DISMISSED_JOBS_KEY, JSON.stringify(Array.from(set)));

// Gợi ý cấu trúc cột Excel theo từng vai trò (hiển thị cho admin trước khi upload)
const EXCEL_HINTS = {
  STUDENT: {
    columns: ["MSSV", "Họ và tên", "Lớp", "Ngày sinh"],
    note: "Username = MSSV, mật khẩu mặc định = ngày sinh dạng DDMMYYYY (vd 13/11/2007 → 13112007). Ngày sinh định dạng dd/MM/yyyy.",
  },
  TEACHER: {
    columns: ["Họ và tên", "SĐT"],
    note: "Username & mật khẩu = họ và tên không dấu viết liền (vd Đặng Thiên Bình → dangthienbinh).",
  },
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const currentUsername = localStorage.getItem("username") || "admin";

  const [activeTab, setActiveTab] = useState("overview"); // overview | students | teachers | classes | cctv

  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0, cameras: 0 });
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modal tạo sinh viên / giáo viên
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState("STUDENT");
  const [newStudent, setNewStudent] = useState({ mssv: "", fullName: "", lopSinhHoat: "", birth: "" });
  const [newTeacher, setNewTeacher] = useState({ fullName: "", phone: "" });
  const [newClassObj, setNewClassObj] = useState({
    name: "",
    teacherId: "",
    roomId: "",
    dayOfWeek: "",
    startPeriod: "",
    endPeriod: "",
  });
  const [creating, setCreating] = useState(false);

  // Modal import Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRole, setImportRole] = useState("STUDENT");
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  // Job import chạy nền (poll backend)
  const [importJobs, setImportJobs] = useState([]);
  const [dismissedJobIds, setDismissedJobIds] = useState(loadDismissed);
  const refreshedJobsRef = useRef(new Set());

  // Tìm kiếm / lọc / sắp xếp sinh viên
  const [studentSearch, setStudentSearch] = useState("");
  const [studentLopFilter, setStudentLopFilter] = useState("");
  const [studentFaceFilter, setStudentFaceFilter] = useState("ALL"); // ALL | YES | NO
  const [studentSort, setStudentSort] = useState({ field: "mssv", dir: "asc" });

  // Tìm kiếm / sắp xếp giáo viên
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherSort, setTeacherSort] = useState({ field: "fullName", dir: "asc" });

  // Phân trang
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(20);
  const [teacherPage, setTeacherPage] = useState(1);
  const [teacherPageSize, setTeacherPageSize] = useState(20);

  // Modal camera (CCTV)
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [cameraForm, setCameraForm] = useState({
    name: "",
    location: "",
    streamUrl: "",
    aiServerUrl: "",
    enabled: true,
  });

  const handleLogout = () => logout(navigate);

  useEffect(() => {
    if (activeTab === "overview") fetchStats();
    else if (activeTab === "students") fetchStudents();
    else if (activeTab === "teachers") fetchTeachers();
    else if (activeTab === "classes") {
      fetchClasses();
      fetchTeachers();
      fetchRooms();
    }
    else if (activeTab === "cctv") {
      fetchCameras();
      fetchRooms();
    }
  }, [activeTab]);

  // 1. Khi mount: lấy danh sách job hiện tại từ backend (rehydrate sau khi reload/đăng nhập lại)
  useEffect(() => {
    adminAPI
      .listImportJobs()
      .then((r) => setImportJobs(r.data || []))
      .catch(() => {});
  }, []);

  // 2. Poll mỗi 1.5s khi còn job đang chạy
  const hasActiveJob = importJobs.some((j) => j.status === "PENDING" || j.status === "RUNNING");
  useEffect(() => {
    if (!hasActiveJob) return undefined;
    const interval = setInterval(() => {
      adminAPI
        .listImportJobs()
        .then((r) => setImportJobs(r.data || []))
        .catch(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, [hasActiveJob]);

  // 3. Khi job chuyển sang DONE/ERROR -> refresh danh sách tương ứng (chỉ 1 lần/job)
  useEffect(() => {
    importJobs.forEach((j) => {
      if ((j.status === "DONE" || j.status === "ERROR") && !refreshedJobsRef.current.has(j.id)) {
        refreshedJobsRef.current.add(j.id);
        if (j.role === "STUDENT") fetchStudents();
        else if (j.role === "TEACHER") fetchTeachers();
        if (activeTab === "overview") fetchStats();
      }
    });
  }, [importJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissJob = (id) => {
    setDismissedJobIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  };

  const visibleJobs = importJobs.filter((j) => !dismissedJobIds.has(j.id));

  // Danh sách lớp sinh hoạt riêng biệt (cho dropdown filter)
  const lopOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.lopSinhHoat) set.add(s.lopSinhHoat);
    });
    return Array.from(set).sort();
  }, [students]);

  const studentsView = useMemo(() => {
    let list = students;
    const q = slug(studentSearch);
    if (q) {
      list = list.filter(
        (s) =>
          slug(s.fullName).includes(q) ||
          slug(s.mssv).includes(q) ||
          slug(s.username).includes(q) ||
          slug(s.lopSinhHoat).includes(q),
      );
    }
    if (studentLopFilter) list = list.filter((s) => s.lopSinhHoat === studentLopFilter);
    if (studentFaceFilter !== "ALL")
      list = list.filter((s) => (studentFaceFilter === "YES") === !!s.faceRegistered);
    const dir = studentSort.dir === "asc" ? 1 : -1;
    return [...list].sort(
      (a, b) =>
        (a[studentSort.field] || "")
          .toString()
          .localeCompare((b[studentSort.field] || "").toString(), "vi", {
            numeric: studentSort.field === "mssv",
          }) * dir,
    );
  }, [students, studentSearch, studentLopFilter, studentFaceFilter, studentSort]);

  const teachersView = useMemo(() => {
    let list = teachers;
    const q = slug(teacherSearch);
    if (q) {
      list = list.filter(
        (t) => slug(t.fullName).includes(q) || slug(t.username).includes(q),
      );
    }
    const dir = teacherSort.dir === "asc" ? 1 : -1;
    return [...list].sort(
      (a, b) =>
        (a[teacherSort.field] || "")
          .toString()
          .localeCompare((b[teacherSort.field] || "").toString(), "vi") * dir,
    );
  }, [teachers, teacherSearch, teacherSort]);

  // Khi filter/sort thay đổi -> đưa về trang 1 để không bị trống bảng
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearch, studentLopFilter, studentFaceFilter, studentSort, studentPageSize]);
  useEffect(() => {
    setTeacherPage(1);
  }, [teacherSearch, teacherSort, teacherPageSize]);

  // View đã cắt theo trang
  const studentsPaged = useMemo(
    () =>
      studentsView.slice(
        (studentPage - 1) * studentPageSize,
        studentPage * studentPageSize,
      ),
    [studentsView, studentPage, studentPageSize],
  );
  const teachersPaged = useMemo(
    () =>
      teachersView.slice(
        (teacherPage - 1) * teacherPageSize,
        teacherPage * teacherPageSize,
      ),
    [teachersView, teacherPage, teacherPageSize],
  );

  const fetchStats = async () => {
    try {
      const [s, t, c, cam] = await Promise.all([
        adminAPI.getStudents(),
        adminAPI.getTeachers(),
        adminAPI.getAllClasses(),
        cameraAPI.getCameras(),
      ]);
      setStats({
        students: s.data?.length || 0,
        teachers: t.data?.length || 0,
        classes: c.data?.length || 0,
        cameras: cam.data?.length || 0,
      });
    } catch (e) {
      console.error("Lỗi lấy thống kê:", e);
    }
  };

  const fetchStudents = async () => {
    try {
      setDataLoading(true);
      const res = await adminAPI.getStudents();
      setStudents(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      setDataLoading(true);
      const res = await adminAPI.getTeachers();
      setTeachers(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setDataLoading(true);
      const res = await adminAPI.getAllClasses();
      setClasses(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchCameras = async () => {
    try {
      setDataLoading(true);
      const res = await cameraAPI.getCameras();
      setCameras(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await roomAPI.getAllRooms();
      setRooms(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const openCreateModal = (role) => {
    setCreateRole(role);
    setNewStudent({ mssv: "", fullName: "", lopSinhHoat: "", birth: "" });
    setNewTeacher({ fullName: "", phone: "" });
    setNewClassObj({ name: "", teacherId: "", roomId: "", dayOfWeek: "", startPeriod: "", endPeriod: "" });
    setShowCreateModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      if (createRole === "CLASS") {
        const scheduleFields = [
          newClassObj.roomId,
          newClassObj.dayOfWeek,
          newClassObj.startPeriod,
          newClassObj.endPeriod,
        ];
        const filledCount = scheduleFields.filter((v) => v !== "" && v !== null && v !== undefined).length;
        if (filledCount > 0 && filledCount < 4) {
          alert("Vui lòng điền đầy đủ phòng, thứ, tiết bắt đầu và tiết kết thúc, hoặc để trống toàn bộ phần lịch học.");
          setCreating(false);
          return;
        }
        if (filledCount === 4) {
          const sp = parseInt(newClassObj.startPeriod, 10);
          const ep = parseInt(newClassObj.endPeriod, 10);
          if (sp > ep) {
            alert("Tiết bắt đầu phải nhỏ hơn hoặc bằng tiết kết thúc.");
            setCreating(false);
            return;
          }
        }

        const classRes = await classAPI.createClass({
          name: newClassObj.name,
          teacherId: parseInt(newClassObj.teacherId, 10),
        });
        const newClassId = classRes.data?.id;

        if (filledCount === 4 && newClassId) {
          try {
            await scheduleAPI.assignSchedule({
              classId: newClassId,
              roomId: parseInt(newClassObj.roomId, 10),
              dayOfWeek: parseInt(newClassObj.dayOfWeek, 10),
              startPeriod: parseInt(newClassObj.startPeriod, 10),
              endPeriod: parseInt(newClassObj.endPeriod, 10),
            });
            alert("Tạo lớp học và xếp lịch thành công!");
          } catch (scheduleErr) {
            alert(
              "Tạo lớp thành công nhưng xếp lịch thất bại: " +
                (scheduleErr.response?.data || scheduleErr.message || "Lỗi không xác định"),
            );
          }
        } else {
          alert("Tạo lớp học thành công!");
        }
        setShowCreateModal(false);
        fetchClasses();
      } else {
        const payload =
          createRole === "STUDENT"
            ? { role: "STUDENT", ...newStudent }
            : { role: "TEACHER", ...newTeacher };
        await adminAPI.createUser(payload);
        alert("Tạo tài khoản thành công!");
        setShowCreateModal(false);
        if (createRole === "STUDENT") fetchStudents();
        else fetchTeachers();
      }
    } catch (error) {
      alert("Lỗi: " + (error.response?.data || "Không thể tạo tài khoản"));
    } finally {
      setCreating(false);
    }
  };

  const openImportModal = (role) => {
    setImportRole(role);
    setSelectedFile(null);
    setImportResult("");
    setShowImportModal(true);
  };

  const handleImportExcel = async () => {
    if (!selectedFile) return alert("Vui lòng chọn file!");
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("role", importRole);
    try {
      setImporting(true);
      setImportResult("");
      const res = await adminAPI.importExcel(formData);
      const job = res.data;
      // Thêm job mới vào state để widget hiển thị ngay; polling sẽ tự cập nhật tiến trình.
      setImportJobs((prev) => [job, ...prev.filter((p) => p.id !== job.id)]);
      // Cho phép widget hiển thị (nếu trước đó user đã ẩn job cùng id)
      setDismissedJobIds((prev) => {
        if (!prev.has(job.id)) return prev;
        const next = new Set(prev);
        next.delete(job.id);
        saveDismissed(next);
        return next;
      });
      // Đóng popup ngay - job chạy ngầm dưới backend
      setShowImportModal(false);
      setSelectedFile(null);
    } catch (error) {
      setImportResult("❌ Lỗi: " + (error.response?.data || "Không khởi tạo được job import"));
    } finally {
      setImporting(false);
    }
  };

  const handleResetPassword = async (username) => {
    const newPass = prompt(`Nhập mật khẩu mới cho [${username}]:`);
    if (!newPass) return;
    if (newPass.trim().length < 4) return alert("Mật khẩu quá ngắn!");
    try {
      const res = await adminAPI.resetPassword(username, newPass);
      alert("✅ " + (res.data || "Đã đặt lại mật khẩu!"));
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể reset"));
    }
  };

  const handleDeleteUser = async (username, refetch) => {
    if (!window.confirm(`Xóa tài khoản [${username}] khỏi hệ thống?`)) return;
    try {
      await adminAPI.deleteUser(username);
      alert("Đã xóa tài khoản!");
      refetch();
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể xóa"));
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm(`Xóa vĩnh viễn lớp học #${classId}?`)) return;
    try {
      await adminAPI.deleteClass(classId);
      alert("Đã xóa lớp học!");
      fetchClasses();
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể xóa lớp"));
    }
  };

  // ----- Camera (CCTV) -----
  const openCameraModal = (cam) => {
    if (cam) {
      setEditingCamera(cam);
      setCameraForm({
        name: cam.name || "",
        location: cam.location || "",
        streamUrl: cam.streamUrl || "",
        aiServerUrl: cam.aiServerUrl || "",
        enabled: cam.enabled ?? true,
      });
    } else {
      setEditingCamera(null);
      setCameraForm({ name: "", location: "", streamUrl: "", aiServerUrl: "", enabled: true });
    }
    setShowCameraModal(true);
  };

  const handleSaveCamera = async (e) => {
    e.preventDefault();
    try {
      if (editingCamera) {
        await cameraAPI.updateCamera(editingCamera.id, cameraForm);
      } else {
        await cameraAPI.createCamera(cameraForm);
      }
      setShowCameraModal(false);
      fetchCameras();
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể lưu camera"));
    }
  };

  const handleDeleteCamera = async (id) => {
    if (!window.confirm(`Xóa camera #${id}?`)) return;
    try {
      await cameraAPI.deleteCamera(id);
      fetchCameras();
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể xóa camera"));
    }
  };

  const tabClass = (tab, activeColor = "bg-purple-600") =>
    `w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
      activeTab === tab ? `${activeColor} text-white shadow-md` : "hover:bg-gray-800 text-gray-400"
    }`;

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* SIDEBAR */}
      <div className="w-64 bg-gray-900 text-gray-300 flex flex-col justify-between shadow-lg z-10">
        <div className="p-5">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white text-xl shadow-md">
              A
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">Hệ Thống Admin</h2>
              <span className="text-[11px] text-gray-400 font-medium">Quyền hạn tối cao</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setActiveTab("overview")} className={tabClass("overview")}>
              📊 <span>Tổng quan</span>
            </button>
            <button onClick={() => setActiveTab("students")} className={tabClass("students")}>
              🎓 <span>Quản lý sinh viên</span>
            </button>
            <button onClick={() => setActiveTab("teachers")} className={tabClass("teachers")}>
              👨‍🏫 <span>Quản lý giáo viên</span>
            </button>
            <button onClick={() => setActiveTab("classes")} className={tabClass("classes")}>
              🏫 <span>Quản lý lớp học</span>
            </button>
            <button onClick={() => setActiveTab("rooms")} className={tabClass("rooms")}>
              Phòng học & Lịch
            </button>
            <button onClick={() => setActiveTab("cctv")} className={tabClass("cctv", "bg-red-600")}>
              CCTV (Quản trị)
            </button>
          </nav>
        </div>

        <div className="p-5 border-t border-gray-800 bg-gray-950/40 flex items-center justify-between text-xs">
          <div className="truncate">
            <p className="text-white font-medium truncate">{currentUsername}</p>
            <p className="text-gray-500 font-mono">ADMIN</p>
          </div>
          <button onClick={handleLogout} className="text-red-400 font-bold hover:text-red-300 transition-colors">
            Đăng xuất
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            {activeTab === "overview" && "Tổng quan thống kê"}
            {activeTab === "students" && "Quản lý tài khoản sinh viên"}
            {activeTab === "teachers" && "Quản lý tài khoản giáo viên"}
            {activeTab === "classes" && "Quản lý lớp học đào tạo"}
            {activeTab === "cctv" && "Quản lý hệ thống CCTV"}
          </h2>
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-600">
            SERVER ONLINE
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: "Sinh viên", value: stats.students, icon: "🎓", tab: "students" },
                { label: "Giáo viên", value: stats.teachers, icon: "👨‍🏫", tab: "teachers" },
                { label: "Lớp học", value: stats.classes, icon: "🏫", tab: "classes" },
              ].map((c) => (
                <div
                  key={c.tab}
                  onClick={() => setActiveTab(c.tab)}
                  className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-gray-400 font-medium">{c.label}</p>
                    <h3 className="text-4xl font-extrabold text-gray-800 mt-1">{c.value}</h3>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-xl">
                    {c.icon}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STUDENTS */}
          {activeTab === "students" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm">
                  Danh sách sinh viên ({studentsView.length}/{students.length})
                </h3>
                <div className="flex space-x-2">
                  <button onClick={() => openImportModal("STUDENT")} className="bg-green-600 text-white text-xs px-4 py-2 rounded-md font-bold hover:bg-green-700">
                    📥 Nhập Excel
                  </button>
                  <button onClick={() => openCreateModal("STUDENT")} className="bg-purple-600 text-white text-xs px-4 py-2 rounded-md font-bold hover:bg-purple-700">
                    + Thêm sinh viên
                  </button>
                </div>
              </div>

              {/* Toolbar: tìm / lọc / sắp xếp */}
              <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="🔍 Tìm theo MSSV / họ tên / lớp..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={studentLopFilter}
                  onChange={(e) => setStudentLopFilter(e.target.value)}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Lớp sinh hoạt: tất cả</option>
                  {lopOptions.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <select
                  value={studentFaceFilter}
                  onChange={(e) => setStudentFaceFilter(e.target.value)}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">Khuôn mặt: tất cả</option>
                  <option value="YES">Đã đăng ký khuôn mặt</option>
                  <option value="NO">Chưa đăng ký khuôn mặt</option>
                </select>
                <select
                  value={`${studentSort.field}|${studentSort.dir}`}
                  onChange={(e) => {
                    const [field, dir] = e.target.value.split("|");
                    setStudentSort({ field, dir });
                  }}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="mssv|asc">Sắp xếp: MSSV ↑</option>
                  <option value="mssv|desc">Sắp xếp: MSSV ↓</option>
                  <option value="fullName|asc">Sắp xếp: Tên A → Z</option>
                  <option value="fullName|desc">Sắp xếp: Tên Z → A</option>
                </select>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">MSSV</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Họ và tên</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Lớp SH</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Khuôn mặt</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {dataLoading ? (
                      <tr><td colSpan="5" className="py-10 text-center text-gray-400 italic">Đang tải...</td></tr>
                    ) : students.length === 0 ? (
                      <tr><td colSpan="5" className="py-10 text-center text-gray-400 italic">Chưa có sinh viên nào.</td></tr>
                    ) : studentsView.length === 0 ? (
                      <tr><td colSpan="5" className="py-10 text-center text-gray-400 italic">Không có sinh viên nào khớp bộ lọc.</td></tr>
                    ) : (
                      studentsPaged.map((s) => (
                        <tr key={s.username} className="hover:bg-gray-50/60">
                          <td className="px-6 py-3.5 font-bold text-gray-900 font-mono">{s.mssv || s.username}</td>
                          <td className="px-6 py-3.5 text-gray-700">{s.fullName || "—"}</td>
                          <td className="px-6 py-3.5 text-gray-600">{s.lopSinhHoat || "—"}</td>
                          <td className="px-6 py-3.5 text-center">
                            {s.faceRegistered ? (
                              <span className="text-green-600 text-xs font-bold">✓ Đã đăng ký</span>
                            ) : (
                              <span className="text-gray-400 text-xs">Chưa</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right space-x-1.5">
                            <button onClick={() => handleResetPassword(s.username)} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded">Reset Pass</button>
                            <button onClick={() => handleDeleteUser(s.username, fetchStudents)} className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded">Xóa</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <Pagination
                  page={studentPage}
                  pageSize={studentPageSize}
                  total={studentsView.length}
                  onPage={setStudentPage}
                  onPageSize={setStudentPageSize}
                />
              </div>
            </div>
          )}

          {/* TEACHERS */}
          {activeTab === "teachers" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm">
                  Danh sách giáo viên ({teachersView.length}/{teachers.length})
                </h3>
                <div className="flex space-x-2">
                  <button onClick={() => openImportModal("TEACHER")} className="bg-green-600 text-white text-xs px-4 py-2 rounded-md font-bold hover:bg-green-700">
                    📥 Nhập Excel
                  </button>
                  <button onClick={() => openCreateModal("TEACHER")} className="bg-purple-600 text-white text-xs px-4 py-2 rounded-md font-bold hover:bg-purple-700">
                    + Thêm giáo viên
                  </button>
                </div>
              </div>

              {/* Toolbar: tìm / sắp xếp */}
              <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="🔍 Tìm theo họ tên / tài khoản..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={`${teacherSort.field}|${teacherSort.dir}`}
                  onChange={(e) => {
                    const [field, dir] = e.target.value.split("|");
                    setTeacherSort({ field, dir });
                  }}
                  className="border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="fullName|asc">Sắp xếp: Tên A → Z</option>
                  <option value="fullName|desc">Sắp xếp: Tên Z → A</option>
                </select>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tài khoản</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Họ và tên</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">SĐT</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {dataLoading ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400 italic">Đang tải...</td></tr>
                    ) : teachers.length === 0 ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400 italic">Chưa có giáo viên nào.</td></tr>
                    ) : teachersView.length === 0 ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400 italic">Không có giáo viên nào khớp bộ lọc.</td></tr>
                    ) : (
                      teachersPaged.map((t) => (
                        <tr key={t.username} className="hover:bg-gray-50/60">
                          <td className="px-6 py-3.5 font-bold text-gray-900 font-mono">{t.username}</td>
                          <td className="px-6 py-3.5 text-gray-700">{t.fullName || "—"}</td>
                          <td className="px-6 py-3.5 text-gray-600 font-mono">{t.phone || "—"}</td>
                          <td className="px-6 py-3.5 text-right space-x-1.5">
                            <button onClick={() => handleResetPassword(t.username)} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded">Reset Pass</button>
                            <button onClick={() => handleDeleteUser(t.username, fetchTeachers)} className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded">Xóa</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <Pagination
                  page={teacherPage}
                  pageSize={teacherPageSize}
                  total={teachersView.length}
                  onPage={setTeacherPage}
                  onPageSize={setTeacherPageSize}
                />
              </div>
            </div>
          )}

          {/* CLASSES */}
          {activeTab === "classes" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm">Tổng số lớp học: {classes.length}</h3>
                <button onClick={() => {
                    setCreateRole("CLASS");
                    setNewClassObj({ name: "", teacherId: "", roomId: "", dayOfWeek: "", startPeriod: "", endPeriod: "" });
                    setShowCreateModal(true);
                }} className="bg-purple-600 text-white text-xs px-4 py-2 rounded-md font-bold hover:bg-purple-700">
                  + Tạo lớp học
                </button>
              </div>
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Mã lớp</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tên lớp</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">ID Giáo viên</th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {dataLoading ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400 italic">Đang tải...</td></tr>
                    ) : classes.length === 0 ? (
                      <tr><td colSpan="4" className="py-10 text-center text-gray-400 italic">Chưa có lớp học nào.</td></tr>
                    ) : (
                      classes.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50/60">
                          <td className="px-6 py-4 font-bold text-purple-600 font-mono">#{c.id}</td>
                          <td className="px-6 py-4 text-gray-800 font-semibold">{c.name}</td>
                          <td className="px-6 py-4 text-center font-mono text-gray-600">GV-{c.teacherId ?? "—"}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button onClick={() => setActiveTab("rooms")} className="text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded shadow-sm">Xếp lịch</button>
                            <button onClick={() => handleDeleteClass(c.id)} className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded shadow-sm">Xóa lớp</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* ROOMS & SCHEDULE */}
          {activeTab === "rooms" && (
             <AdminRoomTab />
          )}

          {/* CCTV */}
          {activeTab === "cctv" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                    Hệ thống camera CCTV ({cameras.length})
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.length === 0 ? (
                  <div className="col-span-2 py-10 text-center text-gray-400 italic">Chưa có phòng học nào.</div>
                ) : (
                  rooms.filter(room => room.camera).map((room) => (
                    <div key={room.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                      <div className="bg-black aspect-video relative">
                        <div className="absolute top-2 left-2 z-10 bg-black/60 border border-gray-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-green-400">
                          CAM_{room.name}
                        </div>
                        <CCTVViewer cam={room.camera} />
                      </div>
                      <div className="p-3 flex items-center justify-between">
                        <div className="text-xs text-gray-600">
                          <p className="font-semibold text-gray-800">CCTV Phòng {room.name}</p>
                          <p className="font-mono text-[11px]">{room.camera.aiServerUrl || "—"}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* WIDGET TIẾN TRÌNH IMPORT (chạy ngầm) */}
      {visibleJobs.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 space-y-3">
          {visibleJobs.map((job) => (
            <ImportJobCard key={job.id} job={job} onDismiss={() => dismissJob(job.id)} />
          ))}
        </div>
      )}

      {/* MODAL: TẠO TÀI KHOẢN */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[28rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {createRole === "STUDENT" ? "Thêm sinh viên mới" : (createRole === "CLASS" ? "Thêm lớp học mới" : "Thêm giáo viên mới")}
            </h2>
            <form onSubmit={handleCreate} className="space-y-3">
              {createRole === "STUDENT" ? (
                <>
                  <Field label="MSSV (dùng làm tài khoản)" value={newStudent.mssv} onChange={(v) => setNewStudent({ ...newStudent, mssv: v })} required />
                  <Field label="Họ và tên" value={newStudent.fullName} onChange={(v) => setNewStudent({ ...newStudent, fullName: v })} required />
                  <Field label="Lớp sinh hoạt" value={newStudent.lopSinhHoat} onChange={(v) => setNewStudent({ ...newStudent, lopSinhHoat: v })} />
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Ngày sinh (mật khẩu = DDMMYYYY)</label>
                    <input type="date" required value={newStudent.birth} onChange={(e) => setNewStudent({ ...newStudent, birth: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                </>
              ) : createRole === "CLASS" ? (
                <>
                  <Field label="Tên lớp học" value={newClassObj.name} onChange={(v) => setNewClassObj({ ...newClassObj, name: v })} required />
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Giáo viên phụ trách</label>
                    <select required value={newClassObj.teacherId} onChange={(e) => setNewClassObj({ ...newClassObj, teacherId: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                      <option value="">-- Chọn giáo viên --</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.fullName} (ID: {t.id})</option>)}
                    </select>
                  </div>

                  <div className="pt-3 mt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-600 mb-2">Lịch học (tùy chọn — điền đủ 4 ô để xếp 1 buổi học)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Phòng học</label>
                        <select value={newClassObj.roomId} onChange={(e) => setNewClassObj({ ...newClassObj, roomId: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="">-- Chọn phòng --</option>
                          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Thứ trong tuần</label>
                        <select value={newClassObj.dayOfWeek} onChange={(e) => setNewClassObj({ ...newClassObj, dayOfWeek: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="">-- Chọn thứ --</option>
                          <option value="2">Thứ 2</option>
                          <option value="3">Thứ 3</option>
                          <option value="4">Thứ 4</option>
                          <option value="5">Thứ 5</option>
                          <option value="6">Thứ 6</option>
                          <option value="7">Thứ 7</option>
                          <option value="8">Chủ nhật</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tiết bắt đầu</label>
                        <select value={newClassObj.startPeriod} onChange={(e) => setNewClassObj({ ...newClassObj, startPeriod: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="">--</option>
                          {[1,2,3,4,5,6,7,8,9,10].map(p => <option key={p} value={p}>Tiết {p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Tiết kết thúc</label>
                        <select value={newClassObj.endPeriod} onChange={(e) => setNewClassObj({ ...newClassObj, endPeriod: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                          <option value="">--</option>
                          {[1,2,3,4,5,6,7,8,9,10].map(p => <option key={p} value={p}>Tiết {p}</option>)}
                        </select>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2 italic">Bỏ trống nếu chỉ muốn tạo lớp, xếp lịch sau tại tab "Phòng học & Lịch". Một lớp có thể có nhiều buổi học khác nhau.</p>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Họ và tên (sinh tài khoản không dấu)" value={newTeacher.fullName} onChange={(v) => setNewTeacher({ ...newTeacher, fullName: v })} required />
                  <Field label="Số điện thoại (SĐT)" value={newTeacher.phone} onChange={(v) => setNewTeacher({ ...newTeacher, phone: v })} />
                </>
              )}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-md">Hủy</button>
                <button type="submit" disabled={creating} className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50 shadow-md">
                  {creating ? "Đang xử lý..." : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT EXCEL */}
      {showImportModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[32rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Nhập {importRole === "STUDENT" ? "sinh viên" : "giáo viên"} từ Excel
            </h2>

            <div className="mb-4 text-xs text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">
              <p className="font-bold mb-1">📌 File Excel bắt buộc có các cột:</p>
              <p className="font-mono text-[12px] text-blue-800">
                {EXCEL_HINTS[importRole].columns.join("  |  ")}
              </p>
              <p className="mt-2 text-gray-600">{EXCEL_HINTS[importRole].note}</p>
              <p className="mt-1 text-gray-500 italic">Thiếu cột nào hệ thống sẽ báo lỗi cụ thể.</p>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 mb-4">
              <input type="file" accept=".xlsx, .xls" onChange={(e) => setSelectedFile(e.target.files[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700" />
            </div>

            {importResult && (
              <div className={`p-3 rounded-md text-xs font-medium whitespace-pre-wrap ${importResult.includes("❌") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {importResult}
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" onClick={() => setShowImportModal(false)} className="px-4 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-md">Đóng</button>
              <button onClick={handleImportExcel} disabled={importing || !selectedFile} className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 shadow-md">
                {importing ? "Đang xử lý..." : "Bắt đầu Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CAMERA */}
      {showCameraModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[28rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editingCamera ? `Sửa camera #${editingCamera.id}` : "Thêm camera mới"}
            </h2>
            <form onSubmit={handleSaveCamera} className="space-y-3">
              <Field label="Tên camera" value={cameraForm.name} onChange={(v) => setCameraForm({ ...cameraForm, name: v })} required />
              <Field label="Vị trí" value={cameraForm.location} onChange={(v) => setCameraForm({ ...cameraForm, location: v })} />
              <Field label="URL luồng video (stream)" value={cameraForm.streamUrl} onChange={(v) => setCameraForm({ ...cameraForm, streamUrl: v })} />
              <Field label="URL AI server" value={cameraForm.aiServerUrl} onChange={(v) => setCameraForm({ ...cameraForm, aiServerUrl: v })} />
              <label className="flex items-center space-x-2 text-sm text-gray-700">
                <input type="checkbox" checked={cameraForm.enabled} onChange={(e) => setCameraForm({ ...cameraForm, enabled: e.target.checked })} />
                <span>Đang hoạt động</span>
              </label>
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowCameraModal(false)} className="px-4 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-md">Hủy</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-md">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Thẻ tiến trình một job import - hiển thị nổi ở góc dưới bên phải
const ImportJobCard = ({ job, onDismiss }) => {
  const isDone = job.status === "DONE";
  const isError = job.status === "ERROR";
  const isFinished = isDone || isError;
  const pct =
    job.total > 0
      ? Math.min(100, Math.round((job.processed / job.total) * 100))
      : isDone
        ? 100
        : 0;
  const barColor = isError ? "bg-red-500" : isDone ? "bg-green-500" : "bg-indigo-500";
  const roleLabel = job.role === "STUDENT" ? "sinh viên" : "giáo viên";

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-gray-800">
          Import {roleLabel}{" "}
          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${isError ? "bg-red-100 text-red-700" : isDone ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"}`}>
            {job.status}
          </span>
        </span>
        {isFinished && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-700 font-bold text-sm"
            aria-label="Đóng"
          >
            ✕
          </button>
        )}
      </div>

      {isError ? (
        <p className="text-red-600 whitespace-pre-wrap break-words">
          ❌ {job.errorMessage || "Job lỗi"}
        </p>
      ) : (
        <>
          <div className="flex justify-between text-gray-600 mb-1 font-mono">
            <span>
              {job.processed}/{job.total || "?"}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 mt-2">
            <span className="text-green-600 font-semibold">✓ {job.succeeded} thành công</span>
            <span className="text-red-500 font-semibold">✗ {job.failed} lỗi</span>
          </div>
          {isDone && (
            <p className="text-green-700 font-bold mt-2">✅ Hoàn tất</p>
          )}
        </>
      )}
    </div>
  );
};

// Thanh phân trang dùng chung cho bảng sinh viên / giáo viên
const Pagination = ({ page, pageSize, total, onPage, onPageSize }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  // Sinh dải số trang gọn: 1 ... p-1 p p+1 ... last
  const items = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
  } else {
    items.push(1);
    if (safePage > 4) items.push("…");
    const from = Math.max(2, safePage - 1);
    const to = Math.min(totalPages - 1, safePage + 1);
    for (let i = from; i <= to; i++) items.push(i);
    if (safePage < totalPages - 3) items.push("…");
    items.push(totalPages);
  }

  const btn =
    "px-2 py-1 rounded text-xs font-semibold disabled:opacity-30 hover:bg-gray-200";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-gray-50 text-xs text-gray-600">
      <div className="flex items-center gap-2">
        <span>
          Hiển thị <b>{start}</b>–<b>{end}</b> / <b>{total}</b>
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="border border-gray-200 rounded px-2 py-1 ml-2"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>/ trang</span>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={safePage === 1} onClick={() => onPage(1)} className={btn} aria-label="Trang đầu">«</button>
        <button disabled={safePage === 1} onClick={() => onPage(safePage - 1)} className={btn} aria-label="Trang trước">‹</button>
        {items.map((it, i) =>
          it === "…" ? (
            <span key={`dots-${i}`} className="px-2 text-gray-400">…</span>
          ) : (
            <button
              key={it}
              onClick={() => onPage(it)}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                it === safePage
                  ? "bg-purple-600 text-white shadow-sm"
                  : "hover:bg-gray-200"
              }`}
            >
              {it}
            </button>
          ),
        )}
        <button disabled={safePage === totalPages} onClick={() => onPage(safePage + 1)} className={btn} aria-label="Trang sau">›</button>
        <button disabled={safePage === totalPages} onClick={() => onPage(totalPages)} className={btn} aria-label="Trang cuối">»</button>
      </div>
    </div>
  );
};

// Ô nhập liệu dùng chung
const Field = ({ label, value, onChange, required = false }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
    <input
      type="text"
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
    />
  </div>
);

export default AdminDashboard;
