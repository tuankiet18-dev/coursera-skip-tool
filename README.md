# Coursera Skip Video / Coursera Tool (Security Analysis Repository)

⚠️ **CẢNH BÁO BẢO MẬT NGHIÊM TRỌNG:** Đây là mã nguồn của một tiện ích mở rộng (Chrome Extension) **độc hại**. Dựa trên phân tích kỹ thuật, tiện ích này chứa mã đánh cắp phiên đăng nhập (Session Hijacking) và có cơ chế điều khiển từ xa (Remote Control). 
**TUYỆT ĐỐI KHÔNG CÀI ĐẶT** extension này trên trình duyệt có chứa tài khoản thật hoặc thông tin nhạy cảm. Nếu bạn đã lỡ cài đặt, hãy ngay lập tức đăng xuất tài khoản Coursera (để hủy cookie), đổi mật khẩu và thu hồi các API Key (như Gemini) đã nhập vào!

---

## Giới thiệu dự án

Tiện ích mở rộng này được phân phối dưới tên gọi **"Coursera Skip Video"** hoặc **"Coursera Tool"**. Theo quảng cáo, chức năng chính của nó là hỗ trợ học viên tự động hóa các tác vụ trên nền tảng Coursera. Tuy nhiên, đằng sau các tính năng đó là một hệ thống đánh cắp thông tin người dùng cực kỳ tinh vi.

Repository này chứa mã nguồn gốc (đã được trích xuất), các công cụ giải mã (decoder) và báo cáo phân tích bảo mật (`BUILD_FORENSIC_REPORT.md`) nhằm mục đích nghiên cứu, học tập và cảnh báo an toàn thông tin.

## 🚀 Các tính năng quảng cáo (Bề nổi)
- **Tự động hoàn thành khóa học (Bypass/Skip):** Tự động bỏ qua và đánh dấu hoàn thành các bài đọc và video.
- **Tự động làm bài tập & trắc nghiệm (Auto Quiz):** Can thiệp vào giao diện để tự động giải các bài kiểm tra.
- **Tích hợp AI (Gemini):** Đọc nội dung câu hỏi và dùng Google Gemini (yêu cầu người dùng tự nhập API Key) để sinh câu trả lời tự động.
- **Chấm điểm chéo (Auto Peer Review):** Tự động gửi yêu cầu và hoàn thành quá trình chấm điểm chéo cho học viên khác.
- **Tự động thảo luận:** Đăng bài tự động lên các diễn đàn trong khóa học.

## 🕵️‍♂️ Phân tích mã độc (Phần chìm - Forensic Analysis)
Mã nguồn của extension đã được làm rối (obfuscated) với rất nhiều lớp để che giấu các hành vi mờ ám. Theo phân tích tĩnh từ báo cáo bảo mật, các hành vi nguy hiểm bao gồm:

1. **Đánh cắp Cookie & Cướp phiên đăng nhập (Session Hijacking):** 
   - Background script của tiện ích tự động thu thập cookie `CAUTH` (cookie phiên đăng nhập quan trọng nhất của Coursera) và `CSRF3-Token`. Kẻ gian có được `CAUTH` sẽ có thể giả mạo bạn để đăng nhập và kiểm soát hoàn toàn tài khoản.
2. **Thu thập thông tin định danh người dùng:** 
   - Tiện ích trích xuất email, `userId`, và khóa mã hóa từ mã nguồn của Coursera, sau đó lưu trữ lại.
3. **Mạng lưới Botnet & Điều khiển từ xa (C2):** 
   - Extension liên tục tải cấu hình từ xa thông qua `https://pear104.github.io/coursera-tool/metadata.json`.
   - Nó tự động POST các thông tin nhạy cảm đã thu thập (Cookie `CAUTH`, email, profile consent) tới máy chủ của kẻ tấn công (thông qua `/check`).
   - Nếu máy chủ yêu cầu, extension có khả năng mở ngầm hàng loạt các URL bất kỳ trong trình duyệt mà bạn không hề hay biết.
4. **Lộ lọt API Key Gemini:**
   - Việc bắt người dùng nhập API Key Gemini để dùng tính năng AI tạo ra rủi ro rất lớn. Key này hoàn toàn có thể bị exfiltrate (tuồn ra ngoài) cùng với đống cookie bên trên.

## 📂 Cấu trúc Repository
- `manifest.json`: Tệp cấu hình gốc của Extension. Nó yêu cầu một lượng quyền (permissions) khổng lồ như `<all_urls>`, `cookies`, `tabs` - quá rộng so với một tool chỉ chạy trên `coursera.org`.
- `background.js` / `service-worker-loader.js`: Script chạy ngầm, nơi chứa logic thu thập cookie và giao tiếp với server điều khiển từ xa.
- `content.js` / `script.js`: Payload được chèn vào trang Coursera để can thiệp giao diện (DOM) và đánh cắp dữ liệu biến `window`.
- `BUILD_FORENSIC_REPORT.md`: Báo cáo giám định bảo mật chuyên sâu về các kịch bản đánh cắp dữ liệu của tool này.
- `build/`: Thư mục chứa mã nguồn đã build (bao gồm các đoạn mã bị obfuscate mạnh).
- `*decode*.js` (ví dụ: `real_decode.js`, `decoder.js`): Các tập lệnh do nhà nghiên cứu viết ra để dịch ngược, gỡ rối (deobfuscate) các chuỗi ký tự bị mã hóa nhằm lật tẩy hành vi của extension.

---
**Tuyên bố miễn trừ trách nhiệm:** Dự án này chỉ dành cho mục đích nghiên cứu bảo mật (Security Research) và cảnh báo cộng đồng. Việc sử dụng mã nguồn này vào các mục đích phá hoại hoặc chuộc lợi là vi phạm pháp luật.
