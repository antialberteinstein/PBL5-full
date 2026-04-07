package com.tam.pbl5.controller;

import com.tam.pbl5.dto.request.TeacherAddStudentRequest;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Student;
import com.tam.pbl5.service.TeacherClassService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teacher-class") // Đường dẫn gốc cho Giáo viên quản lý lớp
@RequiredArgsConstructor
public class TeacherClassController {

    private final TeacherClassService teacherClassService;

    // ==========================================
    // 1. Xem danh sách lớp do mình làm chủ nhiệm
    // ==========================================
    @GetMapping("/my-classes")
    public ResponseEntity<?> getMyClasses(@RequestHeader("Authorization") String token) {
        try {
            List<Clazz> classes = teacherClassService.getMyClasses(token);
            return ResponseEntity.ok(classes);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 2. Giáo viên chủ động thêm sinh viên vào thẳng lớp (APPROVED)
    // ==========================================
    @PostMapping("/add-student")
    public ResponseEntity<?> teacherAddStudent(
            @RequestBody TeacherAddStudentRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            String message = teacherClassService.teacherAddStudent(request, token);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 3. Xem danh sách sinh viên đang chờ duyệt (PENDING)
    // ==========================================
    @GetMapping("/{classId}/pending-students")
    public ResponseEntity<?> getPendingStudents(
            @PathVariable Integer classId,
            @RequestHeader("Authorization") String token) {
        try {
            List<Student> students = teacherClassService.getPendingStudents(classId, token);
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 4. Duyệt sinh viên vào lớp
    // ==========================================
    @PostMapping("/approve-student")
    public ResponseEntity<?> approveStudent(
            @RequestBody TeacherAddStudentRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            String message = teacherClassService.approveStudent(request, token);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 5. Từ chối yêu cầu tham gia lớp
    // ==========================================
    @PostMapping("/reject-student")
    public ResponseEntity<?> rejectStudent(
            @RequestBody TeacherAddStudentRequest request,
            @RequestHeader("Authorization") String token) {
        try {
            String message = teacherClassService.rejectStudent(request, token);
            return ResponseEntity.ok(message);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}