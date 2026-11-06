const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const GD = require('./shared/data.js');
const { createStore } = require('./store.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));

// Danh sách ảnh nhân vật thật (public/chars/linh_1.png ...) và nhạc (public/music/*.mp3)
app.get('/api/assets', (req, res) => {
  const list = d => { try { return fs.readdirSync(path.join(__dirname, 'public', d)); } catch (e) { return []; } };
  res.json({
    chars: list('chars').filter(f => /\.(png|webp|jpg)$/i.test(f)),
    cust: list('cust').filter(f => /\.(png|webp|jpg)$/i.test(f)),
    music: list('music').filter(f => /\.mp3$/i.test(f)),
  });
});

const GHEN_MIN = +(process.env.GHEN_MIN_SEC || 150);
const GHEN_MAX = +(process.env.GHEN_MAX_SEC || 300);
const ROUNDS = 4;
const ROUND_MS = 9000;
const TAPS_NEEDED = 12;

const players = new Map(); // socket.id -> player
const customers = GD.CUSTOMER_SEATS.map((s, i) => ({ ...s, type: Object.keys(GD.CUSTOMER_TYPES)[i % 4], busyBy: null, awayUntil: 0 }));
let ghen = null;
let store;

const hashPin = (name, pin) => crypto.createHash('sha256').update('ktv2d:' + name + ':' + pin).digest('hex');
const keyOf = name => name.trim().toLowerCase();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clean = s => String(s || '').replace(/[<>]/g, '').trim();
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function publicPlayer(p) {
  return { id: p.id, name: p.name, char: p.char, outfit: p.outfit, makeup: p.makeup, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, moving: p.moving, tips: p.tips, rank: GD.rankOf(p.tips).name, serving: !!p.session };
}
function publicCustomer(c) {
  return { id: c.id, room: c.room, x: c.x, y: c.y, type: c.type, busy: !!c.busyBy, away: c.awayUntil > Date.now() };
}
async function saveP(p) {
  await store.save({ key: p.key, name: p.name, pin: p.pin, char: p.char, outfit: p.outfit, makeup: p.makeup, tips: p.tips, day: p.day, dayTips: p.dayTips });
}
async function broadcastTop() {
  io.emit('top', await store.top(5));
}
function announce(text, kind = 'info') { io.emit('toast', { text, kind }); }

function validMakeup(m) {
  m = m || {};
  const okId = (list, id) => list.some(c => c.id === id) ? id : null;
  return {
    lip: okId(GD.LIP_COLORS, m.lip), lipA: Math.min(1, Math.max(0.2, +m.lipA || 0.7)),
    blush: okId(GD.BLUSH_COLORS, m.blush), shadow: okId(GD.SHADOW_COLORS, m.shadow), glitter: !!m.glitter,
  };
}

io.on('connection', socket => {
  let me = null;

  socket.on('login', async ({ name, pin, char, outfit }, cb) => {
    try {
      name = clean(name).slice(0, 16); pin = String(pin || '').trim();
      if (!name || !/^\d{4}$/.test(pin)) return cb({ error: 'Nhập tên và mã PIN 4 số nha' });
      const key = keyOf(name);
      for (const p of players.values()) if (p.key === key) return cb({ error: 'Tên này đang online rồi' });
      let saved = await store.get(key);
      if (saved && saved.pin !== hashPin(key, pin)) return cb({ error: 'Sai mã PIN rồi bà ơi' });
      const isNew = !saved;
      if (!saved) {
        const c = GD.CHARACTERS.find(c => c.id === char) ? char : 'linh';
        saved = { key, name, pin: hashPin(key, pin), char: c, outfit: [0, 1, 2, 3].includes(outfit) ? outfit : 0, makeup: validMakeup({}), tips: 0, day: today(), dayTips: 0 };
      }
      me = { ...saved, id: socket.id, x: GD.SPAWN.x + (Math.random() * 80 - 40), y: GD.SPAWN.y, dir: 1, moving: false, session: null, chatAt: 0 };
      if (me.day !== today()) { me.day = today(); me.dayTips = 0; }
      players.set(socket.id, me);
      await saveP(me);
      cb({ ok: true, me: publicPlayer(me), isNew, dayTips: me.dayTips, players: [...players.values()].map(publicPlayer), customers: customers.map(publicCustomer) });
      socket.broadcast.emit('join', publicPlayer(me));
      announce(`${me.name} vừa vào ca làm ✨`);
      broadcastTop();
    } catch (e) { console.error(e); cb({ error: 'Lỗi server, thử lại nha' }); }
  });

  socket.on('move', d => {
    if (!me || me.session) return;
    const x = +d.x, y = +d.y;
    if (!isFinite(x) || !isFinite(y)) return;
    // chống dịch chuyển tức thời
    if (Math.hypot(x - me.x, y - me.y) > 120) return socket.emit('fix', { x: me.x, y: me.y });
    me.x = Math.max(0, Math.min(GD.W, x)); me.y = Math.max(0, Math.min(GD.H, y));
    me.dir = d.dir === -1 ? -1 : 1; me.moving = !!d.moving;
  });

  socket.on('chat', text => {
    if (!me) return;
    text = clean(text).slice(0, 80);
    if (!text || Date.now() - me.chatAt < 800) return;
    me.chatAt = Date.now();
    io.emit('chat', { id: me.id, name: me.name, text });
  });

  socket.on('look', async ({ char, outfit, makeup }) => {
    if (!me) return;
    if (GD.roomAt(me.x, me.y) !== 'makeup') return socket.emit('toast', { text: 'Vô Phòng Trang Điểm mới đổi đồ được nha', kind: 'warn' });
    if (GD.CHARACTERS.find(c => c.id === char)) me.char = char;
    if ([0, 1, 2, 3].includes(outfit)) me.outfit = outfit;
    me.makeup = validMakeup(makeup);
    await saveP(me);
    io.emit('look', { id: me.id, char: me.char, outfit: me.outfit, makeup: me.makeup });
  });

  // ---- Phục vụ khách ----
  socket.on('serve:start', ({ customerId }) => {
    if (!me || me.session) return;
    const c = customers.find(c => c.id === customerId);
    if (!c) return;
    if (c.awayUntil > Date.now()) return socket.emit('toast', { text: 'Khách đang bận (bị vợ lôi về 😅)', kind: 'warn' });
    if (c.busyBy) return socket.emit('toast', { text: 'Có người đang phục vụ khách này rồi', kind: 'warn' });
    if (Math.hypot(me.x - c.x, me.y - c.y) > 200) return socket.emit('toast', { text: 'Lại gần khách hơn chút', kind: 'warn' });
    if (ghen && ghen.room === c.room) return;
    const reqs = shuffle(GD.REQUESTS).slice(0, ROUNDS);
    me.session = { customerId: c.id, reqs, i: 0, correct: 0, combo: 0, maxCombo: 0, round: null };
    c.busyBy = me.id;
    io.emit('customers', customers.map(publicCustomer));
    socket.emit('serve:begin', { customerId: c.id, type: c.type, total: ROUNDS });
    nextRound(socket, me);
  });

  socket.on('serve:answer', ({ idx }) => {
    const s = me && me.session;
    if (!s || !s.round) return;
    const late = Date.now() > s.round.deadline;
    const ok = !late && idx === s.round.correct;
    s.round = null;
    if (ok) { s.correct++; s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo); } else s.combo = 0;
    socket.emit('serve:feedback', { ok, late });
    s.i++;
    setTimeout(() => { if (me.session === s) { if (s.i >= ROUNDS) finishServe(socket, me); else nextRound(socket, me); } }, 900);
  });

  socket.on('serve:quit', () => { if (me && me.session) endSession(me, true); socket.emit('serve:end', { quit: true }); });

  socket.on('ghen:tap', () => {
    if (!me || !ghen || !ghen.victims.has(me.id)) return;
    const n = (ghen.taps.get(me.id) || 0) + 1;
    ghen.taps.set(me.id, n);
    if (n === TAPS_NEEDED) socket.emit('ghen:safe');
  });

  socket.on('disconnect', async () => {
    if (!me) return;
    if (me.session) endSession(me, true);
    players.delete(socket.id);
    await saveP(me);
    io.emit('leave', socket.id);
  });
});

function nextRound(socket, p) {
  const s = p.session, r = s.reqs[s.i];
  const options = shuffle([r.ok, ...shuffle(r.bad).slice(0, 3)]);
  s.round = { correct: options.indexOf(r.ok), deadline: Date.now() + ROUND_MS + 400 };
  socket.emit('serve:round', { n: s.i + 1, total: ROUNDS, ask: r.ask, options, ms: ROUND_MS });
}

function endSession(p, cancelled) {
  const c = customers.find(c => c.id === p.session.customerId);
  if (c) { c.busyBy = null; if (!cancelled) c.awayUntil = Date.now() + 15000; }
  p.session = null;
  io.emit('customers', customers.map(publicCustomer));
}

async function finishServe(socket, p) {
  const s = p.session, c = customers.find(c => c.id === s.customerId), t = GD.CUSTOMER_TYPES[c.type];
  const lines = [];
  let tip = Math.round(t.base * (s.correct / ROUNDS));
  if (s.correct > 0) lines.push(`Phục vụ đúng ${s.correct}/${ROUNDS} yêu cầu: +${tip}k`);
  if (s.maxCombo >= ROUNDS) { const b = Math.round(t.base * 0.3); tip += b; lines.push(`Combo hoàn hảo: +${b}k`); }
  if (s.correct > 0) {
    if (p.outfit === t.likesOutfit) { const b = Math.round(t.base * 0.3); tip += b; lines.push(`Đúng gu trang phục (${GD.OUTFIT_STYLES[t.likesOutfit]}): +${b}k`); }
    if (p.makeup.lip === t.likesLip) { const b = Math.round(t.base * 0.2); tip += b; lines.push(`Đúng màu son khách thích: +${b}k`); }
    const done = [p.makeup.lip, p.makeup.blush, p.makeup.shadow].filter(Boolean).length;
    if (done === 3) { const b = Math.round(t.base * 0.1); tip += b; lines.push(`Trang điểm đầy đủ: +${b}k`); }
  }
  const mood = s.correct === ROUNDS ? 'love' : s.correct >= 2 ? 'ok' : 'mad';
  const say = mood === 'love' ? pick(['Em dễ thương quá, anh bao luôn!', 'Mai anh dắt bạn tới nữa nha!', 'Tip nè em, đừng khách sáo!'])
    : mood === 'ok' ? pick(['Cũng được, lần sau cố hơn nha em.', 'Tạm ổn, nhưng ly anh vẫn còn khô...'])
    : pick(['Em làm anh tỉnh rượu luôn rồi đó!', 'Thôi anh về với vợ còn hơn...', 'Quản lý đâu!!!']);
  p.tips += tip;
  if (p.day !== today()) { p.day = today(); p.dayTips = 0; }
  p.dayTips += tip;
  endSession(p, false);
  await saveP(p);
  socket.emit('serve:result', { tip, lines, mood, say, tips: p.tips, dayTips: p.dayTips, rank: GD.rankOf(p.tips).name });
  io.emit('tipfx', { id: p.id, tip, tips: p.tips, rank: GD.rankOf(p.tips).name });
  const oldRank = GD.rankOf(p.tips - tip).name, newRank = GD.rankOf(p.tips);
  if (oldRank !== newRank.name) announce(`${newRank.icon} ${p.name} vừa lên hạng ${newRank.name}!`, 'big');
  broadcastTop();
}

// ---- Sự kiện vợ đánh ghen ----
function scheduleGhen() {
  const ms = (GHEN_MIN + Math.random() * (GHEN_MAX - GHEN_MIN)) * 1000;
  setTimeout(startGhen, ms);
}
function startGhen() {
  const rooms = ['p1', 'p2', 'vip'].filter(r => [...players.values()].some(p => GD.roomAt(p.x, p.y) === r) && customers.some(c => c.room === r && c.awayUntil < Date.now()));
  if (!rooms.length) return scheduleGhen();
  const room = pick(rooms);
  const c = pick(customers.filter(c => c.room === room));
  const victims = new Set([...players.values()].filter(p => GD.roomAt(p.x, p.y) === room).map(p => p.id));
  ghen = { room, customer: c.id, victims, taps: new Map(), until: Date.now() + 6000 };
  for (const p of players.values()) if (victims.has(p.id) && p.session) { endSession(p, true); io.to(p.id).emit('serve:end', { ghen: true }); }
  const rName = GD.ROOMS.find(r => r.id === room).name;
  io.emit('ghen:start', { room, roomName: rName, customerName: GD.CUSTOMER_TYPES[c.type].name, victims: [...victims], ms: 6000, taps: TAPS_NEEDED });
  setTimeout(endGhen, 6000);
}
async function endGhen() {
  const g = ghen; ghen = null;
  const lost = [], safe = [];
  for (const id of g.victims) {
    const p = players.get(id); if (!p) continue;
    if ((g.taps.get(id) || 0) >= TAPS_NEEDED) { safe.push(p.name); continue; }
    const loss = Math.min(300, Math.round(p.tips * 0.05));
    p.tips -= loss; lost.push(`${p.name} (-${loss}k)`);
    await saveP(p);
    io.to(id).emit('ghen:caught', { loss, tips: p.tips });
    io.emit('tipfx', { id, tip: -loss, tips: p.tips, rank: GD.rankOf(p.tips).name });
  }
  customers.filter(c => c.room === g.room).forEach(c => { c.awayUntil = Date.now() + 45000; c.busyBy = null; });
  io.emit('customers', customers.map(publicCustomer));
  io.emit('ghen:end', { room: g.room, safe, lost });
  announce(lost.length ? `🩴 Vợ khách bắt được: ${lost.join(', ')}` : '🏃‍♀️ Cả phòng chạy thoát an toàn!', lost.length ? 'warn' : 'info');
  broadcastTop();
  scheduleGhen();
}

// Gửi vị trí 10 lần/giây
setInterval(() => {
  if (!players.size) return;
  io.emit('state', [...players.values()].map(p => [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.moving ? 1 : 0, p.session ? 1 : 0]));
}, 100);
setInterval(() => io.emit('customers', customers.map(publicCustomer)), 5000);

(async () => {
  store = await createStore();
  scheduleGhen();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log('KTV 2D chạy ở cổng ' + PORT));
})();
