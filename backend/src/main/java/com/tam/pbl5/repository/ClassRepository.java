package com.tam.pbl5.repository;

import com.tam.pbl5.entity.Clazz;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassRepository extends JpaRepository<Clazz, Integer> {
    List<Clazz> findByTeacherId(Integer teacherId);
}