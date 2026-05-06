package com.tam.pbl5.service;

import java.util.List;
import com.tam.pbl5.dto.request.TeacherAddStudentRequest;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Student;
import com.tam.pbl5.entity.StudentClass;
import com.tam.pbl5.entity.Teacher;
import com.tam.pbl5.repository.ClassRepository;
import com.tam.pbl5.repository.StudentClassRepository;
import com.tam.pbl5.repository.StudentRepository;
import com.tam.pbl5.repository.TeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.stream.Collectors;
import org.apache.poi.ss.usermodel.*;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class TeacherClassService {
    private final StudentClassRepository studentClassRepository;
    private final ClassRepository classRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final JwtService jwtService;

    @Transactional
    public String teacherAddStudent(TeacherAddStudentRequest request, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);

        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép thêm sinh viên vào lớp!");
        }

        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");

        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));

        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền thêm sinh viên vào lớp của giáo viên khác!");
        }

        // ✨ SỬA Ở ĐÂY: Tìm sinh viên bằng MSSV thay vì Username
        Student student = studentRepository.findByMssv(request.getMssv()).orElse(null);
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên có MSSV là '" + request.getMssv() + "'");
        }

        StudentClass existingRecord = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());
        if (existingRecord != null) {
            if ("APPROVED".equalsIgnoreCase(existingRecord.getStatus())) {
                throw new RuntimeException("Lỗi: Sinh viên mang MSSV " + request.getMssv() + " đã có trong lớp rồi!");
            } else if ("PENDING".equalsIgnoreCase(existingRecord.getStatus())) {
                existingRecord.setStatus("APPROVED");
                studentClassRepository.save(existingRecord);
                return "Sinh viên mang MSSV " + request.getMssv() + " đang trong danh sách chờ. Đã tự động duyệt vào lớp!";
            }
        }

        StudentClass studentClass = new StudentClass();
        studentClass.setClassId(clazz.getId());
        studentClass.setStudentId(student.getId());
        studentClass.setStatus("APPROVED");
        studentClassRepository.save(studentClass);

        return "Đã thêm trực tiếp sinh viên mang MSSV " + request.getMssv() + " vào lớp thành công!";
    }

    public List<Student> getPendingStudents(Integer classId, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được xem danh sách chờ duyệt!");
        }
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        Clazz clazz = classRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền xem danh sách chờ của lớp giáo viên khác!");
        }
        List<StudentClass> pendingRecords = studentClassRepository.findByClassIdAndStatus(classId, "PENDING");
        List<Integer> studentIds = pendingRecords.stream()
                .map(StudentClass::getStudentId)
                .collect(Collectors.toList());
        return studentRepository.findAllById(studentIds);
    }

    public String approveStudent(TeacherAddStudentRequest request, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép duyệt học sinh!");
        }
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền duyệt sinh viên cho lớp của người khác!");
        }

        // ✨ SỬA Ở ĐÂY: Tìm sinh viên bằng MSSV
        Student student = studentRepository.findByMssv(request.getMssv()).orElse(null);
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên có MSSV: " + request.getMssv());
        }

        StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());
        if (studentClass == null) {
            throw new RuntimeException("Lỗi: Sinh viên này chưa gửi yêu cầu tham gia lớp!");
        }
        if ("APPROVED".equalsIgnoreCase(studentClass.getStatus())) {
            throw new RuntimeException("Lỗi: Sinh viên mang MSSV " + request.getMssv() + " đã được duyệt vào lớp từ trước rồi!");
        }

        studentClass.setStatus("APPROVED");
        studentClassRepository.save(studentClass);
        return "Đã duyệt sinh viên có MSSV " + request.getMssv() + " vào lớp thành công!";
    }

    public String rejectStudent(TeacherAddStudentRequest request, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép từ chối học sinh!");
        }
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Lỗi: Không tìm thấy hồ sơ giáo viên!");
        Clazz clazz = classRepository.findById(request.getClassId())
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền từ chối sinh viên của lớp khác!");
        }

        // ✨ SỬA Ở ĐÂY: Tìm sinh viên bằng MSSV
        Student student = studentRepository.findByMssv(request.getMssv()).orElse(null);
        if (student == null) {
            throw new RuntimeException("Lỗi: Không tìm thấy sinh viên có MSSV: " + request.getMssv());
        }

        StudentClass studentClass = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());
        if (studentClass == null) {
            throw new RuntimeException("Lỗi: Sinh viên này chưa gửi yêu cầu tham gia lớp!");
        }

        studentClassRepository.delete(studentClass);
        return "Đã từ chối yêu cầu tham gia lớp của sinh viên mang MSSV " + request.getMssv() + "!";
    }

    public List<Clazz> getMyClasses(String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Chỉ giáo viên mới xem được danh sách lớp của mình!");
        }
        Teacher teacher = teacherRepository.findByUsername(username);
        if (teacher == null) throw new RuntimeException("Không tìm thấy thông tin giáo viên!");
        return classRepository.findByTeacherId(teacher.getId());
    }

    // ==========================================
    // GIÁO VIÊN IMPORT DANH SÁCH SINH VIÊN TỪ EXCEL
    // ==========================================
    @Transactional
    public String importStudentsFromExcel(Integer classId, MultipartFile file, String token) {
        if (token != null && token.startsWith("Bearer ")) token = token.substring(7);
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token);
        if (!"ROLE_TEACHER".equalsIgnoreCase(role)) {
            throw new RuntimeException("Lỗi: Chỉ giáo viên mới được phép thêm danh sách sinh viên!");
        }
        Teacher teacher = teacherRepository.findByUsername(username);
        Clazz clazz = classRepository.findById(classId)
                .orElseThrow(() -> new RuntimeException("Lỗi: Lớp học không tồn tại!"));
        if (!clazz.getTeacherId().equals(teacher.getId())) {
            throw new RuntimeException("Lỗi: Bạn không có quyền thêm sinh viên vào lớp của giáo viên khác!");
        }

        int successCount = 0;
        int failCount = 0;
        StringBuilder errorLog = new StringBuilder();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String studentMssv = "Chưa xác định"; // ✨ Đổi tên biến cho rõ ràng
                try {
                    // Giả định: Cột 0 (Cột A) chứa MSSV
                    Cell cell = row.getCell(0);
                    if (cell == null) throw new RuntimeException("Ô dữ liệu bị trống.");

                    if (cell.getCellType() == CellType.STRING) {
                        studentMssv = cell.getStringCellValue().trim();
                    } else if (cell.getCellType() == CellType.NUMERIC) {
                        studentMssv = String.valueOf((long) cell.getNumericCellValue()).trim();
                    }

                    if (studentMssv.isEmpty()) throw new RuntimeException("MSSV bị rỗng.");

                    // ✨ SỬA Ở ĐÂY: Tìm sinh viên bằng MSSV
                    Student student = studentRepository.findByMssv(studentMssv).orElse(null);
                    if (student == null) {
                        throw new RuntimeException("Không tìm thấy sinh viên có MSSV này trong hệ thống trường.");
                    }

                    StudentClass existingRecord = studentClassRepository.findByStudentIdAndClassId(student.getId(), clazz.getId());
                    if (existingRecord != null) {
                        if ("APPROVED".equalsIgnoreCase(existingRecord.getStatus())) {
                            throw new RuntimeException("Đã là thành viên của lớp, bỏ qua.");
                        } else if ("PENDING".equalsIgnoreCase(existingRecord.getStatus())) {
                            existingRecord.setStatus("APPROVED");
                            studentClassRepository.save(existingRecord);
                            successCount++;
                            continue;
                        }
                    }

                    StudentClass studentClass = new StudentClass();
                    studentClass.setClassId(clazz.getId());
                    studentClass.setStudentId(student.getId());
                    studentClass.setStatus("APPROVED");
                    studentClassRepository.save(studentClass);
                    successCount++;

                } catch (Exception e) {
                    failCount++;
                    errorLog.append("Dòng ").append(i + 1).append(" [").append(studentMssv).append("]: ").append(e.getMessage()).append("\n");
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Lỗi đọc cấu trúc file Excel: " + e.getMessage());
        }

        return String.format("Nhập danh sách hoàn tất!\n✅ Thành công: %d\n❌ Thất bại/Bỏ qua: %d\n%s",
                successCount, failCount, errorLog.length() > 0 ? "\nChi tiết lỗi:\n" + errorLog.toString() : "");
    }
}