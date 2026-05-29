package com.tam.pbl5.controller;

import com.tam.pbl5.entity.Camera;
import com.tam.pbl5.entity.ClassSchedule;
import com.tam.pbl5.service.ScheduleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class ScheduleController {
    private final ScheduleService scheduleService;

    @GetMapping("/room/{roomId}")
    public ResponseEntity<?> getRoomSchedule(@PathVariable Integer roomId) {
        return ResponseEntity.ok(scheduleService.getRoomSchedule(roomId));
    }

    @GetMapping("/class/{classId}")
    public ResponseEntity<?> getClassSchedule(@PathVariable Integer classId) {
        return ResponseEntity.ok(scheduleService.getClassSchedule(classId));
    }

    @PostMapping
    public ResponseEntity<?> assignSchedule(@RequestBody Map<String, Object> body, @RequestHeader("Authorization") String token) {
        try {
            Integer classId = Integer.parseInt(body.get("classId").toString());
            Integer roomId = Integer.parseInt(body.get("roomId").toString());
            Integer dayOfWeek = Integer.parseInt(body.get("dayOfWeek").toString());
            Integer startPeriod = Integer.parseInt(body.get("startPeriod").toString());
            Integer endPeriod = Integer.parseInt(body.get("endPeriod").toString());

            ClassSchedule schedule = scheduleService.assignSchedule(classId, roomId, dayOfWeek, startPeriod, endPeriod, token);
            return ResponseEntity.ok(schedule);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<?> deleteSchedule(@PathVariable Integer scheduleId, @RequestHeader("Authorization") String token) {
        try {
            scheduleService.deleteSchedule(scheduleId, token);
            return ResponseEntity.ok("Đã xóa lịch học");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/class/{classId}/current-camera")
    public ResponseEntity<?> getCurrentCamera(@PathVariable Integer classId) {
        try {
            Camera camera = scheduleService.getCurrentActiveCameraForClass(classId);
            return ResponseEntity.ok(camera);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
