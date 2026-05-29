package com.tam.pbl5.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "class_schedule")
@Data
public class ClassSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne
    @JoinColumn(name = "class_id", nullable = false)
    private Clazz clazz;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek; // 2 (Monday) to 8 (Sunday)

    @Column(name = "start_period", nullable = false)
    private Integer startPeriod; // 1 to 10

    @Column(name = "end_period", nullable = false)
    private Integer endPeriod; // 1 to 10
}
