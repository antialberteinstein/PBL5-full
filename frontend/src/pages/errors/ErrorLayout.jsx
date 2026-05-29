import React from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, getRole, homePathForRole } from "../../utils/auth.js";

const ErrorLayout = ({ code, title, message, accent = "indigo" }) => {
  const navigate = useNavigate();
  const accentMap = {
    indigo: "text-indigo-600",
    amber: "text-amber-500",
    red: "text-red-500",
    gray: "text-gray-700",
  };
  const btnMap = {
    indigo: "bg-indigo-600 hover:bg-indigo-700",
    amber: "bg-amber-500 hover:bg-amber-600",
    red: "bg-red-600 hover:bg-red-700",
    gray: "bg-gray-700 hover:bg-gray-800",
  };

  const goHome = () => {
    if (isAuthenticated()) {
      navigate(homePathForRole(getRole()), { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <p className={`text-7xl font-extrabold tracking-tight ${accentMap[accent]}`}>
          {code}
        </p>
        <h1 className="mt-4 text-xl font-bold text-gray-800">{title}</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>
        <div className="mt-8 flex flex-col gap-2">
          <button
            onClick={goHome}
            className={`w-full text-white py-2 rounded-lg font-semibold transition ${btnMap[accent]}`}
          >
            {isAuthenticated() ? "Quay về trang chủ" : "Đến trang đăng nhập"}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            Quay lại trang trước
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorLayout;
