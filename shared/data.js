// Dữ liệu dùng chung cho server và trình duyệt
(function (root) {
  const W = 1600, H = 1100;
  const ROOM_H = 560, WALL = 16, DOOR = 120;

  const ROOMS = [
    { id: 'p1', name: 'Phòng 1', x: 0, y: 0, w: 400, h: ROOM_H, kind: 'ktv', neon: '#ff3fa4' },
    { id: 'p2', name: 'Phòng 2', x: 400, y: 0, w: 400, h: ROOM_H, kind: 'ktv', neon: '#36e0ff' },
    { id: 'vip', name: 'Phòng VIP', x: 800, y: 0, w: 400, h: ROOM_H, kind: 'ktv', neon: '#ffd23f' },
    { id: 'makeup', name: 'Phòng Trang Điểm', x: 1200, y: 0, w: 400, h: ROOM_H, kind: 'makeup', neon: '#ff9ad5' },
    { id: 'hall', name: 'Sảnh', x: 0, y: ROOM_H, w: W, h: H - ROOM_H, kind: 'hall', neon: '#ffffff' },
  ];

  // Tường + đồ đạc (va chạm)
  const SOLIDS = [];
  SOLIDS.push({ x: 0, y: 0, w: W, h: WALL, t: 'wall' });
  SOLIDS.push({ x: 0, y: H - WALL, w: W, h: WALL, t: 'wall' });
  SOLIDS.push({ x: 0, y: 0, w: WALL, h: H, t: 'wall' });
  SOLIDS.push({ x: W - WALL, y: 0, w: WALL, h: H, t: 'wall' });
  [400, 800, 1200].forEach(x => SOLIDS.push({ x: x - WALL / 2, y: 0, w: WALL, h: ROOM_H, t: 'wall' }));
  ROOMS.filter(r => r.kind !== 'hall').forEach(r => {
    const dx = r.x + r.w / 2 - DOOR / 2;
    SOLIDS.push({ x: r.x, y: ROOM_H - WALL / 2, w: dx - r.x, h: WALL, t: 'wall' });
    SOLIDS.push({ x: dx + DOOR, y: ROOM_H - WALL / 2, w: r.x + r.w - dx - DOOR, h: WALL, t: 'wall' });
  });
  ROOMS.filter(r => r.kind === 'ktv').forEach(r => {
    SOLIDS.push({ x: r.x + 50, y: 120, w: 300, h: 60, t: 'sofa', room: r.id });
    SOLIDS.push({ x: r.x + 120, y: 250, w: 160, h: 56, t: 'table', room: r.id });
  });
  SOLIDS.push({ x: 1240, y: 40, w: 320, h: 70, t: 'vanity' });
  SOLIDS.push({ x: 1250, y: 300, w: 60, h: 120, t: 'rack' });
  SOLIDS.push({ x: 1490, y: 300, w: 60, h: 120, t: 'rack' });
  SOLIDS.push({ x: 640, y: 940, w: 320, h: 50, t: 'counter' });
  [[60, 620], [1520, 620], [60, 1020], [1520, 1020]].forEach(([x, y]) => SOLIDS.push({ x, y, w: 40, h: 40, t: 'plant' }));

  const CUSTOMER_SEATS = [
    { id: 'c1', room: 'p1', x: 200, y: 175 },
    { id: 'c2', room: 'p2', x: 600, y: 175 },
    { id: 'c3', room: 'vip', x: 940, y: 175 },
    { id: 'c4', room: 'vip', x: 1060, y: 175 },
  ];

  const SPAWN = { x: 800, y: 820 };

  function roomAt(x, y) {
    for (const r of ROOMS) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.id;
    return 'hall';
  }

  const OUTFIT_STYLES = ['Lộng lẫy', 'Gợi cảm', 'Kín đáo', 'Đồ biển'];

  const LIP_COLORS = [
    { id: 'do', name: 'Đỏ', hex: '#c8102e' },
    { id: 'cam', name: 'Cam đất', hex: '#d4553a' },
    { id: 'hong', name: 'Hồng', hex: '#e8457f' },
    { id: 'nude', name: 'Nude', hex: '#c27f6e' },
    { id: 'man', name: 'Mận', hex: '#7b1e3a' },
  ];
  const BLUSH_COLORS = [
    { id: 'hong', name: 'Hồng', hex: '#ff7aa2' },
    { id: 'dao', name: 'Đào', hex: '#ff9a76' },
    { id: 'cam', name: 'Cam', hex: '#ff8a3d' },
  ];
  const SHADOW_COLORS = [
    { id: 'nau', name: 'Nâu', hex: '#8a5a44' },
    { id: 'hong', name: 'Hồng', hex: '#d96b9a' },
    { id: 'tim', name: 'Tím khói', hex: '#6b4c8a' },
    { id: 'vang', name: 'Vàng kim', hex: '#d9a441' },
  ];

  // face: toạ độ trên khung chuẩn 600x900 (canh lại khi có ảnh thật bằng calib.html)
  const DEFAULT_FACE = { eyeL: [276, 172], eyeR: [324, 172], eyeW: 30, lips: [300, 214], lipW: 26, cheekL: [266, 196], cheekR: [334, 196] };
  const CHARACTERS = [
    { id: 'linh', name: 'Linh', desc: 'Tóc đen dài, dịu dàng', hair: '#1d1512', hairStyle: 'long', skin: '#f7dccb', outfitColors: ['#d8b25a', '#ff3f8e', '#fbf7f2', '#ff7ab8'], face: DEFAULT_FACE },
    { id: 'vy', name: 'Vy', desc: 'Tóc bạch kim, kiểu búp bê', hair: '#ece8e4', hairStyle: 'long', skin: '#fae3d6', outfitColors: ['#c9ccd6', '#ff3f8e', '#fbf7f2', '#6b9be0'], face: DEFAULT_FACE },
    { id: 'ngoc', name: 'Ngọc', desc: 'Tóc nâu xoăn, quyến rũ', hair: '#6b3a22', hairStyle: 'wavy', skin: '#f1cfb8', outfitColors: ['#9b1b2e', '#ff3f8e', '#fbf7f2', '#f5b82e'], face: DEFAULT_FACE },
    { id: 'mai', name: 'Mai', desc: 'Tóc bob ngắn, cá tính', hair: '#141016', hairStyle: 'bob', skin: '#f3d3bf', outfitColors: ['#1d1d24', '#ff3f8e', '#fbf7f2', '#e0303a'], face: DEFAULT_FACE },
  ];

  const RANKS = [
    { min: 0, name: 'Tập Sự', icon: '🌱' },
    { min: 500, name: 'Nhân Viên', icon: '🎤' },
    { min: 2000, name: 'Ngôi Sao', icon: '⭐' },
    { min: 5000, name: 'Hoa Khôi', icon: '🌹' },
    { min: 15000, name: 'Nữ Hoàng KTV', icon: '👑' },
  ];
  function rankOf(tips) { let r = RANKS[0]; for (const k of RANKS) if (tips >= k.min) r = k; return r; }

  // Khách hài
  const CUSTOMER_TYPES = {
    daigia: { name: 'Anh Ba Đại Gia', base: 160, likesOutfit: 0, likesLip: 'do', shirt: '#e8c34a', bald: true, chain: true, glasses: false, mustache: true,
      hint: 'Anh thích em mặc lộng lẫy, son đỏ cho sang!' },
    bolero: { name: 'Chú Tư Bolero', base: 110, likesOutfit: 2, likesLip: 'nude', shirt: '#7a4fb5', bald: false, comb: true, glasses: true, mustache: true,
      hint: 'Chú thích con gái mặc áo dài, son nhẹ nhàng.' },
    it: { name: 'Anh Khoa IT', base: 90, likesOutfit: 1, likesLip: 'hong', shirt: '#3a7bd5', bald: false, glasses: true, mustache: false,
      hint: 'D-dạ... anh thích son hồng... với đồ hơi... điệu điệu...' },
    sep: { name: 'Sếp Hùng', base: 130, likesOutfit: 3, likesLip: 'man', shirt: '#2e2e38', bald: false, glasses: false, mustache: false, tie: true,
      hint: 'Hát karaoke mà mặc đồ biển mới mát mẻ, son màu mận nha em!' },
  };

  const REQUESTS = [
    { ask: 'Rót bia cho anh coi!', ok: 'Rót bia', bad: ['Rót nước mắm', 'Rót trà sữa trân châu', 'Rót nước rửa chén'] },
    { ask: 'Hát với anh bài bolero đi em!', ok: 'Song ca bolero', bad: ['Rap diss anh', 'Hát ru anh ngủ', 'Đọc bản tin thời sự'] },
    { ask: 'Vợ anh không hiểu anh... 😢', ok: 'Vỗ vai an ủi', bad: ['Gọi cho vợ anh', 'Cười haha', 'Tính tiền luôn'] },
    { ask: 'Bóc giùm anh con tôm!', ok: 'Bóc tôm', bad: ['Bóc phốt anh', 'Bóc lịch', 'Bóc vỏ chuối'] },
    { ask: 'Khen anh một câu đi!', ok: 'Anh phong độ quá trời!', bad: ['Anh giống chú bảo vệ', 'Anh hôi bia quá', 'Anh mấy chục tuổi rồi?'] },
    { ask: 'Cụng ly cái nào!', ok: 'Một, hai, ba... DZÔ!', bad: ['Em đang uống thuốc', 'Ly anh dơ quá', 'Cụng đầu'] },
    { ask: 'Gọt trái cây cho anh!', ok: 'Gọt dĩa trái cây', bad: ['Gọt bút chì', 'Gọt khoai tây', 'Gọt tóc anh'] },
    { ask: 'Bỏ thêm đá vô ly!', ok: 'Châm đá', bad: ['Bỏ muối', 'Bỏ ớt', 'Bỏ chạy'] },
    { ask: 'Kể chuyện gì vui vui đi em!', ok: 'Kể chuyện cười', bad: ['Kể chuyện ma', 'Kể nợ của anh', 'Kể lương em'] },
    { ask: 'Mở bài "Đắp mộ cuộc tình" cho anh!', ok: 'Chọn bài trên máy', bad: ['Mở bài thánh ca', 'Tắt nhạc', 'Mở video nấu ăn'] },
    { ask: 'Anh nóng quá em ơi!', ok: 'Quạt cho anh', bad: ['Tạt nước đá', 'Bật lò sưởi', 'Đưa áo khoác'] },
    { ask: 'Gọi thêm mồi đi em!', ok: 'Gọi khô mực', bad: ['Gọi cảnh sát', 'Gọi vợ anh', 'Gọi taxi'] },
  ];

  const DATA = { W, H, ROOM_H, WALL, DOOR, ROOMS, SOLIDS, CUSTOMER_SEATS, SPAWN, roomAt, OUTFIT_STYLES, LIP_COLORS, BLUSH_COLORS, SHADOW_COLORS, CHARACTERS, RANKS, rankOf, CUSTOMER_TYPES, REQUESTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA; else root.GD = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
