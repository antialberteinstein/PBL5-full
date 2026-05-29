import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { loadConfig } from "./src/config";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadConfig();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Không thể đọc config.yaml");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Lỗi cấu hình</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loading}>Đang tải cấu hình…</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f9fafb",
  },
  loading: { marginTop: 12, color: "#4f46e5", fontWeight: "600" },
  error: { fontSize: 18, fontWeight: "700", color: "#dc2626", marginBottom: 8 },
  errorBody: { color: "#374151", textAlign: "center" },
});
