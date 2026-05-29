package com.tam.pbl5.repository;

import com.tam.pbl5.entity.ClassSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassScheduleRepository extends JpaRepository<ClassSchedule, Integer> {
    List<ClassSchedule> findByRoomId(Integer roomId);
    List<ClassSchedule> findByClazzId(Integer classId);
}
