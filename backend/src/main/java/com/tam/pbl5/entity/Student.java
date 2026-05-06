package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "student")
@Data
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(length = 50)
    private String username;

    @Column(name = "mssv", nullable = false, unique = true)
    private String mssv;

    @Column(name = "face_registered")
    private boolean faceRegistered;
}
