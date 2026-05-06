package com.tam.pbl5.repository;

import com.tam.pbl5.entity.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TeacherRepository extends JpaRepository<Teacher, Integer> {

    // 1. Tìm giáo viên bằng Username
    Teacher findByUsername(String username);

    // 2. ✨ THÊM MỚI: Kiểm tra xem Username đã tồn tại trong bảng Teacher chưa
    boolean existsByUsername(String username);

    // 3. Tìm giáo viên bằng Mã số giáo viên (MSGV)
    Teacher findByMsgv(String msgv);

    // 4. Kiểm tra xem MSGV đã tồn tại chưa
    boolean existsByMsgv(String msgv);
}