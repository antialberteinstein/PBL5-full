DROP DATABASE IF EXISTS pbl5;
CREATE DATABASE pbl5;
USE pbl5;

-- ================= USERS & PROFILE =================
CREATE TABLE profile (
  id INT AUTO_INCREMENT PRIMARY KEY,
  avatar_path VARCHAR(255),
  birth DATETIME,
  full_name VARCHAR(255),
  email VARCHAR(255) NOT NULL
);

CREATE TABLE users (
  username VARCHAR(50) PRIMARY KEY,
  enabled BOOLEAN,
  password VARCHAR(255),
  profile_id INT,
  FOREIGN KEY (profile_id) REFERENCES profile(id)
);

CREATE TABLE authority (
  authority VARCHAR(255),
  username VARCHAR(50),
  PRIMARY KEY (authority, username),
  FOREIGN KEY (username) REFERENCES users(username)
);

-- ================= TEACHER / STUDENT =================
CREATE TABLE teacher (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50),
  FOREIGN KEY (username) REFERENCES users(username)
);

CREATE TABLE student (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50),
  face_registered BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (username) REFERENCES users(username)
);

-- ================= CLASS =================
CREATE TABLE class (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  teacher_id INT,
  FOREIGN KEY (teacher_id) REFERENCES teacher(id)
);

CREATE TABLE student_class (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT,
  student_id INT,
  status VARCHAR(255) DEFAULT 'PENDING',
  FOREIGN KEY (class_id) REFERENCES class(id),
  FOREIGN KEY (student_id) REFERENCES student(id)
);

-- ================= ATTENDANCE =================
CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  datetime DATETIME,
  class_id INT,
  FOREIGN KEY (class_id) REFERENCES class(id)
);

CREATE TABLE student_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attendance_id INT,
  student_id INT,
  checkin_time DATETIME,
  FOREIGN KEY (attendance_id) REFERENCES attendance(id),
  FOREIGN KEY (student_id) REFERENCES student(id)
);

-- ================= NOTIFICATION =================
CREATE TABLE notification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content VARCHAR(255),
  date DATETIME,
  title VARCHAR(255)
);

CREATE TABLE user_notification (
  notification_id INT,
  username VARCHAR(50),
  is_read BOOLEAN,
  PRIMARY KEY (notification_id, username),
  FOREIGN KEY (notification_id) REFERENCES notification(id),
  FOREIGN KEY (username) REFERENCES users(username)
);