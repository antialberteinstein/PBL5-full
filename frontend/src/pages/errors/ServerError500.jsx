import React from "react";
import ErrorLayout from "./ErrorLayout.jsx";

const ServerError500 = () => (
  <ErrorLayout
    code="500"
    title="Máy chủ gặp sự cố"
    message="Hệ thống đang tạm thời không phản hồi. Vui lòng thử lại sau ít phút."
    accent="red"
  />
);

export default ServerError500;
