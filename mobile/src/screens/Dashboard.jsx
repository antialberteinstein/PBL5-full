import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { studentAPI, teacherAPI } from "../services/api";
import { clearSession, getRole, getUsername } from "../utils/auth";

export default function DashboardScreen({ navigation }) {
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(true);

  const fetchAll = useCallback(async () => {
    const r = await getRole();
    const u = await getUsername();
    setRole(r);
    setUsername(u);
    try {
      const res =
        r === "TEACHER"
          ? await teacherAPI.getMyClasses()
          : await studentAPI.getMyJoinedClasses();
      setClasses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn("[Dashboard] load classes failed", err?.message);
      setClasses([]);
    }

    if (r === "STUDENT") {
      try {
        const profile = await studentAPI.getCurrentStudent();
        setFaceRegistered(Boolean(profile.data?.faceRegistered));
      } catch {
        setFaceRegistered(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        await fetchAll();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchAll]),
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={onLogout} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Thoát</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const onLogout = async () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("ClassDetail", { classId: item.id, className: item.name })
      }
    >
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>
          {(item.name || "CL").substring(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardSub}>ID lớp: #{item.id}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>
            Xin chào, <Text style={styles.helloName}>{username}</Text>
          </Text>
          <Text
            style={[
              styles.badge,
              role === "TEACHER" ? styles.badgeTeacher : styles.badgeStudent,
            ]}
          >
            {role === "TEACHER" ? "Giảng viên" : "Sinh viên"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("Profile")}
          style={styles.profileBtn}
        >
          <Text style={styles.profileBtnText}>Hồ sơ</Text>
        </TouchableOpacity>
      </View>

      {role === "STUDENT" && (
        <View style={styles.faceRow}>
          {faceRegistered ? (
            <View style={styles.faceOk}>
              <Text style={styles.faceOkText}>✅ Đã đăng ký khuôn mặt</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    "Đăng ký lại?",
                    "Dữ liệu khuôn mặt cũ sẽ bị xóa.",
                    [
                      { text: "Hủy", style: "cancel" },
                      {
                        text: "Đồng ý",
                        onPress: () =>
                          navigation.navigate("FaceRegistration", { reregister: true }),
                      },
                    ],
                  )
                }
              >
                <Text style={styles.linkText}>Đăng ký lại</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.faceCta}
              onPress={() => navigation.navigate("FaceRegistration")}
            >
              <Text style={styles.faceCtaText}>📷 Đăng ký khuôn mặt</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>
        {role === "TEACHER" ? "Lớp giảng dạy" : "Lớp đã tham gia"}
      </Text>

      <FlatList
        data={classes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Chưa có lớp học nào.</Text>
            <Text style={styles.emptyHint}>
              Kéo xuống để làm mới hoặc liên hệ giảng viên để được thêm vào lớp.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hello: { fontSize: 16, color: "#374151" },
  helloName: { fontWeight: "700", color: "#111827" },
  badge: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
  },
  badgeStudent: { backgroundColor: "#d1fae5", color: "#047857" },
  badgeTeacher: { backgroundColor: "#ffedd5", color: "#c2410c" },
  profileBtn: {
    borderWidth: 1,
    borderColor: "#c7d2fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profileBtnText: { color: "#4f46e5", fontWeight: "700", fontSize: 13 },
  faceRow: { paddingHorizontal: 16, paddingTop: 12 },
  faceCta: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  faceCtaText: { color: "#fff", fontWeight: "700" },
  faceOk: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
  },
  faceOkText: { color: "#047857", fontWeight: "700" },
  linkText: { color: "#4f46e5", fontWeight: "700" },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardAvatarText: { color: "#4338ca", fontWeight: "800" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#6b7280", fontWeight: "600", marginBottom: 6 },
  emptyHint: { color: "#9ca3af", fontSize: 12, textAlign: "center" },
});
