import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

const VerifyOtp = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Lấy username từ trang đăng ký truyền sang (nếu có), nếu không thì để trống cho người dùng tự nhập
    const [username, setUsername] = useState(location.state?.username || '');
    const [otpCode, setOtpCode] = useState('');
    const [error, setError] = useState('');

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await api.post('/auth/verify-otp', { username, otpCode });
            alert("Xác thực thành công! Bạn có thể đăng nhập ngay bây giờ.");
            navigate('/login');
        } catch (err) {
            setError(err.response?.data || 'Mã OTP không hợp lệ hoặc đã hết hạn!');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h2 className="text-2xl font-bold mb-2 text-center text-indigo-600">Xác Thực OTP</h2>
                <p className="text-sm text-gray-500 text-center mb-6">Mã xác thực đã được gửi vào email của bạn.</p>
                
                {error && <div className="bg-red-100 text-red-600 p-2 mb-4 rounded text-sm">{error}</div>}

                <form onSubmit={handleVerify}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Tên đăng nhập</label>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Mã OTP (6 số)</label>
                        <input type="text" maxLength="6" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} required
                            className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-xl tracking-widest" 
                            placeholder="------" />
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition">
                        Xác Nhận OTP
                    </button>
                </form>
            </div>
        </div>
    );
};

export default VerifyOtp;