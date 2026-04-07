package com.tam.pbl5.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO dùng để hứng dữ liệu khi Teacher gửi yêu cầu tạo lớp học mới.
 * Khang lưu ý: Chúng ta chỉ truyền 'name' từ Client lên.
 * 'teacherId' sẽ được Server tự động bóc tách từ Token để đảm bảo bảo mật.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ClassCreateRequest {

    private String name; // Tên của lớp học (ví dụ: Lập trình Java cơ bản)

}