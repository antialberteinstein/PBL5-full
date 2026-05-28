package com.tam.pbl5.dto.response;

public interface StudentInClassProjection {
    String getMssv();           // Tương ứng với s.id
    String getUsername();       // Tương ứng với u.username
    String getFullName();       // Tương ứng với p.full_name
    Boolean getFaceRegistered();// Tương ứng với s.face_registered
}