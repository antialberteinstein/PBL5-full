package com.tam.pbl5.repository;

import com.tam.pbl5.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface StudentRepository extends JpaRepository<Student, Integer> {

    // 1. Tìm kiếm theo Username
    Student findByUsername(String username);

    // 2. Kiểm tra xem Username đã tồn tại trong bảng Student chưa
    boolean existsByUsername(String username);

    // 3. Tìm kiếm sinh viên theo MSSV
    // Trả về Optional để tránh lỗi NullPointerException nếu không tìm thấy
    Optional<Student> findByMssv(String mssv);

    // 4. Kiểm tra xem MSSV đã tồn tại chưa (Rất quan trọng khi tạo mới/import)
    boolean existsByMssv(String mssv);
}