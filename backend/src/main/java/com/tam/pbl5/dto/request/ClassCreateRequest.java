package com.tam.pbl5.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO dùng để hứng dữ liệu khi Admin gửi yêu cầu tạo lớp học mới.
 * Khang lưu ý: 'teacherId' sẽ được truyền từ Client lên do Admin chỉ định.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ClassCreateRequest {

    private String name; // Tên của lớp học (ví dụ: Lập trình Java cơ bản)
    private Integer teacherId; // ID giáo viên được Admin gán

}