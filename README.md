# KTV Lung Linh 2D

Game karaoke chơi online nhiều người. Người chơi đi lại trong quán, phục vụ khách để kiếm tip, hát karaoke chấm điểm, biểu diễn, mua sắm và né vợ khách đánh ghen.

## Bật / tắt tính năng (ra mắt từng đợt)
Mở file `features.json` trên GitHub, bấm ✏️ để sửa. Đổi `true` / `false` rồi bấm **Commit changes**. Render sẽ tự deploy lại trong vài phút.

| Tên | Tính năng |
|---|---|
| `locks` | Khóa nhân vật, cày đủ tổng tip mới mở |
| `shop` | Shop mua đồ, son, phụ kiện, vật phẩm (tắt thì mọi thứ miễn phí) |
| `ghenV2` | Đánh ghen kiểu mới: 4 cách thoát (tắt thì chỉ có nút Chạy) |
| `quests` | Nhiệm vụ hằng ngày + quà điểm danh |
| `karaoke` | Hát karaoke có máy chấm điểm ở máy chọn bài trong phòng |
| `emotes` | Biểu diễn: hát, nhảy, thả tim, cụng ly, vẫy tay |
| `fireworks` | Bắn pháo hoa |
| `gifts` | Tặng hoa, bo tiền cho người chơi khác + bảng Hoa Hậu Đêm Nay |
| `event` | Sự kiện Đại Gia Bao Phòng VIP (khoảng 10–20 phút một lần) |

Gợi ý chia đợt:
- **Đợt 1** (đang bật): `locks`, `shop`, `ghenV2`, `quests`
- **Đợt 2**: `karaoke`, `emotes`, `fireworks`
- **Đợt 3**: `gifts`, `event`

## Ảnh
| Thư mục | Tên file | Ghi chú |
|---|---|---|
| `public/chars/` | `linh_1.webp` … `linh_4.webp` | 1 Lộng lẫy · 2 Gợi cảm · 3 Kín đáo · 4 Đồ biển · 5 Đồ diễn · 6–11 Váy tiệc (ren bèo kem, xếp tầng hồng, voan đen, hoa hồng nơ, lệch vai voan, ren ôm dài) |
| `public/chars/` | `linh_hat.webp`, `linh_nhay.webp` | Ảnh tư thế đồ diễn (cầm mic hát, nhảy múa). Khi bấm Hát/Nhảy, nhân vật tự đổi sang ảnh này |
| `public/cust/` | `daigia_ok.webp`, `daigia_love.webp`, `daigia_mad.webp`… | Khách: `daigia`, `bolero`, `it`, `sep` |
| `public/cust/` | `wife.webp` | Bà vợ đánh ghen |
| `public/bg/` | `hall_top.webp`, `p1_top.webp`… | Ảnh nền phòng (`_top` = bản đồ, `_front` = màn phục vụ) |

Vị trí makeup trên mặt lưu trong `public/faces.json`. Có thể canh lại bằng trang `/calib.html`.

## Chạy thử trên máy
```
npm install
npm start
```
Mở http://localhost:3000

## Đưa lên mạng (Render)
- Build Command: `npm install` · Start Command: `npm start`
- Biến môi trường `MONGODB_URI` để lưu tiền tip lâu dài.
- Người chơi cũ khi vào bản mới: ví được tặng bằng tổng tip đang có, và mở sẵn đủ 4 bộ đồ.
