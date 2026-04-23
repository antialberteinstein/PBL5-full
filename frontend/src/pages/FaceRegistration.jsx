import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { studentAPI } from "../services/api";

const FaceRegistration = () => {
  const navigate = useNavigate();
  const currentUsername = localStorage.getItem("username") || "";

  // Các State quản lý giao diện
  const [status, setStatus] = useState("IDLE"); // IDLE, CONNECTING, REGISTERING, COMPLETE, ERROR
  const [errorMsg, setErrorMsg] = useState("");
  const [instruction, setInstruction] = useState("Chuẩn bị camera...");
  const [progress, setProgress] = useState(0);

  // Tham chiếu (Refs) tới các thẻ HTML
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const captureIntervalRef = useRef(null);

  // Từ điển dịch góc mặt từ AI (Tiếng Anh) sang Tiếng Việt cho sinh viên hiểu
  const poseDictionary = {
    FRONT: "Hãy nhìn THẲNG vào camera",
    LEFT: "Quay mặt chậm sang TRÁI",
    RIGHT: "Quay mặt chậm sang PHẢI",
    UP: "Ngẩng mặt chậm lên TRÊN",
    DOWN: "Cúi mặt chậm xuống DƯỚI",
  };

  // 1. Bật Camera ngay khi vào trang
  useEffect(() => {
    if (!currentUsername) {
      alert("Không tìm thấy thông tin đăng nhập!");
      navigate("/login");
      return;
    }

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setInstruction("Hãy đảm bảo khuôn mặt nằm trong khung hình và đủ sáng.");
      } catch (error) {
        setStatus("ERROR");
        setErrorMsg("Không thể truy cập camera. Vui lòng cấp quyền camera trên trình duyệt.");
      }
    };

    startCamera();

    // Dọn dẹp khi rời trang
    return () => {
      stopCameraAndSocket();
    };
  }, [currentUsername, navigate]);

  // Hàm dọn dẹp tắt camera và socket
  const stopCameraAndSocket = () => {
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    if (wsRef.current) wsRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // 2. Hàm bắt đầu Đăng ký (Kết nối WebSocket)
  const handleStartRegistration = () => {
    setStatus("CONNECTING");
    setErrorMsg("");

    const faceBase = import.meta.env.VITE_FACE_API_BASE || "http://127.0.0.1:8000";
    const wsUrl = `${faceBase.replace(/^http/, "ws").replace(/\/$/, "")}/ws/register_stream?class_id=${currentUsername}`;
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setStatus("REGISTERING");
      // Bắt đầu vòng lặp chụp ảnh 4 lần/giây gửi cho Python
      captureIntervalRef.current = setInterval(captureAndSendFrame, 250);
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Xử lý thông báo từ AI
        if (data.status === "ALREADY_REGISTERED") {
          setStatus("ERROR");
          setErrorMsg("Khuôn mặt này hoặc tài khoản này đã được đăng ký trước đó!");
          stopCameraAndSocket();
          return;
        }

        if (data.status === "COMPLETE") {
          setStatus("COMPLETE");
          setInstruction("Tuyệt vời! Đã thu thập đủ dữ liệu.");
          setProgress(100);
          stopCameraAndSocket();
          
          // Báo cho Spring Boot (Backend) là sinh viên này đã có mặt
          await studentAPI.markFaceRegistered(true);
          
          // Đợi 2 giây rồi đá về Dashboard
          setTimeout(() => {
            navigate("/dashboard");
          }, 2000);
          return;
        }

        // Cập nhật phần trăm tiến độ
        if (data.total_required && data.total_collected !== undefined) {
          const percent = Math.round((data.total_collected / data.total_required) * 100);
          setProgress(percent);
        }

        // Hiện hướng dẫn góc mặt
        if (data.req_pose) {
          const instructionText = poseDictionary[data.req_pose] || `Vui lòng tạo dáng: ${data.req_pose}`;
          
          if (data.status === "NO_FACE") {
            setInstruction("Không tìm thấy khuôn mặt. Hãy đưa mặt vào giữa khung hình.");
          } else if (data.status === "WRONG_POSE") {
            setInstruction(`Sai góc mặt rồi! ${instructionText}`);
          } else {
            setInstruction(instructionText);
          }
        }

      } catch (err) {
        console.error("Lỗi khi đọc tin nhắn từ AI:", err);
      }
    };

    socket.onerror = () => {
      setStatus("ERROR");
      setErrorMsg("Mất kết nối với máy chủ AI. Vui lòng thử lại.");
      stopCameraAndSocket();
    };

    socket.onclose = () => {
      if (status !== "COMPLETE") {
        clearInterval(captureIntervalRef.current);
      }
    };
  };

  // 3. Hàm chụp khung hình và gửi dạng Binary (Bytes) qua WebSocket
  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Lấy kích thước thật của video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Vẽ khung hình từ video lên canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Chuyển Canvas thành Blob (JPG) và gửi thẳng đi
    canvas.toBlob((blob) => {
      if (blob) {
        wsRef.current.send(blob);
      }
    }, "image/jpeg", 0.8); // Chất lượng 80% để truyền nhanh mà không bị lag
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col items-center relative overflow-hidden">
        
        {/* Nút quay lại (ẩn khi đang chụp) */}
        {status !== "REGISTERING" && status !== "CONNECTING" && (
          <button onClick={() => navigate("/login")} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
        )}

        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Đăng ký khuôn mặt</h2>
        <p className="text-sm text-gray-500 text-center mb-6 px-4">
          Hệ thống cần thu thập dữ liệu khuôn mặt để phục vụ việc điểm danh tự động.
        </p>

        {/* Khung Camera */}
        <div className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-indigo-100 shadow-inner bg-gray-200 mb-6 flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`object-cover w-full h-full transform -scale-x-100 ${status === "REGISTERING" ? "opacity-100" : "opacity-70"}`}
          ></video>
          
          {/* Vòng viền quét mờ mờ cho ngầu */}
          {status === "REGISTERING" && (
            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full animate-pulse pointer-events-none"></div>
          )}

          {/* Màn hình chờ nếu lỗi */}
          {status === "ERROR" && (
            <div className="absolute inset-0 bg-red-100 bg-opacity-80 flex items-center justify-center text-red-600 font-bold p-4 text-center">
              Lỗi Camera
            </div>
          )}
          
          {/* Màn hình khi xong */}
          {status === "COMPLETE" && (
            <div className="absolute inset-0 bg-green-500 bg-opacity-90 flex flex-col items-center justify-center text-white p-4">
              <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span className="font-bold text-lg">Thành công!</span>
            </div>
          )}
        </div>

        {/* Thẻ Canvas ẩn dùng để cắt frame gửi đi */}
        <canvas ref={canvasRef} className="hidden"></canvas>

        {/* Bảng Trạng Thái & Hướng dẫn */}
        <div className={`w-full py-3 px-4 rounded-lg text-center font-semibold text-sm mb-6 transition-colors duration-300 ${
          status === "ERROR" ? "bg-red-50 text-red-600 border border-red-200" :
          status === "COMPLETE" ? "bg-green-50 text-green-700 border border-green-200" :
          status === "REGISTERING" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
          "bg-gray-50 text-gray-600 border border-gray-200"
        }`}>
          {errorMsg || instruction}
        </div>

        {/* Thanh Tiến Độ */}
        {(status === "REGISTERING" || status === "COMPLETE") && (
          <div className="w-full mb-6">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
              <span>Tiến độ thu thập</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Nút Điều Khiển */}
        {status === "IDLE" && (
          <button
            onClick={handleStartRegistration}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 shadow-md transition-transform transform hover:scale-[1.02]"
          >
            Bắt đầu thu thập dữ liệu
          </button>
        )}

        {status === "CONNECTING" && (
          <button disabled className="w-full bg-indigo-400 text-white font-bold py-3 rounded-lg flex justify-center items-center">
            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Đang kết nối AI...
          </button>
        )}
      </div>
    </div>
  );
};

export default FaceRegistration;