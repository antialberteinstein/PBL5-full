package com.tam.pbl5.service;

import com.tam.pbl5.entity.Camera;
import com.tam.pbl5.entity.ClassSchedule;
import com.tam.pbl5.entity.Clazz;
import com.tam.pbl5.entity.Room;
import com.tam.pbl5.repository.ClassScheduleRepository;
import com.tam.pbl5.repository.ClassRepository;
import com.tam.pbl5.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleService {
    private final ClassScheduleRepository scheduleRepository;
    private final RoomRepository roomRepository;
    private final ClassRepository clazzRepository;
    private final JwtService jwtService;

    public List<ClassSchedule> getRoomSchedule(Integer roomId) {
        return scheduleRepository.findByRoomId(roomId);
    }

    public List<ClassSchedule> getClassSchedule(Integer classId) {
        return scheduleRepository.findByClazzId(classId);
    }

    public ClassSchedule assignSchedule(Integer classId, Integer roomId, Integer dayOfWeek, Integer startPeriod, Integer endPeriod, String token) {
        if (!"ROLE_ADMIN".equalsIgnoreCase(jwtService.extractRole(token.replace("Bearer ", "")))) {
            throw new RuntimeException("Lỗi: Chỉ Admin mới có quyền xếp lịch!");
        }

        Clazz clazz = clazzRepository.findById(classId).orElseThrow(() -> new RuntimeException("Không tìm thấy lớp học!"));
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Không tìm thấy phòng!"));

        // Todo: Add logic to check for overlapping schedules

        ClassSchedule schedule = new ClassSchedule();
        schedule.setClazz(clazz);
        schedule.setRoom(room);
        schedule.setDayOfWeek(dayOfWeek);
        schedule.setStartPeriod(startPeriod);
        schedule.setEndPeriod(endPeriod);

        return scheduleRepository.save(schedule);
    }

    public void deleteSchedule(Integer scheduleId, String token) {
        if (!"ROLE_ADMIN".equalsIgnoreCase(jwtService.extractRole(token.replace("Bearer ", "")))) {
            throw new RuntimeException("Lỗi: Chỉ Admin mới có quyền xóa lịch!");
        }
        scheduleRepository.deleteById(scheduleId);
    }

    public Camera getCurrentActiveCameraForClass(Integer classId) {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        int currentDayOfWeek = now.getDayOfWeek().getValue() + 1; // Mon=2, Sun=8

        List<ClassSchedule> schedules = scheduleRepository.findByClazzId(classId);

        for (ClassSchedule schedule : schedules) {
            if (schedule.getDayOfWeek() != null
                    && schedule.getDayOfWeek() == currentDayOfWeek
                    && schedule.getRoom() != null
                    && schedule.getRoom().getCamera() != null) {
                return schedule.getRoom().getCamera();
            }
        }

        for (ClassSchedule schedule : schedules) {
            if (schedule.getRoom() != null && schedule.getRoom().getCamera() != null) {
                return schedule.getRoom().getCamera();
            }
        }

        throw new RuntimeException("Lớp học chưa được xếp lịch tại phòng có Camera!");
    }
}
