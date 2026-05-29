import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { classAPI, studentAPI } from "../services/api.js";
import { logout } from "../utils/auth.js";

const Dashboard = () => {
  const navigate = useNavigate();

  const [myClasses, setMyClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const userRole = localStorage.getItem("role") || "STUDENT";
  const currentUsername = localStorage.getItem("username") || "";

  // (Admin is now responsible for class creation)

  // --- STATE KHUÔN MẶT (DÀNH CHO SINH VIÊN) ---
  const [faceRegistering, setFaceRegistering] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);

  // --- STATE XIN VÀO LỚP (DÀNH CHO SINH VIÊN) ---
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinClassId, setJoinClassId] = useState("");
  const [joinClassPreview, setJoinClassPreview] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinResult, setJoinResult] = useState("");

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const endpoint =
        userRole === "TEACHER"
          ? "/teacher-class/my-classes"
          : "/student-class/my-joined-classes";
      const response = await api.get(endpoint);
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
      if (userRole === "TEACHER") return;
      try {
        const response = await studentAPI.getCurrentStudent();
        setFaceRegistered(Boolean(response.data?.faceRegistered));
      } catch (error) {
        console.error("Lỗi khi lấy trạng thái khuôn mặt:", error);
      }
    };
    fetchFaceStatus();
  }, [userRole]);


  // --- HANDLER CHO SINH VIÊN ---
  const handleFindJoinClass = async (e) => {
    e.preventDefault();
    const parsedClassId = Number(joinClassId);
    if (!Number.isInteger(parsedClassId) || parsedClassId <= 0) {
      return setJoinError("Vui lòng nhập ID lớp hợp lệ.");
    }
    try {
      setJoinLoading(true);
      setJoinError("");
      setJoinResult("");
      const response = await classAPI.getClassById(parsedClassId);
      setJoinClassPreview(response.data);
    } catch (error) {
      setJoinClassPreview(null);
      setJoinError("Không tìm thấy lớp học này.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleConfirmJoinClass = async () => {
    if (!joinClassPreview?.id) return;
    try {
      setJoinLoading(true);
      setJoinError("");
      await studentAPI.joinClass({ classId: joinClassPreview.id });
      setJoinResult("✅ Đã gửi yêu cầu tham gia lớp!");
      fetchClasses();
    } catch (error) {
      setJoinError(error.response?.data || "Lỗi khi xin vào lớp.");
    } finally {
      setJoinLoading(false);
    }
  };

  const resetJoinModal = () => {
    setShowJoinModal(false);
    setJoinClassId("");
    setJoinClassPreview(null);
    setJoinError("");
    setJoinResult("");
    setJoinLoading(false);
  };

  const handleLogout = () => logout(navigate);

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* SIDEBAR */}
      <div className="w-16 bg-gray-100 border-r flex flex-col items-center py-4 z-10">
        <button className="flex flex-col items-center mb-6 text-indigo-600 relative">
          <div className="absolute -left-3 top-1 w-1 h-8 bg-indigo-600 rounded-r-md"></div>
          <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
          </svg>
          <span className="text-[10px] font-medium">Lớp học</span>
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold">Hệ thống điểm danh AI</h2>
          <div className="flex items-center space-x-4">
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full ${userRole === "TEACHER" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}
            >
              {userRole === "TEACHER" ? "GIÁO VIÊN" : "SINH VIÊN"}
            </span>
            <button
              onClick={() => navigate("/profile")}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Hồ sơ
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-500"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex justify-between mb-6">
            <h1 className="text-2xl font-bold">
              {userRole === "TEACHER" ? "Lớp giảng dạy" : "Lớp đã tham gia"}
            </h1>

            {/* NÚT BẤM THEO QUYỀN */}
            {userRole === "TEACHER" ? (
              <div className="text-sm text-gray-500 mt-2">
                * Chỉ Admin mới có quyền tạo lớp và xếp lịch.
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {!faceRegistered ? (
                  <button
                    onClick={() => navigate("/register-face")}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium shadow-sm hover:bg-indigo-700"
                  >
                    Đăng ký khuôn mặt
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-md font-medium">
                      ✅ Đã ĐK khuôn mặt
                    </span>
                    <button
                      onClick={() => {
                        const ok = window.confirm(
                          "Bạn có chắc chắn muốn đăng ký lại khuôn mặt? Dữ liệu khuôn mặt cũ sẽ bị xóa và thay bằng dữ liệu mới.",
                        );
                        if (ok) navigate("/register-face?mode=reregister");
                      }}
                      className="bg-white text-indigo-600 border border-indigo-200 px-3 py-2 rounded-md font-medium hover:bg-indigo-50"
                    >
                      Đăng ký lại
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-md font-medium hover:bg-indigo-100"
                >
                  + Xin tham gia lớp
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500">
              Đang tải danh sách...
            </div>
          ) : myClasses.length === 0 ? (
            <div className="text-center py-10 text-gray-500 border border-dashed rounded-lg">
              Chưa có lớp học nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {myClasses.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/class/${cls.id}`)}
                  className="bg-white p-4 border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold mb-3 ${userRole === "TEACHER" ? "bg-orange-100 text-orange-600" : "bg-indigo-100 text-indigo-600"}`}
                  >
                    {cls.name ? cls.name.substring(0, 2).toUpperCase() : "CL"}
                  </div>
                  <h3 className="font-bold text-gray-800 truncate">
                    {cls.name}
                  </h3>
                  <p className="text-sm text-gray-500">ID Lớp: #{cls.id}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>


      {/* ============================================== */}
      {/* MODAL 2: XIN VÀO LỚP (SINH VIÊN)                 */}
      {/* ============================================== */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Xin tham gia lớp</h2>
            {joinResult ? (
              <div>
                <p className="text-green-700 bg-green-50 p-3 rounded mb-4 font-medium">
                  {joinResult}
                </p>
                <button
                  onClick={resetJoinModal}
                  className="w-full bg-indigo-600 text-white py-2 rounded"
                >
                  OK
                </button>
              </div>
            ) : joinClassPreview ? (
              <div>
                <p className="mb-2">Bạn có muốn tham gia lớp này?</p>
                <div className="bg-gray-100 p-3 rounded mb-4">
                  <p className="font-bold text-lg">{joinClassPreview.name}</p>
                  <p className="text-sm text-gray-500">
                    ID: #{joinClassPreview.id}
                  </p>
                </div>
                {joinError && (
                  <p className="text-red-500 text-sm mb-4">{joinError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setJoinClassPreview(null)}
                    className="w-full border py-2 rounded"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirmJoinClass}
                    disabled={joinLoading}
                    className="w-full bg-indigo-600 text-white py-2 rounded font-bold"
                  >
                    {joinLoading ? "Đang gửi..." : "Xác nhận"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFindJoinClass}>
                <input
                  type="number"
                  required
                  value={joinClassId}
                  onChange={(e) => {
                    setJoinClassId(e.target.value);
                    setJoinError("");
                  }}
                  placeholder="Nhập ID lớp..."
                  className="w-full border rounded px-3 py-2 mb-4"
                />
                {joinError && (
                  <p className="text-red-500 text-sm mb-4">{joinError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetJoinModal}
                    className="w-full border py-2 rounded"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={joinLoading}
                    className="w-full bg-indigo-600 text-white py-2 rounded font-bold"
                  >
                    {joinLoading ? "Đang tìm..." : "Tìm lớp"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
