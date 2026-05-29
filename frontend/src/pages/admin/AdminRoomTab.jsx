import React, { useState, useEffect } from "react";
import { roomAPI, scheduleAPI, classAPI, cameraAPI } from "../../services/api";

const AdminRoomTab = () => {
  const [rooms, setRooms] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [schedules, setSchedules] = useState([]);
  
  // Modals
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCamera, setNewRoomCamera] = useState("");
  
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { day, period }
  const [selectedClassToAssign, setSelectedClassToAssign] = useState("");

  useEffect(() => {
    fetchRooms();
    fetchCameras();
    fetchClasses();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await roomAPI.getAllRooms();
      setRooms(res.data);
    } catch (e) {
      console.error(e);
    }
  };
  
  const fetchCameras = async () => {
    try {
      const res = await cameraAPI.getCameras();
      setCameras(res.data);
    } catch (e) {
      console.error(e);
    }
  };
  
  const fetchClasses = async () => {
    try {
      const res = await classAPI.getAllClasses();
      setClasses(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSchedules = async (roomId) => {
    try {
      const res = await scheduleAPI.getRoomSchedule(roomId);
      setSchedules(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    fetchSchedules(room.id);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    try {
      await roomAPI.createRoom({
        name: newRoomName,
        cameraId: newRoomCamera || null
      });
      setShowRoomModal(false);
      setNewRoomName("");
      setNewRoomCamera("");
      fetchRooms();
    } catch (err) {
      alert("Lỗi tạo phòng: " + (err.response?.data || err.message));
    }
  };

  const handleSlotClick = (day, period) => {
    // Check if slot is already occupied
    const existing = schedules.find(s => s.dayOfWeek === day && s.startPeriod <= period && s.endPeriod >= period);
    if (existing) {
      if (window.confirm("Xóa lịch học lớp này?")) {
        scheduleAPI.deleteSchedule(existing.id).then(() => fetchSchedules(selectedRoom.id));
      }
      return;
    }
    
    setSelectedSlot({ day, period });
    setShowScheduleModal(true);
  };

  const handleAssignSchedule = async (e) => {
    e.preventDefault();
    if (!selectedClassToAssign) return;
    try {
      await scheduleAPI.assignSchedule({
        classId: selectedClassToAssign,
        roomId: selectedRoom.id,
        dayOfWeek: selectedSlot.day,
        startPeriod: selectedSlot.period,
        endPeriod: selectedSlot.period // assume 1 period for simplicity, or we can add length
      });
      setShowScheduleModal(false);
      setSelectedClassToAssign("");
      fetchSchedules(selectedRoom.id);
    } catch (err) {
      alert("Lỗi xếp lịch: " + (err.response?.data || err.message));
    }
  };

  const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <h3 className="font-bold text-gray-800 text-lg">Quản lý Phòng Học & Thời Khóa Biểu</h3>
      </div>

      <div className="flex gap-6">
        {/* Room List */}
        <div className="w-1/4 bg-white p-4 rounded-xl border shadow-sm">
          <h4 className="font-bold text-gray-700 mb-4">Danh sách phòng ({rooms.length})</h4>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {rooms.map(room => (
              <div 
                key={room.id}
                onClick={() => handleSelectRoom(room)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedRoom?.id === room.id ? 'bg-blue-50 border-blue-400' : 'hover:bg-gray-50'}`}
              >
                <div className="font-bold text-gray-800">{room.name}</div>
                <div className="text-xs text-gray-500 mt-1">CCTV: {room.camera ? 'Đã kết nối AI Server' : 'Không có'}</div>
              </div>
            ))}
            {rooms.length === 0 && <p className="text-sm text-gray-400">Chưa có phòng nào.</p>}
          </div>
        </div>

        {/* Timetable */}
        <div className="w-3/4 bg-white p-4 rounded-xl border shadow-sm overflow-x-auto">
          {selectedRoom ? (
            <>
              <h4 className="font-bold text-gray-700 mb-4 text-xl">Thời khóa biểu - {selectedRoom.name}</h4>
              <table className="min-w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 w-16">Tiết</th>
                    {days.map((d, i) => (
                      <th key={i} className="border p-2">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5,6,7,8,9,10].map(period => (
                    <tr key={period}>
                      <td className="border p-2 text-center font-bold text-gray-600 bg-gray-50">{period}</td>
                      {[2,3,4,5,6,7,8].map(day => {
                        const sched = schedules.find(s => s.dayOfWeek === day && s.startPeriod <= period && s.endPeriod >= period);
                        return (
                          <td 
                            key={`${day}-${period}`} 
                            onClick={() => handleSlotClick(day, period)}
                            className={`border p-2 h-16 cursor-pointer text-center text-sm font-medium transition-colors ${sched ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' : 'hover:bg-blue-50'}`}
                          >
                            {sched ? (
                              <div className="flex flex-col items-center justify-center">
                                <span>{sched.clazz.name}</span>
                                <span className="text-xs opacity-70">GV: {sched.clazz.teacherId}</span>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[300px] text-gray-400">
              Vui lòng chọn một phòng bên trái để xem thời khóa biểu
            </div>
          )}
        </div>
      </div>


      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[28rem] p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Xếp lịch - Thứ {selectedSlot?.day} Tiết {selectedSlot?.period}</h2>
            <form onSubmit={handleAssignSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Chọn lớp học</label>
                <select required value={selectedClassToAssign} onChange={e => setSelectedClassToAssign(e.target.value)} className="w-full px-3 py-2 border rounded-md">
                  <option value="">-- Chọn lớp --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 bg-gray-200 rounded font-bold hover:bg-gray-300">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Lưu lịch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRoomTab;
