# KTV Lung Linh 2D

Game karaoke 2D chơi online nhiều người. Mỗi người vào vai một cô tiếp viên: phục vụ khách để kiếm tip, trang điểm cho đúng gu khách, và chạy trốn khi vợ khách xông vào đánh ghen.

## Chơi thử trên máy
```
npm install
npm start
```
Mở http://localhost:3000

## Đưa lên mạng (GitHub + Render)
1. Tạo repo mới trên GitHub, ví dụ `karaoke-2d`. Upload toàn bộ thư mục này lên, **trừ** `node_modules` và `data`.
2. Trên Render: New → Web Service → chọn repo vừa tạo.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free · Region: Singapore
3. **Lưu tip lâu dài:** vào Environment, thêm biến `MONGODB_URI` (dùng chuỗi kết nối MongoDB đang có, có thể dùng chung với game 3D vì game này lưu sang một database riêng tên `karaoke2d`). Nếu không thêm biến này, tip chỉ được lưu tạm và sẽ mất khi Render khởi động lại.

## Gắn ảnh nhân vật thật (tạo bằng AI)
1. Bỏ ảnh PNG nền trong suốt vào `public/chars/`, đặt tên theo dạng `linh_1.png`, `linh_2.png`, `linh_3.png`, `vy_1.png`...
   - Số **1** = Lộng lẫy, **2** = Gợi cảm, **3** = Kín đáo, **4** = Đồ biển
   - Tên nhân vật: `linh`, `vy`, `ngoc`, `mai`
2. Game tự nhận ảnh. Ô nào chưa có ảnh thì vẫn dùng hình tạm.
3. Canh vị trí makeup: mở `/calib.html`, chọn ảnh, rồi bấm lần lượt vào mắt trái, mắt phải, môi, má trái, má phải. Copy đoạn chữ hiện ra, dán vào `public/faces.json`.

## Ảnh khách và bà vợ
Để trong `public/cust/`, đặt tên `<khách>_<biểu cảm>.webp`:
- Khách: `daigia`, `bolero`, `it`, `sep`
- Biểu cảm: `ok` (bình thường), `love` (vui), `mad` (giận)
- Bà vợ đánh ghen: `wife.webp`

## Nhạc
Bỏ file `.mp3` vào `public/music/`. Khi người chơi bước vào phòng karaoke, game sẽ phát ngẫu nhiên một bài.

## Tùy chỉnh
- Khách, yêu cầu của khách, màu son, cấp bậc: sửa trong `shared/data.js`
- Tần suất vợ khách đánh ghen: biến môi trường `GHEN_MIN_SEC` / `GHEN_MAX_SEC` (mặc định 150–300 giây)
