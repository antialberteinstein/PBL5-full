import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { studentAPI } from "../services/api.js";
import { saveSession, clearSession, homePathForRole } from "../utils/auth.js";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleEnter = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleLogin(e);
    }
  };

  const handleLogin = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError("");
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      setError("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }
    try {
      // Đảm bảo phiên cũ (nếu có) đã được xoá trước khi cấp phiên mới.
      clearSession();

      const response = await api.post("/auth/login", { username: u, password: p });

      const token = response.data.token || response.data.accessToken;
      const rawRole = response.data.role || response.data.authority || "STUDENT";
      saveSession({ token, role: rawRole, username: u });

      const roleFinal = (rawRole || "").toUpperCase().replace(/^ROLE_/, "");

      if (roleFinal === "ADMIN") {
        navigate(homePathForRole("ADMIN"), { replace: true });
      } else if (roleFinal === "TEACHER") {
        navigate("/dashboard", { replace: true });
      } else if (roleFinal === "STUDENT") {
        try {
          const profileRes = await studentAPI.getCurrentStudent();
          const isFaceRegistered = profileRes.data?.faceRegistered;
          navigate(isFaceRegistered ? "/dashboard" : "/register-face", { replace: true });
        } catch (error) {
          console.error("Lỗi kiểm tra khuôn mặt:", error);
          navigate("/register-face", { replace: true });
        }
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.response?.data || "Sai tài khoản hoặc mật khẩu!");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
          Đăng Nhập
        </h2>
        {error && (
          <div className="bg-red-100 text-red-600 p-2 mb-4 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} autoComplete="on">
          <div className="mb-4">
            <label htmlFor="login-username" className="block text-gray-700 text-sm font-bold mb-2">
              Tên đăng nhập
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleEnter}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="login-password" className="block text-gray-700 text-sm font-bold mb-2">
              Mật khẩu
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleEnter}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Đăng Nhập
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Tài khoản do quản trị viên cấp. Vui lòng liên hệ admin nếu cần hỗ trợ.
        </p>
      </div>
    </div>
  );
};

export default Login;
