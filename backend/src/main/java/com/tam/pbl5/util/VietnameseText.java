package com.tam.pbl5.util;

import java.text.Normalizer;

/**
 * Tiện ích xử lý chuỗi tiếng Việt.
 */
public final class VietnameseText {

    private VietnameseText() {
    }

    /**
     * Chuyển họ tên có dấu thành chuỗi không dấu, viết liền, viết thường.
     * Ví dụ: "Đặng Thiên Bình" -> "dangthienbinh".
     */
    public static String toAsciiSlug(String input) {
        if (input == null) {
            return "";
        }
        // Xử lý riêng chữ Đ/đ vì Normalizer không tách được
        String s = input.replace('đ', 'd').replace('Đ', 'D');
        // Tách dấu kết hợp rồi loại bỏ
        s = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        // Chỉ giữ chữ và số, bỏ khoảng trắng và ký tự khác, đưa về chữ thường
        s = s.replaceAll("[^a-zA-Z0-9]", "");
        return s.toLowerCase();
    }
}
