import React from "react";
import ErrorLayout from "./ErrorLayout.jsx";

const NotFound404 = () => (
  <ErrorLayout
    code="404"
    title="Không tìm thấy trang"
    message="Đường dẫn bạn vừa truy cập không tồn tại hoặc đã bị di chuyển."
    accent="indigo"
  />
);

export default NotFound404;
