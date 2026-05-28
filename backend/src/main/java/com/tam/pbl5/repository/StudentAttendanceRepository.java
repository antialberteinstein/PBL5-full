package com.tam.pbl5.repository;

import com.tam.pbl5.entity.StudentAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentAttendanceRepository extends JpaRepository<StudentAttendance, Integer> {

    // Cần phải có dòng này thì Service mới gọi được nhé
    boolean existsByAttendanceIdAndStudentId(Integer attendanceId, Integer studentId);
    List<StudentAttendance> findByAttendanceId(Integer attendanceId);
    // THÊM DÒNG NÀY (Đúng tên và đúng kiểu trả về Optional)
    Optional<StudentAttendance> findByAttendanceIdAndStudentId(Integer attendanceId, Integer studentId);
}