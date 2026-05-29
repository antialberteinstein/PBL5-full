package com.tam.pbl5.dto.response;

import lombok.Data;

/**
 * Trạng thái một tác vụ import Excel (sinh viên / giáo viên) chạy nền.
 * Được lưu trong bộ nhớ, frontend poll qua /api/admin/import-jobs/{id}.
 */
@Data
public class ImportJob {

    private String id;
    private String role; // STUDENT | TEACHER

    /** PENDING | RUNNING | DONE | ERROR */
    private volatile String status;

    private volatile int total;     // Tổng số dòng dữ liệu cần xử lý
    private volatile int processed; // Đã xử lý
    private volatile int succeeded; // Tạo thành công
    private volatile int failed;    // Thất bại

    private volatile String errorLog = "";
    private volatile String errorMessage; // Lỗi nghiêm trọng (thiếu cột,...)

    private long startedAt;
    private volatile long finishedAt;

    public synchronized void appendErrorLine(String line) {
        String current = this.errorLog == null ? "" : this.errorLog;
        this.errorLog = current + line + "\n";
    }
}
