# Coursera Skip Video (Clean Version)

## 🌟 Giới thiệu

Đây là bản **viết lại hoàn toàn an toàn (Clean Rebuild)** của tiện ích mở rộng "Coursera Skip Video" (hay Coursera Tool). 

Phiên bản gốc của extension này bị phát hiện chứa các đoạn mã độc hại cực kỳ nguy hiểm (chuyên đánh cắp tài khoản và điều khiển từ xa). Do đó, tôi đã **tự viết lại toàn bộ mã nguồn** ở thư mục gốc (root) nhằm mang đến các tính năng tự động hóa trên Coursera một cách **an toàn 100%**. Mã nguồn mới loại bỏ hoàn toàn các đoạn mã ẩn, không thu thập cookie, và không lén lút gửi dữ liệu của bạn đi bất cứ đâu.

## 🚀 Các tính năng chính (Bản Sạch)

- **Tự động hoàn thành (Bypass/Skip):** Tự động bỏ qua và đánh dấu hoàn thành các bài đọc và video trên Coursera.
- **Tự động làm bài tập & trắc nghiệm (Auto Quiz):** Hỗ trợ tự động giải các bài kiểm tra.
- **An toàn & Minh bạch:** Mã nguồn mở, trực quan, hoàn toàn không có mã độc hay các hành vi đánh cắp dữ liệu.

## 📂 Cấu trúc Repository

Dự án này được phân chia thành hai phần rõ rệt:

### 1. Phần an toàn (Mã nguồn có thể sử dụng)
Toàn bộ các file nằm ở **thư mục gốc** (như `manifest.json`, `background.js`, `content.js`, `popup.html`, v.v...) là **mã nguồn sạch do tôi tự viết lại**. Bạn hoàn toàn có thể yên tâm sử dụng thư mục này để load vào trình duyệt.

### 2. Phần phân tích bảo mật & Mã độc của Hacker (Chỉ để tham khảo)
- ⚠️ **Thư mục `build/`**: Chứa mã nguồn gốc của hacker (đã bị làm rối - obfuscated). Mã này chứa mã độc và được giữ lại **chỉ với mục đích nghiên cứu bảo mật và làm bằng chứng**. **TUYỆT ĐỐI KHÔNG** load thư mục này vào trình duyệt!
- `BUILD_FORENSIC_REPORT.md`: Báo cáo giám định chi tiết về các hành vi đánh cắp dữ liệu trong phiên bản gốc.
- Các file `*decode*.js` (`real_decode.js`, `decoder.js`, `correct_decode.js`...): Các đoạn script do tôi tạo ra nhằm dịch ngược, gỡ rối (deobfuscate) mã độc của hacker để viết báo cáo.

## 🕵️‍♂️ Về phiên bản gốc (Malicious Version)

Như được mô tả kỹ trong báo cáo `BUILD_FORENSIC_REPORT.md`, tiện ích gốc có chứa mã độc rất tinh vi:
- **Đánh cắp Session Cookie:** Tự động thu thập `CAUTH` và `CSRF3-Token`. Kẻ gian có thể dùng nó để chiếm quyền tài khoản Coursera của bạn.
- **Đánh cắp thông tin cá nhân:** Lấy cắp email và `userId`.
- **Mạng lưới điều khiển (C2):** Liên tục nhận lệnh từ xa thông qua `metadata.json` của hacker.
- **Lộ API Key:** Lén lút gửi API Key (Gemini) của người dùng về server của kẻ tấn công.

> 💡 **Khuyến cáo:** Nếu bạn đã từng dùng bản gốc của hacker từ các nguồn trôi nổi, hãy **đăng xuất tài khoản Coursera** ngay lập tức (để vô hiệu hóa cookie cũ), đổi mật khẩu và thu hồi (revoke) các API Key đã từng cung cấp.

---

## 🛠 Hướng dẫn cài đặt (Bản Sạch)

1. Tải toàn bộ repository này về máy.
2. Mở trình duyệt Chrome / Edge, truy cập vào trang Quản lý tiện ích mở rộng: `chrome://extensions/`.
3. Bật **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Nhấn vào nút **Tải tiện ích đã giải nén (Load unpacked)**.
5. Chọn **thư mục gốc** của repository này (tuyệt đối không chọn thư mục `build`).
6. Hoàn tất! Tiện ích đã sẵn sàng để sử dụng an toàn trên Coursera.
