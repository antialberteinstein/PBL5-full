import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { userAPI } from "../services/api";

const ROLE_LABEL = {
  STUDENT: "Sinh viên",
  TEACHER: "Giảng viên",
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: "", birth: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await userAPI.getProfile();
        setProfile(res.data);
        setForm({
          fullName: res.data?.fullName || "",
          birth: res.data?.birth || "",
          phone: res.data?.phone || "",
        });
      } catch {
        Alert.alert("Lỗi", "Không thể tải hồ sơ.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = { fullName: form.fullName, birth: form.birth || null };
      if (profile?.role === "TEACHER") payload.phone = form.phone;
      const res = await userAPI.updateMyProfile(payload);
      setProfile(res.data);
      Alert.alert("Thành công", "Cập nhật hồ sơ thành công!");
    } catch (e) {
      Alert.alert("Lỗi", typeof e?.response?.data === "string" ? e.response.data : "Không thể cập nhật.");
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    if (pw.newPassword !== pw.confirm) {
      return Alert.alert("Lỗi", "Mật khẩu xác nhận không khớp!");
    }
    setSavingPw(true);
    try {
      await userAPI.changePassword({
        oldPassword: pw.oldPassword,
        newPassword: pw.newPassword,
      });
      Alert.alert("Thành công", "Đổi mật khẩu thành công!");
      setPw({ oldPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      Alert.alert("Lỗi", typeof e?.response?.data === "string" ? e.response.data : "Không thể đổi mật khẩu.");
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  const role = profile?.role;
  const idLabel = role === "STUDENT" ? "MSSV" : role === "TEACHER" ? "MSGV" : "ID";
  const idValue = profile?.mssv || profile?.msgv || profile?.username;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.fullName || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.fullName || "Chưa cập nhật"}</Text>
          <Text style={styles.roleTag}>{ROLE_LABEL[role] || role}</Text>

          <Info label={idLabel} value={idValue} />
          <Info label="Tên đăng nhập" value={profile?.username} />
          {role === "STUDENT" && (
            <Info label="Lớp sinh hoạt" value={profile?.lopSinhHoat} />
          )}
          {role === "STUDENT" && (
            <Info
              label="Trạng thái khuôn mặt"
              value={profile?.faceRegistered ? "Đã đăng ký" : "Chưa đăng ký"}
            />
          )}
          {role === "TEACHER" && <Info label="Số điện thoại" value={profile?.phone} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Chỉnh sửa hồ sơ</Text>
          <Field
            label="Họ và tên"
            value={form.fullName}
            onChangeText={(v) => setForm({ ...form, fullName: v })}
          />
          <Field
            label="Ngày sinh (YYYY-MM-DD)"
            value={form.birth}
            onChangeText={(v) => setForm({ ...form, birth: v })}
            placeholder="2003-09-15"
          />
          {role === "TEACHER" && (
            <Field
              label="Số điện thoại"
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              keyboardType="phone-pad"
            />
          )}
          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={saveProfile}
            disabled={saving}
          >
            <Text style={styles.btnText}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Đổi mật khẩu</Text>
          <Field
            label="Mật khẩu hiện tại"
            value={pw.oldPassword}
            onChangeText={(v) => setPw({ ...pw, oldPassword: v })}
            secureTextEntry
          />
          <Field
            label="Mật khẩu mới"
            value={pw.newPassword}
            onChangeText={(v) => setPw({ ...pw, newPassword: v })}
            secureTextEntry
          />
          <Field
            label="Xác nhận mật khẩu mới"
            value={pw.confirm}
            onChangeText={(v) => setPw({ ...pw, confirm: v })}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnDark, savingPw && styles.btnDisabled]}
            onPress={changePw}
            disabled={savingPw}
          >
            <Text style={styles.btnText}>{savingPw ? "Đang xử lý…" : "Đổi mật khẩu"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const Info = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || "Chưa cập nhật"}</Text>
  </View>
);

const Field = ({ label, ...props }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      placeholderTextColor="#9ca3af"
      autoCapitalize="none"
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 10,
  },
  avatarText: { color: "#4338ca", fontWeight: "800", fontSize: 28 },
  name: { fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "center" },
  roleTag: {
    alignSelf: "center",
    backgroundColor: "#eef2ff",
    color: "#4338ca",
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 4,
    marginBottom: 12,
    overflow: "hidden",
  },
  infoRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  infoLabel: { color: "#6b7280", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  infoValue: { color: "#111827", marginTop: 2 },
  section: { fontWeight: "800", color: "#111827", fontSize: 16, marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: "#374151", marginBottom: 4, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
  },
  btn: {
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  btnDark: { backgroundColor: "#111827" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700" },
});
