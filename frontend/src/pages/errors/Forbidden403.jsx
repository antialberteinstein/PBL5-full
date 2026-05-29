import React from "react";
import ErrorLayout from "./ErrorLayout.jsx";

const Forbidden403 = () => (
  <ErrorLayout
    code="403"
    title="Bạn không có quyền truy cập"
    message="Tài khoản của bạn không được phép vào trang này. Nếu đây là nhầm lẫn, vui lòng liên hệ quản trị viên."
    accent="amber"
  />
);

export default Forbidden403;
