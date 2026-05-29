import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authAPI, studentAPI } from "../services/api";
import { clearSession, normalizeRole, saveSession } from "../utils/auth";
import { backendHttpBase, getConfig } from "../config";

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cfg = getConfig();
  const allowed = (cfg.app?.allowedRoles || ["STUDENT", "TEACHER"]).map((r) =>
    normalizeRole(r),
  );

  const handleLogin = async () => {
    setError("");
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      setError("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }
    setLoading(true);
    try {
      await clearSession();
      const res = await authAPI.login({ username: u, password: p });
      const token = res.data?.token || res.data?.accessToken;
      const rawRole = res.data?.role || res.data?.authority || "STUDENT";
      const role = normalizeRole(rawRole);

      if (!allowed.includes(role)) {
        setError(
          "Tài khoản này không được phép đăng nhập trên ứng dụng di động. " +
            "Vui lòng dùng giao diện web.",
        );
        return;
      }

      await saveSession({ token, role, username: u });

      if (role === "STUDENT") {
        try {
          const profile = await studentAPI.getCurrentStudent();
          const registered = profile.data?.faceRegistered;
          navigation.reset({
            index: 0,
            routes: [{ name: registered ? "Dashboard" : "FaceRegistration" }],
          });
        } catch {
          navigation.reset({ index: 0, routes: [{ name: "FaceRegistration" }] });
        }
      } else {
        navigation.reset({ index: 0, routes: [{ name: "Dashboard" }] });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.response?.data === "string" ? err.response.data : null) ||
        "Sai tên đăng nhập hoặc mật khẩu";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Đăng nhập</Text>
          <Text style={styles.subtitle}>Hệ thống điểm danh khuôn mặt</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Tên đăng nhập</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            style={styles.input}
            placeholder="Nhập MSSV / MSGV"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.serverHint}>Máy chủ: {backendHttpBase()}</Text>
          <Text style={styles.helpText}>
            Tài khoản do quản trị viên cấp. Tài khoản Admin không đăng nhập
            được trên di động — vui lòng dùng giao diện web.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef2ff" },
  flex: { flex: 1, justifyContent: "center", padding: 16 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#4f46e5", textAlign: "center" },
  subtitle: { textAlign: "center", color: "#6b7280", marginTop: 4, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    fontSize: 15,
  },
  button: {
    marginTop: 24,
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorBox: { backgroundColor: "#fee2e2", padding: 10, borderRadius: 8, marginTop: 8 },
  errorText: { color: "#b91c1c", fontSize: 13 },
  serverHint: { marginTop: 14, fontSize: 12, color: "#6b7280", textAlign: "center" },
  helpText: { marginTop: 6, fontSize: 11, color: "#9ca3af", textAlign: "center" },
});
