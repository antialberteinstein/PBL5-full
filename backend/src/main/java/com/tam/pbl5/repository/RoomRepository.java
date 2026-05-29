package com.tam.pbl5.repository;

import com.tam.pbl5.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RoomRepository extends JpaRepository<Room, Integer> {
    boolean existsByName(String name);
}
