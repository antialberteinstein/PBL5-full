package com.tam.pbl5.repository;

import com.tam.pbl5.entity.StudentClass;
// 1. Thêm các import bắt buộc cho Query, Param và Projection
import com.tam.pbl5.dto.response.StudentInClassProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    @Query(value = "SELECT s.id AS mssv, u.username AS username, p.full_name AS fullName, s.face_registered AS faceRegistered " +
            "FROM student_class sc " +
            "JOIN student s ON sc.student_id = s.id " +
            "JOIN users u ON s.username = u.username " +
            "JOIN profile p ON u.profile_id = p.id " +
            "WHERE sc.class_id = :classId AND sc.status = :status",
            nativeQuery = true)
    List<StudentInClassProjection> findStudentsByClassAndStatus(
            @Param("classId") Integer classId, // 2. Đổi Long thành Integer cho đồng bộ với bên trên
            @Param("status") String status
    ); // 3. Đã thêm dấu đóng ngoặc và chấm phẩy
}