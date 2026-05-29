package com.tam.pbl5.service;

import com.tam.pbl5.dto.response.ImportJob;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hàng chờ chạy nền cho các tác vụ import Excel.
 * Job được giữ trong RAM; frontend poll qua REST để lấy tiến trình.
 * Job tiếp tục chạy ngầm bất kể frontend còn mở hay đã đăng xuất.
 */
@Service
@RequiredArgsConstructor
public class ImportJobService {

    private final AdminService adminService;

    private final Map<String, ImportJob> jobs = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "import-worker");
        t.setDaemon(true);
        return t;
    });

    public ImportJob startImport(byte[] fileBytes, String role) {
        String r = role == null ? "" : role.trim().toUpperCase();
        if (!"STUDENT".equals(r) && !"TEACHER".equals(r)) {
            throw new RuntimeException("Role không hợp lệ! Chỉ chấp nhận STUDENT hoặc TEACHER.");
        }
        if (fileBytes == null || fileBytes.length == 0) {
            throw new RuntimeException("File rỗng hoặc không đọc được!");
        }

        ImportJob job = new ImportJob();
        job.setId(UUID.randomUUID().toString());
        job.setRole(r);
        job.setStatus("PENDING");
        job.setStartedAt(System.currentTimeMillis());
        jobs.put(job.getId(), job);

        executor.submit(() -> runImport(job, fileBytes));
        return job;
    }

    private void runImport(ImportJob job, byte[] fileBytes) {
        try {
            job.setStatus("RUNNING");
            adminService.runImportJob(fileBytes, job);
            job.setStatus("DONE");
        } catch (Exception e) {
            job.setStatus("ERROR");
            job.setErrorMessage(e.getMessage() == null ? e.toString() : e.getMessage());
        } finally {
            job.setFinishedAt(System.currentTimeMillis());
        }
    }

    public ImportJob getJob(String id) {
        ImportJob job = jobs.get(id);
        if (job == null) {
            throw new RuntimeException("Không tìm thấy job: " + id);
        }
        return job;
    }

    /** Danh sách job gần đây nhất (mới trước, tối đa 50). */
    public List<ImportJob> listJobs() {
        List<ImportJob> list = new ArrayList<>(jobs.values());
        list.sort(Comparator.comparingLong(ImportJob::getStartedAt).reversed());
        return list.size() > 50 ? list.subList(0, 50) : list;
    }
}
