import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { adminAPI } from "../services/api.js";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const userRole = localStorage.getItem("role") || "ADMIN";
  const currentUsername = localStorage.getItem("username") || "admin";

  // --- QUẢN LÝ TABS NỘI BỘ ---
  const [activeTab, setActiveTab] = useState("overview"); // overview, users, classes, cctv

  // --- STATE LƯU TRỮ DỮ LIỆU ---
  const [stats, setStats] = useState({ totalUsers: 0, totalClasses: 0 });
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // --- MODAL: TẠO NGƯỜI DÙNG ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    code: "",
    password: "",
    email: "",
    fullName: "",
    role: "STUDENT",
  });
  const [creating, setCreating] = useState(false);

  // --- MODAL: IMPORT EXCEL ---
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [importRole, setImportRole] = useState("STUDENT");

  // Hàm Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login");
  };

  // --- EFFECT THEO DÕI CHUYỂN TAB ĐỂ TẢI DỮ LIỆU ---
  useEffect(() => {
    if (activeTab === "overview") {
      fetchStats();
    } else if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "classes") {
      fetchClasses();
    }
  }, [activeTab]);

  // Đếm số lượng thực tế từ 2 API có sẵn, KHÔNG dùng mock data
  const fetchStats = async () => {
    try {
      const [usersRes, classesRes] = await Promise.all([
        adminAPI.getAllUsers(),
        adminAPI.getAllClasses(),
      ]);

      setStats({
        totalUsers: usersRes.data?.length || 0,
        totalClasses: classesRes.data?.length || 0,
      });
    } catch (e) {
      console.error("Lỗi khi lấy dữ liệu thống kê:", e);
    }
  };

  const fetchUsers = async () => {
    try {
      setDataLoading(true);
      const response = await adminAPI.getAllUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error("Lỗi lấy danh sách user:", error);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setDataLoading(true);
      const response = await adminAPI.getAllClasses();
      setClasses(response.data || []);
    } catch (error) {
      console.error("Lỗi lấy danh sách lớp học:", error);
    } finally {
      setDataLoading(false);
    }
  };

  // 1. Xử lý Tạo tài khoản thủ công
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      await adminAPI.createUser(newUser);
      alert("Tạo tài khoản thành công!");
      setShowCreateModal(false);
      setNewUser({
        username: "",
        code: "",
        password: "",
        email: "",
        fullName: "",
        role: "STUDENT",
      });
      if (activeTab === "users") fetchUsers();
      if (activeTab === "overview") fetchStats();
    } catch (error) {
      alert("Lỗi: " + (error.response?.data || "Không thể tạo tài khoản"));
    } finally {
      setCreating(false);
    }
  };

  // 2. Xử lý Upload Excel
  const handleImportExcel = async (e) => {
    e.preventDefault();
    if (!selectedFile) return alert("Vui lòng chọn file!");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("role", importRole);

    try {
      setImporting(true);
      setImportResult("Đang xử lý dữ liệu...");
      const response = await adminAPI.importExcel(formData);
      setImportResult("✅ " + response.data);
      setSelectedFile(null);
      if (activeTab === "users") fetchUsers();
      if (activeTab === "overview") fetchStats();
    } catch (error) {
      setImportResult("❌ Lỗi: " + (error.response?.data || "Import thất bại"));
    } finally {
      setImporting(false);
    }
  };

  // 3. Xử lý Đặt lại mật khẩu tài khoản
  const handleResetPassword = async (username) => {
    const newPass = prompt(`Nhập mật khẩu mới cho tài khoản [${username}]:`);
    if (!newPass) return;
    if (newPass.trim().length < 4) return alert("Mật khẩu quá ngắn!");

    try {
      const response = await adminAPI.resetPassword(username, newPass);
      alert("✅ " + (response.data || "Đã đặt lại mật khẩu thành công!"));
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể reset mật khẩu"));
    }
  };

  // 4. Xử lý Xóa người dùng
  const handleDeleteUser = async (username) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa tài khoản [${username}] khỏi hệ thống?`,
      )
    )
      return;
    try {
      await adminAPI.deleteUser(username);
      alert("Đã xóa tài khoản thành công!");
      fetchUsers();
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể xóa tài khoản"));
    }
  };

  // 5. Xử lý Xóa lớp học
  const handleDeleteClass = async (classId) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa vĩnh viễn lớp học #${classId}?`,
      )
    )
      return;
    try {
      await adminAPI.deleteClass(classId);
      alert("Đã xóa lớp học thành công!");
      fetchClasses();
    } catch (error) {
      alert("❌ Lỗi: " + (error.response?.data || "Không thể xóa lớp học"));
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* SIDEBAR ĐIỀU HƯỚNG TABS */}
      <div className="w-64 bg-gray-900 text-gray-300 flex flex-col justify-between shadow-lg z-10">
        <div className="p-5">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-white text-xl shadow-md">
              A
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">
                Hệ Thống Admin
              </h2>
              <span className="text-[11px] text-gray-400 font-medium">
                Quyền hạn tối cao
              </span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === "overview" ? "bg-purple-600 text-white shadow-md" : "hover:bg-gray-800 text-gray-400"}`}
            >
              📊 <span>Bảng điều khiển</span>
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === "users" ? "bg-purple-600 text-white shadow-md" : "hover:bg-gray-880 hover:bg-gray-800 text-gray-400"}`}
            >
              👤 <span>Quản lý tài khoản</span>
            </button>
            <button
              onClick={() => setActiveTab("classes")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === "classes" ? "bg-purple-600 text-white shadow-md" : "hover:bg-gray-800 text-gray-400"}`}
            >
              🏫 <span>Quản lý lớp học</span>
            </button>
            <button
              onClick={() => setActiveTab("cctv")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${activeTab === "cctv" ? "bg-red-600 text-white shadow-md" : "hover:bg-gray-800 text-gray-400"}`}
            >
              📹{" "}
              <span className="flex items-center gap-2">
                Hệ thống CCTV Live{" "}
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
              </span>
            </button>
          </nav>
        </div>

        <div className="p-5 border-t border-gray-800 bg-gray-950/40 flex items-center justify-between text-xs">
          <div className="truncate">
            <p className="text-white font-medium truncate">{currentUsername}</p>
            <p className="text-gray-500 font-mono">
              ID: #{currentUsername.charAt(0)}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-red-400 font-bold hover:text-red-300 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* KHU VỰC CHÍNH ĐỔ VIEW THEO TAB */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            {activeTab === "overview" && "Tổng quan thống kê"}
            {activeTab === "users" && "Danh sách tài khoản người dùng"}
            {activeTab === "classes" && "Hệ thống quản lý lớp học đào tạo"}
            {activeTab === "cctv" &&
              "Hệ thống giám sát CCTV tích hợp AI điểm danh"}
          </h2>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-600">
              SERVER ONLINE
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {/* ========================================================= */}
          {/* TAB 1: TỔNG QUAN HỆ THỐNG */}
          {/* ========================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                  onClick={() => setActiveTab("users")}
                  className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-gray-400 font-medium">
                      Tổng số tài khoản
                    </p>
                    <h3 className="text-4xl font-extrabold text-gray-800 mt-1">
                      {stats.totalUsers}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 font-bold rounded-full flex items-center justify-center text-xl">
                    👥
                  </div>
                </div>
                <div
                  onClick={() => setActiveTab("classes")}
                  className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-gray-400 font-medium">
                      Tổng số lớp học
                    </p>
                    <h3 className="text-4xl font-extrabold text-gray-800 mt-1">
                      {stats.totalClasses}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-green-50 text-green-600 font-bold rounded-full flex items-center justify-center text-xl">
                    🏫
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                  onClick={() => setActiveTab("cctv")}
                  className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer"
                >
                  <h3 className="text-base font-bold text-gray-800 mb-2 flex items-center gap-2">
                    📹 Giám sát CCTV Live Cam
                  </h3>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Theo dõi trực tiếp luồng camera thu từ các kit ESP32 đặt tại
                    giảng đường, tự động gọi AI đối khớp khuôn mặt thời gian
                    thực.
                  </p>
                </div>
                <div
                  onClick={() => setActiveTab("users")}
                  className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer"
                >
                  <h3 className="text-base font-bold text-gray-800 mb-2">
                    📥 Nhập dữ liệu tự động
                  </h3>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Cấp tài khoản số lượng lớn nhanh chóng cho sinh viên và giáo
                    viên thông qua việc chuẩn hóa biểu mẫu tệp Excel.
                  </p>
                </div>
                <div
                  onClick={() => setActiveTab("overview")}
                  className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition cursor-pointer"
                >
                  <h3 className="text-base font-bold text-gray-800 mb-2">
                    🔒 Bảo mật & Cấp lại mật khẩu
                  </h3>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    Admin có quyền can thiệp cưỡng chế đổi mật khẩu hoặc xóa tài
                    khoản vĩnh viễn khỏi hệ thống Core Database.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: QUẢN LÝ TÀI KHOẢN (USER) */}
          {/* ========================================================= */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm">
                  Bộ lọc danh sách: Tất cả người dùng ({users.length})
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="bg-green-600 text-white text-xs px-4 py-2 rounded-md font-bold hover:bg-green-700 transition shadow-sm"
                  >
                    📥 Nhập Excel
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-purple-600 text-white text-xs px-4 py-2 rounded-md font-bold hover:bg-purple-700 transition shadow-sm"
                  >
                    + Tạo tay
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Tài khoản (Mã định danh)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Họ và Tên
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                        Vai Trò
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {dataLoading ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="py-10 text-center text-gray-400 italic"
                        >
                          Đang đồng bộ dữ liệu người dùng...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="py-10 text-center text-gray-400 italic"
                        >
                          Hệ thống chưa ghi nhận tài khoản người dùng nào.
                        </td>
                      </tr>
                    ) : (
                      users.map((u, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50/60 transition-colors"
                        >
                          <td className="px-6 py-3.5 font-bold text-gray-900 font-mono">
                            {u.username}
                          </td>
                          <td className="px-6 py-3.5 text-gray-700">
                            {u.profile?.fullName || "Chưa cập nhật tên"}
                          </td>
                          <td className="px-6 py-3.5 text-gray-500 font-mono text-xs">
                            {u.email || "N/A"}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${u.role === "ROLE_TEACHER" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}
                            >
                              {u.role === "ROLE_TEACHER"
                                ? "GIÁO VIÊN"
                                : "SINH VIÊN"}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right space-x-1.5">
                            <button
                              onClick={() => handleResetPassword(u.username)}
                              className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded transition"
                            >
                              Reset Pass
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.username)}
                              className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: QUẢN LÝ LỚP HỌC (CLASS) */}
          {/* ========================================================= */}
          {activeTab === "classes" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-bold text-gray-800 text-sm">
                  Quản lý tổng số hệ thống: {classes.length} lớp học đào tạo
                </h3>
              </div>

              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <table className="min-w-full divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Mã Lớp Học
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                        Tên Môn Học / Lớp
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                        Mã ID Giáo Viên
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {dataLoading ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="py-10 text-center text-gray-400 italic"
                        >
                          Đang quét danh sách lớp...
                        </td>
                      </tr>
                    ) : classes.length === 0 ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="py-10 text-center text-gray-400 italic"
                        >
                          Hệ thống chưa ghi nhận thông tin lớp học nào.
                        </td>
                      </tr>
                    ) : (
                      classes.map((c, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50/60 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-purple-600 font-mono">
                            #{c.id}
                          </td>
                          <td className="px-6 py-4 text-gray-800 font-semibold">
                            {c.name}
                          </td>
                          <td className="px-6 py-4 text-center font-mono text-gray-600">
                            GV-{c.teacherId}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteClass(c.id)}
                              className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded transition shadow-sm"
                            >
                              Xóa lớp
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: HỆ THỐNG CCTV LIVE ĐIỂM DANH */}
          {/* ========================================================= */}
          {activeTab === "cctv" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-red-100 bg-gradient-to-r from-red-50/30 to-transparent shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-red-800 text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                    MÀN HÌNH GIÁM SÁT TRỰC TIẾP (ESP32 CAMERA FEED)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Hệ thống gộp toàn bộ camera giảng đường phục vụ giám sát
                    điểm danh tự động từ xa.
                  </p>
                </div>
                <span className="text-xs font-mono bg-gray-100 border px-3 py-1 rounded-md text-gray-600 font-bold">
                  LƯỚI MONITOR: 2x2 GRID
                </span>
              </div>

              {/* LƯỚI CAM CHIA KHUNG HÌNH KIỂU CCTV MONITOR */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Khung Cam của Lớp 1 */}
                <div className="bg-black rounded-xl overflow-hidden border-2 border-gray-800 shadow-lg relative group aspect-video">
                  <div className="absolute top-2 left-2 z-10 bg-black/60 border border-gray-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-green-400">
                    CAM_01 // LỚP_PBL5_ID_1
                  </div>
                  <div className="absolute top-2 right-2 z-10 bg-red-600 px-2 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>{" "}
                    LIVE
                  </div>
                  {/* Thực tế: src trỏ thẳng về endpoint stream MJPEG của FastAPI xử lý từ ESP32 */}
                  <img
                    src="http://127.0.0.1:8000/api/video_feed/1"
                    alt="Lớp học số 1 Cam Stream"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Nếu lỗi chưa bật cam ESP32 thì hiện màn hình nhiễu giả lập hoặc bảng báo mất tín hiệu
                      e.target.src =
                        "https://images.unsplash.com/photo-1590073844006-33379778ae09?q=80&w=600";
                    }}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between">
                    <span>FPS: 24.5 | BITRATE: 1042kbps</span>
                    <span>RESOLUTION: 1280x720</span>
                  </div>
                </div>

                {/* Khung Cam của Lớp 2 */}
                <div className="bg-black rounded-xl overflow-hidden border-2 border-gray-800 shadow-lg relative group aspect-video">
                  <div className="absolute top-2 left-2 z-10 bg-black/60 border border-gray-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-green-400">
                    CAM_02 // LỚP_ID_2
                  </div>
                  <div className="absolute top-2 right-2 z-10 bg-red-600 px-2 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>{" "}
                    LIVE
                  </div>
                  <img
                    src="http://127.0.0.1:8000/api/video_feed/2"
                    alt="Lớp học số 2 Cam Stream"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src =
                        "https://images.unsplash.com/photo-1590073844006-33379778ae09?q=80&w=600";
                    }}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between">
                    <span>FPS: 23.1 | BITRATE: 984kbps</span>
                    <span>RESOLUTION: 1280x720</span>
                  </div>
                </div>

                {/* Khung Cam Lớp 3 */}
                <div className="bg-black rounded-xl overflow-hidden border-2 border-gray-800 shadow-lg relative group aspect-video">
                  <div className="absolute top-2 left-2 z-10 bg-black/60 border border-gray-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-green-400">
                    CAM_03 // LỚP_ID_3
                  </div>
                  <div className="absolute top-2 right-2 z-10 bg-gray-700 px-2 py-0.5 rounded text-[9px] font-bold text-gray-300">
                    STANDBY
                  </div>
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-500 border border-gray-800 text-xs font-mono">
                    <p className="text-xl mb-1">💤</p>
                    <p>Lớp học trống - Thiết bị ESP32 ngủ đông</p>
                  </div>
                </div>

                {/* Khung Cam Lớp 4 */}
                <div className="bg-black rounded-xl overflow-hidden border-2 border-gray-800 shadow-lg relative group aspect-video">
                  <div className="absolute top-2 left-2 z-10 bg-black/60 border border-gray-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-green-400">
                    CAM_04 // LỚP_ID_4
                  </div>
                  <div className="absolute top-2 right-2 z-10 bg-gray-700 px-2 py-0.5 rounded text-[9px] font-bold text-gray-300">
                    STANDBY
                  </div>
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-500 border border-gray-800 text-xs font-mono">
                    <p className="text-xl mb-1">💤</p>
                    <p>Lớp học trống - Thiết bị ESP32 ngủ đông</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- MODAL 1: TẠO TÀI KHOẢN --- */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[28rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Tạo tài khoản người dùng mới
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tên đăng nhập / Mã định danh (MSSV/MSGV)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 102230123"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      username: e.target.value,
                      code: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mật khẩu khởi tạo
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Địa chỉ Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="example@school.edu.vn"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Họ và Tên thực
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập chữ có dấu hoa..."
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={newUser.fullName}
                  onChange={(e) =>
                    setNewUser({ ...newUser, fullName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phân hệ / Quyền hạn vai trò
                </label>
                <select
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                >
                  <option value="STUDENT">Sinh viên học tập</option>
                  <option value="TEACHER">Giáo viên giảng dạy</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50 shadow-md"
                >
                  {creating ? "Đang tạo hệ thống..." : "Lưu tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: IMPORT EXCEL --- */}
      {showImportModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[32rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Nhập danh sách tài khoản từ tệp dữ liệu Excel
            </h2>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                Chọn hệ quyền phân bổ (Role):
              </label>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                value={importRole}
                onChange={(e) => setImportRole(e.target.value)}
              >
                <option value="STUDENT">Sinh viên hệ thống</option>
                <option value="TEACHER">Giáo viên giảng dạy</option>
              </select>
            </div>

            <div className="mb-4 text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
              <p className="font-bold mb-1">
                📌 Lưu ý cấu trúc tệp Excel chuẩn hóa (4 cột dữ liệu):
              </p>
              <p className="font-mono text-[11px] mt-1">
                Cột A: Username/Mã định danh | Cột B: Password | Cột C: Email |
                Cột D: Họ và Tên
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 mb-4">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700"
              />
            </div>

            {importResult && (
              <div
                className={`p-3 rounded-md text-xs font-medium ${importResult.includes("❌") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
              >
                {importResult}
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult("");
                  setSelectedFile(null);
                }}
                className="px-4 py-2 text-sm text-gray-500 font-bold hover:bg-gray-100 rounded-md"
              >
                Đóng màn hình
              </button>
              <button
                onClick={handleImportExcel}
                disabled={importing || !selectedFile}
                className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 shadow-md"
              >
                {importing ? "Đang xử lý biểu mẫu..." : "Bắt đầu Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
