import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

import { backendWsBase, getConfig } from "../config";
import { studentAPI } from "../services/api";
import { getToken, getUsername } from "../utils/auth";
import { base64ToBinary } from "../utils/ws";

const POSE_TEXT = {
  FRONT: "Hãy nhìn THẲNG vào camera",
  LEFT: "Quay mặt chậm sang TRÁI",
  RIGHT: "Quay mặt chậm sang PHẢI",
  UP: "Ngẩng mặt chậm lên TRÊN",
  DOWN: "Cúi mặt chậm xuống DƯỚI",
};

export default function FaceRegistrationScreen({ navigation, route }) {
  const isReregister = Boolean(route.params?.reregister);
  const cameraRef = useRef(null);
  const wsRef = useRef(null);
  const captureLoopRef = useRef(null);
  const isCapturingRef = useRef(false);
  const completedRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const frameCounterRef = useRef(0);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);

  const [status, setStatus] = useState("IDLE"); // IDLE | CONNECTING | REGISTERING | COMPLETE | ERROR
  const [errorMsg, setErrorMsg] = useState("");
  const [instruction, setInstruction] = useState(
    "Hãy đảm bảo khuôn mặt nằm trong khung hình và đủ sáng.",
  );
  const [progressText, setProgressText] = useState("0/15");
  const [progress, setProgress] = useState(0);
  const [currentPose, setCurrentPose] = useState("");

  const faceCfg = getConfig().face || {};
  const CAPTURE_INTERVAL = faceCfg.captureIntervalMs ?? 450;
  const JPEG_QUALITY = faceCfg.jpegQuality ?? 0.6;

  useEffect(() => {
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const stopAll = () => {
    if (captureLoopRef.current) {
      clearTimeout(captureLoopRef.current);
      captureLoopRef.current = null;
    }
    isCapturingRef.current = false;
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  };

  const handleStart = async () => {
    setErrorMsg("");
    setStatus("CONNECTING");

    if (!cameraReadyRef.current) {
      console.warn("[register] camera not ready yet, will wait…");
    }

    const username = await getUsername();
    if (!username) {
      setStatus("ERROR");
      setErrorMsg("Không tìm thấy thông tin đăng nhập.");
      return;
    }

    if (isReregister) {
      try {
        await studentAPI.markFaceRegistered(false);
      } catch (err) {
        console.warn("[register] markFaceRegistered(false) failed", err?.message);
      }
    }

    const token = await getToken();
    const params = new URLSearchParams({ student_id: username });
    if (isReregister) params.append("reregister", "true");
    if (token) params.append("token", token);
    const wsUrl = `${backendWsBase()}/ws/register_stream?${params.toString()}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("[register] WS open:", wsUrl);
      setStatus("REGISTERING");
      isCapturingRef.current = true;
      scheduleNextCapture(0);
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(
          "[register] WS msg status=%s pose=%s collected=%s",
          data.status,
          data.req_pose,
          data.progress_text,
        );

        if (data.status === "BAD_FRAME") {
          setInstruction("Khung hình lỗi — đảm bảo đủ sáng và giữ máy ổn định.");
          return;
        }

        if (data.status === "ALREADY_REGISTERED") {
          completedRef.current = true;
          setStatus("ERROR");
          setErrorMsg("Khuôn mặt này hoặc tài khoản này đã được đăng ký trước đó!");
          stopAll();
          return;
        }

        if (data.status === "COMPLETE") {
          completedRef.current = true;
          setStatus("COMPLETE");
          setInstruction("Tuyệt vời! Đã thu thập đủ dữ liệu.");
          setProgress(100);
          if (data.progress_text) setProgressText(data.progress_text);
          stopAll();
          try {
            await studentAPI.markFaceRegistered(true);
          } catch (err) {
            console.warn("[register] markFaceRegistered(true) failed", err?.message);
          }
          setTimeout(() => {
            navigation.reset({ index: 0, routes: [{ name: "Dashboard" }] });
          }, 1800);
          return;
        }

        if (
          typeof data.total_required === "number" &&
          typeof data.total_collected === "number"
        ) {
          const pct = Math.round((data.total_collected / data.total_required) * 100);
          setProgress(pct);
          setProgressText(`${data.total_collected}/${data.total_required}`);
        }
        if (data.progress_text) setProgressText(data.progress_text);

        if (data.req_pose) {
          const poseText = POSE_TEXT[data.req_pose] || `Tạo dáng: ${data.req_pose}`;
          if (data.status === "NO_FACE") {
            setInstruction("Không tìm thấy khuôn mặt. Hãy đưa mặt vào giữa khung hình.");
          } else if (data.status === "WRONG_POSE") {
            setInstruction(`Sai góc mặt! ${poseText}`);
          } else {
            setInstruction(poseText);
          }
        }
        if (data.det_pose) setCurrentPose(data.det_pose);
      } catch (err) {
        console.warn("[register] bad WS message", err?.message);
      }
    };

    socket.onerror = () => {
      if (completedRef.current) return;
      setStatus("ERROR");
      setErrorMsg("Mất kết nối với máy chủ. Kiểm tra cấu hình LAN trong config.yaml.");
      stopAll();
    };

    socket.onclose = () => {
      isCapturingRef.current = false;
      if (captureLoopRef.current) {
        clearTimeout(captureLoopRef.current);
        captureLoopRef.current = null;
      }
    };
  };

  const scheduleNextCapture = (delay) => {
    captureLoopRef.current = setTimeout(captureAndSend, delay);
  };

  const captureAndSend = async () => {
    if (!isCapturingRef.current) return;
    const socket = wsRef.current;
    const cam = cameraRef.current;
    const n = ++frameCounterRef.current;

    if (!cam) {
      console.warn(`[register] frame#${n} skipped — cameraRef is null`);
      scheduleNextCapture(CAPTURE_INTERVAL);
      return;
    }
    if (!cameraReadyRef.current) {
      console.warn(`[register] frame#${n} skipped — camera not ready`);
      scheduleNextCapture(CAPTURE_INTERVAL);
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn(`[register] frame#${n} skipped — WS not open (state=${socket?.readyState})`);
      scheduleNextCapture(CAPTURE_INTERVAL);
      return;
    }

    try {
      // `skipProcessing` is intentionally OFF — on iOS it has been
      // observed to break the base64 JPEG so cv2 can't decode it.
      const photo = await cam.takePictureAsync({
        quality: JPEG_QUALITY,
        base64: true,
        exif: false,
        shutterSound: false,
      });
      if (!photo?.base64) {
        console.warn(`[register] frame#${n} takePictureAsync returned no base64`, photo);
        return;
      }
      if (socket.readyState !== WebSocket.OPEN || !isCapturingRef.current) {
        return;
      }
      const bytes = base64ToBinary(photo.base64);
      socket.send(bytes);
      console.log(`[register] frame#${n} sent ${bytes.byteLength} bytes`);
    } catch (err) {
      console.warn(`[register] frame#${n} capture error:`, err?.message || err);
    } finally {
      if (isCapturingRef.current) scheduleNextCapture(CAPTURE_INTERVAL);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#4f46e5" size="large" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Cần quyền truy cập camera</Text>
        <Text style={styles.body}>
          Ứng dụng cần camera trước để thu thập ảnh khuôn mặt cho việc điểm danh.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Cấp quyền camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mute
          onCameraReady={() => {
            console.log("[register] camera ready");
            cameraReadyRef.current = true;
            setCameraReady(true);
          }}
          onMountError={(e) => {
            console.warn("[register] camera mount error:", e?.message);
            setStatus("ERROR");
            setErrorMsg("Không thể khởi tạo camera: " + (e?.message || "unknown"));
          }}
        />
        {status === "REGISTERING" && <View style={styles.scanRing} pointerEvents="none" />}
        {status === "COMPLETE" && (
          <View style={styles.completeOverlay}>
            <Text style={styles.completeMark}>✓</Text>
            <Text style={styles.completeText}>Thành công!</Text>
          </View>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.heading}>
          {isReregister ? "Đăng ký lại khuôn mặt" : "Đăng ký khuôn mặt"}
        </Text>
        <Text
          style={[
            styles.instruction,
            status === "ERROR" && styles.instructionError,
            status === "COMPLETE" && styles.instructionOk,
          ]}
        >
          {errorMsg || instruction}
        </Text>

        {(status === "REGISTERING" || status === "COMPLETE") && (
          <View style={{ marginTop: 12 }}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Tiến độ</Text>
              <Text style={styles.progressLabel}>
                {progressText} ({progress}%)
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            {currentPose ? (
              <Text style={styles.posePill}>Pose hiện tại: {currentPose}</Text>
            ) : null}
          </View>
        )}

        {status === "IDLE" && (
          <TouchableOpacity
            style={[styles.primaryBtn, !cameraReady && styles.primaryBtnDisabled]}
            onPress={handleStart}
            disabled={!cameraReady}
          >
            <Text style={styles.primaryBtnText}>
              {!cameraReady
                ? "Đang khởi tạo camera…"
                : isReregister
                  ? "Bắt đầu đăng ký lại"
                  : "Bắt đầu thu thập dữ liệu"}
            </Text>
          </TouchableOpacity>
        )}

        {status === "CONNECTING" && (
          <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}

        {status === "ERROR" && (
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { flex: 1, marginRight: 8 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.secondaryBtnText}>Quay lại</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]}
              onPress={() => {
                completedRef.current = false;
                setStatus("IDLE");
                setErrorMsg("");
                setProgress(0);
                setProgressText("0/15");
              }}
            >
              <Text style={styles.primaryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  cameraWrap: {
    flex: 1,
    margin: 16,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  scanRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: "#6366f1",
    borderRadius: 24,
    opacity: 0.7,
  },
  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 185, 129, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  completeMark: { color: "#fff", fontSize: 64, fontWeight: "800" },
  completeText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 8 },
  infoCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  heading: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8 },
  instruction: {
    backgroundColor: "#eef2ff",
    color: "#3730a3",
    padding: 12,
    borderRadius: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  instructionError: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  instructionOk: { backgroundColor: "#dcfce7", color: "#15803d" },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: { fontSize: 11, color: "#6b7280", fontWeight: "700" },
  progressTrack: {
    backgroundColor: "#e5e7eb",
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { backgroundColor: "#4f46e5", height: "100%" },
  posePill: {
    marginTop: 8,
    alignSelf: "center",
    backgroundColor: "#eef2ff",
    color: "#4338ca",
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 12,
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: "#4f46e5",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnDisabled: { backgroundColor: "#a5b4fc" },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: {
    marginTop: 14,
    backgroundColor: "#f3f4f6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "700" },
  row: { flexDirection: "row" },
  title: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8 },
  body: { color: "#374151", textAlign: "center", marginBottom: 16 },
});
