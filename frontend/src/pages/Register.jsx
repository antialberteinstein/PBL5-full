import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
const Register = () => {
  // Giả định DTO RegisterRequest của Khang có username, email, password và role
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "STUDENT", // Mặc định là sinh viên
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const response = await api.post("/auth/register", formData);
      setMessage(response.data); // Hiển thị câu "Đăng ký thành công! Vui lòng kiểm tra email..."

      // Chuyển hướng sang trang nhập OTP sau 2 giây, truyền theo username để tiện xác thực
      setTimeout(() => {
        navigate("/verify-otp", { state: { username: formData.username } });
      }, 2000);
    } catch (err) {
      setError(err.response?.data || "Đăng ký thất bại!");
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center text-green-600">
          Đăng Ký Tài Khoản
        </h2>
        {error && (
          <div className="bg-red-100 text-red-600 p-2 mb-4 rounded text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-100 text-green-600 p-2 mb-4 rounded text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tên đăng nhập
            </label>
            <input
              type="text"
              name="username"
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email (Nhận mã OTP)
            </label>
            <input
              type="email"
              name="email"
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              name="password"
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Vai trò
            </label>
            <select
              name="role"
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none"
            >
              <option value="STUDENT">Sinh viên</option>
              <option value="TEACHER">Giáo viên</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
          >
            Đăng Ký
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          Đã có tài khoản?{" "}
          <Link className="text-green-500 hover:underline" to="/login">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
