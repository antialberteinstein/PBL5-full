package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "users")
@Data
public class User {
    @Id
    @Column(length = 50)
    private String username;
    private String password;
    private boolean enabled;

    @OneToOne
    @JoinColumn(name = "profile_id")
    private Profile profile;
}
