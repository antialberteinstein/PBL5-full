import React, { useState, useEffect } from "react";
import { userAPI } from "../services/api";

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await userAPI.getProfile();
        setProfile(response.data);
      } catch (err) {
        setError("Không thể tải thông tin cá nhân. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-indigo-600 font-medium">
        <svg
          className="animate-spin h-6 w-6 text-indigo-600 mr-3"
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
        Đang tải thông tin...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-red-500 font-medium">
        {error}
      </div>
    );
  }

  // Hàm dịch Role sang tiếng Việt
  const getRoleLabel = (role) => {
    if (role === "STUDENT") return "Sinh viên";
    if (role === "TEACHER") return "Giảng viên";
    if (role === "ADMIN") return "Quản trị viên";
    return role;
  };

  // Hàm lấy nhãn cho Mã số tùy theo vai trò
  const getIdLabel = (role) => {
    if (role === "STUDENT") return "Mã số sinh viên (MSSV)";
    if (role === "TEACHER") return "Mã giảng viên (MSGV)";
    return "Mã định danh";
  };

  // Ưu tiên lấy mssv (nếu có), hoặc code (nếu có), cuối cùng mới lấy username
  const displayId =
    profile?.mssv || profile?.code || profile?.username || "Chưa cập nhật";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Cover */}
        <div className="h-32 bg-indigo-600 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90"></div>
        </div>

        <div className="px-8 pb-8">
          {/* Avatar & Role Badge */}
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="w-24 h-24 bg-white rounded-full p-1 shadow-md">
              <div className="w-full h-full bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-4xl font-bold uppercase">
                {profile?.fullName ? profile.fullName.charAt(0) : "U"}
              </div>
            </div>

            {/* Đổi màu Tag dựa theo chức vụ */}
            <span
              className={`px-4 py-1 text-xs font-bold rounded-full border uppercase tracking-wider shadow-sm ${
                profile?.role === "TEACHER"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : profile?.role === "ADMIN"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
              }`}
            >
              {getRoleLabel(profile?.role)}
            </span>
          </div>

          {/* Thông tin chính */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {profile?.fullName || "Chưa cập nhật tên"}
            </h1>
            <p className="text-sm text-gray-500 mb-6 flex items-center font-medium">
              <svg
                className="w-4 h-4 mr-1 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                ></path>
              </svg>
              Tên đăng nhập hệ thống:{" "}
              <span className="font-semibold text-gray-700 ml-1">
                {profile?.username}
              </span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-6">
              {/* ✨ CỘT 1: Mã định danh (Đổi tên theo Role) */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {getIdLabel(profile?.role)}
                </h3>
                <p className="text-base font-bold text-indigo-700 bg-indigo-50 inline-block px-4 py-1.5 rounded-lg border border-indigo-100 shadow-sm">
                  {displayId}
                </p>
              </div>

              {/* CỘT 2: Email */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Email liên hệ
                </h3>
                <p className="text-sm font-medium text-gray-800 bg-gray-50 inline-block px-4 py-1.5 rounded-lg border border-gray-100">
                  {profile?.email || "Chưa cập nhật email"}
                </p>
              </div>

              {/* CỘT 3: Face ID Status (Chỉ hiển thị cho Sinh viên) */}
              {profile?.role === "STUDENT" && (
                <div className="md:col-span-2 mt-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Trạng thái nhận diện AI
                  </h3>
                  <div className="inline-block px-4 py-3 bg-gray-50 rounded-lg border border-gray-100 w-full sm:w-auto">
                    {profile?.faceRegistered ? (
                      <span className="text-green-600 font-semibold flex items-center text-sm">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full mr-2 shadow-sm"></div>
                        Đã đăng ký dữ liệu khuôn mặt thành công
                      </span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center text-sm">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full mr-2 shadow-sm animate-pulse"></div>
                        Chưa đăng ký khuôn mặt (Vui lòng đăng ký trong chi tiết
                        lớp)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
