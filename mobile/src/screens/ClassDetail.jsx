import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { attendanceAPI, classAPI } from "../services/api";
import { backendHttpBase } from "../config";
import { getRole, getUsername } from "../utils/auth";

// Resolve a relative /uploads/... image path against the LAN backend host.
// Mirrors frontend's resolveAttendanceImageUrl.
const resolveImageUrl = (imageUrl) => {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith("data:")) {
    return imageUrl;
  }
  if (imageUrl.startsWith("/uploads/")) {
    return `${backendHttpBase()}${imageUrl}`;
  }
  return imageUrl;
};

const formatSessionDate = (datetime) => {
  if (!datetime) return "";
  const d = new Date(datetime);
  if (Number.isNaN(d.getTime())) return String(datetime);
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function ClassDetailScreen({ route }) {
  const { classId, className } = route.params || {};

  const [activeTab, setActiveTab] = useState("students");
  const [isTeacher, setIsTeacher] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");

  const [details, setDetails] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openSessionId, setOpenSessionId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  // Bộ lọc lịch sử theo từng buổi: { [sessionId]: { query, status } }
  // status: "all" | "present" | "spoof" | "absent"
  const [sessionFilters, setSessionFilters] = useState({});

  // "present" = có mặt & không gian lận, "spoof" = nghi gian lận, "absent" = vắng.
  const getAttendanceStatus = (sv) => {
    if (!sv?.isPresent) return "absent";
    return sv?.spoof ? "spoof" : "present";
  };

  const getSessionFilter = (sessionId) =>
    sessionFilters[sessionId] || { query: "", status: "all" };

  const updateSessionFilter = (sessionId, patch) =>
    setSessionFilters((prev) => ({
      ...prev,
      [sessionId]: { ...getSessionFilter(sessionId), ...patch },
    }));

  const applySessionFilter = (sessionId, studentList) => {
    const { query, status } = getSessionFilter(sessionId);
    const q = query.trim().toLowerCase();
    return studentList.filter((sv) => {
      const matchesText =
        !q ||
        String(sv.fullName || "").toLowerCase().includes(q) ||
        String(sv.mssv || "").toLowerCase().includes(q) ||
        String(sv.username || "").toLowerCase().includes(q);
      const matchesStatus =
        status === "all" || getAttendanceStatus(sv) === status;
      return matchesText && matchesStatus;
    });
  };

  const FILTER_OPTIONS = [
    { key: "all", label: "Tất cả" },
    { key: "present", label: "Có mặt" },
    { key: "spoof", label: "Nghi gian lận" },
    { key: "absent", label: "Vắng" },
  ];

  // Resolve role/username once.
  useEffect(() => {
    (async () => {
      const [role, username] = await Promise.all([getRole(), getUsername()]);
      setIsTeacher(role === "TEACHER");
      setCurrentUsername(username);
    })();
  }, []);

  // Load class header + student roster.
  useEffect(() => {
    (async () => {
      try {
        const [d, s] = await Promise.all([
          classAPI.getClassById(classId),
          classAPI.getStudents(classId).catch(() => ({ data: [] })),
        ]);
        setDetails(d.data);
        setStudents(Array.isArray(s.data) ? s.data : []);
      } catch (err) {
        console.warn("[ClassDetail] load failed", err?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [classId]);

  // Load attendance history (sessions + their attended/absent students) the
  // first time the user opens the history tab.
  useEffect(() => {
    if (activeTab !== "history") return;

    let cancelled = false;
    (async () => {
      try {
        setHistoryLoading(true);
        const res = await attendanceAPI.getAttendanceList(classId);
        const rawSessions = Array.isArray(res.data) ? res.data : [];

        const withStudents = await Promise.all(
          rawSessions.map(async (session) => {
            try {
              const [attendedRes, absentRes] = await Promise.all([
                attendanceAPI.getAttendedStudents(session.id),
                attendanceAPI.getAbsentStudents(session.id),
              ]);
              const attended = (attendedRes.data || []).map((sv) => ({
                ...sv,
                isPresent: true,
              }));
              const absent = (absentRes.data || []).map((sv) => ({
                ...sv,
                isPresent: false,
              }));

              let merged = [...attended, ...absent];
              merged.sort((a, b) =>
                String(a.mssv || "").localeCompare(String(b.mssv || "")),
              );

              // Students only see their own attendance record.
              if (!isTeacher) {
                merged = merged.filter(
                  (sv) =>
                    sv.username === currentUsername ||
                    sv.mssv === currentUsername ||
                    sv.id === currentUsername,
                );
              }

              return { id: session.id, datetime: session.datetime, students: merged };
            } catch {
              return { id: session.id, datetime: session.datetime, students: [] };
            }
          }),
        );

        if (!cancelled) setSessions(withStudents);
      } catch (err) {
        console.warn("[ClassDetail] history load failed", err?.message);
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, classId, isTeacher, currentUsername]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  const renderStudentsTab = () => (
    <FlatList
      data={students}
      keyExtractor={(item, i) =>
        String(item.username || item.mssv || item.id || i)
      }
      contentContainerStyle={{ padding: 16, paddingTop: 8 }}
      ListHeaderComponent={
        <Text style={styles.sectionTitle}>Sinh viên ({students.length})</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rowName}>
            {item.fullName || item.name || item.username}
          </Text>
          <Text style={styles.rowSub}>{item.mssv || item.username}</Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>Chưa có sinh viên trong lớp này.</Text>
      }
    />
  );

  const renderSessionDetail = (session) => {
    if (session.students.length === 0) {
      return (
        <Text style={styles.detailEmpty}>
          {isTeacher
            ? "Không có dữ liệu sinh viên trong buổi này."
            : "Bạn vắng mặt trong buổi này."}
        </Text>
      );
    }
    const filter = getSessionFilter(session.id);
    const filtered = applySessionFilter(session.id, session.students);

    const rows = filtered.map((sv, idx) => {
      const img = resolveImageUrl(sv.imageUrl);
      return (
        <View
          key={`${sv.username || sv.mssv || idx}`}
          style={[styles.detailRow, !sv.isPresent && styles.detailRowAbsent]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>{sv.fullName || sv.username}</Text>
            <Text style={styles.detailMssv}>{sv.mssv || sv.username}</Text>
            {sv.spoof ? (
              <Text style={styles.spoofBadge}>⚠ Nghi gian lận</Text>
            ) : null}
          </View>
          <View style={styles.detailRight}>
            {img ? (
              <Pressable
                onPress={() =>
                  setPreviewImage({ uri: img, title: sv.fullName || sv.username })
                }
              >
                <Image source={{ uri: img }} style={styles.thumb} />
              </Pressable>
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbPlaceholderText}>—</Text>
              </View>
            )}
            <Text
              style={[
                styles.badge,
                sv.isPresent ? styles.badgePresent : styles.badgeAbsent,
              ]}
            >
              {sv.isPresent ? "Có mặt" : "Vắng"}
            </Text>
          </View>
        </View>
      );
    });

    return (
      <View>
        {/* Thanh tìm kiếm + bộ lọc trạng thái cho buổi này */}
        <View style={styles.filterBar}>
          <TextInput
            value={filter.query}
            onChangeText={(t) => updateSessionFilter(session.id, { query: t })}
            placeholder="Tìm theo tên hoặc MSSV..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
          />
          <View style={styles.filterChips}>
            {FILTER_OPTIONS.map((opt) => {
              const active = filter.status === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() =>
                    updateSessionFilter(session.id, { status: opt.key })
                  }
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {filtered.length === 0 ? (
          <Text style={styles.detailEmpty}>
            Không tìm thấy sinh viên phù hợp với bộ lọc.
          </Text>
        ) : (
          rows
        )}
      </View>
    );
  };

  const renderHistoryTab = () => {
    if (historyLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      );
    }
    if (sessions.length === 0) {
      return <Text style={styles.empty}>Chưa có buổi điểm danh nào.</Text>;
    }
    return (
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {sessions.map((session) => {
          const open = openSessionId === session.id;
          return (
            <View key={session.id} style={styles.sessionCard}>
              <Pressable
                style={styles.sessionHeader}
                onPress={() => setOpenSessionId(open ? null : session.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle}>Buổi #{session.id}</Text>
                  <Text style={styles.sessionDate}>
                    {formatSessionDate(session.datetime)}
                  </Text>
                </View>
                <Text style={styles.sessionToggle}>
                  {open ? "Đóng" : "Xem chi tiết"}
                </Text>
              </Pressable>
              {open && (
                <View style={styles.sessionBody}>{renderSessionDetail(session)}</View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>{details?.name || className}</Text>
        <Text style={styles.sub}>ID: #{classId}</Text>
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "students" && styles.tabActive]}
          onPress={() => setActiveTab("students")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "students" && styles.tabTextActive,
            ]}
          >
            Sinh viên
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "history" && styles.tabTextActive,
            ]}
          >
            Chi tiết buổi điểm danh
          </Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === "students" ? renderStudentsTab() : renderHistoryTab()}
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        {/* Tapping the backdrop closes the preview. */}
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImage(null)}>
          {/* Swallow taps on the image itself so they don't close. */}
          <Pressable onPress={() => {}} style={styles.previewContent}>
            {previewImage?.title ? (
              <Text style={styles.previewTitle}>{previewImage.title}</Text>
            ) : null}
            {previewImage ? (
              <Image
                source={{ uri: previewImage.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  headerCard: {
    backgroundColor: "#fff",
    margin: 16,
    marginBottom: 0,
    padding: 18,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  sub: { color: "#6b7280", marginTop: 4 },

  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: "#eef2ff",
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#4f46e5" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#4f46e5" },
  tabTextActive: { color: "#ffffff" },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  row: { backgroundColor: "#fff", padding: 12, borderRadius: 10, marginTop: 8 },
  rowName: { fontWeight: "700", color: "#111827" },
  rowSub: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  empty: { textAlign: "center", color: "#9ca3af", padding: 24 },

  sessionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sessionTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  sessionDate: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  sessionToggle: { fontSize: 12, fontWeight: "700", color: "#4f46e5" },
  sessionBody: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },

  filterBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 8,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#111827",
  },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#4f46e5", borderColor: "#4f46e5" },
  chipText: { fontSize: 11, fontWeight: "700", color: "#6b7280" },
  chipTextActive: { color: "#ffffff" },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  detailRowAbsent: { backgroundColor: "#fef2f2" },
  detailName: { fontWeight: "700", color: "#111827" },
  detailMssv: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  spoofBadge: {
    marginTop: 4,
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "800",
    color: "#dc2626",
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  detailRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#e5e7eb" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  thumbPlaceholderText: { color: "#9ca3af", fontWeight: "700" },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
    minWidth: 56,
    textAlign: "center",
  },
  badgePresent: { backgroundColor: "#dcfce7", color: "#16a34a" },
  badgeAbsent: { backgroundColor: "#fee2e2", color: "#dc2626" },
  detailEmpty: {
    textAlign: "center",
    color: "#9ca3af",
    fontStyle: "italic",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },

  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewContent: { width: "100%", alignItems: "center" },
  previewTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
});
