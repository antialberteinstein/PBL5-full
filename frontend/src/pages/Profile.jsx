import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { userAPI } from "../services/api";

const ROLE_LABEL = { STUDENT: "Sinh viên", TEACHER: "Giảng viên", ADMIN: "Quản trị viên" };

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form sửa hồ sơ
  const [form, setForm] = useState({ fullName: "", birth: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Form đổi mật khẩu
  const [pwForm, setPwForm] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const loadProfile = async () => {
    try {
      const res = await userAPI.getProfile();
      setProfile(res.data);
      setForm({
        fullName: res.data?.fullName || "",
        birth: res.data?.birth || "",
        phone: res.data?.phone || "",
      });
    } catch (err) {
      setError("Không thể tải thông tin cá nhân. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const payload = { fullName: form.fullName, birth: form.birth || null };
      if (profile?.role === "TEACHER") payload.phone = form.phone;
      const res = await userAPI.updateMyProfile(payload);
      setProfile(res.data);
      alert("Cập nhật hồ sơ thành công!");
    } catch (err) {
      alert("Lỗi: " + (err.response?.data || "Không thể cập nhật hồ sơ"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      return alert("Mật khẩu xác nhận không khớp!");
    }
    try {
      setSavingPw(true);
      const res = await userAPI.changePassword({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      });
      alert("✅ " + (res.data || "Đổi mật khẩu thành công!"));
      setPwForm({ oldPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      alert("❌ Lỗi: " + (err.response?.data || "Không thể đổi mật khẩu"));
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-indigo-600 font-medium">
        Đang tải thông tin...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50 text-red-500 font-medium">
        {error}
      </div>
    );
  }

  const role = profile?.role;
  const idLabel = role === "STUDENT" ? "MSSV" : role === "TEACHER" ? "MSGV" : "Mã định danh";
  const idValue = profile?.mssv || profile?.msgv || profile?.username;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 font-semibold hover:underline">
          ← Quay lại
        </button>

        {/* Thẻ thông tin */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-indigo-600 to-purple-600"></div>
          <div className="px-8 pb-8">
            <div className="relative flex justify-between items-end -mt-10 mb-6">
              <div className="w-20 h-20 bg-white rounded-full p-1 shadow-md">
                <div className="w-full h-full bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-3xl font-bold uppercase">
                  {profile?.fullName ? profile.fullName.charAt(0) : "U"}
                </div>
              </div>
              <span className="px-4 py-1 text-xs font-bold rounded-full border uppercase tracking-wider bg-indigo-50 text-indigo-700 border-indigo-200">
                {ROLE_LABEL[role] || role}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-1">{profile?.fullName || "Chưa cập nhật tên"}</h1>
            <p className="text-sm text-gray-500 mb-6">
              Tên đăng nhập: <span className="font-semibold text-gray-700">{profile?.username}</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-6">
              <Info label={idLabel} value={idValue} />
              {role === "STUDENT" && <Info label="Lớp sinh hoạt" value={profile?.lopSinhHoat} />}
              {role === "TEACHER" && <Info label="Số điện thoại" value={profile?.phone} />}
              {role === "STUDENT" && (
                <Info
                  label="Trạng thái khuôn mặt"
                  value={profile?.faceRegistered ? "Đã đăng ký" : "Chưa đăng ký"}
                />
              )}
            </div>
          </div>
        </div>

        {/* Form sửa hồ sơ (chỉ cho student/teacher) */}
        {(role === "STUDENT" || role === "TEACHER") && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Chỉnh sửa hồ sơ</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <FormRow label="Họ và tên">
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </FormRow>
              <FormRow label="Ngày sinh">
                <input
                  type="date"
                  value={form.birth || ""}
                  onChange={(e) => setForm({ ...form, birth: e.target.value })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </FormRow>
              {role === "TEACHER" && (
                <FormRow label="Số điện thoại">
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </FormRow>
              )}
              <button type="submit" disabled={savingProfile} className="bg-indigo-600 text-white text-sm font-bold px-5 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </form>
          </div>
        )}

        {/* Form đổi mật khẩu */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Đổi mật khẩu</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <FormRow label="Mật khẩu hiện tại">
              <input
                type="password"
                required
                value={pwForm.oldPassword}
                onChange={(e) => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </FormRow>
            <FormRow label="Mật khẩu mới">
              <input
                type="password"
                required
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </FormRow>
            <FormRow label="Xác nhận mật khẩu mới">
              <input
                type="password"
                required
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </FormRow>
            <button type="submit" disabled={savingPw} className="bg-gray-800 text-white text-sm font-bold px-5 py-2 rounded-md hover:bg-gray-900 disabled:opacity-50">
              {savingPw ? "Đang xử lý..." : "Đổi mật khẩu"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</h3>
    <p className="text-sm font-medium text-gray-800 bg-gray-50 inline-block px-4 py-1.5 rounded-lg border border-gray-100">
      {value || "Chưa cập nhật"}
    </p>
  </div>
);

const FormRow = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

export default Profile;
