(function () {
  const $ = id => document.getElementById(id);
  const socket = io();
  const cvs = $('map'), ctx = cvs.getContext('2d');
  const R = 12, SPEED = 210;

  let myId = null, players = {}, customers = [], ghenState = null, inOverlay = false;
  const keys = {};
  let target = null, lastSent = 0, lastRoom = null, zoom = 1, cam = { x: GD.SPAWN.x, y: GD.SPAWN.y };
  let loginLook = { char: 'linh', outfit: 0, makeup: {} };
  const fx = [];

  const me = () => players[myId];
  const custType = c => GD.CUSTOMER_TYPES[c.type];
  const rankIcon = name => (GD.RANKS.find(r => r.name === name) || GD.RANKS[0]).icon;

  function toast(text, kind = 'info') {
    const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = text;
    $('toasts').appendChild(d); setTimeout(() => d.remove(), kind === 'big' ? 5000 : 3500);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }

  // ---------- Đăng nhập ----------
  function buildLogin() {
    const pick = $('charPick'); pick.innerHTML = '';
    GD.CHARACTERS.forEach(c => {
      const card = document.createElement('div'); card.className = 'char-card' + (c.id === loginLook.char ? ' on' : '');
      const cv = document.createElement('canvas'); cv.width = 180; cv.height = 260;
      card.append(cv); card.insertAdjacentHTML('beforeend', `<b>${c.name}</b><small>${c.desc}</small>`);
      card.onclick = () => { loginLook.char = c.id; buildLogin(); };
      pick.append(card);
      Portrait.render(cv, { char: c.id, outfit: loginLook.outfit, makeup: {} }, 'bust');
    });
    const seg = $('outfitPick'); seg.innerHTML = '';
    GD.OUTFIT_STYLES.forEach((s, i) => {
      const b = document.createElement('button'); b.textContent = s; if (i === loginLook.outfit) b.className = 'on';
      b.onclick = () => { loginLook.outfit = i; buildLogin(); }; seg.append(b);
    });
  }
  try { const saved = JSON.parse(localStorage.getItem('ktv2d') || '{}'); if (saved.name) $('lname').value = saved.name; } catch (e) { }
  Portrait.loadAssets().then(buildLogin);

  $('lgo').onclick = () => {
    const name = $('lname').value, pin = $('lpin').value;
    $('lerr').textContent = '';
    socket.emit('login', { name, pin, char: loginLook.char, outfit: loginLook.outfit }, res => {
      if (res.error) { $('lerr').textContent = res.error; return; }
      try { localStorage.setItem('ktv2d', JSON.stringify({ name })); } catch (e) { }
      myId = res.me.id; players = {};
      res.players.forEach(addPlayer);
      customers = res.customers;
      $('login').classList.add('hidden'); $('hud').classList.remove('hidden');
      updateHud();
      Music.enable();
      toast(res.isNew ? `Chào ${res.me.name}! Đi lại gần khách rồi bấm "Phục vụ" để kiếm tip nha 💸` : `Mừng ${res.me.name} quay lại ca làm! Tip hôm nay: ${res.dayTips}k`, 'big');
      if (res.isNew) setTimeout(() => toast('Mẹo: ghé Phòng Trang Điểm (góc trên phải) để đánh son đúng gu khách → tip cao hơn', 'info'), 2500);
    });
  };
  $('lpin').addEventListener('keydown', e => { if (e.key === 'Enter') $('lgo').click(); });

  function addPlayer(p) { players[p.id] = { ...p, rx: p.x, ry: p.y, phase: 0, chat: null }; }

  function updateHud() {
    const m = me(); if (!m) return;
    $('hName').textContent = m.name;
    $('hRank').textContent = rankIcon(m.rank) + ' ' + m.rank;
    $('hTips').textContent = '💸 ' + m.tips.toLocaleString('vi-VN') + 'k';
  }

  // ---------- Socket ----------
  socket.on('join', addPlayer);
  socket.on('leave', id => delete players[id]);
  socket.on('state', list => {
    for (const [id, x, y, dir, moving, serving] of list) {
      const p = players[id]; if (!p) continue;
      p.serving = !!serving;
      if (id === myId) continue;
      p.x = x; p.y = y; p.dir = dir; p.moving = !!moving;
    }
  });
  socket.on('fix', ({ x, y }) => { const m = me(); if (m) { m.x = m.rx = x; m.y = m.ry = y; } });
  socket.on('customers', list => customers = list);
  socket.on('chat', ({ id, text }) => { const p = players[id]; if (p) p.chat = { text, until: Date.now() + 5000 }; });
  socket.on('look', ({ id, char, outfit, makeup }) => { const p = players[id]; if (p) Object.assign(p, { char, outfit, makeup }); });
  socket.on('toast', t => toast(t.text, t.kind));
  socket.on('top', list => {
    $('topList').innerHTML = list.map(p => `<li>${p.name.replace(/</g, '')} — ${p.tips.toLocaleString('vi-VN')}k</li>`).join('');
  });
  socket.on('tipfx', ({ id, tip, tips, rank }) => {
    const p = players[id]; if (!p) return;
    p.tips = tips; p.rank = rank;
    fx.push({ id, text: (tip >= 0 ? '+' : '') + tip + 'k', color: tip >= 0 ? '#7dffb0' : '#ff6a6a', t: Date.now() });
    if (id === myId) updateHud();
  });
  socket.on('disconnect', () => toast('Mất kết nối, đang thử lại...', 'warn'));
  socket.on('connect', () => { if (myId) location.reload(); });

  // ---------- Điều khiển ----------
  addEventListener('keydown', e => {
    if (document.activeElement === $('chatIn')) { if (e.key === 'Escape') $('chatIn').blur(); return; }
    if (ghenState && ghenState.mine && (e.code === 'Space')) { e.preventDefault(); ghenTap(); return; }
    if (inOverlay) return;
    if (e.key === 'Enter' && myId) { e.preventDefault(); $('chatIn').focus(); return; }
    if ((e.key === 'e' || e.key === 'E') && !$('actBtn').classList.contains('hidden')) { $('actBtn').click(); return; }
    keys[e.key.toLowerCase()] = true; target = null;
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  cvs.addEventListener('pointerdown', e => {
    if (!myId || inOverlay) return;
    $('chatIn').blur();
    target = { x: (e.clientX - innerWidth / 2) / zoom + cam.x, y: (e.clientY - innerHeight / 2) / zoom + cam.y };
  });
  $('chatForm').onsubmit = e => { e.preventDefault(); const t = $('chatIn').value.trim(); if (t) socket.emit('chat', t); $('chatIn').value = ''; $('chatIn').blur(); };

  function hits(x, y) {
    for (const s of GD.SOLIDS) {
      const cx = Math.max(s.x, Math.min(x, s.x + s.w)), cy = Math.max(s.y, Math.min(y, s.y + s.h));
      if ((x - cx) ** 2 + (y - cy) ** 2 < R * R) return true;
    }
    return false;
  }

  function updateMe(dt) {
    const m = me(); if (!m) return;
    let dx = 0, dy = 0;
    if (!inOverlay && !m.serving) {
      if (keys['arrowleft'] || keys['a']) dx -= 1;
      if (keys['arrowright'] || keys['d']) dx += 1;
      if (keys['arrowup'] || keys['w']) dy -= 1;
      if (keys['arrowdown'] || keys['s']) dy += 1;
      if (!dx && !dy && target) {
        const tx = target.x - m.x, ty = target.y - m.y, d = Math.hypot(tx, ty);
        if (d < 6) target = null; else { dx = tx / d; dy = ty / d; }
      }
    }
    const len = Math.hypot(dx, dy);
    m.moving = len > 0;
    if (len) {
      dx /= len; dy /= len;
      const nx = m.x + dx * SPEED * dt, ny = m.y + dy * SPEED * dt;
      let moved = false;
      if (!hits(nx, m.y)) { m.x = nx; moved = true; }
      if (!hits(m.x, ny)) { m.y = ny; moved = true; }
      if (!moved) target = null;
      if (dx) m.dir = dx < 0 ? -1 : 1;
    }
    m.rx = m.x; m.ry = m.y;
    const now = performance.now();
    if (now - lastSent > 90) { lastSent = now; socket.emit('move', { x: m.x, y: m.y, dir: m.dir, moving: m.moving }); }
    const room = GD.roomAt(m.x, m.y);
    if (room !== lastRoom) {
      lastRoom = room;
      const r = GD.ROOMS.find(r => r.id === room);
      $('roomLabel').textContent = r.name; $('roomLabel').style.color = r.neon;
      Music.room(r.kind === 'ktv' ? room : null);
    }
    updateAction(m, room);
  }

  let actFn = null;
  function updateAction(m, room) {
    let label = null; actFn = null;
    if (!inOverlay && !m.serving) {
      if (room === 'makeup') { label = '💄 Trang điểm / Thay đồ'; actFn = openMakeup; }
      let best = null, bd = 170;
      for (const c of customers) { const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < bd) { bd = d; best = c; } }
      if (best) {
        const t = custType(best);
        if (best.away) label = `${t.name} đang vắng...`;
        else if (best.busy) label = `${t.name} đang có người phục vụ`;
        else { label = `🍻 Phục vụ ${t.name}`; actFn = () => socket.emit('serve:start', { customerId: best.id }); }
      }
    }
    const b = $('actBtn');
    if (label) { b.textContent = label; b.classList.remove('hidden'); b.disabled = !actFn; b.style.opacity = actFn ? 1 : .6; }
    else b.classList.add('hidden');
  }
  $('actBtn').onclick = () => { if (actFn) actFn(); };

  // ---------- Vẽ bản đồ ----------
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    cvs.width = innerWidth * dpr; cvs.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    zoom = Math.max(0.55, Math.min(1.25, Math.min(innerWidth / 900, innerHeight / 650)));
  }
  addEventListener('resize', resize); resize();

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  function drawFloor(t) {
    // sảnh lát gạch
    for (let y = GD.ROOM_H; y < GD.H; y += 64) for (let x = 0; x < GD.W; x += 64) {
      ctx.fillStyle = ((x + y) / 64) % 2 ? '#2a2236' : '#322943'; ctx.fillRect(x, y, 64, 64);
    }
    for (const r of GD.ROOMS) {
      if (r.kind === 'ktv') {
        ctx.fillStyle = '#1b1028'; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = t / 1500 + i * 2.1 + r.x;
          const px = r.x + r.w / 2 + Math.cos(a) * 120, py = r.h / 2 + 60 + Math.sin(a * 1.3) * 140;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 110);
          const col = [r.neon, '#7a3fff', '#36e0ff'][i];
          g.addColorStop(0, col + '40'); g.addColorStop(1, col + '00');
          ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
        }
        ctx.restore();
        // màn hình karaoke
        rr(r.x + 110, r.y + 20, 180, 58, 8); ctx.fillStyle = '#0a0a12'; ctx.fill();
        ctx.strokeStyle = r.neon; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#9ad7ff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        const lyric = ['♪ la la la ♪', '♫ tình em... ♫', '♪ dzô dzô ♪', '♫ ôi mưa rơi ♫'][Math.floor(t / 2500 + r.x) % 4];
        ctx.fillText(lyric, r.x + 200, r.y + 54);
      } else if (r.kind === 'makeup') {
        ctx.fillStyle = '#3a2238'; ctx.fillRect(r.x, r.y, r.w, r.h);
        for (let y = 0; y < r.h; y += 40) for (let x = r.x; x < r.x + r.w; x += 40) { ctx.fillStyle = 'rgba(255,154,213,.06)'; if (((x + y) / 40) % 2) ctx.fillRect(x, y, 40, 40); }
      }
      if (ghenState && ghenState.room === r.id) {
        ctx.fillStyle = `rgba(255,30,30,${0.18 + 0.15 * Math.sin(t / 90)})`; ctx.fillRect(r.x, r.y, r.w, r.h);
      }
    }
  }

  function drawSolid(s, t) {
    if (s.t === 'wall') {
      ctx.fillStyle = '#3d2a57'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#5b3f82'; ctx.fillRect(s.x, s.y, s.w, Math.min(5, s.h));
    } else if (s.t === 'sofa') {
      rr(s.x, s.y, s.w, s.h, 14); ctx.fillStyle = '#8a1538'; ctx.fill();
      rr(s.x + 8, s.y + 24, s.w - 16, s.h - 28, 10); ctx.fillStyle = '#b01e4a'; ctx.fill();
    } else if (s.t === 'table') {
      rr(s.x, s.y, s.w, s.h, 10); ctx.fillStyle = 'rgba(160,220,255,.35)'; ctx.fill(); ctx.strokeStyle = '#9ad7ff'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = '#2f8f3a'; ctx.fillRect(s.x + 20 + i * 18, s.y + 12, 8, 22); ctx.fillStyle = '#f4d35e'; ctx.fillRect(s.x + 20 + i * 18, s.y + 8, 8, 5); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s.x + 120, s.y + 30, 22, 14, 0, 0, 7); ctx.fill();
      ['#ff5a5a', '#ffd23f', '#7dff7d'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(s.x + 110 + i * 10, s.y + 30, 5, 0, 7); ctx.fill(); });
    } else if (s.t === 'vanity') {
      rr(s.x, s.y + 30, s.w, s.h - 30, 8); ctx.fillStyle = '#f5e1ea'; ctx.fill();
      for (let i = 0; i < 3; i++) {
        const cx = s.x + 55 + i * 105;
        ctx.fillStyle = '#cfe8ff'; ctx.beginPath(); ctx.ellipse(cx, s.y + 22, 34, 22, 0, 0, 7); ctx.fill();
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ctx.fillStyle = Math.sin(t / 200 + k) > 0 ? '#fff6c8' : '#ffd23f'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 40, s.y + 22 + Math.sin(a) * 27, 3, 0, 7); ctx.fill(); }
      }
    } else if (s.t === 'rack') {
      ctx.fillStyle = '#888'; ctx.fillRect(s.x, s.y, s.w, 4);
      ['#ff3f8e', '#d8b25a', '#fff', '#9b1b2e', '#36e0ff'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(s.x + 4 + i * 11, s.y + 6, 9, s.h - 10); });
    } else if (s.t === 'counter') {
      rr(s.x, s.y, s.w, s.h, 10); ctx.fillStyle = '#5b3f82'; ctx.fill(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LỄ TÂN', s.x + s.w / 2, s.y + 32);
    } else if (s.t === 'plant') {
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(s.x + 10, s.y + 20, 20, 20);
      ctx.fillStyle = '#2f9e5a'; ctx.beginPath(); ctx.arc(s.x + 20, s.y + 14, 18, 0, 7); ctx.fill();
    }
  }

  function drawLabels(t) {
    ctx.textAlign = 'center'; ctx.font = 'bold 22px sans-serif';
    for (const r of GD.ROOMS) {
      if (r.kind === 'hall') continue;
      ctx.save(); ctx.shadowColor = r.neon; ctx.shadowBlur = 14 + 4 * Math.sin(t / 300);
      ctx.fillStyle = r.neon; ctx.fillText(r.name, r.x + r.w / 2, GD.ROOM_H + 34); ctx.restore();
    }
    ctx.save(); ctx.shadowColor = '#ff3f8e'; ctx.shadowBlur = 20; ctx.fillStyle = '#ff3f8e'; ctx.font = 'bold 40px sans-serif';
    ctx.fillText('✨ KTV LUNG LINH ✨', GD.W / 2, 700); ctx.restore();
  }

  function bubble(x, y, text) {
    ctx.font = '13px sans-serif';
    const words = text.split(' '), lines = [''];
    for (const w of words) { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (ctx.measureText(t).width > 200 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; }
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18, h = lines.length * 16 + 8;
    rr(x - w / 2, y - h - 4, w, h, 10); ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
    ctx.fillStyle = '#222'; ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, x, y - h + 12 + i * 16));
  }

  function draw(t) {
    const m = me();
    if (m) { cam.x += (m.x - cam.x) * 0.15; cam.y += (m.y - cam.y) * 0.15; }
    ctx.fillStyle = '#0d0814'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.save();
    ctx.translate(innerWidth / 2, innerHeight / 2); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);
    drawFloor(t);
    GD.SOLIDS.filter(s => s.t !== 'sofa').forEach(s => drawSolid(s, t));
    drawLabels(t);

    const ents = [];
    let nearestCust = null, nd = 240;
    if (m) for (const c of customers) { const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < nd) { nd = d; nearestCust = c; } }
    GD.SOLIDS.filter(s => s.t === 'sofa').forEach(s => ents.push({ y: s.y + 20, draw: () => drawSolid(s, t) }));
    for (const c of customers) ents.push({ y: c.y, draw: () => {
      Cartoons.drawUncle(ctx, c.x, c.y, c.type, c, t);
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(custType(c).name + (c.away ? ' (vắng)' : ''), c.x, c.y - 70);
      if (m && c === nearestCust && !c.away && !c.busy) bubble(c.x, c.y - 76, custType(c).hint);
    } });
    for (const id in players) {
      const p = players[id];
      if (id !== myId) { p.rx += (p.x - p.rx) * 0.25; p.ry += (p.y - p.ry) * 0.25; }
      if (p.moving) p.phase += 0.25;
      ents.push({ y: p.ry, draw: () => {
        Cartoons.drawChibi(ctx, p.rx, p.ry, p, p.dir || 1, p.phase, p.moving);
        ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = id === myId ? '#7dffb0' : '#fff';
        ctx.fillText(rankIcon(p.rank) + ' ' + p.name, p.rx, p.ry - 78);
        if (p.serving) { ctx.fillText('🍻', p.rx + 22, p.ry - 60); }
        if (p.chat && p.chat.until > Date.now()) bubble(p.rx, p.ry - 86, p.chat.text);
      } });
    }
    if (ghenState) {
      const r = GD.ROOMS.find(r => r.id === ghenState.room);
      const prog = Math.min(1, (Date.now() - ghenState.start) / 1500);
      ents.push({ y: 9999, draw: () => {
        const x = r.x + r.w / 2, y = GD.ROOM_H + 40 - prog * 120;
        ctx.font = '42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('👩‍🦱🩴', x, y);
        ctx.fillStyle = '#ff4a4a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('ANH ĐÂU RỒIIII!!!', x, y - 40);
      } });
    }
    ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i], p = players[f.id], age = (Date.now() - f.t) / 1500;
      if (age > 1 || !p) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - age; ctx.fillStyle = f.color; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(f.text, p.rx, p.ry - 100 - age * 50); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (myId) updateMe(dt);
    draw(t);
    requestAnimationFrame(loop);
  if (location.search.includes('debug')) window.KTV = { goto: (x, y) => { target = { x, y }; }, me };
  }
  requestAnimationFrame(loop);

  // ---------- Phục vụ khách ----------
  let roundTimer = null, curCust = null;
  socket.on('serve:begin', ({ customerId, type }) => {
    inOverlay = true; curCust = type; target = null;
    $('serve').classList.remove('hidden'); $('serveBody').classList.remove('hidden'); $('serveResult').classList.add('hidden');
    $('serveQuit').classList.remove('hidden');
    const t = GD.CUSTOMER_TYPES[type];
    $('custArt').innerHTML = Cartoons.customerArt(type, 'ok');
    $('custName').textContent = t.name;
    $('custBubble').textContent = t.hint;
    $('options').innerHTML = '';
    Portrait.render($('serveMe'), me(), 'bust');
  });
  socket.on('serve:round', ({ n, total, ask, options, ms }) => {
    $('custArt').innerHTML = Cartoons.customerArt(curCust, 'ok');
    $('custBubble').textContent = ask;
    $('roundNo').textContent = `Yêu cầu ${n}/${total}`;
    const box = $('options'); box.innerHTML = '';
    options.forEach((o, i) => {
      const b = document.createElement('button'); b.textContent = o;
      b.onclick = () => answer(i, b); box.append(b);
    });
    const bar = $('timerBar'); bar.style.transition = 'none'; bar.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${ms}ms linear`; bar.style.width = '0%'; }));
    clearTimeout(roundTimer); roundTimer = setTimeout(() => answer(-1), ms);
  });
  let lastPicked = null;
  function answer(i, btn) {
    clearTimeout(roundTimer);
    [...$('options').children].forEach(b => b.disabled = true);
    lastPicked = btn || null;
    socket.emit('serve:answer', { idx: i });
  }
  socket.on('serve:feedback', ({ ok, late }) => {
    if (lastPicked) lastPicked.classList.add(ok ? 'ok' : 'bad');
    $('custArt').innerHTML = Cartoons.customerArt(curCust, ok ? 'love' : 'mad');
    $('custBubble').textContent = ok ? ['Đúng ý anh!', 'Giỏi quá em!', 'Ngon lành!'][Math.floor(Math.random() * 3)] : late ? 'Chậm quá em ơiii...' : 'Ủa em làm gì vậy???';
  });
  socket.on('serve:result', ({ tip, lines, mood, say, tips, rank }) => {
    clearTimeout(roundTimer);
    $('custArt').innerHTML = Cartoons.customerArt(curCust, mood);
    $('custBubble').textContent = say;
    $('serveBody').classList.add('hidden'); $('serveQuit').classList.add('hidden');
    const r = $('serveResult'); r.classList.remove('hidden');
    r.innerHTML = `<div class="tip">${tip > 0 ? '+' + tip + 'k tip 💸' : 'Không có tip 😭'}</div>
      ${lines.length ? `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
      <p>Tổng tip: <b>${tips.toLocaleString('vi-VN')}k</b> · ${rankIcon(rank)} ${rank}</p>
      <button class="big" id="serveDone">Tiếp tục làm việc</button>`;
    $('serveDone').onclick = closeServe;
    const m = me(); if (m) { m.tips = tips; m.rank = rank; updateHud(); }
  });
  socket.on('serve:end', ({ ghen }) => { closeServe(); if (ghen) toast('Có biến! Bỏ dở phục vụ...', 'warn'); });
  $('serveQuit').onclick = () => socket.emit('serve:quit');
  function closeServe() { clearTimeout(roundTimer); $('serve').classList.add('hidden'); inOverlay = false; }

  // ---------- Phòng trang điểm ----------
  let draft = null, mkPending = false;
  function openMakeup() {
    const m = me(); inOverlay = true; target = null;
    draft = { char: m.char, outfit: m.outfit, makeup: { ...m.makeup } };
    $('makeup').classList.remove('hidden');
    buildMakeup();
  }
  function seg(el, items, cur, onPick) {
    el.innerHTML = '';
    items.forEach((label, i) => { const b = document.createElement('button'); b.textContent = label; if (i === cur) b.className = 'on'; b.onclick = () => onPick(i); el.append(b); });
  }
  function swatch(el, list, cur, onPick) {
    el.innerHTML = '';
    const none = document.createElement('button'); none.className = 'none' + (!cur ? ' on' : ''); none.textContent = 'Không'; none.onclick = () => onPick(null); el.append(none);
    list.forEach(c => { const b = document.createElement('button'); b.style.background = c.hex; b.title = c.name; if (c.id === cur) b.classList.add('on'); b.onclick = () => onPick(c.id); el.append(b); });
  }
  function buildMakeup() {
    const d = draft, mk = d.makeup;
    seg($('mkChar'), GD.CHARACTERS.map(c => c.name), GD.CHARACTERS.findIndex(c => c.id === d.char), i => { d.char = GD.CHARACTERS[i].id; buildMakeup(); });
    seg($('mkOutfit'), GD.OUTFIT_STYLES, d.outfit, i => { d.outfit = i; buildMakeup(); });
    swatch($('mkLip'), GD.LIP_COLORS, mk.lip, id => { mk.lip = id; buildMakeup(); });
    swatch($('mkBlush'), GD.BLUSH_COLORS, mk.blush, id => { mk.blush = id; buildMakeup(); });
    swatch($('mkShadow'), GD.SHADOW_COLORS, mk.shadow, id => { mk.shadow = id; buildMakeup(); });
    $('mkLipA').value = Math.round((mk.lipA || 0.7) * 100);
    $('mkGlitter').checked = !!mk.glitter;
    redrawMakeup();
  }
  function redrawMakeup() {
    if (mkPending) return; mkPending = true;
    requestAnimationFrame(async () => {
      mkPending = false;
      await Portrait.render($('mkFull'), draft, 'full');
      await Portrait.render($('mkFace'), draft, 'face');
    });
  }
  $('mkLipA').oninput = e => { draft.makeup.lipA = e.target.value / 100; redrawMakeup(); };
  $('mkGlitter').onchange = e => { draft.makeup.glitter = e.target.checked; redrawMakeup(); };
  $('mkSave').onclick = () => { socket.emit('look', draft); toast('Đã lưu diện mạo mới 💄'); closeMakeup(); };
  $('mkClose').onclick = closeMakeup;
  function closeMakeup() { $('makeup').classList.add('hidden'); inOverlay = false; }

  // ---------- Đánh ghen ----------
  let ghenTaps = 0, ghenSafe = false;
  socket.on('ghen:start', ({ room, roomName, customerName, victims, ms, taps }) => {
    const mine = victims.includes(myId);
    ghenState = { room, mine, start: Date.now(), taps };
    toast(`🚨 Vợ của ${customerName} đang xông vào ${roomName}!`, 'big');
    if (!mine) return;
    ghenTaps = 0; ghenSafe = false;
    closeServe(); closeMakeup(); inOverlay = true;
    $('ghen').classList.remove('hidden');
    $('ghenArt').innerHTML = Cartoons.wifeArt();
    $('ghenTitle').textContent = `Vợ ${customerName} tới!!!`;
    $('ghenCount').textContent = `0 / ${taps}`;
    const bar = $('ghenBar'); bar.style.transition = 'none'; bar.style.width = '100%';
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `width ${ms}ms linear`; bar.style.width = '0%'; }));
  });
  function ghenTap() {
    if (!ghenState || !ghenState.mine || ghenSafe) return;
    ghenTaps++; socket.emit('ghen:tap');
    $('ghenCount').textContent = `${ghenTaps} / ${ghenState.taps}`;
  }
  $('ghenRun').onpointerdown = e => { e.preventDefault(); ghenTap(); };
  socket.on('ghen:safe', () => { ghenSafe = true; $('ghenCount').textContent = '✅ Thoát rồi! Núp sau quầy lễ tân...'; });
  socket.on('ghen:caught', ({ loss, tips }) => { const m = me(); if (m) { m.tips = tips; updateHud(); } toast(`🩴 Bị dép tổ ong phang! Mất ${loss}k`, 'warn'); });
  socket.on('ghen:end', ({ room }) => {
    if (ghenState && ghenState.mine) {
      $('ghen').classList.add('hidden'); inOverlay = false;
      if (ghenSafe) { const m = me(); m.x = m.rx = GD.SPAWN.x; m.y = m.ry = GD.SPAWN.y + 60; socket.emit('move', { x: m.x, y: m.y, dir: 1, moving: false }); }
    }
    ghenState = null;
  });

  // ---------- Nhạc ----------
  const Music = (() => {
    let list = [], audio = null, on = false, cur = null;
    Portrait.loadAssets().then(a => { list = a.music || []; if (!list.length) $('musicBtn').classList.add('hidden'); });
    function play(room) {
      if (audio) { audio.pause(); audio = null; }
      if (!on || !room || !list.length) return;
      audio = new Audio('/music/' + encodeURIComponent(list[Math.floor(Math.random() * list.length)]));
      audio.volume = 0.5; audio.onended = () => play(room); audio.play().catch(() => { });
    }
    $('musicBtn').onclick = () => { on = !on; $('musicBtn').textContent = on ? '🔊' : '🔈'; play(cur); };
    return { enable() { on = true; $('musicBtn').textContent = '🔊'; }, room(r) { if (r === cur) return; cur = r; play(r); } };
  })();
})();
