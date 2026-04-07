package com.tam.pbl5.repository;

import com.tam.pbl5.entity.StudentClass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StudentClassRepository extends JpaRepository<StudentClass, Integer> {
    List<StudentClass> findByStudentId(Integer studentId);

    // 2. Dùng để: Giáo viên xem danh sách toàn bộ sinh viên trong 1 lớp cụ thể
    List<StudentClass> findByClassId(Integer classId);

    // 3. Dùng để: Kiểm tra xem sinh viên đã ở trong lớp chưa (để tránh add trùng)
    boolean existsByStudentIdAndClassId(Integer studentId, Integer classId);

    // 4. Dùng để: Tìm chính xác 1 bản ghi để xóa (khi giáo viên đuổi học sinh)
    StudentClass findByStudentIdAndClassId(Integer studentId, Integer classId);

    List<StudentClass> findByClassIdAndStatus(Integer classId, String status);
    List<StudentClass> findByStudentIdAndStatus(Integer studentId, String status);
}