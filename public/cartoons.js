// Khách hài + bà vợ đánh ghen (SVG) và nhân vật chibi trên bản đồ (canvas)
(function () {
  function customerSVG(typeId, mood = 'ok') {
    const t = GD.CUSTOMER_TYPES[typeId];
    const skin = '#f0c29a', red = mood === 'love' ? 0.75 : 0.35;
    const mouth = mood === 'love' ? '<path d="M120,190 Q150,225 180,190 Q150,205 120,190Z" fill="#7a2a2a"/>'
      : mood === 'mad' ? '<path d="M125,205 Q150,185 175,205" stroke="#5a2020" stroke-width="5" fill="none" stroke-linecap="round"/>'
      : '<path d="M125,195 Q150,212 175,195" stroke="#5a2020" stroke-width="5" fill="none" stroke-linecap="round"/>';
    const brows = mood === 'mad' ? '<path d="M100,118 L135,130 M200,118 L165,130" stroke="#2a1a10" stroke-width="7" stroke-linecap="round"/>'
      : '<path d="M100,122 Q117,112 135,122 M165,122 Q183,112 200,122" stroke="#2a1a10" stroke-width="6" fill="none" stroke-linecap="round"/>';
    const hair = t.bald ? '<path d="M70,120 Q60,90 80,85 M230,120 Q240,90 220,85" stroke="#2a1a10" stroke-width="10" fill="none"/><ellipse cx="130" cy="70" rx="22" ry="8" fill="#fff" opacity=".45"/>'
      : t.comb ? '<path d="M75,105 Q90,50 150,52 Q215,50 228,100 Q200,72 150,76 Q100,70 75,105Z" fill="#3a2a20"/><path d="M90,80 Q150,60 220,85" stroke="#3a2a20" stroke-width="4" fill="none"/>'
      : '<path d="M72,110 Q70,45 150,42 Q232,45 228,110 Q215,75 150,72 Q88,75 72,110Z" fill="#1a1410"/>';
    const glasses = t.glasses ? '<circle cx="117" cy="140" r="22" fill="rgba(200,230,255,.35)" stroke="#222" stroke-width="5"/><circle cx="183" cy="140" r="22" fill="rgba(200,230,255,.35)" stroke="#222" stroke-width="5"/><path d="M139,140 L161,140" stroke="#222" stroke-width="5"/>' : '';
    const stache = t.mustache ? '<path d="M112,180 Q130,168 150,178 Q170,168 188,180 Q170,188 150,182 Q130,188 112,180Z" fill="#2a1a10"/>' : '';
    const chain = t.chain ? '<path d="M100,262 Q150,320 200,262" stroke="#ffd23f" stroke-width="9" fill="none" stroke-dasharray="10 4"/><circle cx="150" cy="300" r="14" fill="#ffd23f"/>' : '';
    const tie = t.tie ? '<path d="M150,255 L138,270 L150,345 L162,270Z" fill="#c8102e"/>' : '';
    const mic = '<rect x="228" y="250" width="16" height="60" rx="6" fill="#333" transform="rotate(-20 236 280)"/><circle cx="246" cy="244" r="15" fill="#888"/>';
    return `<svg viewBox="0 0 300 380" xmlns="http://www.w3.org/2000/svg">
      <path d="M30,380 Q30,255 150,245 Q270,255 270,380Z" fill="${t.shirt}"/>
      <ellipse cx="150" cy="345" rx="95" ry="50" fill="${t.shirt}" stroke="rgba(0,0,0,.15)" stroke-width="3"/>
      <rect x="128" y="215" width="44" height="40" fill="${skin}"/>
      ${tie}${chain}
      <ellipse cx="150" cy="145" rx="82" ry="95" fill="${skin}"/>
      <ellipse cx="68" cy="150" rx="12" ry="20" fill="${skin}"/><ellipse cx="232" cy="150" rx="12" ry="20" fill="${skin}"/>
      ${hair}${brows}
      <ellipse cx="117" cy="142" rx="8" ry="${mood === 'love' ? 3 : 9}" fill="#222"/><ellipse cx="183" cy="142" rx="8" ry="${mood === 'love' ? 3 : 9}" fill="#222"/>
      ${glasses}
      <ellipse cx="150" cy="168" rx="16" ry="12" fill="#e8a07a"/>
      <ellipse cx="100" cy="178" rx="20" ry="11" fill="#ff5a5a" opacity="${red}"/><ellipse cx="200" cy="178" rx="20" ry="11" fill="#ff5a5a" opacity="${red}"/>
      ${stache}${mouth}${mic}
      ${mood === 'love' ? '<text x="235" y="80" font-size="44">💕</text>' : mood === 'mad' ? '<text x="225" y="80" font-size="44">💢</text>' : ''}
    </svg>`;
  }

  function wifeSVG() {
    return `<svg viewBox="0 0 300 380" xmlns="http://www.w3.org/2000/svg">
      <path d="M30,380 Q30,250 150,240 Q270,250 270,380Z" fill="#3fa36b"/>
      ${Array.from({ length: 9 }, (_, i) => `<circle cx="${60 + (i * 31) % 190}" cy="${290 + (i * 47) % 80}" r="9" fill="#fff" opacity=".6"/>`).join('')}
      <rect x="128" y="210" width="44" height="40" fill="#f0c29a"/>
      <ellipse cx="150" cy="140" rx="78" ry="90" fill="#f0c29a"/>
      <path d="M70,120 Q70,40 150,38 Q230,40 230,120 Q215,70 150,68 Q85,70 70,120Z" fill="#2a1a10"/>
      ${[80, 120, 160, 200].map(x => `<rect x="${x - 12}" y="40" width="24" height="22" rx="10" fill="#ff7ac0"/>`).join('')}
      <path d="M98,108 L138,124 M202,108 L162,124" stroke="#2a1a10" stroke-width="8" stroke-linecap="round"/>
      <circle cx="118" cy="140" r="9" fill="#222"/><circle cx="182" cy="140" r="9" fill="#222"/>
      <ellipse cx="150" cy="198" rx="26" ry="18" fill="#7a2a2a"/><rect x="132" y="186" width="36" height="7" fill="#fff"/>
      <g transform="rotate(-25 250 200)"><rect x="225" y="120" width="52" height="110" rx="24" fill="#ff8a00"/>
      ${[0, 1, 2, 3, 4].map(r => [0, 1, 2].map(c => `<circle cx="${237 + c * 14}" cy="${138 + r * 18}" r="4" fill="#c46200"/>`).join('')).join('')}</g>
      <text x="20" y="70" font-size="46">💢</text><text x="235" y="60" font-size="34">💨</text>
    </svg>`;
  }

  // Ảnh thật (public/cust/<loại>_<ok|love|mad>.webp, wife.webp) nếu có, không thì dùng hình vẽ
  const hasCust = f => { const a = Portrait.assetsSync(); return a && (a.cust || []).includes(f); };
  function customerArt(typeId, mood = 'ok') {
    const f = `${typeId}_${mood}.webp`;
    return hasCust(f) ? `<img src="/cust/${f}" alt="">` : customerSVG(typeId, mood);
  }
  function wifeArt() { return hasCust('wife.webp') ? '<img src="/cust/wife.webp" alt="">' : wifeSVG(); }
  Portrait.loadAssets().then(a => (a.cust || []).forEach(f => { const i = new Image(); i.src = '/cust/' + f; }));

  // ---- Chibi trên bản đồ ----
  function drawChibi(ctx, x, y, look, dir, phase, moving) {
    const c = GD.CHARACTERS.find(c => c.id === look.char) || GD.CHARACTERS[0];
    const oc = c.outfitColors[look.outfit || 0];
    const bob = moving ? Math.abs(Math.sin(phase)) * 3 : 0;
    const step = moving ? Math.sin(phase) * 4 : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 5, 0, 0, 7); ctx.fill();
    ctx.translate(0, -bob);
    // chân
    ctx.fillStyle = c.skin;
    ctx.fillRect(-6 + step / 2, -16, 5, 14); ctx.fillRect(1 - step / 2, -16, 5, 14);
    ctx.fillStyle = look.outfit === 2 ? '#fff' : look.outfit === 3 ? oc : '#ff3f8e';
    if (look.outfit === 2) { ctx.fillRect(-7 + step / 2, -18, 6, 16); ctx.fillRect(1 - step / 2, -18, 6, 16); }
    ctx.fillStyle = '#222'; ctx.fillRect(-7 + step / 2, -3, 7, 3); ctx.fillRect(1 - step / 2, -3, 7, 3);
    // tóc sau
    ctx.fillStyle = c.hair;
    if (c.hairStyle !== 'bob') { ctx.beginPath(); ctx.ellipse(0, -46, 17, 24, 0, 0, 7); ctx.fill(); }
    // thân / váy
    ctx.fillStyle = oc;
    ctx.beginPath();
    if (look.outfit === 0) { ctx.moveTo(-8, -36); ctx.lineTo(8, -36); ctx.lineTo(14, -2); ctx.lineTo(-14, -2); }
    else if (look.outfit === 1) { ctx.moveTo(-9, -36); ctx.lineTo(9, -36); ctx.lineTo(10, -16); ctx.lineTo(-10, -16); }
    else if (look.outfit === 3) { ctx.moveTo(-11, -24); ctx.lineTo(11, -24); ctx.lineTo(14, -6); ctx.lineTo(-14, -6); }
    else { ctx.moveTo(-9, -36); ctx.lineTo(9, -36); ctx.lineTo(11, -10); ctx.lineTo(-11, -10); }
    ctx.closePath(); ctx.fill();
    if (look.outfit === 3) { // áo bikini + bụng trần
      ctx.fillStyle = c.skin; ctx.fillRect(-8, -36, 16, 12);
      ctx.fillStyle = oc; ctx.beginPath(); ctx.ellipse(-4, -33, 4, 3, 0, 0, 7); ctx.ellipse(4, -33, 4, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(9, -64, 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = c.skin; ctx.fillRect(-12, -34, 4, 14); ctx.fillRect(8, -34, 4, 14);
    // đầu
    ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(0, -52, 15, 0, 7); ctx.fill();
    ctx.fillStyle = c.hair; ctx.beginPath(); ctx.arc(0, -56, 16, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillRect(-16, -58, 5, c.hairStyle === 'bob' ? 14 : 24); ctx.fillRect(11, -58, 5, c.hairStyle === 'bob' ? 14 : 24);
    // mắt
    ctx.fillStyle = '#2a1810'; ctx.beginPath(); ctx.ellipse(-5, -50, 2.4, 3.2, 0, 0, 7); ctx.ellipse(6, -50, 2.4, 3.2, 0, 0, 7); ctx.fill();
    const m = look.makeup || {};
    if (m.blush) { ctx.fillStyle = 'rgba(255,110,150,.55)'; ctx.beginPath(); ctx.ellipse(-8, -45, 3, 2, 0, 0, 7); ctx.ellipse(9, -45, 3, 2, 0, 0, 7); ctx.fill(); }
    const lip = (GD.LIP_COLORS.find(l => l.id === m.lip) || {}).hex || '#d98a86';
    ctx.fillStyle = lip; ctx.beginPath(); ctx.ellipse(1, -43, 2.6, 1.4, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawUncle(ctx, x, y, typeId, state, t) {
    const ty = GD.CUSTOMER_TYPES[typeId];
    ctx.save(); ctx.translate(x, y);
    if (state.away) { ctx.globalAlpha = 0.3; }
    const sway = state.away ? 0 : Math.sin(t / 400 + x) * 2;
    ctx.translate(sway, 0);
    ctx.fillStyle = ty.shirt; ctx.beginPath(); ctx.ellipse(0, -18, 22, 20, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0c29a'; ctx.beginPath(); ctx.arc(0, -48, 15, 0, 7); ctx.fill();
    if (!ty.bald) { ctx.fillStyle = '#1f1610'; ctx.beginPath(); ctx.arc(0, -52, 15, Math.PI, 0); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-4, -58, 5, 2, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#222'; ctx.fillRect(-6, -50, 3, 3); ctx.fillRect(4, -50, 3, 3);
    if (ty.glasses) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.strokeRect(-9, -53, 7, 6); ctx.strokeRect(2, -53, 7, 6); }
    if (ty.mustache) { ctx.fillStyle = '#2a1a10'; ctx.fillRect(-6, -42, 12, 3); }
    ctx.fillStyle = 'rgba(255,80,80,.5)'; ctx.beginPath(); ctx.ellipse(-9, -44, 3, 2, 0, 0, 7); ctx.ellipse(9, -44, 3, 2, 0, 0, 7); ctx.fill();
    if (ty.chain) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -34, 8, 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.restore();
  }

  window.Cartoons = { customerSVG, wifeSVG, customerArt, wifeArt, drawChibi, drawUncle };
})();
