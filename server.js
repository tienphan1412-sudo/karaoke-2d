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

// ---------- Tính năng bật/tắt ----------
let FEATURES = {};
try { FEATURES = JSON.parse(fs.readFileSync(path.join(__dirname, 'features.json'), 'utf8')); } catch (e) { }
for (const k of ['locks', 'shop', 'ghenV2', 'quests', 'karaoke', 'emotes', 'fireworks', 'gifts', 'event']) {
  const env = process.env['FEATURE_' + k.toUpperCase()];
  if (env !== undefined) FEATURES[k] = env === '1' || env === 'true';
  if (FEATURES[k] === undefined) FEATURES[k] = false;
}
delete FEATURES._huong_dan;
const F = k => !!FEATURES[k];
console.log('Tính năng:', Object.entries(FEATURES).map(([k, v]) => (v ? '✅' : '⛔') + k).join(' '));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.get('/api/assets', (req, res) => {
  const list = d => { try { return fs.readdirSync(path.join(__dirname, 'public', d)); } catch (e) { return []; } };
  const img = f => /\.(png|webp|jpg)$/i.test(f);
  res.json({ chars: list('chars').filter(img), cust: list('cust').filter(img), bg: list('bg').filter(img), music: list('music').filter(f => /\.mp3$/i.test(f)) });
});

// ---------- Hằng số ----------
const GHEN_MIN = +(process.env.GHEN_MIN_SEC || 150), GHEN_MAX = +(process.env.GHEN_MAX_SEC || 300);
const EVENT_MIN = +(process.env.EVENT_MIN_SEC || 600), EVENT_MAX = +(process.env.EVENT_MAX_SEC || 1200), EVENT_LEN = 120, EVENT_POOL = 1000;
const GHEN_MS = 8000, ROUNDS = 4, ROUND_MS = 9000;

const players = new Map(); // socket.id -> player online
const customers = GD.CUSTOMER_SEATS.map(s => ({ ...s, busyBy: null, awayUntil: 0 }));
let ghen = null, event = null, store;

const hashPin = (name, pin) => crypto.createHash('sha256').update('ktv2d:' + name + ':' + pin).digest('hex');
const keyOf = name => name.trim().toLowerCase();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clean = s => String(s || '').replace(/[<>]/g, '').trim();
const vnDate = (off = 0) => new Date(Date.now() + 7 * 3600e3 + off).toISOString().slice(0, 10);
const today = () => vnDate();
const charOf = id => GD.CHARACTERS.find(c => c.id === id) || GD.CHARACTERS[0];
const roomName = id => (GD.ROOMS[id] || {}).name || id;

// ---------- Hồ sơ người chơi ----------
const SAVE_FIELDS = ['key', 'name', 'pin', 'char', 'outfit', 'makeup', 'acc', 'tips', 'wallet', 'owned', 'inv', 'buff', 'day', 'dayTips', 'flowersDay', 'quests', 'loginDay', 'streak'];
function normalize(s) {
  const legacy = s.wallet === undefined;
  s.tips = s.tips || 0;
  if (legacy) s.wallet = s.tips;
  s.owned = s.owned || {};
  const o = s.owned;
  o.outfits = o.outfits || (legacy && s.tips > 0 ? [0, 1, 2, 3] : [0]);
  for (const k of ['lip', 'blush', 'shadow']) o[k] = o[k] || GD.FREE[k].slice();
  o.acc = o.acc || []; o.glitter = !!o.glitter;
  s.inv = Object.assign({ bia: 0, phaohoa: 0, hoa: 0, baoke: 0 }, s.inv || {});
  s.buff = s.buff || {};
  s.makeup = s.makeup || {};
  s.acc = s.acc || null;
  s.flowersDay = s.flowersDay || 0;
  s.streak = s.streak || 0;
  if (!GD.CHARACTERS.find(c => c.id === s.char)) s.char = 'linh';
  if (!(Number.isInteger(s.outfit) && s.outfit >= 0 && s.outfit < GD.OUTFIT_STYLES.length)) s.outfit = 0;
  return s;
}
function ensureDay(p) {
  if (p.day !== today()) { p.day = today(); p.dayTips = 0; p.flowersDay = 0; }
  if (!p.quests || p.quests.day !== today()) {
    const pool = GD.QUESTS.filter(q => !q.feature || F(q.feature));
    p.quests = { day: today(), list: shuffle(pool).slice(0, 3).map(q => ({ id: q.id, p: 0, claimed: false })) };
  }
}
function questAdd(p, id, n = 1, socket) {
  if (!F('quests') || !p.quests) return;
  const q = p.quests.list.find(q => q.id === id); if (!q) return;
  const def = GD.QUESTS.find(d => d.id === id);
  const before = q.p >= def.goal;
  q.p = id === 'earn500' ? n : Math.min(def.goal, q.p + n);
  if (!before && q.p >= def.goal && socket) socket.emit('toast', { text: `🎯 Hoàn thành nhiệm vụ: ${def.text}! Vào 🎯 để nhận thưởng`, kind: 'big' });
  if (socket) socket.emit('quests', p.quests);
}
async function saveP(p) { const o = {}; for (const k of SAVE_FIELDS) o[k] = p[k]; await store.save(o); }
function unlocked(p, charId) { return !F('locks') || p.tips >= charOf(charId).unlock || p.char === charId; }
function owns(p, kind, ref) {
  if (!F('shop')) return true;
  if (kind === 'outfit') return p.owned.outfits.includes(ref);
  if (kind === 'acc') return p.owned.acc.includes(ref);
  if (kind === 'glitter') return p.owned.glitter;
  return p.owned[kind].includes(ref);
}
function validLook(p, { char, outfit, makeup, acc }) {
  const m = makeup || {};
  const okC = (list, kind, id) => list.some(c => c.id === id) && owns(p, kind, id) ? id : null;
  return {
    char: GD.CHARACTERS.find(c => c.id === char) && unlocked(p, char) ? char : p.char,
    outfit: (Number.isInteger(outfit) && outfit >= 0 && outfit < GD.OUTFIT_STYLES.length) && owns(p, 'outfit', outfit) ? outfit : p.outfit,
    makeup: {
      lip: okC(GD.LIP_COLORS, 'lip', m.lip), lipA: Math.min(1, Math.max(0.2, +m.lipA || 0.7)),
      blush: okC(GD.BLUSH_COLORS, 'blush', m.blush), shadow: okC(GD.SHADOW_COLORS, 'shadow', m.shadow),
      glitter: !!m.glitter && owns(p, 'glitter', true),
    },
    acc: GD.ACCESSORIES.some(a => a.id === acc) && owns(p, 'acc', acc) ? acc : null,
  };
}
let flowerQueen = null;
function pub(p) {
  return { id: p.id, name: p.name, char: p.char, outfit: p.outfit, makeup: p.makeup, acc: p.acc, room: p.room, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, tips: p.tips, rank: GD.rankOf(p.tips).name, queen: flowerQueen === p.key };
}
function privateProfile(p) {
  return { name: p.name, char: p.char, outfit: p.outfit, makeup: p.makeup, acc: p.acc, tips: p.tips, wallet: p.wallet, dayTips: p.dayTips, owned: p.owned, inv: p.inv, buff: p.buff, quests: p.quests, flowersDay: p.flowersDay, streak: p.streak };
}
const pubCust = c => ({ id: c.id, room: c.room, x: c.x, y: c.y, type: c.type, busy: !!c.busyBy, away: c.awayUntil > Date.now() });
const sendCustomers = () => io.emit('customers', customers.map(pubCust));
function toast(text, kind = 'info') { io.emit('toast', { text, kind }); }
function ticker(text) { io.emit('ticker', text); }
function sendMe(socket, p) { socket.emit('me', privateProfile(p)); }
async function broadcastTop() {
  const top = await store.top(10);
  const flowers = F('gifts') ? await store.topFlowers(today(), 5) : [];
  const q = flowers[0] ? keyOf(flowers[0].name) : null;
  if (q !== flowerQueen) { flowerQueen = q; for (const p of players.values()) io.emit('pinfo', { id: p.id, queen: flowerQueen === p.key }); }
  io.emit('top', { tips: top, flowers });
}
function addTip(p, amount, socket) {
  p.tips += amount; p.wallet += amount;
  ensureDay(p); p.dayTips += amount;
  questAdd(p, 'earn500', p.dayTips, socket);
  io.emit('tipfx', { id: p.id, tip: amount, tips: p.tips, rank: GD.rankOf(p.tips).name });
  const oldRank = GD.rankOf(p.tips - amount).name, nr = GD.rankOf(p.tips);
  if (oldRank !== nr.name) { toast(`${nr.icon} ${p.name} vừa lên hạng ${nr.name}!`, 'big'); ticker(`${nr.icon} ${p.name} lên hạng ${nr.name}`); }
  if (F('locks')) for (const c of GD.CHARACTERS) if (c.unlock && p.tips >= c.unlock && p.tips - amount < c.unlock) socket && socket.emit('toast', { text: `🔓 Mở khóa nhân vật mới: ${c.name} – ${c.tag}!`, kind: 'big' });
}

io.on('connection', socket => {
  let me = null, acct = null;

  socket.on('login', async ({ name, pin }, cb) => {
    try {
      if (typeof cb !== 'function') return;
      name = clean(name).slice(0, 16); pin = String(pin || '').trim();
      if (!name || !/^\d{4}$/.test(pin)) return cb({ error: 'Nhập tên và mã PIN 4 số nha' });
      const key = keyOf(name);
      for (const p of players.values()) if (p.key === key) return cb({ error: 'Tên này đang online rồi' });
      let saved = await store.get(key);
      if (saved && saved.pin !== hashPin(key, pin)) return cb({ error: 'Sai mã PIN rồi bà ơi' });
      const isNew = !saved;
      if (!saved) saved = { key, name, pin: hashPin(key, pin), char: 'linh', outfit: 0, tips: 0, wallet: 0, day: today(), dayTips: 0 };
      acct = normalize(saved);
      ensureDay(acct);
      let loginBonus = 0;
      if (acct.loginDay !== today()) {
        acct.streak = acct.loginDay === vnDate(-86400e3) ? acct.streak + 1 : 1;
        acct.loginDay = today();
        if (F('quests')) { loginBonus = 50 * Math.min(7, acct.streak); acct.wallet += loginBonus; }
      }
      await saveP(acct);
      cb({ ok: true, isNew, loginBonus, features: FEATURES, profile: privateProfile(acct) });
    } catch (e) { console.error(e); cb({ error: 'Lỗi server, thử lại nha' }); }
  });

  socket.on('enter', async ({ char, outfit }, cb) => {
    if (!acct || me || typeof cb !== 'function') return;
    for (const p of players.values()) if (p.key === acct.key) return cb({ error: 'Tên này đang online rồi' });
    if (!GD.CHARACTERS.find(c => c.id === char)) char = acct.char;
    if (!unlocked(acct, char)) return cb({ error: 'Nhân vật này chưa mở khóa' });
    acct.char = char;
    if ((Number.isInteger(outfit) && outfit >= 0 && outfit < GD.OUTFIT_STYLES.length) && owns(acct, 'outfit', outfit)) acct.outfit = outfit;
    const [sx, sy] = GD.ROOMS.hall.spawn;
    me = Object.assign(acct, { id: socket.id, room: 'hall', x: sx + (Math.random() * 120 - 60), y: sy, dir: 1, moving: false, session: null, chatAt: 0, emote: null, emoteAt: 0, karaoke: null, karaokeAt: 0 });
    players.set(socket.id, me);
    await saveP(me);
    cb({ ok: true, me: pub(me), profile: privateProfile(me), players: [...players.values()].map(pub), customers: customers.map(pubCust), event: event && { until: event.until } });
    socket.broadcast.emit('join', pub(me));
    ticker(`✨ ${me.name} vừa vào ca`);
    broadcastTop();
  });

  socket.on('move', d => {
    if (!me || me.session || me.karaoke) return;
    const x = +d.x, y = +d.y;
    if (!isFinite(x) || !isFinite(y)) return;
    if (Math.hypot(x - me.x, y - me.y) > 140) return socket.emit('fix', { room: me.room, x: me.x, y: me.y });
    me.x = Math.max(0, Math.min(GD.BW, x)); me.y = Math.max(0, Math.min(GD.BH, y));
    me.dir = d.dir === -1 ? -1 : 1; me.moving = !!d.moving;
  });

  socket.on('goRoom', ({ room }) => {
    if (!me || me.session || me.karaoke || !GD.ROOMS[room]) return;
    if (me.room === 'hall') {
      const door = GD.ROOMS.hall.doors.find(d => d.id === room);
      if (!door || Math.hypot(door.x - me.x, door.y - me.y) > GD.DOOR_RANGE + 60) return;
      if (ghen && ghen.room === room) return socket.emit('toast', { text: 'Trong đó đang có biến, đừng vô! 🩴', kind: 'warn' });
      me.room = room; [me.x, me.y] = GD.ROOMS[room].spawn; me.x += Math.random() * 100 - 50;
    } else if (room === 'hall') {
      const door = GD.ROOMS.hall.doors.find(d => d.id === me.room);
      me.room = 'hall'; me.x = door.x; me.y = door.y + 70;
    } else return;
    me.emote = null;
    io.emit('moved', { id: me.id, room: me.room, x: me.x, y: me.y });
  });

  socket.on('chat', text => {
    if (!me) return;
    text = clean(text).slice(0, 80);
    if (!text || Date.now() - me.chatAt < 800) return;
    me.chatAt = Date.now();
    io.emit('chat', { id: me.id, name: me.name, text });
  });

  socket.on('look', async look => {
    if (!me) return;
    if (me.room !== 'makeup') return socket.emit('toast', { text: 'Vô Phòng Trang Điểm mới đổi đồ được nha', kind: 'warn' });
    Object.assign(me, validLook(me, look || {}));
    await saveP(me);
    io.emit('look', { id: me.id, char: me.char, outfit: me.outfit, makeup: me.makeup, acc: me.acc });
    sendMe(socket, me);
  });

  // ---- Shop ----
  socket.on('buy', async ({ id }, cb) => {
    if (!me || !F('shop') || typeof cb !== 'function') return;
    const it = GD.SHOP.find(s => s.id === id);
    if (!it) return cb({ error: 'Không có món này' });
    if (it.kind !== 'item' && owns(me, it.kind, it.ref)) return cb({ error: 'Bạn có món này rồi' });
    if (me.wallet < it.price) return cb({ error: `Không đủ tiền, cần ${it.price}k` });
    me.wallet -= it.price;
    if (it.kind === 'outfit') me.owned.outfits.push(it.ref);
    else if (it.kind === 'acc') me.owned.acc.push(it.ref);
    else if (it.kind === 'glitter') me.owned.glitter = true;
    else if (it.kind === 'item') me.inv[it.ref]++;
    else me.owned[it.kind].push(it.ref);
    questAdd(me, 'buy1', 1, socket);
    await saveP(me);
    sendMe(socket, me);
    cb({ ok: true });
  });

  // ---- Phục vụ khách ----
  socket.on('serve:start', ({ customerId }) => {
    if (!me || me.session || me.karaoke) return;
    const c = customers.find(c => c.id === customerId);
    if (!c || c.room !== me.room) return;
    if (c.awayUntil > Date.now()) return socket.emit('toast', { text: 'Khách đang vắng (bị vợ lôi về 😅)', kind: 'warn' });
    if (c.busyBy) return socket.emit('toast', { text: 'Có người đang phục vụ khách này rồi', kind: 'warn' });
    if (Math.hypot(me.x - c.x, me.y - c.y) > 330) return socket.emit('toast', { text: 'Lại gần khách hơn chút', kind: 'warn' });
    if (ghen && ghen.room === c.room) return;
    const ch = charOf(me.char);
    const ms = ROUND_MS + ((ch.perks && ch.perks.roundMs) || 0);
    me.session = { customerId: c.id, reqs: shuffle(GD.REQUESTS).slice(0, ROUNDS), i: 0, correct: 0, combo: 0, maxCombo: 0, round: null, ms };
    c.busyBy = me.id;
    sendCustomers();
    socket.emit('serve:begin', { customerId: c.id, type: c.type, total: ROUNDS, room: me.room, buff: !!me.buff.bia, event: !!(event && me.room === 'vip') });
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

  // ---- Karaoke ----
  socket.on('karaoke:start', (_, cb) => {
    if (!me || !F('karaoke') || typeof cb !== 'function' || me.session || me.karaoke) return;
    if ((GD.ROOMS[me.room] || {}).kind !== 'ktv') return cb({ error: 'Vô phòng karaoke mới hát được' });
    const wait = Math.ceil((me.karaokeAt + 40000 - Date.now()) / 1000);
    if (wait > 0) return cb({ error: `Nghỉ giọng ${wait} giây nữa nha` });
    const notes = []; let t = 1800;
    for (let i = 0; i < 22; i++) { notes.push({ lane: Math.floor(Math.random() * 3), t }); t += pick([400, 600, 600, 800]); }
    me.karaoke = { notes, startedAt: Date.now() };
    cb({ ok: true, notes, len: t + 800 });
    io.emit('emote', { id: me.id, e: 'hat', until: Date.now() + t + 800 });
  });
  socket.on('karaoke:end', async ({ hits }) => {
    const k = me && me.karaoke; if (!k) return;
    me.karaoke = null; me.karaokeAt = Date.now();
    io.emit('emote', { id: me.id, e: null, until: 0 });
    const elapsed = Date.now() - k.startedAt, last = k.notes[k.notes.length - 1].t;
    if (!Array.isArray(hits) || elapsed < last * 0.8) return socket.emit('karaoke:result', { score: 0, tip: 0, judge: 'Hát gì mà nhanh vậy???' });
    hits = hits.slice(0, 80).filter(h => h && [0, 1, 2].includes(h.lane) && isFinite(h.t));
    const used = new Set(); let sum = 0;
    for (const n of k.notes) {
      let best = -1, bd = 999;
      hits.forEach((h, i) => { if (!used.has(i) && h.lane === n.lane) { const d = Math.abs(h.t - n.t); if (d < bd) { bd = d; best = i; } } });
      if (best >= 0 && bd <= 260) { used.add(best); sum += bd <= 110 ? 1 : 0.6; }
    }
    const extra = hits.length - used.size;
    const score = Math.max(0, Math.min(100, Math.round(100 * sum / k.notes.length - extra * 2)));
    const tip = score >= 30 ? Math.round(score * 1.5) : 0;
    const judge = GD.KARAOKE_JUDGE.find(([min]) => score >= min)[1];
    if (tip) addTip(me, tip, socket);
    if (score >= 80) questAdd(me, 'sing80', 1, socket);
    await saveP(me);
    socket.emit('karaoke:result', { score, tip, judge });
    sendMe(socket, me);
    io.emit('chat', { id: me.id, name: '🎤', text: `${score} điểm!` });
    if (score >= 90) ticker(`🎤 ${me.name} hát được ${score} điểm ở ${roomName(me.room)}!`);
    broadcastTop();
  });

  // ---- Biểu diễn ----
  socket.on('emote', ({ e }) => {
    if (!me || !F('emotes') || me.session || me.karaoke) return;
    const def = GD.EMOTES.find(x => x.id === e); if (!def) return;
    if (Date.now() - me.emoteAt < 1500) return;
    me.emoteAt = Date.now(); me.emote = e;
    io.emit('emote', { id: me.id, e, until: Date.now() + def.ms });
    questAdd(me, 'emote5', 1, socket);
  });

  socket.on('firework', async () => {
    if (!me || !F('fireworks')) return;
    if (me.inv.phaohoa < 1) return socket.emit('toast', { text: 'Hết pháo hoa rồi, ra shop mua thêm nha 🎆', kind: 'warn' });
    me.inv.phaohoa--; await saveP(me); sendMe(socket, me);
    io.emit('firework', { room: me.room, id: me.id, name: me.name });
    ticker(`🎆 ${me.name} bắn pháo hoa ở ${roomName(me.room)}!`);
  });

  socket.on('gift', async ({ to, kind, amount }, cb) => {
    if (!me || !F('gifts') || typeof cb !== 'function') return;
    const r = players.get(to);
    if (!r || r === me) return cb({ error: 'Người này không còn online' });
    if (kind === 'hoa') {
      if (me.inv.hoa < 1) { if (me.wallet < 50) return cb({ error: 'Không đủ 50k mua hoa' }); me.wallet -= 50; } else me.inv.hoa--;
      ensureDay(r); r.flowersDay++;
      questAdd(me, 'gift1', 1, socket);
      io.emit('giftfx', { from: me.id, to: r.id, kind: 'hoa' });
      ticker(`💐 ${me.name} tặng hoa cho ${r.name}`);
    } else if (kind === 'tip') {
      amount = Math.floor(+amount);
      if (!(amount >= 10 && amount <= 1000)) return cb({ error: 'Tặng từ 10k đến 1000k thôi' });
      if (me.wallet < amount) return cb({ error: 'Ví không đủ tiền' });
      me.wallet -= amount; r.wallet += amount;
      io.emit('giftfx', { from: me.id, to: r.id, kind: 'tip', amount });
      ticker(`💸 ${me.name} bo ${amount}k cho ${r.name}`);
    } else return;
    await saveP(me); await saveP(r);
    sendMe(socket, me); const rs = io.sockets.sockets.get(r.id); if (rs) { sendMe(rs, r); rs.emit('toast', { text: kind === 'hoa' ? `💐 ${me.name} tặng hoa cho bạn!` : `💸 ${me.name} bo bạn ${amount}k!`, kind: 'big' }); }
    cb({ ok: true });
    broadcastTop();
  });

  socket.on('quest:claim', async ({ id }) => {
    if (!me || !F('quests')) return;
    ensureDay(me);
    const q = me.quests.list.find(q => q.id === id), def = GD.QUESTS.find(d => d.id === id);
    if (!q || q.claimed || q.p < def.goal) return;
    q.claimed = true; me.wallet += def.reward;
    await saveP(me); sendMe(socket, me);
    socket.emit('toast', { text: `🎁 Nhận ${def.reward}k vào ví!`, kind: 'big' });
  });

  // ---- Đánh ghen ----
  socket.on('ghen:choose', async ({ choice }) => {
    if (!me || !ghen || !ghen.victims.has(me.id) || ghen.res.has(me.id)) return;
    const c = GD.GHEN_CHOICES.find(c => c.id === choice); if (!c) return;
    if (!F('ghenV2') && !c.run) return;
    if (c.run) { ghen.running.add(me.id); return socket.emit('ghen:run', { taps: (charOf(me.char).perks || {}).runTaps || GD.RUN_TAPS }); }
    const win = Math.random() < c.chance;
    ghen.res.set(me.id, win ? 'safe' : 'caught');
    if (win) {
      if (c.cost) me.wallet = Math.max(0, me.wallet - c.cost);
      if (c.bonus) addTip(me, c.bonus, socket);
      questAdd(me, 'ghen', 1, socket);
      await saveP(me);
    }
    socket.emit('ghen:result', { safe: win, text: win ? c.win : c.lose });
  });
  socket.on('ghen:tap', () => {
    if (!me || !ghen || !ghen.running.has(me.id) || ghen.res.has(me.id)) return;
    const n = (ghen.taps.get(me.id) || 0) + 1; ghen.taps.set(me.id, n);
    if (n >= ((charOf(me.char).perks || {}).runTaps || GD.RUN_TAPS)) { ghen.res.set(me.id, 'safe'); questAdd(me, 'ghen', 1, socket); socket.emit('ghen:result', { safe: true, text: 'Chạy thoát! Núp sau quầy lễ tân thở hổn hển...' }); }
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
  s.round = { correct: options.indexOf(r.ok), deadline: Date.now() + s.ms + 400 };
  socket.emit('serve:round', { n: s.i + 1, total: ROUNDS, ask: r.ask, options, ms: s.ms });
}
function endSession(p, cancelled) {
  const c = customers.find(c => c.id === p.session.customerId);
  if (c) { c.busyBy = null; if (!cancelled) c.awayUntil = Date.now() + 15000; }
  p.session = null;
  sendCustomers();
}
async function finishServe(socket, p) {
  const s = p.session, c = customers.find(c => c.id === s.customerId), t = GD.CUSTOMER_TYPES[c.type];
  const lines = [];
  let tip = Math.round(t.base * (s.correct / ROUNDS));
  if (s.correct > 0) lines.push(`Phục vụ đúng ${s.correct}/${ROUNDS} yêu cầu: +${tip}k`);
  if (s.maxCombo >= ROUNDS) { const b = Math.round(t.base * 0.3); tip += b; lines.push(`Combo hoàn hảo: +${b}k`); questAdd(p, 'perfect', 1, socket); }
  if (s.correct > 0) {
    if (t.likesOutfit.includes(p.outfit)) { const b = Math.round(t.base * 0.3); tip += b; lines.push(`Đúng gu trang phục (${GD.OUTFIT_STYLES[p.outfit]}): +${b}k`); }
    if (p.makeup.lip === t.likesLip) { const b = Math.round(t.base * 0.2); tip += b; lines.push(`Đúng màu son khách thích: +${b}k`); }
    const done = [p.makeup.lip, p.makeup.blush, p.makeup.shadow].filter(Boolean).length;
    if (done === 3) { const b = Math.round(t.base * 0.1); tip += b; lines.push(`Trang điểm đầy đủ: +${b}k`); }
    if (p.acc) { const b = Math.round(t.base * 0.1); tip += b; lines.push(`Phụ kiện sang chảnh: +${b}k`); }
    const mult = ((charOf(p.char).perks || {}).tip || {})[c.type];
    if (mult) { const b = Math.round(tip * (mult - 1)); tip += b; lines.push(`${charOf(p.char).name} – ${charOf(p.char).tag}: ${b >= 0 ? '+' : ''}${b}k`); }
    if (p.buff.bia) { const b = Math.round(tip * 0.2); tip += b; lines.push(`Bia mời khách: +${b}k`); }
    if (event && p.room === 'vip') { const b = tip; tip += b; lines.push(`💰 Đại Gia Bao Phòng x2: +${b}k`); event.participants.add(p.key); }
  }
  p.buff.bia = false;
  const mood = s.correct === ROUNDS ? 'love' : s.correct >= 2 ? 'ok' : 'mad';
  const say = mood === 'love' ? pick(['Em dễ thương quá, anh bao luôn!', 'Mai anh dắt bạn tới nữa nha!', 'Tip nè em, đừng khách sáo!'])
    : mood === 'ok' ? pick(['Cũng được, lần sau cố hơn nha em.', 'Tạm ổn, nhưng ly anh vẫn còn khô...'])
      : pick(['Em làm anh tỉnh rượu luôn rồi đó!', 'Thôi anh về với vợ còn hơn...', 'Quản lý đâu!!!']);
  endSession(p, false);
  if (tip > 0) addTip(p, tip, socket);
  questAdd(p, 'serve3', 1, socket); questAdd(p, 'serve5', 1, socket);
  await saveP(p);
  socket.emit('serve:result', { tip, lines, mood, say, tips: p.tips, wallet: p.wallet, rank: GD.rankOf(p.tips).name });
  sendMe(socket, p);
  if (tip >= 200) ticker(`💸 ${p.name} vừa được ${t.name} bo ${tip}k!`);
  broadcastTop();
}

// ---------- Đánh ghen ----------
function scheduleGhen() { setTimeout(startGhen, (GHEN_MIN + Math.random() * (GHEN_MAX - GHEN_MIN)) * 1000); }
async function startGhen() {
  const rooms = ['p1', 'p2', 'vip'].filter(r => [...players.values()].some(p => p.room === r) && customers.some(c => c.room === r && c.awayUntil < Date.now()));
  if (!rooms.length || ghen) return scheduleGhen();
  const room = pick(rooms);
  const c = pick(customers.filter(c => c.room === room && c.awayUntil < Date.now()));
  const victims = [...players.values()].filter(p => p.room === room);
  ghen = { room, customer: c.id, victims: new Set(victims.map(p => p.id)), res: new Map(), running: new Set(), taps: new Map(), until: Date.now() + GHEN_MS };
  for (const p of victims) if (p.session) { endSession(p, true); io.to(p.id).emit('serve:end', { ghen: true }); }
  for (const p of victims) if (p.karaoke) { p.karaoke = null; io.to(p.id).emit('karaoke:abort'); }
  const cname = GD.CUSTOMER_TYPES[c.type].name;
  io.emit('ghen:start', { room, roomName: roomName(room), customerId: c.id, customerName: cname, victims: [...ghen.victims], ms: GHEN_MS, v2: F('ghenV2') });
  for (const p of victims) if (p.inv.baoke > 0) {
    p.inv.baoke--; ghen.res.set(p.id, 'safe'); questAdd(p, 'ghen', 1, io.sockets.sockets.get(p.id)); await saveP(p);
    io.to(p.id).emit('ghen:result', { safe: true, text: '🕴️ Anh bảo kê ra mặt, bà vợ quay về! (đã dùng 1 bảo kê)' });
    io.to(p.id).emit('me', privateProfile(p));
  }
  ticker(`🚨 Vợ ${cname} xông vào ${roomName(room)}!`);
  setTimeout(endGhen, GHEN_MS);
}
async function endGhen() {
  const g = ghen; ghen = null;
  const lost = [], safe = [];
  for (const id of g.victims) {
    const p = players.get(id); if (!p) continue;
    if (g.res.get(id) === 'safe') { safe.push(p.name); continue; }
    const loss = Math.min(300, Math.round(p.wallet * 0.05));
    p.wallet -= loss; lost.push(`${p.name} (-${loss}k)`);
    await saveP(p);
    io.to(id).emit('ghen:caught', { loss });
    io.to(id).emit('me', privateProfile(p));
    io.emit('tipfx', { id, tip: -loss, tips: p.tips, rank: GD.rankOf(p.tips).name });
  }
  customers.filter(c => c.id === g.customer).forEach(c => { c.awayUntil = Date.now() + 45000; c.busyBy = null; });
  sendCustomers();
  io.emit('ghen:end', { room: g.room, customerId: g.customer, safe, lost });
  toast(lost.length ? `🩴 Vợ khách bắt được: ${lost.join(', ')}` : safe.length ? '🏃‍♀️ Cả phòng thoát an toàn!' : '🩴 Vợ khách lôi chồng về rồi!', lost.length ? 'warn' : 'info');
  scheduleGhen();
}

// ---------- Sự kiện Đại Gia Bao Phòng ----------
function scheduleEvent() { setTimeout(startEvent, (EVENT_MIN + Math.random() * (EVENT_MAX - EVENT_MIN)) * 1000); }
function startEvent() {
  if (!F('event') || !players.size) return scheduleEvent();
  event = { until: Date.now() + EVENT_LEN * 1000, participants: new Set() };
  io.emit('event:start', { until: event.until, pool: EVENT_POOL });
  toast(`💰 ĐẠI GIA BAO PHÒNG VIP! Vô phục vụ trong ${EVENT_LEN / 60} phút: tip x2 + chia thưởng ${EVENT_POOL}k!`, 'big');
  ticker('💰 Đại Gia Bao Phòng VIP đang diễn ra!');
  setTimeout(endEvent, EVENT_LEN * 1000);
}
async function endEvent() {
  const e = event; event = null;
  const winners = [...players.values()].filter(p => e.participants.has(p.key));
  const share = winners.length ? Math.floor(EVENT_POOL / winners.length) : 0;
  for (const p of winners) { addTip(p, share, io.sockets.sockets.get(p.id)); await saveP(p); io.to(p.id).emit('me', privateProfile(p)); }
  io.emit('event:end', { winners: winners.map(p => p.name), share });
  toast(winners.length ? `💰 Đại gia chia ${share}k cho: ${winners.map(p => p.name).join(', ')}` : '💰 Đại gia về rồi, không ai phục vụ kịp 😢', 'big');
  broadcastTop();
  scheduleEvent();
}

// Gửi vị trí 10 lần/giây
setInterval(() => {
  if (!players.size) return;
  io.emit('state', [...players.values()].map(p => [p.id, p.room, Math.round(p.x), Math.round(p.y), p.dir, p.moving ? 1 : 0, p.session || p.karaoke ? 1 : 0]));
}, 100);
setInterval(sendCustomers, 5000);

(async () => {
  store = await createStore();
  scheduleGhen(); scheduleEvent();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log('KTV 2D chạy ở cổng ' + PORT));
})();
