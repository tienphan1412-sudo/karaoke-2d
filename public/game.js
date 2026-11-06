(function () {
  const $ = id => document.getElementById(id);
  const socket = io();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('vi-VN') + 'k';
  const rankIcon = name => (GD.RANKS.find(r => r.name === name) || GD.RANKS[0]).icon;
  const charOf = id => GD.CHARACTERS.find(c => c.id === id) || GD.CHARACTERS[0];

  let FEAT = {}, profile = null, myId = null, players = {}, customers = [], inOverlay = false, eventUntil = 0, ghenAnim = null;
  let assets = { chars: [], cust: [], bg: [], music: [] };
  const keys = {};
  let target = null, lastSent = 0, lastRoom = null, cam = { x: 800, y: 600 }, scale = 1;
  const fx = [], particles = [];
  const me = () => players[myId];
  const hasCust = f => assets.cust.includes(f);

  // ---------- Âm thanh ----------
  let soundOn = true, actx = null;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (actx && actx.state === 'suspended') actx.resume(); return actx; }
  function beep(freq, dur = 0.12, type = 'sine', vol = 0.15, when = 0) {
    const a = ac(); if (!a || !soundOn) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    coin() { beep(988, 0.08, 'square', 0.08); beep(1319, 0.2, 'square', 0.08, 0.08); },
    ok() { beep(660, 0.1, 'triangle'); beep(880, 0.15, 'triangle', 0.15, 0.08); },
    bad() { beep(200, 0.25, 'sawtooth', 0.08); },
    pop() { beep(500 + Math.random() * 400, 0.08, 'triangle', 0.1); },
    boom() { const a = ac(); if (!a || !soundOn) return; const b = a.createBuffer(1, a.sampleRate * 0.4, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); const s = a.createBufferSource(), g = a.createGain(); g.gain.value = 0.25; s.buffer = b; s.connect(g).connect(a.destination); s.start(); },
  };
  const Music = (() => {
    let audio = null, cur = null;
    function play(room) {
      if (audio) { audio.pause(); audio = null; }
      if (!soundOn || !room || !assets.music.length) return;
      audio = new Audio('/music/' + encodeURIComponent(assets.music[Math.floor(Math.random() * assets.music.length)]));
      audio.volume = 0.4; audio.onended = () => play(room); audio.play().catch(() => { });
    }
    return { room(r) { if (r === cur) return; cur = r; play(r); }, refresh() { play(cur); }, duck(v) { if (audio) audio.volume = v; } };
  })();
  $('bSound').onclick = () => { soundOn = !soundOn; $('bSound').textContent = soundOn ? '🔊' : '🔇'; Music.refresh(); };

  // ---------- Toast + ticker ----------
  function toast(text, kind = 'info') {
    const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = text;
    $('toasts').appendChild(d); setTimeout(() => d.remove(), kind === 'big' ? 5000 : 3500);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }
  const tickQ = []; let tickBusy = false;
  function ticker(text) { tickQ.push(text); if (tickQ.length > 6) tickQ.shift(); if (!tickBusy) nextTick(); }
  function nextTick() {
    const t = tickQ.shift(); const el = $('ticker');
    if (!t) { tickBusy = false; el.classList.remove('show'); return; }
    tickBusy = true; el.textContent = t; el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); setTimeout(nextTick, 400); }, 4000);
  }

  // ---------- Ảnh ----------
  const imgs = {};
  function img(src) { if (!imgs[src]) { const i = new Image(); i.src = src; imgs[src] = i; } const i = imgs[src]; return i.complete && i.naturalWidth ? i : null; }
  const bgImg = room => img('/bg/' + GD.ROOMS[room].bg + '.webp');
  const custImg = (type, mood) => hasCust(`${type}_${mood}.webp`) ? img(`/cust/${type}_${mood}.webp`) : null;
  const custArt = (type, mood) => hasCust(`${type}_${mood}.webp`) ? `<img src="/cust/${type}_${mood}.webp" alt="">` : Cartoons.customerSVG(type, mood);
  const wifeArt = () => hasCust('wife.webp') ? '<img src="/cust/wife.webp" alt="">' : Cartoons.wifeSVG();

  // =========================================================
  // ĐĂNG NHẬP
  // =========================================================
  try { const s = JSON.parse(localStorage.getItem('ktv2d') || '{}'); if (s.name) $('lname').value = s.name; } catch (e) { }
  Portrait.loadAssets().then(a => { assets = Object.assign(assets, a); Object.values(GD.ROOMS).forEach(r => img('/bg/' + r.bg + '.webp')); });
  $('lgo').onclick = () => {
    ac();
    $('lerr').textContent = '';
    socket.emit('login', { name: $('lname').value, pin: $('lpin').value }, res => {
      if (res.error) { $('lerr').textContent = res.error; return; }
      try { localStorage.setItem('ktv2d', JSON.stringify({ name: $('lname').value })); } catch (e) { }
      FEAT = res.features; profile = res.profile;
      $('login').classList.add('hidden');
      openSelect();
      if (res.loginBonus) toast(`🎁 Điểm danh ngày ${profile.streak}: +${res.loginBonus}k vào ví!`, 'big');
      if (res.isNew) toast(`Chào ${profile.name}! Chọn nhân vật rồi vào ca nha ✨`, 'big');
    });
  };
  $('lpin').addEventListener('keydown', e => { if (e.key === 'Enter') $('lgo').click(); });

  // =========================================================
  // CHỌN NHÂN VẬT (kiểu YABAI)
  // =========================================================
  let selIdx = 0, selOutfit = 0;
  const isLocked = c => FEAT.locks && profile.tips < c.unlock && profile.char !== c.id;
  const ownsOutfit = i => !FEAT.shop || profile.owned.outfits.includes(i);
  function openSelect() {
    selIdx = Math.max(0, GD.CHARACTERS.findIndex(c => c.id === profile.char));
    selOutfit = ownsOutfit(profile.outfit) ? profile.outfit : 0;
    $('select').classList.remove('hidden');
    $('selDots').innerHTML = GD.CHARACTERS.map(() => '<i></i>').join('');
    drawSelect();
  }
  function drawSelect() {
    const c = GD.CHARACTERS[selIdx], locked = isLocked(c);
    $('selWallet').textContent = '💰 ' + fmt(profile.wallet);
    $('selTips').textContent = rankIcon(GD.rankOf(profile.tips).name) + ' ' + fmt(profile.tips);
    $('selName').textContent = c.name.toUpperCase();
    $('selTag').textContent = c.tag;
    $('selStrong').textContent = c.strong; $('selWeak').textContent = c.weak; $('selStory').textContent = c.story;
    [...$('selDots').children].forEach((d, i) => d.classList.toggle('on', i === selIdx));
    document.querySelector('.stage').classList.toggle('locked', locked);
    $('selLock').classList.toggle('hidden', !locked);
    const seg = $('selOutfit'); seg.innerHTML = '';
    GD.OUTFIT_STYLES.forEach((s, i) => {
      const b = document.createElement('button'); const own = ownsOutfit(i);
      b.textContent = (own ? '' : '🔒 ') + s; if (i === selOutfit) b.className = 'on'; if (!own) b.classList.add('locked');
      b.onclick = () => { if (!own) return toast('Mua bộ này trong Shop 🛍️ sau khi vào ca nha', 'warn'); selOutfit = i; drawSelect(); };
      seg.append(b);
    });
    const go = $('selGo');
    go.disabled = locked;
    go.textContent = locked ? `🔒 ${fmt(Math.min(profile.tips, c.unlock))} / ${fmt(c.unlock)} TỔNG TIP` : 'VÀO CA ✨';
    Portrait.render($('selChar'), { char: c.id, outfit: selOutfit, makeup: c.id === profile.char ? profile.makeup : {}, acc: c.id === profile.char ? profile.acc : null }, 'full');
  }
  $('selPrev').onclick = () => { selIdx = (selIdx + GD.CHARACTERS.length - 1) % GD.CHARACTERS.length; drawSelect(); };
  $('selNext').onclick = () => { selIdx = (selIdx + 1) % GD.CHARACTERS.length; drawSelect(); };
  let swipeX = null;
  document.querySelector('.stage').addEventListener('pointerdown', e => swipeX = e.clientX);
  document.querySelector('.stage').addEventListener('pointerup', e => { if (swipeX !== null && Math.abs(e.clientX - swipeX) > 40) (e.clientX < swipeX ? $('selNext') : $('selPrev')).click(); swipeX = null; });
  $('selGo').onclick = () => {
    $('selErr').textContent = '';
    socket.emit('enter', { char: GD.CHARACTERS[selIdx].id, outfit: selOutfit }, res => {
      if (res.error) { $('selErr').textContent = res.error; return; }
      myId = res.me.id; profile = res.profile; players = {};
      res.players.forEach(addPlayer);
      customers = res.customers;
      if (res.event) startEventBar(res.event.until);
      $('select').classList.add('hidden'); $('hud').classList.remove('hidden');
      applyFeatures(); updateHud();
      setTimeout(() => toast('Mẹo: bấm vào cửa phòng 101, 102, 103 để vào phục vụ khách 💸', 'info'), 1500);
    });
  };
  function applyFeatures() {
    $('bEmote').classList.toggle('hidden', !FEAT.emotes);
    $('bFire').classList.toggle('hidden', !FEAT.fireworks);
    $('bQuest').classList.toggle('hidden', !FEAT.quests);
    $('bShop').classList.toggle('hidden', !FEAT.shop);
    document.querySelector('#rankTabs [data-t=flowers]').classList.toggle('hidden', !FEAT.gifts);
  }

  function addPlayer(p) { players[p.id] = Object.assign(players[p.id] || {}, p, { rx: p.x, ry: p.y, phase: 0, chat: null, emote: null, spin: 0 }); }
  function updateHud() {
    const m = me(); if (!m || !profile) return;
    $('hName').textContent = (m.queen ? '👑 ' : '') + profile.name;
    $('hRank').textContent = rankIcon(GD.rankOf(profile.tips).name) + ' ' + GD.rankOf(profile.tips).name;
    $('hWallet').textContent = '💰 ' + fmt(profile.wallet);
    $('hTips').textContent = '⭐ ' + fmt(profile.tips);
    $('fireCount').textContent = profile.inv.phaohoa;
    const ready = FEAT.quests && profile.quests && profile.quests.list.filter(q => !q.claimed && q.p >= GD.QUESTS.find(d => d.id === q.id).goal).length;
    $('questBadge').textContent = ready || ''; $('questBadge').classList.toggle('hidden', !ready);
    Portrait.render($('avatar'), { char: m.char, outfit: m.outfit, makeup: m.makeup, acc: m.acc }, 'face');
    if (!$('shop').classList.contains('hidden')) buildShop();
    if (!$('quests').classList.contains('hidden')) buildQuests();
  }

  // =========================================================
  // SOCKET
  // =========================================================
  socket.on('join', addPlayer);
  socket.on('leave', id => delete players[id]);
  socket.on('state', list => {
    for (const [id, room, x, y, dir, moving, serving] of list) {
      const p = players[id]; if (!p) continue;
      p.serving = !!serving;
      if (id === myId) continue;
      if (p.room !== room) { p.room = room; p.rx = x; p.ry = y; }
      p.x = x; p.y = y; p.dir = dir; p.moving = !!moving;
    }
  });
  socket.on('moved', ({ id, room, x, y }) => { const p = players[id]; if (!p) return; Object.assign(p, { room, x, y, rx: x, ry: y }); if (id === myId) target = null; });
  socket.on('fix', ({ room, x, y }) => { const m = me(); if (m) Object.assign(m, { room, x, y, rx: x, ry: y }); });
  socket.on('customers', list => customers = list);
  socket.on('chat', ({ id, text }) => { const p = players[id]; if (p) p.chat = { text, until: Date.now() + 5000 }; });
  socket.on('look', ({ id, char, outfit, makeup, acc }) => { const p = players[id]; if (!p) return; Object.assign(p, { char, outfit, makeup, acc, spin: performance.now() }); if (p.room === (me() || {}).room) { sparkle(p); sfx.pop(); } if (id === myId) updateHud(); });
  socket.on('pinfo', ({ id, queen }) => { const p = players[id]; if (p) { p.queen = queen; if (id === myId) updateHud(); } });
  socket.on('me', p => { profile = p; updateHud(); });
  socket.on('quests', q => { if (profile) { profile.quests = q; updateHud(); } });
  socket.on('toast', t => toast(t.text, t.kind));
  socket.on('ticker', ticker);
  let topData = { tips: [], flowers: [] }, rankTab = 'tips';
  socket.on('top', d => { topData = d; buildRank(); });
  socket.on('tipfx', ({ id, tip, tips, rank }) => {
    const p = players[id]; if (!p) return;
    p.tips = tips; p.rank = rank;
    fx.push({ id, text: (tip >= 0 ? '+' : '') + tip + 'k', color: tip >= 0 ? '#7dffb0' : '#ff6a6a', t: Date.now() });
    if (id === myId && tip > 0) sfx.coin();
  });
  socket.on('emote', ({ id, e, until }) => { const p = players[id]; if (!p) return; p.emote = e ? { e, until, start: performance.now() } : null; if ((e === 'hat' || e === 'nhay') && Portrait.poseFile(p.char, e) && p.room === (me() || {}).room) { p.spin = performance.now(); sparkle(p); } });
  socket.on('firework', ({ room, name }) => { const m = me(); if (m && m.room === room) launchFireworks(); });
  socket.on('giftfx', ({ from, to, kind, amount }) => { const a = players[from], b = players[to], m = me(); if (a && b && m && a.room === m.room) fx.push({ fly: true, from, to, text: kind === 'hoa' ? '💐' : '💸', t: Date.now() }); });
  socket.on('disconnect', () => toast('Mất kết nối, đang thử lại...', 'warn'));
  socket.on('connect', () => { if (myId) location.reload(); });

  // =========================================================
  // ĐIỀU KHIỂN
  // =========================================================
  addEventListener('keydown', e => {
    if (karaState && !karaState.done && ['a', 's', 'd', 'j', 'k', 'l'].includes(e.key.toLowerCase())) { e.preventDefault(); karaHit({ a: 0, s: 1, d: 2, j: 0, k: 1, l: 2 }[e.key.toLowerCase()]); return; }
    if (document.activeElement === $('chatIn')) { if (e.key === 'Escape') $('chatIn').blur(); return; }
    if (ghenState && ghenState.running && e.code === 'Space') { e.preventDefault(); ghenTap(); return; }
    if (inOverlay || !myId) return;
    if (e.key === 'Enter') { e.preventDefault(); $('chatIn').focus(); return; }
    if ((e.key === 'e' || e.key === 'E') && !$('actBtn').classList.contains('hidden')) { $('actBtn').click(); return; }
    keys[e.key.toLowerCase()] = true; target = null;
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  const toWorld = (sx, sy) => ({ x: (sx - innerWidth / 2) / scale + cam.x, y: (sy - innerHeight / 2) / scale + cam.y });
  const cvs = $('map'), ctx = cvs.getContext('2d');
  cvs.addEventListener('pointerdown', e => {
    if (!myId || inOverlay) return;
    $('chatIn').blur(); $('emoteWheel').classList.add('hidden'); $('pmenu').classList.add('hidden');
    const w = toWorld(e.clientX, e.clientY), m = me();
    // bấm vào người chơi khác
    for (const id in players) {
      const p = players[id]; if (id === myId || p.room !== m.room) continue;
      const h = GD.charHeight(p.ry);
      if (Math.abs(w.x - p.rx) < h * 0.22 && w.y < p.ry + 10 && w.y > p.ry - h) { openPMenu(p, e.clientX, e.clientY); return; }
    }
    // bấm vào cửa
    if (m.room === 'hall') {
      for (const d of GD.ROOMS.hall.doors) if (Math.abs(w.x - d.x) < 55 && w.y < d.y + 20 && w.y > d.y - 240) { target = { x: d.x, y: d.y + 30, door: d.id }; return; }
    }
    target = { x: w.x, y: w.y };
  });
  $('chatForm').onsubmit = e => { e.preventDefault(); const t = $('chatIn').value.trim(); if (t) socket.emit('chat', t); $('chatIn').value = ''; $('chatIn').blur(); };
  $('bExit').onclick = () => socket.emit('goRoom', { room: 'hall' });

  function walkable(room, x, y) { return GD.inPoly(x, y, GD.ROOMS[room].floor); }
  function updateMe(dt) {
    const m = me(); if (!m) return;
    let dx = 0, dy = 0;
    const busy = inOverlay || m.serving;
    if (!busy) {
      if (keys['arrowleft'] || keys['a']) dx -= 1; if (keys['arrowright'] || keys['d']) dx += 1;
      if (keys['arrowup'] || keys['w']) dy -= 1; if (keys['arrowdown'] || keys['s']) dy += 1;
      if (!dx && !dy && target) {
        const tx = target.x - m.x, ty = target.y - m.y, d = Math.hypot(tx, ty);
        if (d < 8) { if (target.door) enterDoor(target.door); target = null; } else { dx = tx / d; dy = ty / d; }
      }
    }
    const len = Math.hypot(dx, dy);
    m.moving = len > 0;
    if (len) {
      dx /= len; dy /= len;
      const sp = 260 * (0.75 + 0.35 * (m.y - 300) / 585);
      const nx = m.x + dx * sp * dt, ny = m.y + dy * sp * dt * 0.8;
      let moved = false;
      if (walkable(m.room, nx, ny)) { m.x = nx; m.y = ny; moved = true; }
      else if (walkable(m.room, nx, m.y)) { m.x = nx; moved = true; }
      else if (walkable(m.room, m.x, ny)) { m.y = ny; moved = true; }
      if (!moved && target) { if (target.door) enterDoor(target.door); target = null; }
      if (dx) m.dir = dx < 0 ? -1 : 1;
      if (m.emote && m.emote.e !== 'hat') m.emote = null;
    }
    m.rx = m.x; m.ry = m.y;
    const now = performance.now();
    if (now - lastSent > 90) { lastSent = now; socket.emit('move', { x: m.x, y: m.y, dir: m.dir, moving: m.moving }); }
    if (m.room !== lastRoom) {
      lastRoom = m.room; const r = GD.ROOMS[m.room];
      $('roomLabel').textContent = r.name; $('roomLabel').style.color = r.neon;
      $('bExit').classList.toggle('hidden', m.room === 'hall');
      Music.room(r.kind === 'ktv' ? m.room : null);
      cam.x = m.x; cam.y = m.y;
    }
    updateAction(m);
  }
  function enterDoor(id) {
    if (id === 'closed') return toast('🚧 Phòng 105 đang sửa máy lạnh, quay lại sau nha', 'warn');
    socket.emit('goRoom', { room: id });
  }

  let actFn = null;
  function updateAction(m) {
    let label = null; actFn = null;
    const room = GD.ROOMS[m.room];
    if (!inOverlay && !m.serving) {
      const near = (p, r) => Math.hypot(p[0] - m.x, p[1] - m.y) < r;
      if (m.room === 'hall') {
        let best = null, bd = 120;
        for (const d of room.doors) { const dd = Math.hypot(d.x - m.x, d.y + 30 - m.y); if (dd < bd) { bd = dd; best = d; } }
        if (best) { label = best.id === 'closed' ? '🚧 Phòng 105 đang sửa' : `🚪 Vào phòng ${best.label}`; actFn = () => enterDoor(best.id); }
      } else if (room.kind === 'ktv') {
        let best = null, bd = 330;
        for (const c of customers) { if (c.room !== m.room || c.away) continue; const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < bd) { bd = d; best = c; } }
        if (best) {
          const t = GD.CUSTOMER_TYPES[best.type];
          if (best.busy) label = `${t.name} đang có người phục vụ`;
          else { label = `🍻 Phục vụ ${t.name}`; actFn = () => socket.emit('serve:start', { customerId: best.id }); }
        }
        if (FEAT.karaoke && near(room.kiosk, 230) && (!best || Math.hypot(room.kiosk[0] - m.x, room.kiosk[1] - m.y) < bd)) { label = '🎤 Hát karaoke chấm điểm'; actFn = startKaraoke; }
      } else if (m.room === 'makeup') {
        if (near(room.vanity, 240)) { label = '💄 Trang điểm / Thay đồ'; actFn = openMakeup; }
        else if (near(room.rack, 240)) { label = FEAT.shop ? '🛍️ Mua sắm' : '💄 Thay đồ'; actFn = FEAT.shop ? openShop : openMakeup; }
      }
    }
    const b = $('actBtn');
    if (label) { b.textContent = label; b.classList.remove('hidden'); b.disabled = !actFn; }
    else b.classList.add('hidden');
  }
  $('actBtn').onclick = () => { if (actFn) actFn(); };

  // =========================================================
  // VẼ
  // =========================================================
  const fxc = $('fx'), fctx = fxc.getContext('2d');
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [cvs, fxc]) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(innerWidth / GD.BW, innerHeight / GD.BH);
  }
  addEventListener('resize', resize); resize();

  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
  function bubble(x, y, text, maxW = 220) {
    ctx.font = '600 15px "Be Vietnam Pro", sans-serif';
    const words = text.split(' '), lines = [''];
    for (const w of words) { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (ctx.measureText(t).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; }
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22, h = lines.length * 19 + 12;
    rr(ctx, x - w / 2, y - h - 8, w, h, 12); ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 7, y - 9); ctx.lineTo(x + 7, y - 9); ctx.lineTo(x, y); ctx.fill();
    ctx.fillStyle = '#222'; ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, x, y - h + 12 + i * 19));
  }
  function nameTag(x, y, text, color = '#fff') {
    ctx.font = '800 15px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 18;
    rr(ctx, x - w / 2, y - 18, w, 24, 12); ctx.fillStyle = 'rgba(15,8,25,.72)'; ctx.fill();
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  function drawCustomer(c, t) {
    if (c.away && !(ghenAnim && ghenAnim.customerId === c.id)) return;
    let x = c.x, y = c.y, mood = 'ok', alpha = 1;
    if (ghenAnim && ghenAnim.customerId === c.id) {
      mood = 'mad';
      if (ghenAnim.drag) { const k = Math.min(1, (performance.now() - ghenAnim.drag) / 1800); x = c.x + (800 - c.x) * k; y = c.y + (980 - c.y) * k; }
    }
    const h = GD.charHeight(Math.max(y, 330)) * 0.72;
    const im = custImg(c.type, mood);
    ctx.save(); ctx.globalAlpha = alpha;
    const sway = Math.sin(t / 700 + c.x) * 0.02;
    ctx.translate(x, y); ctx.rotate(sway);
    if (im) { const w = h * im.width / im.height; ctx.drawImage(im, -w / 2, -h, w, h); }
    else Cartoons.drawUncle(ctx, 0, 0, c.type, c, t);
    ctx.restore();
    if (!ghenAnim || ghenAnim.customerId !== c.id) {
      nameTag(x, y - h - 6, GD.CUSTOMER_TYPES[c.type].name + (c.busy ? ' 🍻' : ''), '#ffd23f');
    } else if (ghenAnim.drag) bubble(x, y - h - 4, 'Á á á em ơi anh đi tiếp khách hàng mà!!!');
  }
  function drawWife(t) {
    const c = customers.find(c => c.id === ghenAnim.customerId); if (!c) return;
    const now = performance.now(), k = Math.min(1, (now - ghenAnim.start) / 1500);
    let x = 800 + (c.x + 110 - 800) * k, y = 950 + (c.y + 40 - 950) * k;
    if (ghenAnim.drag) { const d = Math.min(1, (now - ghenAnim.drag) / 1800); x = c.x + 110 + (900 - c.x - 110) * d; y = c.y + 40 + (1000 - c.y - 40) * d; }
    const h = GD.charHeight(Math.min(y, 885)) * 0.85, im = hasCust('wife.webp') ? img('/cust/wife.webp') : null;
    ctx.save(); ctx.translate(x + Math.sin(now / 50) * 3, y);
    if (im) { const w = h * im.width / im.height; ctx.drawImage(im, -w / 2, -h, w, h); }
    else { ctx.fillStyle = '#fff'; ctx.font = '80px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('👩‍🦱', 0, -20); }
    ctx.restore();
    if (!ghenAnim.drag) bubble(x, y - h - 4, 'ANH ĐÂU RỒIIIII!!! 🩴');
  }

  function drawPlayer(p, t, now) {
    const h = GD.charHeight(p.ry), dh = h / 0.975, dw = dh * 600 / 900;
    const em = p.emote && p.emote.until > Date.now() ? p.emote.e : null;
    const pose = ['hat', 'nhay'].includes(em) && Portrait.poseFile(p.char, em) ? em : null;
    const look = { char: p.char, outfit: p.outfit, makeup: p.makeup, acc: p.acc, pose };
    const spr = Portrait.spriteSync(look) || (pose && Portrait.spriteSync({ ...look, pose: null }));
    let x = p.rx, y = p.ry, rot = 0, sx = p.dir === -1 ? -1 : 1, sy = 1, bob = 0;
    if (p.moving) { p.phase += 0.22; bob = Math.abs(Math.sin(p.phase)) * 5; rot = Math.sin(p.phase) * 0.035; }
    else sy = 1 + 0.008 * Math.sin(t / 500 + x);
    const et = em ? now - p.emote.start : 0;
    if (em === 'hat') { rot = Math.sin(et / 300) * 0.045; }
    else if (em === 'nhay') { bob = Math.abs(Math.sin(et / 260)) * 14; sx = Math.floor(et / 1040) % 2 ? -1 : 1; rot = Math.sin(et / 260) * (pose ? 0.05 : 0.12); }
    else if (em === 'vay') { rot = Math.sin(et / 110) * 0.07; }
    if (p.spin) { const k = (now - p.spin) / 700; if (k < 1) sx *= Math.cos(k * Math.PI * 2); else p.spin = 0; }
    // bóng
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, dw * 0.28, dw * 0.07, 0, 0, 7); ctx.fill();
    if (em === 'nhay') { const g = ctx.createRadialGradient(x, y, 0, x, y, dw * 0.6); g.addColorStop(0, `hsla(${(now / 8) % 360},90%,65%,.45)`); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, dw * 0.6, dw * 0.18, 0, 0, 7); ctx.fill(); }
    if (p.queen) { ctx.strokeStyle = `rgba(255,210,63,${0.5 + 0.3 * Math.sin(t / 250)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, dw * 0.34, dw * 0.09, 0, 0, 7); ctx.stroke(); }
    ctx.save();
    ctx.translate(x, y - bob); ctx.rotate(rot); ctx.scale(sx, sy);
    if (spr) drawLive(ctx, spr, -dw / 2, -dh * 0.985, dw, dh, p, now, { pose, em, moving: p.moving });
    else { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-dw * 0.15, -h, dw * 0.3, h); }
    if (em === 'hat' && !pose && spr && spr.face) { const f = spr.face; ctx.fillStyle = '#fff'; ctx.font = `${dh * 0.07}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🎤', (f.lips[0] - 300) / 600 * dw + dw * 0.05, (f.lips[1] - 886) / 900 * dh + dh * 0.05); }
    ctx.restore();
    ctx.fillStyle = '#fff';
    const headY = y - h - bob - 8;
    if (em === 'hat') { for (let i = 0; i < 3; i++) { const k = ((et / 1200) + i / 3) % 1; ctx.globalAlpha = 1 - k; ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(['♪', '♫', '🎶'][i], x + 40 + Math.sin(k * 6 + i) * 20, headY + 30 - k * 80); } ctx.globalAlpha = 1; }
    if (em === 'tim') { for (let i = 0; i < 5; i++) { const k = ((et / 1500) + i / 5) % 1; ctx.globalAlpha = 1 - k; ctx.font = `${26 + i * 4}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.fillText('💖', x + Math.sin(k * 8 + i * 2) * 40, headY + 20 - k * 110); } ctx.globalAlpha = 1; }
    if (em === 'cungly') { ctx.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🍻', x, headY + 10 - Math.abs(Math.sin(et / 200)) * 14); }
    if (em === 'vay') { ctx.font = '38px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('👋', x + dw * 0.32, headY + 50 + Math.sin(et / 110) * 6); }
    const label = (p.queen ? '👑 ' : '') + rankIcon(p.rank) + ' ' + p.name;
    nameTag(x, headY - (em === 'cungly' ? 40 : 0), label, p.id === myId ? '#7dffb0' : '#fff');
    if (p.serving) { ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.emote && p.emote.e === 'hat' ? '' : '🍻', x + dw * 0.3, headY + 40); }
    if (p.chat && p.chat.until > Date.now()) bubble(x, headY - 26, p.chat.text);
  }

  function drawDoors(t) {
    const m = me();
    for (const d of GD.ROOMS.hall.doors) {
      const near = Math.hypot(d.x - m.x, d.y + 30 - m.y) < 160;
      if (!near) continue;
      ctx.save(); ctx.shadowColor = '#ff5fd2'; ctx.shadowBlur = 16;
      nameTag(d.x, d.y - 245, '▼ ' + d.label, d.id === 'closed' ? '#999' : '#ffb3e6'); ctx.restore();
    }
  }

  function draw(t) {
    const m = me(); if (!m) { ctx.fillStyle = '#120a1f'; ctx.fillRect(0, 0, innerWidth, innerHeight); return; }
    const now = performance.now();
    const hw = innerWidth / 2 / scale, hh = innerHeight / 2 / scale;
    const tx = Math.max(hw, Math.min(GD.BW - hw, m.rx)), ty = Math.max(hh, Math.min(GD.BH - hh, m.ry - 120));
    cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.12;
    cam.x = Math.max(hw, Math.min(GD.BW - hw, cam.x)); cam.y = Math.max(hh, Math.min(GD.BH - hh, cam.y));
    ctx.fillStyle = '#120a1f'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.save();
    ctx.translate(innerWidth / 2, innerHeight / 2); ctx.scale(scale, scale); ctx.translate(-cam.x, -cam.y);
    const bg = bgImg(m.room);
    if (bg) ctx.drawImage(bg, 0, 0, GD.BW, GD.BH);
    if (ghenAnim && ghenAnim.room === m.room) { ctx.fillStyle = `rgba(255,30,30,${0.12 + 0.1 * Math.sin(t / 90)})`; ctx.fillRect(0, 0, GD.BW, GD.BH); }
    if (m.room === 'hall') drawDoors(t);
    if (target && !target.door) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(target.x, target.y, 18, 6, 0, 0, 7); ctx.stroke(); }

    const ents = [];
    for (const c of customers) if (c.room === m.room) ents.push({ y: c.y, draw: () => drawCustomer(c, t) });
    for (const id in players) {
      const p = players[id]; if (p.room !== m.room) continue;
      if (id !== myId) { p.rx += (p.x - p.rx) * 0.22; p.ry += (p.y - p.ry) * 0.22; }
      ents.push({ y: p.ry, draw: () => drawPlayer(p, t, now) });
    }
    if (ghenAnim && ghenAnim.room === m.room) ents.push({ y: 2000, draw: () => drawWife(t) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());

    // hiệu ứng chữ
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], age = (Date.now() - f.t) / 1500;
      if (age > 1) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - age * age; ctx.textAlign = 'center';
      if (f.fly) {
        const a = players[f.from], b = players[f.to]; if (!a || !b) continue;
        const x = a.rx + (b.rx - a.rx) * age, y = a.ry - 150 + (b.ry - a.ry) * age - Math.sin(age * Math.PI) * 120;
        ctx.fillStyle = '#fff'; ctx.font = '44px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.fillText(f.text, x, y);
      } else {
        const p = players[f.id]; if (!p || p.room !== m.room) continue;
        ctx.font = '900 30px "Baloo 2", sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)';
        const y = p.ry - GD.charHeight(p.ry) - 60 - age * 60;
        ctx.strokeText(f.text, p.rx, y); ctx.fillStyle = f.color; ctx.fillText(f.text, p.rx, y);
      }
      ctx.globalAlpha = 1;
    }
    // lấp lánh
    for (let i = particles.length - 1; i >= 0; i--) {
      const s = particles[i]; s.life -= 0.02; if (s.life <= 0) { particles.splice(i, 1); continue; }
      s.x += s.vx; s.y += s.vy; s.vy += 0.05;
      ctx.globalAlpha = s.life; ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // =========================================================
  // 2.5D: thở, tóc + váy đung đưa, chớp mắt (biến dạng lưới trên ảnh 2D)
  // =========================================================
  const GX = 16, GY = 28; const FORCE_BLINK = location.search.includes('blink');
  const seedOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0) % 1000 / 1000; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const bump = (a, peak, b, x) => x <= a || x >= b ? 0 : x < peak ? smooth(a, peak, x) : 1 - smooth(peak, b, x);
  function skinOf(spr) {
    if (spr._skin !== undefined) return spr._skin;
    spr._skin = null;
    try {
      const f = spr.face; if (!f) return null;
      const d = spr.getContext('2d').getImageData(Math.round(f.cheekL[0]), Math.round(f.cheekL[1] - f.eyeW * 0.2), 3, 3).data;
      if (d[3] > 200) spr._skin = `rgb(${d[0]},${d[1]},${d[2]})`;
    } catch (e) { }
    return spr._skin;
  }
  function drawLive(c, spr, X, Y, W, H, p, now, o) {
    if (!p.seed) p.seed = seedOf(p.id) || 0.37;
    const t = now / 1000 + p.seed * 20;
    const f = spr.face, PW = 600, PH = 900;
    const lipsV = f ? f.lips[1] / PH : 0.13;
    const chestTop = lipsV + 0.06, waist = lipsV + 0.24;
    const breath = Math.sin(t * 2.1) * 0.5 + 0.5;                 // 0..1, ~3 giây/nhịp
    const ampB = H * 0.006;                                        // độ phồng ngực/vai
    const wind = o.em === 'nhay' ? 2.2 : o.moving ? 1.7 : 1;
    const ampHair = W * 0.010 * wind, ampSkirt = W * 0.013 * wind;
    const sx0 = W / PW, sy0 = H / PH;
    const cw = PW / GX, ch = PH / GY;
    c.drawImage(spr, X, Y, W, H); // lớp nền tránh khe hở giữa các ô
    for (let j = 0; j < GY; j++) {
      const v = (j + 0.5) / GY;
      // thở: phần trên ngực nâng lên, eo đứng yên → ngực/vai phồng nhẹ
      const dy = -ampB * breath * (1 - smooth(chestTop, waist, v));
      // váy: lắc từ hông xuống, chân giữ yên
      const skirt = bump(waist + 0.05, 0.72, 0.97, v) * ampSkirt * Math.sin(t * 1.6 - v * 4);
      const hairV = bump(lipsV - 0.02, lipsV + 0.18, waist + 0.12, v);
      for (let i = 0; i < GX; i++) {
        const u = (i + 0.5) / GX;
        const side = smooth(0.06, 0.13, Math.abs(u - 0.5));        // chỉ phần hai bên mặt (tóc)
        const dx = skirt * (0.6 + 0.4 * Math.abs(u - 0.5) * 4) + hairV * side * ampHair * Math.sin(t * 1.3 + (u < 0.5 ? 0 : 0.8) - v * 3);
        c.drawImage(spr, i * cw, j * ch, cw, ch, X + i * cw * sx0 + dx - 0.6, Y + j * ch * sy0 + dy - 0.6, cw * sx0 + 1.2, ch * sy0 + 1.2);
      }
    }
    // chớp mắt (chỉ ảnh đứng, có toạ độ mặt)
    if (f && !o.pose) {
      const cyc = (t * 1000) % 4200, closed = FORCE_BLINK ? 1 : cyc < 140 ? Math.sin(cyc / 140 * Math.PI) : 0;
      const skin = closed > 0.05 && skinOf(spr);
      if (skin) {
        const ew = f.eyeW * sx0, dyEye = -ampB * breath;
        for (const [ex, ey] of [f.eyeL, f.eyeR]) {
          const x = X + ex * sx0, y = Y + ey * sy0 + dyEye, rx = ew * 0.62, ry = ew * 0.42;
          c.save(); c.globalAlpha = Math.min(1, closed * 1.4); c.fillStyle = skin;
          c.beginPath(); c.ellipse(x, y - ry * (1 - closed) * 0.4, rx, ry * closed, 0, 0, 7); c.fill();
          c.strokeStyle = 'rgba(40,20,15,.85)'; c.lineWidth = Math.max(0.8, ew * 0.09);
          c.beginPath(); c.moveTo(x - rx, y); c.quadraticCurveTo(x, y + ry * 0.35 * closed, x + rx, y); c.stroke();
          c.restore();
        }
      }
    }
  }

  function sparkle(p) {
    const h = GD.charHeight(p.ry);
    for (let i = 0; i < 40; i++) particles.push({ x: p.rx + (Math.random() - 0.5) * h * 0.5, y: p.ry - Math.random() * h, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, r: 2 + Math.random() * 3, life: 1, c: ['#fff6c8', '#ff9ad5', '#ffd23f', '#9ad7ff'][i % 4] });
  }

  // Pháo hoa (lớp phủ toàn màn hình)
  const rockets = [];
  function launchFireworks() {
    for (let i = 0; i < 7; i++) setTimeout(() => { rockets.push({ x: innerWidth * (0.15 + Math.random() * 0.7), y: innerHeight, ty: innerHeight * (0.15 + Math.random() * 0.3), vy: -9 - Math.random() * 3, hue: Math.random() * 360, sparks: null }); }, i * 350);
  }
  function drawFx() {
    fctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      if (!r.sparks) {
        r.y += r.vy; fctx.fillStyle = `hsl(${r.hue},100%,75%)`; fctx.beginPath(); fctx.arc(r.x, r.y, 3, 0, 7); fctx.fill();
        if (r.y <= r.ty) { r.sparks = Array.from({ length: 70 }, () => { const a = Math.random() * 7, s = 1 + Math.random() * 5; return { x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 }; }); sfx.boom(); }
      } else {
        let alive = 0;
        for (const s of r.sparks) { if (s.life <= 0) continue; alive++; s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.vx *= 0.98; s.life -= 0.012; fctx.globalAlpha = s.life; fctx.fillStyle = `hsl(${r.hue + Math.random() * 40},100%,${60 + s.life * 30}%)`; fctx.beginPath(); fctx.arc(s.x, s.y, 2.4, 0, 7); fctx.fill(); }
        fctx.globalAlpha = 1;
        if (!alive) rockets.splice(i, 1);
      }
    }
  }

  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (myId) updateMe(dt);
    draw(t);
    if (rockets.length) drawFx(); else if (fxc._dirty !== false) { fctx.clearRect(0, 0, innerWidth, innerHeight); fxc._dirty = false; }
    if (rockets.length) fxc._dirty = true;
    if (karaState && !karaState.done) karaFrame();
    if (eventUntil) { const s = Math.max(0, Math.ceil((eventUntil - Date.now()) / 1000)); $('eventBar').textContent = `💰 ĐẠI GIA BAO PHÒNG VIP · x2 tip · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (!s) { eventUntil = 0; $('eventBar').classList.add('hidden'); } }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  if (location.search.includes('debug')) window.KTV = { goto: (x, y) => { target = { x, y }; }, me, players: () => players, door: id => { target = null; enterDoor(id); }, tp: (x, y) => { const m = me(); m.x = m.rx = x; m.y = m.ry = y; socket.emit('move', { x, y, dir: 1 }); } };

  // =========================================================
  // PHỤC VỤ KHÁCH
  // =========================================================
  let roundTimer = null, curCust = null, lastPicked = null;
  function openScreen(id) { inOverlay = true; target = null; $(id).classList.remove('hidden'); }
  function closeScreen(id) { $(id).classList.add('hidden'); inOverlay = ['serve', 'makeup', 'shop', 'quests', 'rank', 'karaoke', 'ghen'].some(s => !$(s).classList.contains('hidden')); }
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeScreen(b.dataset.close));

  socket.on('serve:begin', ({ type, room, buff, event }) => {
    curCust = type; openScreen('serve');
    $('serveStage').style.backgroundImage = `url(/bg/${GD.ROOMS[room].front}.webp)`;
    $('serveBody').classList.remove('hidden'); $('serveResult').classList.add('hidden'); $('serveQuit').classList.remove('hidden');
    const t = GD.CUSTOMER_TYPES[type];
    $('custArt').innerHTML = custArt(type, 'ok'); $('custName').textContent = t.name; $('custBubble').textContent = t.hint;
    $('options').innerHTML = '';
    $('serveBuffs').innerHTML = (buff ? '<span>🍺 Bia mời khách +20%</span>' : '') + (event ? '<span>💰 Đại gia x2</span>' : '');
    const m = me(); Portrait.render($('serveMe'), { char: m.char, outfit: m.outfit, makeup: m.makeup, acc: m.acc }, 'full');
  });
  socket.on('serve:round', ({ n, total, ask, options, ms }) => {
    $('custArt').innerHTML = custArt(curCust, 'ok'); $('custBubble').textContent = ask;
    $('roundNo').textContent = `Yêu cầu ${n}/${total}`;
    const box = $('options'); box.innerHTML = '';
    options.forEach((o, i) => { const b = document.createElement('button'); b.textContent = o; b.onclick = () => answer(i, b); box.append(b); });
    const bar = $('timerBar'); bar.style.transition = 'none'; bar.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${ms}ms linear`; bar.style.width = '0%'; }));
    clearTimeout(roundTimer); roundTimer = setTimeout(() => answer(-1), ms);
  });
  function answer(i, btn) { clearTimeout(roundTimer); [...$('options').children].forEach(b => b.disabled = true); lastPicked = btn || null; socket.emit('serve:answer', { idx: i }); }
  socket.on('serve:feedback', ({ ok, late }) => {
    if (lastPicked) lastPicked.classList.add(ok ? 'ok' : 'bad');
    ok ? sfx.ok() : sfx.bad();
    $('custArt').innerHTML = custArt(curCust, ok ? 'love' : 'mad');
    $('custBubble').textContent = ok ? ['Đúng ý anh!', 'Giỏi quá em!', 'Ngon lành!'][Math.floor(Math.random() * 3)] : late ? 'Chậm quá em ơiii...' : 'Ủa em làm gì vậy???';
  });
  socket.on('serve:result', ({ tip, lines, mood, say, tips, wallet, rank }) => {
    clearTimeout(roundTimer);
    $('custArt').innerHTML = custArt(curCust, mood); $('custBubble').textContent = say;
    $('serveBody').classList.add('hidden'); $('serveQuit').classList.add('hidden');
    const r = $('serveResult'); r.classList.remove('hidden');
    r.innerHTML = `<div class="tip">${tip > 0 ? '+' + tip + 'k tip 💸' : 'Không có tip 😭'}</div>
      ${lines.length ? `<ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      <p>Ví: <b>${fmt(wallet)}</b> · Tổng tip: <b>${fmt(tips)}</b> · ${rankIcon(rank)} ${rank}</p>
      <button class="btn-main" id="serveDone">Tiếp tục làm việc</button>`;
    $('serveDone').onclick = () => closeScreen('serve');
  });
  socket.on('serve:end', ({ ghen }) => { clearTimeout(roundTimer); closeScreen('serve'); if (ghen) toast('Có biến! Bỏ dở phục vụ...', 'warn'); });
  $('serveQuit').onclick = () => socket.emit('serve:quit');

  // =========================================================
  // KARAOKE
  // =========================================================
  const LYRICS = ['♪ Tip ơi tip à, về đây với em ♪', '♪ Anh Ba ơi anh Ba, sao anh say quá ♪', '♪ Một ly nữa thôi, rồi mình về nhà ♪', '♪ Vợ anh tới rồi, chạy mau chạy mau ♪', '♪ Đèn neon lung linh, lòng em xao xuyến ♪', '♪ Dzô dzô dzô, trăm phần trăm nha ♪'];
  const LANE_FREQ = [523, 659, 784];
  let karaState = null;
  function startKaraoke() {
    socket.emit('karaoke:start', {}, res => {
      if (res.error) return toast(res.error, 'warn');
      openScreen('karaoke'); Music.duck(0.1);
      $('karaPanel').style.backgroundImage = `linear-gradient(rgba(10,5,25,.75),rgba(10,5,25,.95)), url(/bg/${GD.ROOMS[me().room].front}.webp)`;
      $('karaResult').classList.add('hidden'); $('karaField').classList.remove('hidden');
      document.querySelectorAll('.note').forEach(n => n.remove());
      const field = $('karaField');
      const st = { notes: res.notes.map(n => ({ ...n, el: null, judged: false })), len: res.len, t0: performance.now(), hits: [], done: false, field, beat: 0, lyric: -1 };
      karaState = st;
      for (const n of st.notes) { const el = document.createElement('div'); el.className = 'note l' + n.lane; field.children[n.lane].append(el); n.el = el; }
    });
  }
  function karaFrame() {
    const st = karaState, now = performance.now() - st.t0;
    const H = st.field.clientHeight, hitY = H * 0.86, speed = H * 0.86 / 1600;
    for (const n of st.notes) {
      const y = hitY - (n.t - now) * speed;
      n.el.style.top = (y - 11) + 'px';
      n.el.style.display = y < -30 || y > H + 30 || n.judged ? 'none' : '';
      if (!n.judged && now - n.t > 260) { n.judged = true; karaFx('MISS', '#ff5a7a'); }
      if (!n.played && now >= n.t) { n.played = true; beep(LANE_FREQ[n.lane] / 2, 0.25, 'triangle', 0.05); }
    }
    while (st.beat * 400 < now) { if (st.beat * 400 > 1000) beep(70, 0.12, 'sine', 0.25); st.beat++; }
    const li = Math.floor(now / 3500) % LYRICS.length; if (li !== st.lyric) { st.lyric = li; $('karaLyric').textContent = LYRICS[li]; }
    if (now > st.len) karaEnd();
  }
  function karaHit(lane) {
    const st = karaState; if (!st || st.done) return;
    const t = performance.now() - st.t0;
    st.hits.push({ lane, t: Math.round(t) });
    const laneEl = st.field.children[lane]; laneEl.classList.add('hit'); setTimeout(() => laneEl.classList.remove('hit'), 120);
    let best = null, bd = 999;
    for (const n of st.notes) if (!n.judged && n.lane === lane) { const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = n; } }
    if (best && bd <= 260) { best.judged = true; beep(LANE_FREQ[lane], 0.18, 'square', 0.07); karaFx(bd <= 110 ? 'PERFECT!' : 'GOOD', bd <= 110 ? '#ffd23f' : '#36e0ff'); }
    else beep(150, 0.08, 'sawtooth', 0.04);
  }
  document.querySelectorAll('.lane').forEach(l => l.addEventListener('pointerdown', e => { e.preventDefault(); karaHit(+l.dataset.l); }));
  function karaFx(text, color) { const f = $('karaFx'); f.textContent = text; f.style.color = color; f.style.opacity = 1; clearTimeout(f._t); f._t = setTimeout(() => f.style.opacity = 0, 350); }
  function karaEnd() { const st = karaState; st.done = true; socket.emit('karaoke:end', { hits: st.hits }); }
  socket.on('karaoke:result', ({ score, tip, judge }) => {
    if (!karaState) return;
    $('karaField').classList.add('hidden');
    const r = $('karaResult'); r.classList.remove('hidden');
    r.innerHTML = `<div class="score">${score}</div><h3>${esc(judge)}</h3><p>${tip ? `Khách vỗ tay bo <b style="color:#7dffb0">+${tip}k</b> 💸` : 'Không ai bo đồng nào 😭'}</p><button class="btn-main" id="karaDone">Xong</button>`;
    score >= 80 ? sfx.coin() : sfx.bad();
    $('karaDone').onclick = () => { karaState = null; closeScreen('karaoke'); Music.duck(0.4); };
  });
  socket.on('karaoke:abort', () => { karaState = null; closeScreen('karaoke'); Music.duck(0.4); });

  // =========================================================
  // TRANG ĐIỂM
  // =========================================================
  let draft = null, mkPending = false;
  const ownsK = (kind, ref) => !FEAT.shop || (kind === 'outfit' ? profile.owned.outfits.includes(ref) : kind === 'acc' ? profile.owned.acc.includes(ref) : kind === 'glitter' ? profile.owned.glitter : profile.owned[kind].includes(ref));
  function openMakeup() { const m = me(); draft = { char: m.char, outfit: m.outfit, makeup: { ...m.makeup }, acc: m.acc }; openScreen('makeup'); buildMakeup(); }
  function seg(el, items, cur, onPick) {
    el.innerHTML = '';
    items.forEach(({ label, locked }, i) => { const b = document.createElement('button'); b.textContent = (locked ? '🔒 ' : '') + label; if (i === cur) b.className = 'on'; if (locked) b.classList.add('locked'); b.onclick = () => locked ? toast('Món này chưa có, mua ở Shop 🛍️', 'warn') : onPick(i); el.append(b); });
  }
  function swatch(el, list, kind, cur, onPick) {
    el.innerHTML = '';
    const none = document.createElement('button'); none.className = 'none' + (!cur ? ' on' : ''); none.textContent = 'Không'; none.onclick = () => onPick(null); el.append(none);
    list.forEach(c => {
      const b = document.createElement('button'); b.style.background = c.hex; b.title = c.name; const own = ownsK(kind, c.id);
      if (c.id === cur) b.classList.add('on'); if (!own) b.classList.add('locked');
      b.onclick = () => own ? onPick(c.id) : toast(`${c.name}: mua ở Shop 🛍️`, 'warn'); el.append(b);
    });
  }
  function buildMakeup() {
    const d = draft, mk = d.makeup;
    seg($('mkChar'), GD.CHARACTERS.map(c => ({ label: c.name, locked: isLocked(c) })), GD.CHARACTERS.findIndex(c => c.id === d.char), i => { d.char = GD.CHARACTERS[i].id; buildMakeup(); });
    seg($('mkOutfit'), GD.OUTFIT_STYLES.map((s, i) => ({ label: s, locked: !ownsK('outfit', i) })), d.outfit, i => { d.outfit = i; buildMakeup(); });
    swatch($('mkLip'), GD.LIP_COLORS, 'lip', mk.lip, id => { mk.lip = id; buildMakeup(); });
    swatch($('mkBlush'), GD.BLUSH_COLORS, 'blush', mk.blush, id => { mk.blush = id; buildMakeup(); });
    swatch($('mkShadow'), GD.SHADOW_COLORS, 'shadow', mk.shadow, id => { mk.shadow = id; buildMakeup(); });
    seg($('mkAcc'), [{ label: 'Không' }, ...GD.ACCESSORIES.map(a => ({ label: a.icon + ' ' + a.name, locked: !ownsK('acc', a.id) }))], d.acc ? GD.ACCESSORIES.findIndex(a => a.id === d.acc) + 1 : 0, i => { d.acc = i ? GD.ACCESSORIES[i - 1].id : null; buildMakeup(); });
    $('mkLipA').value = Math.round((mk.lipA || 0.7) * 100);
    $('mkGlitter').checked = !!mk.glitter; $('mkGlitter').disabled = !ownsK('glitter', true);
    $('mkShopHint').classList.toggle('hidden', !FEAT.shop);
    redrawMakeup();
  }
  function redrawMakeup() {
    if (mkPending) return; mkPending = true;
    requestAnimationFrame(async () => { mkPending = false; await Portrait.render($('mkFull'), draft, 'full'); await Portrait.render($('mkFace'), draft, 'face'); });
  }
  $('mkLipA').oninput = e => { draft.makeup.lipA = e.target.value / 100; redrawMakeup(); };
  $('mkGlitter').onchange = e => { draft.makeup.glitter = e.target.checked; redrawMakeup(); };
  $('mkSave').onclick = () => { socket.emit('look', draft); closeScreen('makeup'); };
  $('mkClose').onclick = () => closeScreen('makeup');

  // =========================================================
  // SHOP
  // =========================================================
  const SHOP_TABS = [['outfit', '👗 Trang phục'], ['makeup', '💄 Trang điểm'], ['acc', '👑 Phụ kiện'], ['item', '🎁 Vật phẩm']];
  let shopTab = 'outfit';
  function openShop() { openScreen('shop'); buildShop(); }
  $('bShop').onclick = openShop;
  function buildShop() {
    $('shopWallet').textContent = '💰 ' + fmt(profile.wallet);
    $('shopTabs').innerHTML = SHOP_TABS.map(([k, l]) => `<button data-k="${k}" class="${k === shopTab ? 'on' : ''}">${l}</button>`).join('');
    $('shopTabs').querySelectorAll('button').forEach(b => b.onclick = () => { shopTab = b.dataset.k; buildShop(); });
    const items = GD.SHOP.filter(s => shopTab === 'makeup' ? ['lip', 'blush', 'shadow', 'glitter'].includes(s.kind) : s.kind === shopTab);
    const grid = $('shopGrid'); grid.innerHTML = '';
    const m = me();
    for (const it of items) {
      const owned = it.kind !== 'item' && ownsK(it.kind, it.ref);
      const d = document.createElement('div'); d.className = 'item'; d.dataset.id = it.id;
      let pic = `<div class="ic">${it.icon}</div>`;
      if (it.kind === 'lip' || it.kind === 'blush' || it.kind === 'shadow') { const c = GD[{ lip: 'LIP_COLORS', blush: 'BLUSH_COLORS', shadow: 'SHADOW_COLORS' }[it.kind]].find(c => c.id === it.ref); pic = `<div class="ic"><span style="display:inline-block;width:46px;height:46px;border-radius:50%;background:${c.hex};border:3px solid #fff"></span></div>`; }
      d.innerHTML = `${it.kind === 'outfit' || it.kind === 'acc' ? '<canvas width="200" height="260"></canvas>' : pic}<b>${it.name}</b><small>${it.desc || ''}${it.kind === 'item' ? ` (có ${profile.inv[it.ref]})` : ''}</small><button>${owned ? 'Đã có ✓' : '💰 ' + it.price + 'k'}</button>`;
      const btn = d.querySelector('button'); btn.disabled = owned || profile.wallet < it.price;
      btn.onclick = () => socket.emit('buy', { id: it.id }, res => { if (res.error) toast(res.error, 'warn'); else { sfx.coin(); toast(`Đã mua ${it.name}! ${it.kind === 'item' ? '' : 'Vào Phòng Trang Điểm để mặc/đánh nha 💄'}`); } });
      grid.append(d);
      const cv = d.querySelector('canvas');
      if (cv) Portrait.render(cv, { char: m.char, outfit: it.kind === 'outfit' ? it.ref : m.outfit, makeup: m.makeup, acc: it.kind === 'acc' ? it.ref : m.acc }, it.kind === 'acc' ? 'bust' : 'full');
    }
  }

  // =========================================================
  // NHIỆM VỤ + XẾP HẠNG
  // =========================================================
  $('bQuest').onclick = () => { openScreen('quests'); buildQuests(); };
  function buildQuests() {
    $('streak').textContent = `🔥 Điểm danh ${profile.streak} ngày liên tiếp · mai vào nhận ${50 * Math.min(7, profile.streak + 1)}k`;
    $('questList').innerHTML = '';
    for (const q of profile.quests.list) {
      const def = GD.QUESTS.find(d => d.id === q.id), done = q.p >= def.goal;
      const el = document.createElement('div'); el.className = 'quest';
      el.innerHTML = `<div class="qb"><div class="qtext">${def.text}</div><div class="qbar"><i style="width:${Math.min(100, q.p / def.goal * 100)}%"></i></div><small>${Math.min(q.p, def.goal)}/${def.goal} · thưởng ${def.reward}k</small></div><button ${!done || q.claimed ? 'disabled' : ''}>${q.claimed ? 'Đã nhận' : done ? 'Nhận 🎁' : 'Chưa xong'}</button>`;
      el.querySelector('button').onclick = () => socket.emit('quest:claim', { id: q.id });
      $('questList').append(el);
    }
  }
  $('bTop').onclick = () => { openScreen('rank'); buildRank(); };
  document.querySelectorAll('#rankTabs button').forEach(b => b.onclick = () => { rankTab = b.dataset.t; document.querySelectorAll('#rankTabs button').forEach(x => x.classList.toggle('on', x === b)); buildRank(); });
  function buildRank() {
    const list = rankTab === 'tips' ? topData.tips.map(p => [p.name, fmt(p.tips)]) : topData.flowers.map(p => [p.name, p.flowersDay + ' 💐']);
    $('rankList').innerHTML = list.length ? list.map(([n, v], i) => `<li><span>${i === 0 && rankTab === 'flowers' ? '👑 ' : ''}${esc(n)}</span><em>${v}</em></li>`).join('') : '<p class="hint">Chưa có ai...</p>';
  }

  // =========================================================
  // BIỂU DIỄN, PHÁO HOA, QUÀ
  // =========================================================
  $('emoteWheel').innerHTML = GD.EMOTES.map(e => `<button data-e="${e.id}">${e.icon}<small>${e.name}</small></button>`).join('');
  $('bEmote').onclick = () => {
    const w = $('emoteWheel'); w.classList.toggle('hidden');
  };
  $('emoteWheel').querySelectorAll('button').forEach(b => b.onclick = () => { socket.emit('emote', { e: b.dataset.e }); $('emoteWheel').classList.add('hidden'); });
  $('bFire').onclick = () => socket.emit('firework');

  function openPMenu(p, sx, sy) {
    const box = $('pmenu');
    let html = `<b>${esc(p.name)}</b><small style="text-align:center;color:#b9a6d6">${rankIcon(p.rank)} ${p.rank} · ⭐ ${fmt(p.tips)}</small>`;
    if (FEAT.gifts) html += `<button id="pmHoa">💐 Tặng hoa (${profile.inv.hoa ? 'còn ' + profile.inv.hoa : '50k'})</button><div class="row"><input id="pmAmt" type="number" min="10" max="1000" value="50"><button id="pmTip">💸 Bo</button></div>`;
    else html += `<small style="color:#b9a6d6;text-align:center">Tặng quà sẽ mở sớm 🎁</small>`;
    box.innerHTML = html; box.classList.remove('hidden');
    box.style.left = Math.min(innerWidth - 210, sx) + 'px'; box.style.top = Math.min(innerHeight - 160, sy) + 'px';
    const done = res => { if (res.error) toast(res.error, 'warn'); else { sfx.pop(); box.classList.add('hidden'); } };
    if (FEAT.gifts) {
      $('pmHoa').onclick = () => socket.emit('gift', { to: p.id, kind: 'hoa' }, done);
      $('pmTip').onclick = () => socket.emit('gift', { to: p.id, kind: 'tip', amount: +$('pmAmt').value }, done);
    }
  }

  // =========================================================
  // SỰ KIỆN ĐẠI GIA
  // =========================================================
  function startEventBar(until) { eventUntil = until; $('eventBar').classList.remove('hidden'); }
  socket.on('event:start', ({ until }) => { startEventBar(until); sfx.coin(); });
  socket.on('event:end', () => { eventUntil = 0; $('eventBar').classList.add('hidden'); });

  // =========================================================
  // ĐÁNH GHEN
  // =========================================================
  let ghenState = null;
  socket.on('ghen:start', ({ room, roomName, customerId, customerName, victims, ms, v2 }) => {
    ghenAnim = { room, customerId, start: performance.now(), drag: 0 };
    const mine = victims.includes(myId);
    toast(`🚨 Vợ của ${customerName} đang xông vào ${roomName}!`, 'big');
    if (!mine) return;
    ghenState = { running: false, taps: 0, need: GD.RUN_TAPS, resolved: false };
    if (karaState) { karaState = null; closeScreen('karaoke'); }
    closeScreen('serve'); closeScreen('makeup'); closeScreen('shop');
    openScreen('ghen'); sfx.bad();
    $('ghen').querySelector('.panel').classList.remove('calm');
    $('ghenArt').innerHTML = wifeArt();
    $('ghenTitle').textContent = `Vợ ${customerName} tới!!! Làm sao đây?`;
    $('ghenRunBox').classList.add('hidden'); $('ghenResult').classList.add('hidden');
    const box = $('ghenChoices'); box.classList.remove('hidden');
    const choices = v2 ? GD.GHEN_CHOICES : GD.GHEN_CHOICES.filter(c => c.run);
    box.innerHTML = choices.map(c => `<button data-c="${c.id}">${c.icon} ${c.name}<small>${c.run ? 'Bấm liên tục để chạy' : c.chance >= 0.65 ? 'Dễ thoát' + (c.cost ? `, tốn ${c.cost}k` : '') : c.chance >= 0.5 ? 'Hên xui' : 'Khó, nhưng được bo ' + (c.bonus || 0) + 'k'}</small></button>`).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = () => { box.querySelectorAll('button').forEach(x => x.disabled = true); socket.emit('ghen:choose', { choice: b.dataset.c }); });
    const bar = $('ghenBar'); bar.style.transition = 'none'; bar.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${ms}ms linear`; bar.style.width = '0%'; }));
  });
  socket.on('ghen:run', ({ taps }) => {
    ghenState.running = true; ghenState.need = taps;
    $('ghenChoices').classList.add('hidden'); $('ghenRunBox').classList.remove('hidden');
    $('ghenCount').textContent = `0 / ${taps}`;
  });
  function ghenTap() {
    if (!ghenState || !ghenState.running || ghenState.resolved) return;
    ghenState.taps++; socket.emit('ghen:tap'); sfx.pop();
    $('ghenCount').textContent = `${ghenState.taps} / ${ghenState.need}`;
  }
  $('ghenRun').onpointerdown = e => { e.preventDefault(); ghenTap(); };
  socket.on('ghen:result', ({ safe, text }) => {
    if (!ghenState) ghenState = { resolved: true };
    ghenState.resolved = true; ghenState.running = false;
    $('ghenChoices').classList.add('hidden'); $('ghenRunBox').classList.add('hidden');
    const r = $('ghenResult'); r.classList.remove('hidden'); r.className = 'ghen-result ' + (safe ? 'ok' : 'bad'); r.textContent = (safe ? '✅ ' : '❌ ') + text;
    $('ghen').querySelector('.panel').classList.toggle('calm', safe);
    safe ? sfx.ok() : sfx.bad();
  });
  socket.on('ghen:caught', ({ loss }) => toast(`🩴 Bị dép tổ ong phang! Mất ${loss}k trong ví`, 'warn'));
  socket.on('ghen:end', () => {
    if (ghenAnim) ghenAnim.drag = performance.now();
    setTimeout(() => { ghenAnim = null; }, 2000);
    if (ghenState) {
      setTimeout(() => { closeScreen('ghen'); }, 1600);
      ghenState = null;
    }
  });
})();
