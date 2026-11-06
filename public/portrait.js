// Vẽ ảnh nhân vật cỡ lớn + phủ makeup bằng code
// Ảnh thật: public/chars/<id>_<1|2|3>.png  → nếu chưa có thì dùng hình tạm vẽ bằng SVG
(function () {
  const PW = 600, PH = 900;
  let assetList = null, faces = {};
  const imgCache = {};

  async function loadAssets() {
    if (assetList) return assetList;
    try { assetList = await (await fetch('/api/assets')).json(); } catch (e) { assetList = { chars: [], music: [] }; }
    try { const r = await fetch('/faces.json'); if (r.ok) faces = await r.json(); } catch (e) { }
    return assetList;
  }

  function placeholderSVG(c, outfit) {
    const s = c.skin, h = c.hair, oc = c.outfitColors[outfit];
    if (outfit === 3) outfit = 1; if (outfit >= 4) outfit = outfit === 7 ? 1 : 0;
    const shade = 'rgba(0,0,0,.12)';
    let backHair = '', frontHair = '';
    if (c.hairStyle === 'long') {
      backHair = `<path d="M245,140 Q240,80 300,78 Q360,80 355,140 L372,330 Q378,470 352,520 L248,520 Q222,470 228,330 Z" fill="${h}"/>`;
      frontHair = `<path d="M250,150 Q248,92 300,88 Q352,92 350,150 Q338,118 312,112 Q296,130 262,138 Q256,150 254,190 Z" fill="${h}"/>
        <path d="M252,140 Q244,210 256,300 L264,300 Q256,220 262,150 Z" fill="${h}"/><path d="M348,140 Q356,210 344,300 L336,300 Q344,220 338,150 Z" fill="${h}"/>`;
    } else if (c.hairStyle === 'wavy') {
      backHair = `<path d="M245,140 Q236,80 300,76 Q364,80 355,140 Q385,200 365,260 Q392,320 368,380 Q390,440 352,500 L248,500 Q210,440 232,380 Q208,320 235,260 Q215,200 245,140 Z" fill="${h}"/>`;
      frontHair = `<path d="M250,155 Q246,90 300,86 Q354,90 350,155 Q336,112 300,116 Q280,140 252,150 Z" fill="${h}"/>
        <path d="M252,140 Q236,190 254,230 Q238,270 258,310 L266,300 Q252,260 266,226 Q252,190 262,150Z" fill="${h}"/><path d="M348,140 Q364,190 346,230 Q362,270 342,310 L334,300 Q348,260 334,226 Q348,190 338,150Z" fill="${h}"/>`;
    } else {
      backHair = `<path d="M240,150 Q236,80 300,78 Q364,80 360,150 L364,238 L236,238 Z" fill="${h}"/>`;
      frontHair = `<path d="M248,150 Q246,88 300,86 Q354,88 352,150 L350,142 L250,142 Z" fill="${h}"/>
        <path d="M244,130 L238,240 L262,240 L258,150Z" fill="${h}"/><path d="M356,130 L362,240 L338,240 L342,150Z" fill="${h}"/>`;
    }
    const legs = `<path d="M268,470 L262,850 L286,850 L298,500 Z" fill="${s}"/><path d="M332,470 L338,850 L314,850 L302,500 Z" fill="${s}"/>
      <path d="M258,846 L290,846 L292,862 L250,862Z" fill="#222"/><path d="M310,846 L342,846 L350,862 L308,862Z" fill="#222"/>`;
    const body = `<rect x="289" y="222" width="22" height="46" fill="${s}"/>
      <path d="M244,280 Q300,262 356,280 L350,320 Q338,360 334,400 Q352,440 350,480 L250,480 Q248,440 266,400 Q262,360 250,320 Z" fill="${s}"/>
      <path d="M246,282 Q232,300 232,380 L236,480 L250,480 L254,380 Q256,330 262,300Z" fill="${s}"/><path d="M354,282 Q368,300 368,380 L364,480 L350,480 L346,380 Q344,330 338,300Z" fill="${s}"/>`;
    let outfitSvg = '';
    if (outfit === 0) {
      outfitSvg = `<path d="M262,300 Q300,286 338,300 L336,340 Q330,370 332,400 Q350,440 352,480 L392,866 L208,866 L248,480 Q250,440 268,400 Q270,370 264,340 Z" fill="${oc}"/>
        <path d="M270,300 L276,270 M330,300 L324,270" stroke="${oc}" stroke-width="3"/>
        <path d="M300,420 L310,866 L290,866Z" fill="${shade}"/>
        ${Array.from({ length: 28 }, (_, i) => `<circle cx="${230 + (i * 53) % 140}" cy="${330 + (i * 97) % 520}" r="2" fill="#fff" opacity=".7"/>`).join('')}`;
    } else if (outfit === 1) {
      outfitSvg = legs.replace(/<path d="M2[5]8,846[^>]*>|<path d="M310,846[^>]*>/g, '') +
        `<path d="M236,290 Q300,304 364,290 L360,312 Q336,330 334,400 Q352,440 352,500 L248,500 Q248,440 266,400 Q264,330 240,312 Z" fill="${oc}"/>
        <path d="M262,330 Q300,345 338,330" stroke="${shade}" stroke-width="3" fill="none"/>
        <path d="M258,846 L290,846 L292,862 L250,862Z" fill="#ff3f8e"/><path d="M310,846 L342,846 L350,862 L308,862Z" fill="#ff3f8e"/>`;
    } else {
      outfitSvg = `<path d="M262,500 L250,866 L296,866 L300,520 L304,866 L350,866 L338,500 Z" fill="#ffffff" stroke="#e7e0d8"/>
        <path d="M284,226 L316,226 L318,262 L282,262Z" fill="${oc}" stroke="#e0d6c8"/>
        <path d="M244,278 Q300,262 356,278 L370,300 L372,470 L356,472 L346,330 Q336,360 334,400 Q346,430 344,800 L256,800 Q254,430 266,400 Q264,360 254,330 L244,472 L228,470 L230,300 Z" fill="${oc}" stroke="#e7ddd0"/>
        ${[0, 1, 2, 3, 4].map(i => `<circle cx="${280 + i * 9}" cy="${330 + i * 22}" r="7" fill="#f4a6c0" opacity=".8"/><circle cx="${292 + i * 7}" cy="${340 + i * 22}" r="4" fill="#9ccf9a"/>`).join('')}
        <path d="M258,846 L290,846 L292,862 L250,862Z" fill="#d8c3a5"/><path d="M310,846 L342,846 L350,862 L308,862Z" fill="#d8c3a5"/>`;
    }
    const face = `<path d="M256,150 Q256,222 300,240 Q344,222 344,150 Q344,104 300,104 Q256,104 256,150Z" fill="${s}"/>
      <ellipse cx="256" cy="175" rx="6" ry="11" fill="${s}"/><ellipse cx="344" cy="175" rx="6" ry="11" fill="${s}"/>
      ${[276, 324].map((x, i) => `
        <path d="M${x - 15},173 Q${x},160 ${x + 15},172 Q${x},184 ${x - 15},173Z" fill="#fff"/>
        <ellipse cx="${x}" cy="173" rx="7.5" ry="9" fill="#3a2418"/><ellipse cx="${x}" cy="174" rx="4" ry="5" fill="#120a06"/>
        <circle cx="${x - 2.5}" cy="169.5" r="2.4" fill="#fff"/>
        <path d="M${x - 16},172 Q${x},157 ${x + 16},170" stroke="#1a0f0a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M${x + (i ? 14 : -14)},170 l${i ? 5 : -5},-4" stroke="#1a0f0a" stroke-width="2"/>
        <path d="M${x - 13},152 Q${x},146 ${x + 13},151" stroke="${c.hairStyle === 'long' && c.id === 'vy' ? '#b9a99c' : '#3a2a20'}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join('')}
      <path d="M299,186 Q297,196 302,198" stroke="#d2a48e" stroke-width="1.6" fill="none"/>
      <path d="M287,213 Q294,208 300,211 Q306,208 313,213 Q300,216 287,213Z" fill="#d98a86"/>
      <path d="M287,213 Q300,224 313,213 Q300,217 287,213Z" fill="#e59c96"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">
      ${backHair}${outfit === 1 ? '' : legs}${body}${outfitSvg}${face}${frontHair}
      <text x="300" y="895" text-anchor="middle" font-family="sans-serif" font-size="13" fill="rgba(255,255,255,.55)">hình tạm — chờ ảnh thật</text></svg>`;
  }

  function loadImg(src) {
    if (imgCache[src]) return imgCache[src];
    imgCache[src] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    return imgCache[src];
  }

  async function baseImage(charId, outfit) {
    const list = await loadAssets();
    const want = `${charId}_${outfit + 1}`;
    const file = list.chars.find(f => f.replace(/\.\w+$/, '').toLowerCase() === want);
    if (file) { try { return { img: await loadImg('/chars/' + file), real: true, key: want }; } catch (e) { } }
    const c = GD.CHARACTERS.find(c => c.id === charId) || GD.CHARACTERS[0];
    const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(placeholderSVG(c, outfit));
    return { img: await loadImg(src), real: false, key: want };
  }

  function faceFor(charId, key) {
    const c = GD.CHARACTERS.find(c => c.id === charId) || GD.CHARACTERS[0];
    return faces[key] || faces[charId] || c.face;
  }

  // Vẽ ảnh vào khung 600x900 (giữ tỉ lệ, canh giữa)
  function drawNormalized(ctx, img) {
    const sc = Math.min(PW / img.width, PH / img.height);
    const w = img.width * sc, h = img.height * sc;
    ctx.drawImage(img, (PW - w) / 2, PH - h, w, h);
  }

  const hexOf = (list, id) => (list.find(c => c.id === id) || {}).hex;

  function applyMakeup(ctx, f, m) {
    if (!m) return;
    const ew = f.eyeW;
    ctx.save();
    if (m.shadow) {
      const col = hexOf(GD.SHADOW_COLORS, m.shadow);
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.5; ctx.filter = `blur(${ew * 0.12}px)`;
      ctx.fillStyle = col;
      for (const [x, y] of [f.eyeL, f.eyeR]) { ctx.beginPath(); ctx.ellipse(x, y - ew * 0.22, ew * 0.62, ew * 0.26, 0, Math.PI, 0); ctx.fill(); }
    }
    if (m.blush) {
      const col = hexOf(GD.BLUSH_COLORS, m.blush);
      ctx.filter = 'none'; ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.55;
      for (const [x, y] of [f.cheekL, f.cheekR]) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, ew * 0.75);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, ew * 0.75, ew * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (m.lip) {
      const col = hexOf(GD.LIP_COLORS, m.lip), [x, y] = f.lips, lw = f.lipW;
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = m.lipA || 0.7; ctx.filter = `blur(${lw * 0.04}px)`;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - lw / 2, y);
      ctx.quadraticCurveTo(x - lw * 0.25, y - lw * 0.28, x, y - lw * 0.12);
      ctx.quadraticCurveTo(x + lw * 0.25, y - lw * 0.28, x + lw / 2, y);
      ctx.quadraticCurveTo(x, y + lw * 0.42, x - lw / 2, y);
      ctx.fill();
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.35; ctx.filter = `blur(${lw * 0.05}px)`; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(x + lw * 0.08, y + lw * 0.13, lw * 0.14, lw * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (m.glitter) {
      ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9;
      let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      for (const [x, y] of [f.eyeL, f.eyeR]) for (let i = 0; i < 9; i++) {
        const px = x + (rnd() - 0.5) * ew * 1.2, py = y + ew * 0.3 + rnd() * ew * 0.25, r = ew * (0.02 + rnd() * 0.03);
        ctx.fillStyle = i % 3 ? '#fff6c8' : '#ffd1f0'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawAcc(ctx, f, acc) {
    if (!acc) return;
    const ew = f.eyeW, mx = (f.eyeL[0] + f.eyeR[0]) / 2, my = (f.eyeL[1] + f.eyeR[1]) / 2, span = f.eyeR[0] - f.eyeL[0];
    ctx.save();
    if (acc === 'kinh') {
      ctx.fillStyle = 'rgba(20,10,20,.88)'; ctx.strokeStyle = '#d9a441'; ctx.lineWidth = ew * 0.08;
      for (const [x, y] of [f.eyeL, f.eyeR]) { ctx.beginPath(); ctx.ellipse(x, y, ew * 0.75, ew * 0.55, 0, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(f.eyeL[0] + ew * 0.7, my - ew * 0.1); ctx.quadraticCurveTo(mx, my - ew * 0.35, f.eyeR[0] - ew * 0.7, my - ew * 0.1); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (const [x, y] of [f.eyeL, f.eyeR]) { ctx.beginPath(); ctx.ellipse(x - ew * 0.25, y - ew * 0.2, ew * 0.18, ew * 0.1, -0.5, 0, 7); ctx.fill(); }
    } else if (acc === 'vuongmien') {
      const w = span * 1.5, h = ew * 1.3, cx = mx, base = my - span * 1.35;
      const g = ctx.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, '#fff3a8'); g.addColorStop(1, '#d9a441');
      ctx.fillStyle = g; ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = ew * 0.05;
      ctx.beginPath(); ctx.moveTo(cx - w / 2, base);
      const pts = 5;
      for (let i = 0; i <= pts * 2; i++) { const x = cx - w / 2 + (w * i) / (pts * 2); ctx.lineTo(x, i % 2 ? base - h * 0.45 : base - h); }
      ctx.lineTo(cx + w / 2, base); ctx.closePath(); ctx.fill(); ctx.stroke();
      ['#ff3f8e', '#36e0ff', '#ff3f8e'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx + (i - 1) * w * 0.3, base - h * 0.2, ew * 0.13, 0, 7); ctx.fill(); });
    } else if (acc === 'hoa') {
      const cx = f.eyeR[0] + span * 0.75, cy = my - span * 0.75, r = ew * 0.55;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; ctx.fillStyle = i % 2 ? '#ff4f7b' : '#ff6b8f'; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75, r * 0.7, r * 0.5, a, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, 7); ctx.fill();
    } else if (acc === 'ngoctrai') {
      const cx = f.lips[0], cy = f.lips[1] + span * 1.35, rx = span * 1.05, ry = span * 0.55;
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI * 0.12 + (Math.PI * 0.76) * i / 16;
        const x = cx - Math.cos(a) * rx, y = cy + Math.sin(a) * ry - ry * 0.4;
        const g = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, ew * 0.13); g.addColorStop(0, '#fff'); g.addColorStop(1, '#d8cfc4');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, ew * 0.11, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }

  // Ảnh tư thế: chars/<id>_<pose>.webp (hat | nhay). Không có thì trả null
  function poseFile(charId, pose) {
    const list = (assetList && assetList.chars) || [];
    return list.find(f => f.replace(/\.\w+$/, '').toLowerCase() === `${charId}_${pose}`);
  }
  const composed = new Map();
  // Ghép ảnh + makeup + phụ kiện vào khung 600x900 (có cache)
  async function compose(look) {
    const pose = look.pose && poseFile(look.char, look.pose) ? look.pose : null;
    const key = JSON.stringify([look.char, pose || look.outfit, look.makeup || {}, look.acc || null]);
    if (composed.has(key)) return composed.get(key);
    const job = (async () => {
      let img, fkey;
      if (pose) { img = await loadImg('/chars/' + poseFile(look.char, pose)); fkey = `${look.char}_${pose}`; }
      else { const b = await baseImage(look.char, look.outfit); img = b.img; fkey = b.key; }
      const off = document.createElement('canvas'); off.width = PW; off.height = PH;
      const o = off.getContext('2d');
      drawNormalized(o, img);
      const f = pose ? faces[fkey] : faceFor(look.char, fkey);
      if (f) { applyMakeup(o, f, look.makeup); drawAcc(o, f, look.acc); }
      off.face = f || faceFor(look.char, fkey);
      return off;
    })();
    composed.set(key, job);
    if (composed.size > 80) composed.delete(composed.keys().next().value);
    return job;
  }
  // Bản đồng bộ cho vòng lặp vẽ: trả canvas nếu đã sẵn sàng, không thì null (và bắt đầu tải)
  const ready = new Map();
  function spriteSync(look) {
    const pose = look.pose && poseFile(look.char, look.pose) ? look.pose : null;
    const key = JSON.stringify([look.char, pose || look.outfit, look.makeup || {}, look.acc || null]);
    if (ready.has(key)) return ready.get(key);
    if (!ready.has('p:' + key)) { ready.set('p:' + key, 1); compose(look).then(c => ready.set(key, c)); }
    return null;
  }

  // mode = 'full' | 'face' | 'bust'
  async function render(canvas, look, mode = 'full') {
    const off = await compose(look);
    const f = off.face;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let sx = 0, sy = 0, sw = PW, sh = PH;
    if (mode === 'face') {
      const size = f.eyeW * 5.2, cx = f.lips[0], cy = (f.eyeL[1] + f.lips[1]) / 2;
      sw = size; sh = size * canvas.height / canvas.width; sx = cx - sw / 2; sy = cy - sh / 2;
    } else if (mode === 'bust') {
      sh = PH * 0.62; sw = sh * canvas.width / canvas.height; sx = (PW - sw) / 2; sy = Math.max(0, f.eyeL[1] - sh * 0.22);
    } else {
      const sc = Math.min(canvas.width / PW, canvas.height / PH);
      const w = PW * sc, h = PH * sc;
      ctx.drawImage(off, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      return;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  window.Portrait = { render, compose, spriteSync, poseFile, loadAssets, assetsSync: () => assetList, loadImg, baseImage, drawNormalized, PW, PH, placeholderSVG };
})();
