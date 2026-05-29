package com.tam.pbl5.service;

import com.tam.pbl5.entity.Camera;
import com.tam.pbl5.entity.Room;
import com.tam.pbl5.repository.CameraRepository;
import com.tam.pbl5.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomService {
    private final RoomRepository roomRepository;
    private final CameraRepository cameraRepository;
    private final JwtService jwtService;

    public List<Room> getAllRooms() {
        return roomRepository.findAll();
    }

    public Room createRoom(String name, Integer cameraId, String token) {
        if (!"ROLE_ADMIN".equalsIgnoreCase(jwtService.extractRole(token.replace("Bearer ", "")))) {
            throw new RuntimeException("Lỗi: Chỉ Admin mới có quyền tạo phòng!");
        }

        Room room = new Room();
        room.setName(name);

        if (cameraId != null) {
            Camera camera = cameraRepository.findById(cameraId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy camera!"));
            room.setCamera(camera);
        }

        return roomRepository.save(room);
    }
}
