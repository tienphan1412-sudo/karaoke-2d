// Dữ liệu dùng chung cho server và trình duyệt (v2)
(function (root) {
  const BW = 1600, BH = 900; // kích thước ảnh nền

  // ---------- Phòng ----------
  const KTV_FLOOR = [[120, 700], [300, 630], [560, 560], [960, 480], [1080, 360], [1480, 520], [1530, 885], [70, 885]];
  const ROOMS = {
    hall: {
      name: 'Sảnh', bg: 'hall_top', front: 'hall_front', neon: '#ff5fd2', kind: 'hall',
      floor: [[470, 320], [1050, 300], [1200, 420], [1480, 560], [1440, 885], [170, 885], [120, 560], [460, 420]],
      spawn: [800, 700],
      doors: [
        { id: 'p1', label: '101', x: 540, y: 330 },
        { id: 'p2', label: '102', x: 660, y: 322 },
        { id: 'vip', label: '103 VIP', x: 765, y: 316 },
        { id: 'makeup', label: '104 Trang điểm', x: 858, y: 312 },
        { id: 'closed', label: '105', x: 955, y: 306 },
      ],
    },
    p1: { name: 'Phòng 101', bg: 'p1_top', front: 'p1_front', neon: '#ff3fa4', kind: 'ktv', floor: KTV_FLOOR, spawn: [800, 820], kiosk: [1090, 400] },
    p2: { name: 'Phòng 102', bg: 'p2_top', front: 'p2_front', neon: '#36e0ff', kind: 'ktv', floor: KTV_FLOOR, spawn: [800, 820], kiosk: [1090, 400] },
    vip: { name: 'Phòng 103 VIP', bg: 'vip_top', front: 'vip_front', neon: '#ffd23f', kind: 'ktv', floor: KTV_FLOOR, spawn: [800, 820], kiosk: [1090, 400] },
    makeup: {
      name: 'Phòng Trang Điểm', bg: 'makeup_top', front: 'makeup_front', neon: '#ff9ad5', kind: 'makeup',
      floor: [[130, 520], [450, 470], [1050, 440], [1400, 560], [1340, 640], [1340, 885], [120, 885]],
      spawn: [800, 800], vanity: [700, 470], rack: [1150, 470],
    },
  };
  const DOOR_RANGE = 70;

  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // chiều cao nhân vật theo độ sâu (gần thì to)
  const charHeight = y => 205 + (y - 300) / 585 * 175;

  // ---------- Khách ----------
  const CUSTOMER_SEATS = [
    { id: 'c1', room: 'p1', x: 620, y: 335, type: 'daigia' },
    { id: 'c2', room: 'p2', x: 620, y: 335, type: 'bolero' },
    { id: 'c3', room: 'vip', x: 340, y: 470, type: 'it' },
    { id: 'c4', room: 'vip', x: 760, y: 305, type: 'sep' },
  ];
  const CUSTOMER_TYPES = {
    daigia: { name: 'Anh Ba Đại Gia', base: 160, likesOutfit: [0, 7], likesLip: 'do', hint: 'Anh thích em mặc lộng lẫy hay váy voan đen sang chảnh, son đỏ nha!' },
    bolero: { name: 'Chú Tư Bolero', base: 110, likesOutfit: [2, 6, 10], likesLip: 'nude', hint: 'Chú thích con gái mặc áo dài hay váy dài nữ tính, son nhẹ nhàng.' },
    it: { name: 'Anh Khoa IT', base: 90, likesOutfit: [1, 5, 8], likesLip: 'hong', hint: 'D-dạ... anh thích son hồng... với váy ngắn điệu điệu... có nơ càng tốt...' },
    sep: { name: 'Sếp Hùng', base: 130, likesOutfit: [3, 9], likesLip: 'man', hint: 'Mặc đồ biển hay váy lệch vai cho mát mẻ, son màu mận nha em!' },
  };

  // ---------- Nhân vật ----------
  const DEFAULT_FACE = { eyeL: [276, 172], eyeR: [324, 172], eyeW: 30, lips: [300, 214], lipW: 26, cheekL: [266, 196], cheekR: [334, 196] };
  const CHARACTERS = [
    {
      id: 'linh', name: 'Linh', tag: 'Hiền Như Cục Đất', unlock: 0, hair: '#1d1512', hairStyle: 'long', skin: '#f7dccb', outfitColors: ['#d8b25a', '#ff3f8e', '#fbf7f2', '#ff7ab8', '#1a1a22', '#f1dcc0', '#f2a7a7', '#1a1a1a', '#f6ece2', '#ece4cf', '#f0d8c8'],
      strong: 'Chú Tư Bolero thương như con: tip +20%', weak: 'Hiền quá bị Sếp Hùng ăn hiếp: tip Sếp Hùng -10%',
      story: 'Gái quê lên Sài Gòn học kế toán. Ra trường 2 năm nộp CV khắp nơi không ai gọi. Chị hàng xóm rủ đi làm karaoke "chỉ cần ngồi hát", ai dè ngày đầu tiên bóc hết 3 ký tôm.',
      perks: { tip: { bolero: 1.2, sep: 0.9 } }, face: DEFAULT_FACE,
    },
    {
      id: 'mai', name: 'Mai', tag: 'Nhanh Như Điện', unlock: 1000, hair: '#141016', hairStyle: 'bob', skin: '#f3d3bf', outfitColors: ['#1d1d24', '#ff3f8e', '#fbf7f2', '#e0303a', '#1a1a22', '#f1dcc0', '#f2a7a7', '#1a1a1a', '#f6ece2', '#ece4cf', '#f0d8c8'],
      strong: 'Vợ khách tới: chỉ cần bấm 8 lần là chạy thoát', weak: 'Anh Ba Đại Gia chê "lanh quá": tip -15%',
      story: 'Chạy shipper 3 năm, thuộc hẻm Sài Gòn hơn Google Maps. Nghỉ vì nắng đen thui, chuyển qua karaoke ngồi máy lạnh nhưng vẫn giữ tốc độ giao hỏa tốc.',
      perks: { tip: { daigia: 0.85 }, runTaps: 8 }, face: DEFAULT_FACE,
    },
    {
      id: 'ngoc', name: 'Ngọc', tag: 'Chị Đại', unlock: 3000, hair: '#6b3a22', hairStyle: 'wavy', skin: '#f1cfb8', outfitColors: ['#9b1b2e', '#ff3f8e', '#fbf7f2', '#f5b82e', '#1a1a22', '#f1dcc0', '#f2a7a7', '#1a1a1a', '#f6ece2', '#ece4cf', '#f0d8c8'],
      strong: 'Khí chất bà chủ, Anh Ba Đại Gia nể: tip +25%', weak: 'Mang giày 12 phân: chạy trốn phải bấm 16 lần',
      story: 'Từng là chủ tiệm nail ba chi nhánh, nghe lời "anh trader" đầu tư tiền ảo nên mất sạch. Giờ làm lại từ đầu, nhưng ánh mắt vẫn như đang đi thu tiền mặt bằng.',
      perks: { tip: { daigia: 1.25 }, runTaps: 16 }, face: DEFAULT_FACE,
    },
    {
      id: 'vy', name: 'Vy', tag: 'Sống Ảo', unlock: 6000, hair: '#ece8e4', hairStyle: 'long', skin: '#fae3d6', outfitColors: ['#c9ccd6', '#ff3f8e', '#fbf7f2', '#6b9be0', '#1a1a22', '#f1dcc0', '#f2a7a7', '#1a1a1a', '#f6ece2', '#ece4cf', '#f0d8c8'],
      strong: 'Anh Khoa IT mê như điếu đổ: tip x2', weak: 'Mải canh góc chụp hình: mỗi yêu cầu bớt 2 giây',
      story: 'Hot girl 12k follow. Đi làm chủ yếu để có background đẹp lên story. Đang rót bia cho khách mà thấy đèn neon đẹp là phải dừng lại quay TikTok cho bằng được.',
      perks: { tip: { it: 2 }, roundMs: -2000 }, face: DEFAULT_FACE,
    },
  ];
  const RUN_TAPS = 12;

  const OUTFIT_STYLES = ['Lộng lẫy', 'Gợi cảm', 'Kín đáo', 'Đồ biển', 'Đồ diễn', 'Ren bèo kem', 'Xếp tầng hồng', 'Voan đen', 'Hoa hồng nơ', 'Lệch vai voan', 'Ren ôm dài'];
  const LIP_COLORS = [
    { id: 'do', name: 'Đỏ', hex: '#c8102e' }, { id: 'nude', name: 'Nude', hex: '#c27f6e' },
    { id: 'hong', name: 'Hồng', hex: '#e8457f' }, { id: 'cam', name: 'Cam đất', hex: '#d4553a' }, { id: 'man', name: 'Mận', hex: '#7b1e3a' },
  ];
  const BLUSH_COLORS = [{ id: 'hong', name: 'Hồng', hex: '#ff7aa2' }, { id: 'dao', name: 'Đào', hex: '#ff9a76' }, { id: 'cam', name: 'Cam', hex: '#ff8a3d' }];
  const SHADOW_COLORS = [{ id: 'nau', name: 'Nâu', hex: '#8a5a44' }, { id: 'hong', name: 'Hồng', hex: '#d96b9a' }, { id: 'tim', name: 'Tím khói', hex: '#6b4c8a' }, { id: 'vang', name: 'Vàng kim', hex: '#d9a441' }];
  const ACCESSORIES = [
    { id: 'kinh', name: 'Kính râm', icon: '🕶️' }, { id: 'vuongmien', name: 'Vương miện', icon: '👑' },
    { id: 'hoa', name: 'Hoa cài tóc', icon: '🌺' }, { id: 'ngoctrai', name: 'Dây chuyền ngọc trai', icon: '📿' },
  ];

  // ---------- Shop ----------
  // kind: outfit | lip | blush | shadow | glitter | acc | item
  const SHOP = [
    { id: 'outfit:1', kind: 'outfit', ref: 1, name: 'Bộ Gợi cảm', icon: '👗', price: 300 },
    { id: 'outfit:2', kind: 'outfit', ref: 2, name: 'Bộ Áo dài', icon: '🥻', price: 200 },
    { id: 'outfit:3', kind: 'outfit', ref: 3, name: 'Bộ Đồ biển', icon: '👙', price: 500 },
    { id: 'outfit:4', kind: 'outfit', ref: 4, name: 'Bộ Đồ diễn', icon: '🎭', price: 600, desc: 'Mặc vào là hát, nhảy ra dáng ca sĩ' },
    { id: 'outfit:5', kind: 'outfit', ref: 5, name: 'Váy ren bèo kem', icon: '👗', price: 350 },
    { id: 'outfit:6', kind: 'outfit', ref: 6, name: 'Đầm xếp tầng hồng', icon: '👗', price: 450 },
    { id: 'outfit:7', kind: 'outfit', ref: 7, name: 'Đầm voan đen', icon: '👗', price: 550 },
    { id: 'outfit:8', kind: 'outfit', ref: 8, name: 'Váy hoa hồng nơ', icon: '👗', price: 400 },
    { id: 'outfit:9', kind: 'outfit', ref: 9, name: 'Đầm lệch vai voan', icon: '👗', price: 650 },
    { id: 'outfit:10', kind: 'outfit', ref: 10, name: 'Đầm ren ôm dài', icon: '👗', price: 800 },
    { id: 'lip:hong', kind: 'lip', ref: 'hong', name: 'Son Hồng', icon: '💄', price: 100 },
    { id: 'lip:cam', kind: 'lip', ref: 'cam', name: 'Son Cam đất', icon: '💄', price: 100 },
    { id: 'lip:man', kind: 'lip', ref: 'man', name: 'Son Mận', icon: '💄', price: 150 },
    { id: 'blush:dao', kind: 'blush', ref: 'dao', name: 'Má hồng Đào', icon: '🌸', price: 80 },
    { id: 'blush:cam', kind: 'blush', ref: 'cam', name: 'Má hồng Cam', icon: '🌸', price: 80 },
    { id: 'shadow:hong', kind: 'shadow', ref: 'hong', name: 'Phấn mắt Hồng', icon: '👁️', price: 100 },
    { id: 'shadow:tim', kind: 'shadow', ref: 'tim', name: 'Phấn mắt Tím khói', icon: '👁️', price: 120 },
    { id: 'shadow:vang', kind: 'shadow', ref: 'vang', name: 'Phấn mắt Vàng kim', icon: '👁️', price: 150 },
    { id: 'glitter', kind: 'glitter', ref: true, name: 'Kim tuyến', icon: '✨', price: 200 },
    { id: 'acc:hoa', kind: 'acc', ref: 'hoa', name: 'Hoa cài tóc', icon: '🌺', price: 150 },
    { id: 'acc:kinh', kind: 'acc', ref: 'kinh', name: 'Kính râm', icon: '🕶️', price: 250 },
    { id: 'acc:ngoctrai', kind: 'acc', ref: 'ngoctrai', name: 'Dây chuyền ngọc trai', icon: '📿', price: 300 },
    { id: 'acc:vuongmien', kind: 'acc', ref: 'vuongmien', name: 'Vương miện', icon: '👑', price: 800 },
    { id: 'item:bia', kind: 'item', ref: 'bia', name: 'Bia mời khách', icon: '🍺', price: 50, desc: 'Lượt phục vụ kế tiếp +20% tip' },
    { id: 'item:phaohoa', kind: 'item', ref: 'phaohoa', name: 'Pháo hoa', icon: '🎆', price: 200, desc: 'Bắn cho cả phòng xem' },
    { id: 'item:hoa', kind: 'item', ref: 'hoa', name: 'Bó hoa tặng', icon: '💐', price: 50, desc: 'Tặng người chơi khác' },
    { id: 'item:baoke', kind: 'item', ref: 'baoke', name: 'Anh bảo kê', icon: '🕴️', price: 300, desc: 'Thoát 1 lần vợ đánh ghen, không mất tip' },
  ];
  const FREE = { lip: ['do', 'nude'], blush: ['hong'], shadow: ['nau'], outfit: [0] };

  // ---------- Cấp bậc ----------
  const RANKS = [
    { min: 0, name: 'Tập Sự', icon: '🌱' }, { min: 500, name: 'Nhân Viên', icon: '🎤' }, { min: 2000, name: 'Ngôi Sao', icon: '⭐' },
    { min: 5000, name: 'Hoa Khôi', icon: '🌹' }, { min: 15000, name: 'Nữ Hoàng KTV', icon: '👑' },
  ];
  function rankOf(tips) { let r = RANKS[0]; for (const k of RANKS) if (tips >= k.min) r = k; return r; }

  // ---------- Yêu cầu khách ----------
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

  // ---------- Đánh ghen v2 ----------
  const GHEN_CHOICES = [
    { id: 'sofa', icon: '🛋️', name: 'Núp sau sofa', chance: 0.55, win: 'Núp kỹ quá, vợ khách không thấy!', lose: 'Tóc ló ra ngoài sofa... bị lôi ra!' },
    { id: 'donphong', icon: '🧹', name: 'Giả làm nhân viên dọn phòng', chance: 0.7, cost: 20, win: 'Cầm chổi quét lia lịa, vợ khách tưởng lao công thật! (thuê chổi -20k)', lose: 'Lao công gì mà mang giày cao gót???' },
    { id: 'emnuoi', icon: '👧', name: 'Nhận là em gái nuôi', chance: 0.35, bonus: 100, win: 'Vợ khách tin sái cổ! Khách cảm kích bo thêm 100k', lose: '"Em gái nuôi" mà ngồi sát rạt vậy hả???' },
    { id: 'chay', icon: '🏃‍♀️', name: 'Chạy!', run: true },
  ];

  // ---------- Hành động ----------
  const EMOTES = [
    { id: 'hat', icon: '🎤', name: 'Hát', ms: 5000 },
    { id: 'nhay', icon: '💃', name: 'Nhảy', ms: 5000 },
    { id: 'tim', icon: '😘', name: 'Thả tim', ms: 3000 },
    { id: 'cungly', icon: '🍻', name: 'Cụng ly', ms: 3000 },
    { id: 'vay', icon: '👋', name: 'Vẫy tay', ms: 2500 },
  ];

  // ---------- Nhiệm vụ ngày ----------
  const QUESTS = [
    { id: 'serve3', text: 'Phục vụ 3 lượt khách', goal: 3, reward: 150 },
    { id: 'serve5', text: 'Phục vụ 5 lượt khách', goal: 5, reward: 250 },
    { id: 'perfect', text: 'Phục vụ hoàn hảo 4/4 một lần', goal: 1, reward: 150 },
    { id: 'earn500', text: 'Kiếm 500k tip trong ngày', goal: 500, reward: 200 },
    { id: 'sing80', text: 'Hát karaoke được 80 điểm', goal: 1, reward: 150, feature: 'karaoke' },
    { id: 'ghen', text: 'Thoát vợ đánh ghen 1 lần', goal: 1, reward: 200 },
    { id: 'emote5', text: 'Biểu diễn 5 lần (hát, nhảy...)', goal: 5, reward: 100, feature: 'emotes' },
    { id: 'gift1', text: 'Tặng hoa cho người chơi khác', goal: 1, reward: 100, feature: 'gifts' },
    { id: 'buy1', text: 'Mua 1 món trong shop', goal: 1, reward: 100, feature: 'shop' },
  ];

  const KARAOKE_JUDGE = [
    [95, 'Giọng ca vàng! Ca sĩ thật ra đây ngồi coi!'], [80, 'Hát hay quá, khách vỗ tay rần rần!'], [60, 'Cũng được, bia vô là hay liền.'],
    [40, 'Lạc tông nhẹ... lạc qua tới phòng bên.'], [20, 'Hàng xóm vừa gọi điện phàn nàn.'], [0, 'Hàng xóm đã báo công an!'],
  ];

  const DATA = {
    BW, BH, ROOMS, DOOR_RANGE, inPoly, charHeight, CUSTOMER_SEATS, CUSTOMER_TYPES, CHARACTERS, RUN_TAPS, OUTFIT_STYLES,
    LIP_COLORS, BLUSH_COLORS, SHADOW_COLORS, ACCESSORIES, SHOP, FREE, RANKS, rankOf, REQUESTS, GHEN_CHOICES, EMOTES, QUESTS, KARAOKE_JUDGE,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA; else root.GD = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
