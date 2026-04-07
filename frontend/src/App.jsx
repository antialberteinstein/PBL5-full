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
// ĐÃ MỞ KHÓA: Import trang Dashboard thật
import Dashboard from "./pages/Dashboard.jsx";

// Mấy trang này tạm thời comment lại vì chưa làm tới
// import Attendance from "./pages/Attendance.jsx";
// import Profile from "./pages/Profile.jsx";

function App() {
  return (
    <Router>
      <Routes>
        {/* 1. Trang mặc định khi mở web sẽ vào Login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* 2. Các Route để test */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/class/:classId" element={<ClassDetail />} />
        {/* 3. ĐÃ SỬA: Thay dòng chữ tạm bằng Component Dashboard thật */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Các trang khác chưa có thì chưa khai báo ở đây */}
      </Routes>
    </Router>
  );
}

export default App;
