import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api.js";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await api.post("/auth/login", { username, password });

      // 1. Lấy token và lưu vào với tên là "token" (không dùng jwt_token nữa)
      const token = response.data.token || response.data.accessToken;
      localStorage.setItem("token", token);

      // Lưu username để dùng cho các tác vụ của sinh viên
      localStorage.setItem("username", username);

      // 2. Lấy Role từ Backend trả về
      // Dùng console.log để Khang tự F12 lên xem Backend trả về tên biến là gì (role, roles, hay authority)
      console.log("Dữ liệu Backend trả về:", response.data);

      // Giả sử Backend trả về biến 'role' (VD: "ROLE_TEACHER")
      let userRole = response.data.role || response.data.authority || "STUDENT";

      // 3. Cắt bỏ chữ "ROLE_" để đồng bộ với chữ "TEACHER" trong Dashboard
      if (userRole.startsWith("ROLE_")) {
        userRole = userRole.replace("ROLE_", "");
      }

      // 4. Lưu Role vào bộ nhớ
      localStorage.setItem("role", userRole.toUpperCase());

      alert("Đăng nhập thành công!");
      navigate("/dashboard");
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

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <p className="mt-4 text-center text-sm">
          Chưa có tài khoản?{" "}
          <Link className="text-blue-500 hover:underline" to="/register">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
