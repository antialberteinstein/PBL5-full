import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { studentAPI } from "../services/api.js";

const Dashboard = () => {
  const navigate = useNavigate();

  const [myClasses, setMyClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lấy Role từ bộ nhớ (Mặc định là STUDENT nếu chưa có)
  const userRole = localStorage.getItem("role") || "STUDENT";

  // --- CÁC STATE DÀNH CHO TẠO LỚP MỚI ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);
  const [faceRegistering, setFaceRegistering] = useState(false);
  const [faceError, setFaceError] = useState("");
  const [faceResult, setFaceResult] = useState("");
  const [faceRegistered, setFaceRegistered] = useState(false);

  const currentUsername = localStorage.getItem("username") || "";

  // Hàm gọi API lấy danh sách lớp
  const fetchClasses = async () => {
    try {
      setLoading(true);
      let response;
      if (userRole === "TEACHER") {
        // Gọi API lấy danh sách lớp của Giáo viên
        response = await api.get("/teacher-class/my-classes");
      } else {
        // Gọi API lấy danh sách lớp của Sinh viên
        response = await api.get("/student-class/my-joined-classes");
      }
      setMyClasses(response.data);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách lớp:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [userRole]);

  useEffect(() => {
    const fetchFaceStatus = async () => {
      if (userRole === "TEACHER") {
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
  }, [userRole]);

  // --- HÀM XỬ LÝ KHI BẤM NÚT "LƯU LỚP HỌC" ---
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      setCreating(true);
      // Gọi API Tạo lớp học bên ClazzController
      await api.post("/classes/create", { name: newClassName });

      // Nếu thành công: Ẩn bảng, xóa chữ, tải lại danh sách
      setShowCreateModal(false);
      setNewClassName("");
      fetchClasses();

      alert("Tạo lớp học thành công!");
    } catch (error) {
      alert(error.response?.data || "Có lỗi xảy ra khi tạo lớp!");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login");
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
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* SIDEBAR */}
      <div className="w-16 bg-gray-100 border-r border-gray-200 flex flex-col items-center py-4 shadow-sm z-10">
        <button className="flex flex-col items-center mb-6 text-indigo-600 relative">
          <div className="absolute -left-3 top-1 w-1 h-8 bg-indigo-600 rounded-r-md"></div>
          <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
          </svg>
          <span className="text-[10px] font-medium">Lớp học</span>
        </button>
      </div>

      {/* KHU VỰC CHÍNH */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <div className="flex-1 max-w-xl">
            <h2 className="text-lg font-semibold text-gray-700">
              Hệ thống điểm danh PBL5
            </h2>
          </div>
          <div className="flex items-center space-x-4 ml-4">
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full ${userRole === "TEACHER" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}
            >
              {userRole === "TEACHER" ? "GIÁO VIÊN" : "SINH VIÊN"}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-500 font-medium transition"
            >
              Đăng xuất
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              K
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gray-50">
          <div className="flex justify-between items-end mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              {userRole === "TEACHER"
                ? "Các lớp bạn đang giảng dạy"
                : "Các lớp bạn đã tham gia"}
            </h1>

            {/* HIỂN THỊ NÚT BẤM THEO ROLE */}
            {userRole === "TEACHER" ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-orange-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-600 shadow-sm transition"
              >
                + Tạo lớp học mới
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {!faceRegistered ? (
                  <button
                    onClick={handleRegisterFace}
                    disabled={faceRegistering}
                    className={`px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition ${faceRegistering ? "bg-gray-300 text-gray-600" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                  >
                    {faceRegistering ? "Đang mở camera..." : "Đăng ký khuôn mặt"}
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-md text-sm font-semibold text-green-700 bg-green-50 border border-green-200">
                    Đã đăng ký khuôn mặt
                  </div>
                )}
                <button className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-100 shadow-sm transition">
                  + Xin tham gia lớp
                </button>
              </div>
            )}
          </div>

          {userRole !== "TEACHER" && (faceError || faceResult) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-800">
                Trạng thái đăng ký khuôn mặt
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                ID đăng ký: {currentUsername || "(chưa có)"}
              </p>
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

          {loading ? (
            <div className="text-center text-gray-500 mt-10">
              Đang tải danh sách lớp học...
            </div>
          ) : myClasses.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              Bạn chưa có lớp học nào ở đây cả.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {myClasses.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/class/${cls.id}`)} // <--- THÊM DÒNG NÀY ĐỂ BẤM ĐƯỢC
                  className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer flex flex-col h-40"
                >
                  <div
                    className={`h-20 rounded-t-lg flex items-center justify-center ${userRole === "TEACHER" ? "bg-orange-50" : "bg-gray-100"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner ${userRole === "TEACHER" ? "bg-orange-100 text-orange-600" : "bg-indigo-100 text-indigo-600"}`}
                    >
                      {cls.name ? cls.name.substring(0, 2).toUpperCase() : "CL"}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <h3
                      className="font-bold text-gray-800 text-lg truncate"
                      title={cls.name}
                    >
                      {cls.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 font-medium">
                      ID Lớp: #{cls.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* --- BẢNG (MODAL) NHẬP TÊN TẠO LỚP HỌC --- */}
      {showCreateModal && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Tạo lớp học mới
            </h2>
            <form onSubmit={handleCreateClass}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên lớp học
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Nhập tên lớp (VD: Lập trình Java)"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md transition disabled:opacity-50"
                >
                  {creating ? "Đang tạo..." : "Lưu lớp học"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
