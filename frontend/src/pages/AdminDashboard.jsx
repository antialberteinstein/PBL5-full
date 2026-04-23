import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { adminAPI } from "../services/api.js";

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Lấy Role từ bộ nhớ
  const userRole = localStorage.getItem("role") || "ADMIN";
  const currentUsername = localStorage.getItem("username") || "admin";

  const [stats, setStats] = useState({ totalUsers: 0, totalClasses: 0 });
  const [loading, setLoading] = useState(false);

  // --- MODAL: TẠO NGƯỜI DÙNG ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
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

  // Hàm Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login");
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
        password: "",
        email: "",
        fullName: "",
        role: "STUDENT",
      });
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

    try {
      setImporting(true);
      setImportResult("Đang xử lý dữ liệu...");
      const response = await adminAPI.importExcel(formData);
      setImportResult("✅ " + response.data);
      setSelectedFile(null);
    } catch (error) {
      setImportResult("❌ Lỗi: " + (error.response?.data || "Import thất bại"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* SIDEBAR */}
      <div className="w-16 bg-gray-100 border-r border-gray-200 flex flex-col items-center py-4 shadow-sm z-10">
        <button className="flex flex-col items-center mb-6 text-purple-600 relative">
          <div className="absolute -left-3 top-1 w-1 h-8 bg-purple-600 rounded-r-md"></div>
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            ></path>
          </svg>
          <span className="text-[10px] font-medium text-center">Quản trị</span>
        </button>
      </div>

      {/* KHU VỰC CHÍNH */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <div className="flex-1 max-w-xl">
            <h2 className="text-lg font-semibold text-gray-700">
              Hệ thống điểm danh PBL5 - Admin Area
            </h2>
          </div>
          <div className="flex items-center space-x-4 ml-4">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-600">
              ADMIN
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-500 font-medium transition"
            >
              Đăng xuất
            </button>
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm uppercase">
              {currentUsername.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gray-50">
          <div className="flex justify-between items-end mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Bảng điều khiển Quản trị viên
            </h1>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-green-100 transition shadow-sm"
              >
                📥 Nhập từ Excel
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition shadow-sm"
              >
                + Tạo tài khoản
              </button>
            </div>
          </div>

          {/* Các thẻ chức năng mở rộng cho Admin */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Duyệt ảnh khuôn mặt
              </h3>
              <p className="text-gray-500 text-sm">
                Kiểm tra và phê duyệt dữ liệu khuôn mặt do sinh viên đăng ký để
                đảm bảo tính chính xác.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Quản lý Tài khoản
              </h3>
              <p className="text-gray-500 text-sm">
                Xem danh sách toàn bộ giáo viên và sinh viên, khóa hoặc mở khóa
                tài khoản.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Thống kê hệ thống
              </h3>
              <p className="text-gray-500 text-sm">
                Xem báo cáo tổng quan về số lượng lớp học, tỷ lệ điểm danh toàn
                trường.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* --- MODAL 1: TẠO TÀI KHOẢN --- */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Tạo tài khoản mới
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mật khẩu
                </label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Họ và Tên
                </label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newUser.fullName}
                  onChange={(e) =>
                    setNewUser({ ...newUser, fullName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Vai trò
                </label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                >
                  <option value="STUDENT">Sinh viên</option>
                  <option value="TEACHER">Giáo viên</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50"
                >
                  {creating ? "Đang tạo..." : "Lưu tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: IMPORT EXCEL --- */}
      {showImportModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[32rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Nhập danh sách tài khoản từ Excel
            </h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 mb-4">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>

            {importResult && (
              <div
                className={`p-3 rounded-md text-sm whitespace-pre-wrap ${importResult.includes("❌") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
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
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Đóng
              </button>
              <button
                onClick={handleImportExcel}
                disabled={importing || !selectedFile}
                className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
              >
                {importing ? "Đang nhập..." : "Bắt đầu Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
