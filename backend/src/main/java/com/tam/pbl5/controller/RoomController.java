package com.tam.pbl5.controller;

import com.tam.pbl5.entity.Room;
import com.tam.pbl5.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {
    private final RoomService roomService;

    @GetMapping
    public ResponseEntity<?> getAllRooms() {
        return ResponseEntity.ok(roomService.getAllRooms());
    }

    @PostMapping
    public ResponseEntity<?> createRoom(@RequestBody Map<String, Object> body, @RequestHeader("Authorization") String token) {
        try {
            String name = (String) body.get("name");
            Integer cameraId = body.get("cameraId") != null ? Integer.parseInt(body.get("cameraId").toString()) : null;
            Room room = roomService.createRoom(name, cameraId, token);
            return ResponseEntity.ok(room);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
