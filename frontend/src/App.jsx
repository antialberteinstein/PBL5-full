import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Import các trang chính
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import VerifyOtp from "./pages/VerifyOtp.jsx";
import ClassDetail from "./pages/ClassDetail.jsx";
import Dashboard from "./pages/Dashboard.jsx";

// ✨ THÊM MỚI Ở ĐÂY: Import 2 trang quan trọng còn thiếu
import AdminDashboard from "./pages/AdminDashboard.jsx";
import FaceRegistration from "./pages/FaceRegistration.jsx";

function App() {
  return (
    <Router>
      <Routes>
        {/* 1. Trang mặc định khi mở web sẽ vào Login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* 2. Các Route chính */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />

        {/* Route chi tiết lớp học */}
        <Route path="/class/:classId" element={<ClassDetail />} />

        {/* Route Dashboard cho Teacher/Student */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* ✨ THÊM MỚI Ở ĐÂY: Khai báo "điểm đến" cho Admin và Đăng ký mặt */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/register-face" element={<FaceRegistration />} />

        {/* 3. Route dự phòng: Nếu gõ bừa đường dẫn sẽ tự về Login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
