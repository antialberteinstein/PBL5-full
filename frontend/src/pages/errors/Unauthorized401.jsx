import React from "react";
import ErrorLayout from "./ErrorLayout.jsx";

const Unauthorized401 = () => (
  <ErrorLayout
    code="401"
    title="Phiên đăng nhập đã hết hạn"
    message="Bạn cần đăng nhập lại để tiếp tục sử dụng hệ thống."
    accent="red"
  />
);

export default Unauthorized401;
