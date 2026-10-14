// NOXCAT TCG battle table UI + deck builder
(function () {
  const N = window.NOX, E = window.NOXGAME;
  const $ = id => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLL_KEY = 'noxcat-tcg-cybercat-1', DECK_KEY = 'noxcat-tcg-deck-1';
  const esc = t => String(t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const card = id => N.CARDS[id - 1];
  const TYPE = N.TYPE;

  // ───────── collection + saved deck (this browser only) ─────────
  function owned() { try { const s = JSON.parse(localStorage.getItem(COLL_KEY)); return (s && s.owned) || {}; } catch (e) { return {}; } }
  function avail() {
    const o = owned(), a = {};
    N.CARDS.forEach(c => { a[c.id] = c.basic ? 99 : Math.max(0, o[c.id] | 0); });
    return a;
  }
  function loadDeck() { try { const d = JSON.parse(localStorage.getItem(DECK_KEY)); if (Array.isArray(d)) return d.filter(id => id >= 1 && id <= N.CARDS.length); } catch (e) {} return null; }
  function saveDeck(d) { try { localStorage.setItem(DECK_KEY, JSON.stringify(d)); } catch (e) {} }

  // ───────── card face images ─────────
  const faces = new Map();
  let queue = Promise.resolve(), backURL = '';
  const toURL = cv => new Promise(res => { try { cv.toBlob(b => res(b ? URL.createObjectURL(b) : cv.toDataURL('image/jpeg', 0.88)), 'image/jpeg', 0.88); } catch (e) { res(''); } });
  function face(id) {
    if (!faces.has(id)) {
      const p = queue.then(() => N.drawCardFace(card(id))).then(toURL).catch(() => '');
      queue = p.then(() => new Promise(r => setTimeout(r, 0)));
      faces.set(id, p);
      p.then(u => { faces.set(id, Promise.resolve(u)); faceNow[id] = u; });
    }
    return faces.get(id);
  }
  const faceNow = {};
  async function ensureBack() { if (!backURL) { await N.fontsReady; backURL = await toURL(N.drawCardBack()); document.documentElement.style.setProperty('--back', `url(${backURL})`); } return backURL; }
  function imgFor(id) {
    const img = document.createElement('img'); img.alt = card(id).name; img.decoding = 'async';
    if (faceNow[id]) img.src = faceNow[id]; else { if (backURL) img.src = backURL; face(id).then(u => { if (u) img.src = u; }); }
    return img;
  }

  // ───────── small helpers ─────────
  const dot = (t, label) => {
    const c = t === 'any' ? TYPE.any.c : TYPE[t].c;
    return `<i class="dot" style="--tc:${c}" title="${TYPE[t].name}">${TYPE[t].n}</i>`;
  };
  function pipStyle(e) {
    const c = e.c;
    if (c.basic) return `background:${TYPE[c.type].c}`;
    if (c.name === '彩虹資源') return 'background:conic-gradient(#ff6b6b,#ffe66b,#6bff9d,#6bc8ff,#c77bff,#ff6b6b)';
    if (c.name === '雙重資源') return 'background:#fff;outline:2px solid #b4f01e;outline-offset:-4px';
    return 'background:#eceee4';
  }
  const ST = { poison: '毒', burn: '灼', sleep: '睡', par: '麻', conf: '亂' };
  const wait = ms => new Promise(r => setTimeout(r, reduce ? Math.min(ms, 120) : ms));
  const isPhone = () => window.matchMedia('(max-width: 1000px)').matches;

  // ───────── UI state ─────────
  let myDeck = null, aiDeck = null, aiType = null;
  const UI = { sel: null, mode: null, busy: false, detail: null, logLines: [], oppName: '電腦', hide: new Set(), born: new Map() };
  const G = () => E.G;
  const me = () => E.P(0), op = () => E.P(1);
  // ON = the online (friend) session; defined in the online section below
  const oppGone = () => ON.inGame && !!ON.nr && !ON.oppPeer();
  const myTurnNow = () => G() && !G().over && G().cur === 0 && !UI.busy && !UI.asking && !(ON.role === 'guest' && oppGone());
  // Actions: a guest sends them to the host's engine; everyone else runs them locally.
  const A = {};
  ['playBasic', 'playCmd', 'evolve', 'attach', 'playTool', 'retreat', 'useAbility', 'attack', 'endTurn'].forEach(k => {
    A[k] = (...a) => ON.role === 'guest' && ON.inGame ? remoteAct(k, a.slice(1).map(x => x && typeof x === 'object' ? x.uid : x)) : E[k](...a);
  });

  // ───────── battle effects: particles, energy, Hearthstone-style attacks ─────────
  const fxRoot = () => $('fx');
  const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
  const finished = a => a.finished.catch(() => {});
  const RAINBOW = ['#ff6b6b', '#ffe66b', '#6bff9d', '#6bc8ff', '#c77bff'];
  function addFx(cls, x, y, css) {
    const el = document.createElement('div'); el.className = cls;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (css) Object.assign(el.style, css);
    fxRoot().appendChild(el); return el;
  }
  function sparks(x, y, colors, n, spread, dur) {
    if (reduce) return;
    for (let i = 0; i < n; i++) {
      const col = colors[i % colors.length], ang = Math.random() * Math.PI * 2, d = spread * (0.45 + Math.random() * 0.75), s = 4 + Math.random() * 6;
      const el = addFx('spark', x, y, { width: s + 'px', height: s + 'px', background: col, boxShadow: `0 0 10px ${col}` });
      finished(el.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d}px)) scale(.2)`, opacity: 0 }
      ], { duration: dur * (0.7 + Math.random() * 0.6), easing: 'cubic-bezier(.1,.75,.3,1)' })).then(() => el.remove());
    }
  }
  function ring(x, y, col, size, dur) {
    const el = addFx('ring', x, y, { width: size + 'px', height: size + 'px', borderColor: col, boxShadow: `0 0 18px ${col}, inset 0 0 12px ${col}` });
    return finished(el.animate([{ transform: 'translate(-50%,-50%) scale(.25)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }],
      { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)' })).then(() => el.remove());
  }
  function flash(x, y, col, size) {
    const el = addFx('flash', x, y, { width: size + 'px', height: size + 'px', background: `radial-gradient(circle, #fff 0%, ${col} 32%, transparent 68%)` });
    return finished(el.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.35)', opacity: 0 }],
      { duration: 400, easing: 'ease-out' })).then(() => el.remove());
  }
  function tint(col, a) {
    const el = document.createElement('div'); el.className = 'tint'; el.style.background = col; fxRoot().appendChild(el);
    finished(el.animate([{ opacity: a }, { opacity: 0 }], { duration: 450, easing: 'ease-out' })).then(() => el.remove());
  }
  function shakeMat(power) {
    const m = $('mat'); if (!m || reduce) return;
    const p = Math.min(9, 2 + power / 25);
    m.animate([{ transform: 'none' }, { transform: `translate(${-p}px, ${p * .5}px)` }, { transform: `translate(${p * .8}px, ${-p * .4}px)` }, { transform: `translate(${-p * .4}px, ${p * .3}px)` }, { transform: 'none' }], { duration: 340, easing: 'ease-out' });
  }
  const typeCol = c => c && TYPE[c.type] ? TYPE[c.type].c : '#eceee4';
  function energyCol(c) {
    if (c.basic) return TYPE[c.type].c;
    if (c.name === '雙重資源') return '#b4f01e';
    return '#ffffff';
  }

  // lightning: jagged bolts over the card while it flickers
  function boltPath(w, h) {
    let x = w * (0.2 + Math.random() * 0.6), d = `M${x.toFixed(1)} 0`;
    for (let i = 1; i <= 8; i++) { x = Math.max(4, Math.min(w - 4, x + (Math.random() - .5) * w * 0.5)); d += ` L${x.toFixed(1)} ${(h * i / 8).toFixed(1)}`; }
    return d;
  }
  async function zap(el) {
    const r = el.getBoundingClientRect(), pad = 22, w = r.width + pad * 2, h = r.height + pad * 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'zap'); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    Object.assign(svg.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: w + 'px', height: h + 'px' });
    fxRoot().appendChild(svg);
    tint('#ffe45c', .18);
    el.animate([
      { filter: 'brightness(1)', transform: 'none' },
      { filter: 'brightness(2.3) saturate(1.5)', transform: 'translate(-3px,1px)' },
      { filter: 'brightness(.8)', transform: 'translate(3px,-1px)' },
      { filter: 'brightness(2) saturate(1.4)', transform: 'translate(-2px,0)' },
      { filter: 'brightness(.9)', transform: 'translate(2px,1px)' },
      { filter: 'brightness(1)', transform: 'none' }
    ], { duration: 560 });
    const c = centerOf(el);
    sparks(c.x, c.y, ['#fff6b0', '#ffd23f'], 12, r.width * .8, 420);
    for (let k = 0; k < 5; k++) {
      svg.innerHTML = [0, 1, 2].map(i => { const d = boltPath(w, h); return `<path d="${d}" stroke="#ffd23f" stroke-width="${i ? 8 : 12}" opacity=".35"/><path d="${d}" stroke="#fffbe0" stroke-width="${i ? 1.8 : 3.2}"/>`; }).join('');
      svg.style.opacity = '1'; await wait(70);
      svg.style.opacity = k % 2 ? '.2' : '.6'; await wait(40);
    }
    svg.remove();
  }
  async function energyFx(uid, cid) {
    const el = slotNode(uid), c = card(cid); if (!el || !c) return;
    const col = energyCol(c), rainbow = c.name === '彩虹資源', cols = rainbow ? RAINBOW : [col, '#ffffff'];
    const to = centerOf(el);
    if (!reduce) {
      const src = el.closest('#me-zone') ? $('hand') : (document.querySelector('#opp-zone .handcount') || $('opp-zone'));
      const f = centerOf(src);
      const orb = addFx('orb', f.x, f.y, { background: rainbow ? `conic-gradient(${RAINBOW.join(',')},${RAINBOW[0]})` : `radial-gradient(circle at 35% 30%, #fff, ${col} 60%)`, boxShadow: `0 0 18px ${col}, 0 0 4px #fff` });
      const dx = to.x - f.x, dy = to.y - f.y;
      await finished(orb.animate([
        { transform: 'translate(-50%,-50%) scale(.5)', opacity: .4 },
        { transform: `translate(calc(-50% + ${dx * .5}px), calc(-50% + ${dy * .5 - 50}px)) scale(1.25)`, opacity: 1, offset: .55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: 1 }
      ], { duration: 420, easing: 'cubic-bezier(.45,0,.55,1)' }));
      orb.remove();
    }
    const node = slotNode(uid) || el, t = centerOf(node);
    ring(t.x, t.y, cols[0], t.r.width * 1.25, 520);
    sparks(t.x, t.y, cols, 16, t.r.width * .85, 520);
    node.animate([{ boxShadow: `0 0 0 0 ${col}` }, { boxShadow: `0 0 28px 8px ${col}` }, { boxShadow: '0 0 0 0 transparent' }], { duration: 650 });
    if (c.basic && c.type === 'volt' && !reduce) await zap(node); else await wait(240);
  }

  // attacks: the attacker lifts off the mat, lunges into the defender, and slides back
  async function attackFx(aUid, dUid, col, label, dmg) {
    const a = slotNode(aUid), d = dUid != null ? slotNode(dUid) : null;
    if (!a || reduce) { banner(label, true); if (d) { const c = centerOf(d); flash(c.x, c.y, col, c.r.width * 1.4); } await wait(560); return; }
    const ra = a.getBoundingClientRect();
    const ghost = a.cloneNode(true);
    ghost.className = 'pc ghost'; ghost.removeAttribute('tabindex'); ghost.setAttribute('aria-hidden', 'true');
    ghost.querySelectorAll('.hp,.hpbar,.sts,.float').forEach(x => x.remove());
    Object.assign(ghost.style, { left: ra.left + 'px', top: ra.top + 'px', width: ra.width + 'px', height: ra.height + 'px' });
    ghost.style.setProperty('--tc', col);
    const cap = document.createElement('div'); cap.className = 'atk-cap'; cap.textContent = label; ghost.appendChild(cap);
    fxRoot().appendChild(ghost);
    UI.hide.add(aUid); a.style.visibility = 'hidden';
    const cleanup = () => { ghost.remove(); UI.hide.delete(aUid); const n = slotNode(aUid); if (n) n.style.visibility = ''; };
    const up = 'translate(0px,-16px) scale(1.16) rotate(0deg)';
    await finished(ghost.animate([
      { transform: 'translate(0px,0px) scale(1) rotate(0deg)', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.5))' },
      { transform: up, filter: `drop-shadow(0 26px 22px rgba(0,0,0,.75)) drop-shadow(0 0 16px ${col})` }
    ], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.25)', fill: 'forwards' }));
    if (!(d && dmg > 0)) {
      // a move without direct damage: the card glows and pulses in place
      const c = centerOf(ghost);
      ring(c.x, c.y, col, ra.width * 1.5, 600); sparks(c.x, c.y, [col, '#fff'], 14, ra.width, 600);
      await wait(380);
      finished(ghost.animate([{ transform: up }, { transform: 'translate(0px,0px) scale(1) rotate(0deg)' }], { duration: 300, easing: 'ease-in-out', fill: 'forwards' })).then(cleanup);
      return;
    }
    const rd = d.getBoundingClientRect();
    const dx = rd.left + rd.width / 2 - (ra.left + ra.width / 2), dy = rd.top + rd.height / 2 - (ra.top + ra.height / 2);
    const dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
    const reach = (Math.abs(uy) * (ra.height * 1.1 + rd.height) + Math.abs(ux) * (ra.width * 1.1 + rd.width)) / 2;
    const stop = Math.max(0, dist - reach * 0.78);
    const tx = ux * stop, ty = uy * stop, rot = Math.max(-12, Math.min(12, dx / 25));
    const back = `translate(${(-ux * 14).toFixed(1)}px,${(-16 - uy * 14).toFixed(1)}px) scale(1.2) rotate(${(-rot / 2).toFixed(1)}deg)`;
    const hit = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(1.08) rotate(${rot.toFixed(1)}deg)`;
    await finished(ghost.animate([{ transform: up }, { transform: back }], { duration: 150, easing: 'ease-out', fill: 'forwards' }));
    await finished(ghost.animate([{ transform: back }, { transform: hit }], { duration: 170, easing: 'cubic-bezier(.6,0,1,.6)', fill: 'forwards' }));
    // impact
    const dc = centerOf(d), ix = dc.x - ux * rd.height * 0.32, iy = dc.y - uy * rd.height * 0.32;
    flash(ix, iy, col, Math.max(140, rd.width * 1.6)); ring(ix, iy, col, rd.width * 1.2, 450);
    sparks(ix, iy, [col, '#ffffff', '#ffd6a0'], 22, rd.width * 1.1, 520);
    shakeMat(dmg);
    d.animate([{ transform: 'none' }, { transform: `translate(${(ux * 12).toFixed(1)}px,${(uy * 12).toFixed(1)}px) rotate(${(rot / 2).toFixed(1)}deg)` }, { transform: 'translate(-4px,2px)' }, { transform: 'none' }], { duration: 360, easing: 'ease-out' });
    finished(ghost.animate([
      { transform: hit },
      { transform: `translate(${(tx * .8).toFixed(1)}px,${(ty * .8).toFixed(1)}px) scale(1.12) rotate(${(rot * .5).toFixed(1)}deg)`, offset: .25 },
      { transform: 'translate(0px,0px) scale(1) rotate(0deg)' }
    ], { duration: 460, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' })).then(cleanup);
    await wait(70);
  }
  function hitFx(uid, n) {
    const el = slotNode(uid); if (!el) return;
    el.animate([{ transform: 'none' }, { transform: 'translateX(-7px) rotate(-2deg)' }, { transform: 'translateX(7px) rotate(2deg)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 400 });
    const h = document.createElement('div'); h.className = 'hurt'; el.appendChild(h); setTimeout(() => h.remove(), 520);
    const f = document.createElement('div'); f.className = 'float' + (n >= 100 ? ' big' : ''); f.textContent = '−' + n; el.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }
  async function koFx(uid) {
    const el = slotNode(uid); if (!el) return;
    const c = centerOf(el);
    const tag = addFx('ko-tag', c.x, c.y); tag.textContent = '擊倒';
    finished(tag.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15)', opacity: 1, offset: .25 }, { transform: 'translate(-50%,-80%) scale(1)', opacity: 0 }], { duration: 1000, easing: 'ease-out' })).then(() => tag.remove());
    sparks(c.x, c.y, ['#ffffff', '#9aa093', '#ff5a4e'], 20, c.r.width, 600);
    if (reduce) { el.style.opacity = '0'; await wait(300); return; }
    await finished(el.animate([
      { filter: 'brightness(1)', transform: 'none', opacity: 1 },
      { filter: 'brightness(2.6) grayscale(1)', transform: 'scale(1.06)', opacity: 1, offset: .25 },
      { filter: 'grayscale(1) brightness(.5)', transform: 'translateY(26px) rotate(-12deg) scale(.7)', opacity: 0 }
    ], { duration: 680, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' }));
  }
  function evoFx(uid) {
    const el = slotNode(uid); if (!el) return;
    const c = centerOf(el);
    flash(c.x, c.y, '#f5c451', c.r.width * 1.8); ring(c.x, c.y, '#f5c451', c.r.width * 1.4, 650);
    sparks(c.x, c.y, ['#f5c451', '#ffffff', '#b4f01e'], 22, c.r.width * 1.1, 700);
    el.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.12)', filter: 'brightness(2.2)', offset: .3 }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 700, easing: 'ease-out' });
  }

  // ───────── table effects (shared by local play and by a guest replaying the host's table) ─────────
  const slotNode = uid => document.querySelector(`.pc[data-slot="${uid}"]`);
  const show = {
    async coin(r, label) {
      const el = document.createElement('div'); el.className = 'coinfx';
      el.innerHTML = `<i class="${r ? '' : 'tails'}">${r ? '正' : '反'}</i><span>${esc(label)}：${r ? '正面' : '反面'}</span>`;
      $('fx').appendChild(el); await wait(820); el.remove();
    },
    hit: (uid, n) => hitFx(uid, n),
    ko: uid => koFx(uid),
    evo: uid => evoFx(uid),
    energy: (uid, id) => energyFx(uid, id),
    attack: (a, d, col, label, dmg) => attackFx(a, d, col, label, dmg),
    async play(id) {
      const el = document.createElement('div'); el.className = 'played'; el.appendChild(imgFor(id));
      $('fx').appendChild(el); await wait(950); el.remove();
    },
    banner(text, small) { banner(text, small); }
  };
  const hosting = () => ON.role === 'host' && ON.inGame;

  // ───────── IO hooks for the engine ─────────
  const io = {
    aiDelay: reduce ? 120 : 520,
    log(t, cls) {
      UI.logLines.push({ t, cls });
      const p = document.createElement('p'); if (cls) p.className = cls; p.textContent = t;
      const box = $('log'); box.appendChild(p);
      while (box.children.length > 260) box.firstChild.remove();
      box.scrollTop = box.scrollHeight;
      if (cls !== 'turn') $('status-text').innerHTML = esc(t);
      markDirty();
    },
    render() { render(); markDirty(); },
    wait,
    async coin(r, label) { if (hosting()) { flush(); netSend({ t: 'fx', k: 'coin', r, l: label }); } await show.coin(r, label); },
    hit(s, n) { render(); if (hosting()) { flush(); netSend({ t: 'fx', k: 'hit', u: s.uid, n }); } show.hit(s.uid, n); },
    async ko(s) { if (hosting()) { flush(); netSend({ t: 'fx', k: 'ko', u: s.uid }); } await show.ko(s.uid); },
    evolve(s) { render(); if (hosting()) { flush(); netSend({ t: 'fx', k: 'evo', u: s.uid }); } show.evo(s.uid); },
    async energy(s, e) { if (hosting()) { flush(); netSend({ t: 'fx', k: 'en', u: s.uid, id: e.c.id }); } await show.energy(s.uid, e.c.id); },
    turnBanner(pi) {
      banner(pi === 0 ? '你的回合' : `${UI.oppName}的回合`);
      if (hosting()) { flush(); netSend({ t: 'fx', k: 'banner', x: pi === 1 ? '你的回合' : `${E.P(0).name}的回合` }); }
    },
    async showPlay(pi, inst) {
      if (hosting() && pi === 0) { flush(); netSend({ t: 'fx', k: 'play', id: inst.c.id }); }
      if (pi === 1) await show.play(inst.c.id);
    },
    async attackFx(pi, m) {
      const a = E.P(pi).active, d = E.P(1 - pi).active;
      const label = `${m.name}${m.dmg ? ' ' + m.dmg : ''}`, col = typeCol(a && E.top(a)), dmg = E.dmgNum(m);
      if (hosting()) { flush(); netSend({ t: 'fx', k: 'atk', a: a ? a.uid : null, d: d ? d.uid : null, c: col, x: label, n: dmg }); }
      await show.attack(a ? a.uid : null, d ? d.uid : null, col, label, dmg);
    },
    ask: (pi, req) => hosting() && pi === 1 ? remoteAsk(req) : askModal(req),
    gameOver(w, why) {
      if (hosting()) { flush(); netSend({ t: 'over', g: ON.gid, w: 1 - w, y: why }); }
      if (!UI.noResult) setTimeout(() => showResult(w, why), 900);
    }
  };
  function banner(text, small) {
    const el = document.createElement('div'); el.className = 'banner' + (small ? ' small' : ''); el.textContent = text;
    $('fx').appendChild(el); setTimeout(() => el.remove(), 950);
  }

  // ───────── board rendering ─────────
  function slotEl(s, owner, active) {
    const top = E.top(s), el = document.createElement('div');
    el.className = 'pc' + (active ? ' active' : '');
    el.dataset.slot = s.uid; el.tabIndex = 0;
    if (UI.hide.has(s.uid)) el.style.visibility = 'hidden';
    if (!UI.born.has(s.uid)) UI.born.set(s.uid, performance.now());
    const age = performance.now() - UI.born.get(s.uid);
    if (age < 520 && !reduce) { el.classList.add('enter'); el.style.animationDelay = `-${Math.round(age)}ms`; }
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${owner === 0 ? '你的' : '對手的'}${top.name}，剩 ${E.hpLeft(s)} NP`);
    el.appendChild(imgFor(top.id));
    const left = E.hpLeft(s), low = left <= top.np * 0.34;
    el.insertAdjacentHTML('beforeend', `<span class="hp${low ? ' low' : ''}">${left}</span><span class="hpbar"><i class="${low ? 'low' : ''}" style="width:${Math.max(0, left / top.np * 100)}%"></i></span>`);
    if (s.energy.length) el.insertAdjacentHTML('beforeend', `<span class="pips">${s.energy.map(e => `<i style="${pipStyle(e)}" title="${esc(e.c.name)}"></i>`).join('')}</span>`);
    if (s.tool) el.insertAdjacentHTML('beforeend', `<span class="tool" title="${esc(s.tool.c.name)}">裝</span>`);
    const sts = Object.keys(s.status).map(k => `<span class="st-${k}">${ST[k]}</span>`);
    if (E.fxOn(s, 'prevent')) sts.push('<span class="st-fx">護</span>');
    if (E.fxOn(s, 'reduce')) sts.push(`<span class="st-fx">−${s.fx.reduce.n}</span>`);
    if (sts.length) el.insertAdjacentHTML('beforeend', `<span class="sts">${sts.join('')}</span>`);
    if (UI.mode && UI.mode.valid.has(s)) el.classList.add('target');
    el.addEventListener('click', () => clickSlot(s, owner));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickSlot(s, owner); } });
    return el;
  }
  function prizesEl(p) {
    const d = document.createElement('div'); d.className = 'pile';
    const taken = p.prizesTaken || 0, total = p.prizes.length + taken;
    d.innerHTML = `<div class="prizes">${Array.from({ length: Math.max(4, total) }, (_, i) => `<i class="${i < p.prizes.length ? '' : 'gone'}" style="${i < p.prizes.length ? 'background-image:var(--back)' : ''}"></i>`).join('')}</div><div class="zone-label">戰利品 ${p.prizes.length}</div>`;
    return d;
  }
  function pilesEl(p, pi) {
    const d = document.createElement('div'); d.className = 'pile';
    const top = p.discard[p.discard.length - 1];
    d.innerHTML = `<div class="piles"><div class="mini" title="牌庫" style="background-image:var(--back)"><b>${p.deck.length}</b></div><div class="mini" title="棄牌區" data-discard="${pi}" style="${top && faceNow[top.c.id] ? `background-image:url(${faceNow[top.c.id]})` : ''}"><b>${p.discard.length}</b></div></div><div class="zone-label">牌庫・棄牌</div>`;
    d.querySelector('[data-discard]').addEventListener('click', () => askModal({ title: `${pi === 0 ? '你的' : '對手的'}棄牌區（${p.discard.length} 張）`, options: p.discard.slice().reverse().map(c => ({ value: c, card: c })), viewOnly: true }));
    if (top) face(top.c.id).then(u => { const m = d.querySelector('[data-discard]'); if (m && u) m.style.backgroundImage = `url(${u})`; });
    return d;
  }
  function benchEl(p, pi) {
    const wrap = document.createElement('div');
    const b = document.createElement('div'); b.className = 'bench';
    p.bench.forEach(s => b.appendChild(slotEl(s, pi, false)));
    for (let i = p.bench.length; i < 4; i++) { const e = document.createElement('div'); e.className = 'empty'; b.appendChild(e); }
    wrap.appendChild(b);
    wrap.insertAdjacentHTML('beforeend', `<div class="zone-label">後援區 ${p.bench.length}/4</div>`);
    return wrap;
  }
  function frontEl(p, pi) {
    const wrap = document.createElement('div');
    const f = document.createElement('div'); f.className = 'front';
    if (p.active) f.appendChild(slotEl(p.active, pi, true)); else f.innerHTML = '<div class="bench"><div class="empty" style="width:var(--wa)"></div></div>';
    wrap.appendChild(f);
    wrap.insertAdjacentHTML('beforeend', `<div class="zone-label">${pi === 0 ? '你的前線' : '對手前線'}</div>`);
    return wrap;
  }
  function zone(el, prz, act, bench, piles) {
    el.innerHTML = '';
    prz.classList.add('a-prz'); act.classList.add('a-act'); bench.classList.add('a-bench');
    const pw = document.createElement('div'); pw.className = 'a-piles'; piles.forEach(x => pw.appendChild(x));
    [prz, act, bench, pw].forEach(x => el.appendChild(x));
  }
  function render() {
    const g = G(); if (!g) return;
    const P0 = me(), P1 = op();
    const hc = document.createElement('div'); hc.className = 'pile';
    hc.innerHTML = `<div class="handcount">${Array.from({ length: Math.min(P1.hand.length, 8) }, () => '<i style="background-image:var(--back)"></i>').join('')}</div><div class="zone-label">手牌 ${P1.hand.length}</div>`;
    zone($('opp-zone'), prizesEl(P1), frontEl(P1, 1), benchEl(P1, 1), [pilesEl(P1, 1), hc]);
    zone($('me-zone'), prizesEl(P0), frontEl(P0, 0), benchEl(P0, 0), [pilesEl(P0, 0)]);
    // stadium
    const st = $('stadium'); st.innerHTML = '';
    if (g.stadium) {
      const m = document.createElement('div'); m.className = 'mini'; m.style.width = '54px'; m.title = g.stadium.c.name;
      face(g.stadium.c.id).then(u => { if (u) m.style.backgroundImage = `url(${u})`; });
      m.addEventListener('click', () => showCard(g.stadium.c.id));
      st.appendChild(m); st.insertAdjacentHTML('beforeend', `<div class="zone-label">場地</div>`);
    }
    $('btn-end').disabled = !myTurnNow();
    $('me-zone').classList.toggle('turn', !g.over && g.cur === 0);
    $('opp-zone').classList.toggle('turn', !g.over && g.cur === 1);
    renderHand(); renderActionbar();
    if (UI.detail) renderDetail();
  }
  function playableNow(inst) {
    if (!myTurnNow()) return false;
    const c = inst.c, p = me();
    if (E.isBasicCat(c)) return p.bench.length < 4;
    if (E.isEvo(c)) return E.evoTargets(p, inst).length > 0;
    if (E.isEnergy(c)) return E.inPlay(p).some(s => E.canAttach(0, inst, s));
    if (E.isCmd(c)) return E.canPlayCmd(0, inst);
    return false;
  }
  function renderHand() {
    const h = $('hand'); h.innerHTML = '';
    me().hand.forEach(inst => {
      const el = document.createElement('div'); el.className = 'pc'; el.tabIndex = 0; el.setAttribute('role', 'button');
      el.setAttribute('aria-label', inst.c.name);
      el.appendChild(imgFor(inst.c.id));
      const ok = playableNow(inst);
      if (ok) el.insertAdjacentHTML('beforeend', '<span class="can"></span>');
      if (UI.sel === inst) el.classList.add('sel');
      el.addEventListener('click', () => selectHand(inst));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectHand(inst); } });
      h.appendChild(el);
    });
  }
  function renderActionbar() {
    const bar = $('actionbar'), g = G();
    const logBtn = isPhone() ? '<button class="btn btn-ghost btn-small" data-act="log">紀錄</button>' : '';
    if (g.over) { bar.innerHTML = `<span class="prompt">對戰結束</span>${logBtn}`; bindBar(); return; }
    if (ON.inGame && oppGone()) {
      const btn = ON.role === 'host' ? '<button class="btn btn-ghost btn-small" data-act="claim">判對手棄權</button>' : '<button class="btn btn-ghost btn-small" data-act="leave-game">離開對戰</button>';
      bar.innerHTML = `<span class="prompt">${esc(UI.oppName)}離線了，等待重新連線…</span>${btn}${logBtn}`; bindBar(); return;
    }
    if (ON.pendingAsk) { bar.innerHTML = `<span class="prompt">等 ${esc(UI.oppName)} 選擇…</span>${logBtn}`; bindBar(); return; }
    if (g.cur !== 0) { bar.innerHTML = `<span class="prompt">${ON.inGame ? `${esc(UI.oppName)} 行動中…` : '電腦思考中…'}</span>${logBtn}`; bindBar(); return; }
    if (UI.busy || UI.asking) { bar.innerHTML = `<span class="prompt">處理中…</span>${logBtn}`; bindBar(); return; }
    if (UI.mode) {
      bar.innerHTML = `<span class="prompt">${esc(UI.mode.prompt)}</span><button class="btn btn-ghost btn-small" data-act="cancel">取消</button>`;
      bindBar(); return;
    }
    if (UI.sel) {
      const c = UI.sel.c, p = me(), btns = [];
      let prompt = `<b>${esc(c.name)}</b>`;
      if (E.isBasicCat(c)) btns.push(`<button class="btn btn-primary btn-small" data-act="bench" ${p.bench.length < 4 ? '' : 'disabled'}>放到後援區</button>`), prompt += p.bench.length < 4 ? '' : ' <small>後援區已滿</small>';
      else if (E.isEvo(c)) { const ts = E.evoTargets(p, UI.sel); prompt += ts.length ? ' <small>點要覺醒的 NOXCAT</small>' : ` <small>${G().turn < 3 ? '雙方第一回合不能覺醒' : `場上沒有可以覺醒的「${esc(c.from)}」`}</small>`; }
      else if (E.isEnergy(c)) prompt += E.inPlay(p).some(s => E.canAttach(0, UI.sel, s)) ? ' <small>點要貼上的 NOXCAT</small>' : ' <small>這回合已經貼過資源</small>';
      else if (E.isCmd(c, '裝備')) prompt += ' <small>點要裝備的 NOXCAT</small>';
      else if (E.isCmd(c)) { const ok = E.canPlayCmd(0, UI.sel); btns.push(`<button class="btn btn-primary btn-small" data-act="play" ${ok ? '' : 'disabled'}>使用</button>`); if (!ok) prompt += ` <small>${cmdWhy(UI.sel)}</small>`; }
      btns.push('<button class="btn btn-ghost btn-small" data-act="view">查看</button>', '<button class="btn btn-ghost btn-small" data-act="cancel">取消</button>');
      bar.innerHTML = `<span class="prompt">${prompt}</span>${btns.join('')}`;
      bindBar(); return;
    }
    const a = me().active;
    const atk = a ? `<button class="btn btn-ghost btn-small" data-act="active">攻擊・撤離</button>` : '';
    bar.innerHTML = `<span class="prompt">點手牌出牌，或點你的前線 NOXCAT 攻擊。</span>${atk}${logBtn}`;
    bindBar();
  }
  function cmdWhy(inst) {
    const c = inst.c, p = me(), g = G();
    if (c.sub === '夥伴') return p.supporter ? '這回合已經用過夥伴卡' : g.turn === 1 ? '先攻第一回合不能用夥伴卡' : '現在沒有可用的目標';
    if (c.sub === '道具') return p.noItems >= g.turn ? '這回合不能使用道具卡' : '現在沒有可用的目標';
    if (c.sub === '場地') return p.stadiumPlayed ? '這回合已經用過場地卡' : '場上已經是這張場地';
    return '';
  }
  function bindBar() {
    $('actionbar').querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => barAction(b.dataset.act)));
  }
  function barAction(a) {
    const inst = UI.sel;
    if (a === 'cancel') { clearSel(); return; }
    if (a === 'log') { const i = $('info'); i.classList.add('open', 'showlog'); return; }
    if (a === 'view') { showCard(inst.c.id, true); return; }
    if (a === 'active') { if (me().active) clickSlot(me().active, 0); return; }
    if (a === 'bench') act(() => A.playBasic(0, inst));
    if (a === 'play') act(() => A.playCmd(0, inst));
    if (a === 'claim' && ON.role === 'host' && G() && !G().over && confirm(`判定 ${UI.oppName} 棄權，結束這場對戰？`)) E.forfeit(1, `${UI.oppName}斷線太久`);
    if (a === 'leave-game') leaveOnlineGame();
  }
  function clearSel() { UI.sel = null; UI.mode = null; render(); }
  async function act(fn) {
    UI.sel = null; UI.mode = null; UI.busy = true; closeSheet(); render();
    try { await fn(); } catch (e) { console.error(e); io.log('發生錯誤：' + e.message); }
    UI.busy = false; render();
  }

  // ───────── interactions ─────────
  function selectHand(inst) {
    if (!myTurnNow()) { showCard(inst.c.id, true); return; }
    if (UI.sel === inst) { clearSel(); return; }
    UI.sel = inst; UI.mode = null;
    const c = inst.c, p = me();
    let valid = [];
    if (E.isEvo(c)) valid = E.evoTargets(p, inst);
    else if (E.isEnergy(c)) valid = E.inPlay(p).filter(s => E.canAttach(0, inst, s));
    else if (E.isCmd(c, '裝備')) valid = E.inPlay(p).filter(s => !s.tool);
    if (valid.length) {
      UI.mode = { kind: E.isEvo(c) ? 'evolve' : E.isEnergy(c) ? 'attach' : 'tool', card: inst, valid: new Set(valid),
        prompt: `${c.name}：${E.isEvo(c) ? '點要覺醒的 NOXCAT' : E.isEnergy(c) ? '點要貼上的 NOXCAT' : '點要裝備的 NOXCAT'}` };
    }
    if (!isPhone()) showCard(c.id);
    render();
  }
  function clickSlot(s, owner) {
    const m = UI.mode;
    if (m && m.valid.has(s)) {
      const inst = m.card;
      if (m.kind === 'evolve') act(() => A.evolve(0, inst, s));
      else if (m.kind === 'attach') act(() => A.attach(0, inst, s));
      else if (m.kind === 'tool') act(() => A.playTool(0, inst, s));
      else if (m.kind === 'retreat') act(() => A.retreat(0, s));
      return;
    }
    if (m) { UI.mode = null; UI.sel = null; }
    UI.detail = { slot: s, owner };
    renderDetail(); openSheet(); render();
  }
  function showCard(id, sheet) {
    UI.detail = { id };
    renderDetail();
    if (sheet || isPhone()) openSheet();
  }
  function openSheet() { if (isPhone()) { const i = $('info'); i.classList.remove('showlog'); i.classList.add('open'); } }
  function closeSheet() { $('info').classList.remove('open', 'showlog'); }

  function facts(s) {
    const c = E.top(s), out = [];
    out.push(`<span class="chip">NP <b>${E.hpLeft(s)}/${c.np}</b></span>`);
    out.push(`<span class="chip">${N.STAGE[c.stage]}${c.legend ? '・傳奇' : ''}</span>`);
    out.push(`<span class="chip">剋制 ${dot(N.WEAK[c.type])} ×2</span>`);
    if (c.stage > 0 || c.legend) out.push(`<span class="chip">抵抗 ${dot(N.RESIST[c.type])} −30</span>`);
    const p = E.P(G().players[0].active === s || G().players[0].bench.includes(s) ? 0 : 1);
    out.push(`<span class="chip">撤離 <b>${E.retreatCost(p, s)}</b></span>`);
    if (s.energy.length) out.push(`<span class="chip">資源 ${s.energy.map(e => `<i class="dot" style="${pipStyle(e)}" title="${esc(e.c.name)}"></i>`).join('')}</span>`);
    if (s.tool) out.push(`<span class="chip">裝備 <b>${esc(s.tool.c.name)}</b></span>`);
    Object.keys(s.status).forEach(k => out.push(`<span class="chip st-${k}">${E.STATUS_NAME[k]}</span>`));
    if (E.fxOn(s, 'prevent')) out.push('<span class="chip st-fx">受到保護</span>');
    if (E.fxOn(s, 'reduce')) out.push(`<span class="chip st-fx">受到傷害 −${s.fx.reduce.n}</span>`);
    if (E.fxOn(s, 'cantRetreat')) out.push('<span class="chip st-fx">不能撤離</span>');
    if (E.fxOn(s, 'cantAttack')) out.push('<span class="chip st-fx">這回合不能攻擊</span>');
    return out.join('');
  }
  function renderDetail() {
    const box = $('detail'), d = UI.detail, g = G();
    if (!d) { box.innerHTML = '<p class="tip">點任何一張卡，這裡會顯示詳細資料。</p>'; return; }
    const close = '<button class="btn btn-ghost btn-small sheet-close" data-close>關閉</button>';
    if (d.id) {
      box.innerHTML = `<div class="detail-head"><h3>${esc(card(d.id).name)}</h3>${close}</div>`;
      const img = imgFor(d.id); img.className = 'face'; box.appendChild(img);
    } else {
      const s = d.slot;
      const alive = g && E.inPlay(E.P(d.owner)).includes(s);
      if (!alive) { UI.detail = null; box.innerHTML = '<p class="tip">點任何一張卡，這裡會顯示詳細資料。</p>'; return; }
      const c = E.top(s), mine = d.owner === 0, isActive = E.P(d.owner).active === s;
      box.innerHTML = `<div class="detail-head"><h3>${esc(c.name)} <small style="color:var(--muted);font-weight:500">${mine ? '你的' : '對手'}${isActive ? '前線' : '後援區'}</small></h3>${close}</div><div class="facts">${facts(s)}</div>`;
      if (mine && (isActive || c.moves.some(m => m.ability))) {
        const mv = document.createElement('div'); mv.className = 'moves';
        c.moves.forEach((m, i) => {
          const el = document.createElement('div'); el.className = 'mv';
          if (m.ability) {
            const ok = myTurnNow() && E.canAbility(0, s);
            el.innerHTML = `<div class="mv-top"><span class="abil">特性</span><b>${esc(m.name)}</b></div><p>${esc(m.text)}</p>`;
            if (c.name === '大魔導師') { const b = document.createElement('button'); b.className = 'btn btn-primary btn-small'; b.textContent = '發動'; b.disabled = !ok; b.addEventListener('click', () => act(() => A.useAbility(0, s))); el.appendChild(b); }
          } else if (isActive) {
            const st = E.moveState(0, i), ok = myTurnNow() && st.ok;
            el.innerHTML = `<div class="mv-top">${m.cost.map(t => dot(t)).join('')}<b>${esc(m.name)}</b><span class="dmg">${esc(m.dmg)}</span></div>${m.text ? `<p>${esc(m.text)}</p>` : ''}${!st.ok && st.why ? `<span class="why">${esc(st.why)}</span>` : ''}`;
            const b = document.createElement('button'); b.className = 'btn btn-primary btn-small'; b.textContent = '使用這招'; b.disabled = !ok;
            b.addEventListener('click', () => act(() => A.attack(0, i)));
            el.appendChild(b);
          } else return;
          mv.appendChild(el);
        });
        box.appendChild(mv);
        if (isActive) {
          const cost = E.retreatCost(me(), s), ok = myTurnNow() && E.canRetreat(0);
          const r = document.createElement('div'); r.className = 'mv';
          let why = '';
          if (!ok && myTurnNow()) why = !me().bench.length ? '後援區沒有 NOXCAT' : me().retreated ? '這回合已經撤離過' : s.status.sleep || s.status.par ? '沉睡或癱瘓時不能撤離' : E.fxOn(s, 'cantRetreat') ? '這回合不能撤離' : '資源不夠付撤離成本';
          r.innerHTML = `<div class="mv-top"><b>撤離</b><span class="dmg" style="font-size:13px">成本 ${cost}</span></div><p>棄掉 ${cost} 個資源，換一隻後援區的 NOXCAT 上前線。每回合 1 次。</p>${why ? `<span class="why">${why}</span>` : ''}`;
          const b = document.createElement('button'); b.className = 'btn btn-ghost btn-small'; b.textContent = '選擇要換上的 NOXCAT'; b.disabled = !ok;
          b.addEventListener('click', () => { UI.sel = null; UI.mode = { kind: 'retreat', valid: new Set(me().bench), prompt: '撤離：點要換上前線的後援區 NOXCAT' }; closeSheet(); render(); });
          r.appendChild(b); box.appendChild(r);
        }
      }
      const img = imgFor(c.id); img.className = 'face'; box.appendChild(img);
    }
    const cb = box.querySelector('[data-close]'); if (cb) cb.addEventListener('click', closeSheet);
  }

  // ───────── choice modal ─────────
  function askModal(req) {
    return new Promise(res => {
      UI.asking = true; renderActionbarSafe();
      const box = $('modal-box'), modal = $('modal');
      const single = !req.viewOnly && req.min === 1 && req.max === 1;
      const picked = new Set();
      box.innerHTML = `<h3 id="modal-title">${esc(req.title)}</h3>${req.sub ? `<p class="sub">${esc(req.sub)}</p>` : ''}<div class="opts"></div><div class="modal-foot"></div>`;
      const grid = box.querySelector('.opts'), foot = box.querySelector('.modal-foot');
      const done = v => { modal.hidden = true; UI.asking = false; res(v); setTimeout(render, 0); };
      req.options.forEach(o => {
        const b = document.createElement('button'); b.type = 'button';
        const id = o.card ? o.card.c.id : o.slot ? E.top(o.slot).id : null;
        if (id) {
          b.className = 'opt'; b.appendChild(imgFor(id));
          const lab = o.label || (o.slot ? `${E.top(o.slot).name}（${E.hpLeft(o.slot)} NP）` : card(id).name);
          b.insertAdjacentHTML('beforeend', `<span>${esc(lab)}</span>`);
        } else { b.className = 'opt text'; b.textContent = o.label || '選項'; }
        if (o.disabled || req.viewOnly) b.disabled = !!o.disabled;
        if (req.viewOnly) b.style.cursor = 'default';
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => {
          if (req.viewOnly || o.disabled) return;
          if (single) { done([o.value]); return; }
          if (picked.has(o)) picked.delete(o); else { if (picked.size >= req.max) return; picked.add(o); }
          b.setAttribute('aria-pressed', String(picked.has(o)));
          sync();
        });
        grid.appendChild(b);
      });
      const sync = () => {
        foot.innerHTML = '';
        if (req.viewOnly) { const c = document.createElement('button'); c.className = 'btn btn-primary'; c.textContent = '關閉'; c.addEventListener('click', () => done([])); foot.appendChild(c); return; }
        const enabledCount = req.options.filter(o => !o.disabled).length;
        foot.insertAdjacentHTML('beforeend', `<span class="count">${single ? '點一張選擇' : `已選 ${picked.size} / 最多 ${req.max}`}${enabledCount ? '' : '・沒有可選的卡'}</span>`);
        if (req.cancel) { const c = document.createElement('button'); c.className = 'btn btn-ghost'; c.textContent = '取消'; c.addEventListener('click', () => done(null)); foot.appendChild(c); }
        if (!single || !enabledCount) {
          const ok = document.createElement('button'); ok.className = 'btn btn-primary'; ok.textContent = picked.size || !enabledCount ? '確定' : (req.min === 0 ? '不選，繼續' : '確定');
          ok.disabled = picked.size < Math.min(req.min, enabledCount);
          ok.addEventListener('click', () => done([...picked].map(o => o.value)));
          foot.appendChild(ok);
        }
      };
      sync();
      modal.hidden = false;
      const f = box.querySelector('button:not([disabled])'); if (f) f.focus({ preventScroll: true });
    });
  }
  function renderActionbarSafe() { if (G()) renderActionbar(); }

  // ───────── result ─────────
  function showResult(w, why) {
    const box = $('modal-box');
    const online = ON.inGame, guest = online && ON.role === 'guest';
    box.classList.add('result');
    const again = guest ? '' : `<button class="btn btn-primary" id="r-again">${online ? '跟朋友再一局' : '再來一局'}</button>`;
    box.innerHTML = `<span class="big">${w === 0 ? 'VICTORY' : 'DEFEAT'}</span><h3 id="modal-title">${w === 0 ? '你贏了！' : `${esc(UI.oppName)}贏了`}</h3><p class="sub">${esc(why)}・共 ${G().turn} 回合${guest ? '<br>房主可以直接開下一局。' : ''}</p><div class="modal-foot" style="justify-content:center">${again}<button class="btn btn-ghost" id="r-lobby">回到大廳</button></div>`;
    $('modal').hidden = false;
    if ($('r-again')) $('r-again').addEventListener('click', () => { box.classList.remove('result'); $('modal').hidden = true; if (online) hostStart(); else { pickAiDeck(); startGame(); } });
    $('r-lobby').addEventListener('click', () => { box.classList.remove('result'); $('modal').hidden = true; showView('lobby'); });
  }

  // ───────── lobby ─────────
  function deckSummary(d) {
    const cnt = { cat: 0, cmd: 0, energy: 0 }; d.forEach(id => cnt[card(id).kind]++);
    const types = [...new Set(d.map(card).filter(c => c.kind === 'cat').map(c => c.type))];
    return { cnt, types };
  }
  function deckFaces(d) {
    const cats = [...new Set(d)].map(card).filter(c => c.kind === 'cat').sort((a, b) => N.TIERS[b.tier].rank - N.TIERS[a.tier].rank || b.stage - a.stage).slice(0, 5);
    const wrap = document.createElement('div'); wrap.className = 'deck-faces';
    cats.forEach(c => wrap.appendChild(imgFor(c.id)));
    return wrap;
  }
  function pickAiDeck() {
    const all = {}; N.CARDS.forEach(c => { all[c.id] = 3; });
    aiType = N.TYPE_ORDER[Math.floor(Math.random() * 8)];
    aiDeck = E.autoBuild(all, { types: [aiType] });
  }
  function currentMyDeck() {
    const a = avail();
    let d = loadDeck();
    if (!d || E.validate(d, a).length) { const auto = E.autoBuild(a); if (!E.validate(auto, a).length || !d) d = auto; }
    return d;
  }
  function renderLobby() {
    const a = avail();
    myDeck = currentMyDeck();
    const errs = E.validate(myDeck, a);
    const mb = $('my-deckbox'); mb.innerHTML = '';
    const sm = deckSummary(myDeck);
    mb.insertAdjacentHTML('beforeend', `<span class="who">你的牌組</span><h2>${sm.types.length ? sm.types.map(t => TYPE[t].name).join('・') : '還沒有 NOXCAT'}</h2>`);
    mb.appendChild(deckFaces(myDeck));
    mb.insertAdjacentHTML('beforeend', `<div class="deck-meta"><span class="chip">NOXCAT <b>${sm.cnt.cat}</b></span><span class="chip">指令卡 <b>${sm.cnt.cmd}</b></span><span class="chip">資源 <b>${sm.cnt.energy}</b></span><span class="chip">共 <b>${myDeck.length}</b> 張</span></div>`);
    if (errs.length) mb.insertAdjacentHTML('beforeend', `<ul class="errs">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul><p class="tip">先到卡包網站多開幾包，收集到基礎 NOXCAT 就能組牌。</p>`);
    else mb.insertAdjacentHTML('beforeend', `<p class="okline">牌組可以出戰</p>`);
    const eb = document.createElement('button'); eb.className = 'btn btn-ghost btn-small'; eb.textContent = '編輯牌組'; eb.style.justifySelf = 'start';
    eb.addEventListener('click', () => showView('deck')); mb.appendChild(eb);
    const ab = $('ai-deckbox'); ab.innerHTML = '';
    const as = deckSummary(aiDeck);
    ab.insertAdjacentHTML('beforeend', `<span class="who">電腦對手</span><h2>${TYPE[aiType].name}牌組</h2>`);
    ab.appendChild(deckFaces(aiDeck));
    ab.insertAdjacentHTML('beforeend', `<div class="deck-meta"><span class="chip">NOXCAT <b>${as.cnt.cat}</b></span><span class="chip">指令卡 <b>${as.cnt.cmd}</b></span><span class="chip">資源 <b>${as.cnt.energy}</b></span></div><p class="tip">電腦會用全部 97 張卡裡的${TYPE[aiType].name}卡組牌。</p>`);
    $('btn-start').disabled = errs.length > 0 || (ON.role === 'guest' && ON.accepted);
    renderOnline();
  }

  // ───────── game ─────────
  function resetTable() {
    showView('game');
    $('log').innerHTML = ''; UI.logLines = []; UI.sel = null; UI.mode = null; UI.detail = null; UI.busy = false; UI.asking = false; UI.noResult = false; UI.hide.clear(); UI.born.clear();
    $('modal').hidden = true; $('modal-box').classList.remove('result');
    $('status-text').textContent = '洗牌中…';
  }
  async function startGame() {
    const a = avail();
    myDeck = currentMyDeck();
    if (E.validate(myDeck, a).length) { showView('lobby'); return; }
    ON.inGame = false; UI.oppName = '電腦';
    resetTable();
    await ensureBack();
    const ids = [...new Set(myDeck.concat(aiDeck))];
    await Promise.all(ids.map(face));
    renderDetail();
    E.newGame(myDeck.slice(), aiDeck.slice(), io).catch(e => { console.error(e); io.log('發生錯誤：' + e.message); });
  }

  // ───────── deck builder ─────────
  const B = { deck: [], kind: 'all', type: 'all' };
  function renderFilters() {
    const kinds = [['all', '全部'], ['cat', 'NOXCAT'], ['cmd', '指令卡'], ['energy', '資源卡']];
    const f = $('filters');
    f.innerHTML = kinds.map(([k, l]) => `<button data-k="${k}" aria-pressed="${B.kind === k}">${l}</button>`).join('') + '<span style="width:8px"></span>' +
      [['all', '全部屬性']].concat(N.TYPE_ORDER.map(t => [t, TYPE[t].name])).map(([t, l]) => `<button data-t="${t}" aria-pressed="${B.type === t}">${t === 'all' ? '' : dot(t)}${l}</button>`).join('');
    f.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { B.kind = b.dataset.k; renderBuilder(); }));
    f.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { B.type = b.dataset.t; renderBuilder(); }));
  }
  const inDeck = id => B.deck.filter(x => x === id).length;
  const capOf = (id, a) => card(id).basic ? 40 : Math.min(3, a[id] || 0);
  function changeDeck(id, d) {
    const a = avail();
    if (d > 0 && (B.deck.length >= 40 || inDeck(id) >= capOf(id, a))) return;
    if (d < 0) { const i = B.deck.indexOf(id); if (i >= 0) B.deck.splice(i, 1); } else B.deck.push(id);
    B.deck.sort((x, y) => x - y); saveDeck(B.deck); renderBuilder();
  }
  function renderBuilder() {
    renderFilters();
    const a = avail();
    const list = N.CARDS.filter(c => (a[c.id] || 0) > 0)
      .filter(c => B.kind === 'all' || c.kind === B.kind)
      .filter(c => B.type === 'all' || c.type === B.type);
    const coll = $('coll'); coll.innerHTML = '';
    const ownedKinds = N.CARDS.filter(c => !c.basic && (a[c.id] || 0) > 0).length;
    if (ownedKinds < 6) coll.insertAdjacentHTML('beforeend', `<div class="empty-note" style="grid-column:1/-1">你目前收集了 ${ownedKinds} / 89 種卡（不含基本資源）。牌組只能用自己抽到的卡，先回卡包網站多開幾包吧。</div>`);
    list.forEach(c => {
      const el = document.createElement('div'); el.className = 'cc';
      const fc = document.createElement('div'); fc.className = 'face'; fc.appendChild(imgFor(c.id));
      fc.insertAdjacentHTML('beforeend', `<span class="own">${c.basic ? '不限' : '擁有 ' + a[c.id]}</span>${inDeck(c.id) ? `<span class="in">×${inDeck(c.id)}</span>` : ''}`);
      fc.addEventListener('click', () => askModal({ title: c.name, options: [{ value: c, card: { c } }], viewOnly: true }));
      el.appendChild(fc);
      const st = document.createElement('div'); st.className = 'stepper';
      st.innerHTML = `<button aria-label="少一張 ${esc(c.name)}" ${inDeck(c.id) ? '' : 'disabled'}>−</button><span>${inDeck(c.id)}</span><button aria-label="多一張 ${esc(c.name)}" ${B.deck.length < 40 && inDeck(c.id) < capOf(c.id, a) ? '' : 'disabled'}>+</button>`;
      const [m, , p] = st.children;
      m.addEventListener('click', () => changeDeck(c.id, -1)); p.addEventListener('click', () => changeDeck(c.id, 1));
      el.appendChild(st); coll.appendChild(el);
    });
    renderDecklist(a);
  }
  function renderDecklist(a) {
    const dl = $('decklist'), errs = E.validate(B.deck, a);
    const groups = [['cat', 'NOXCAT'], ['cmd', '指令卡'], ['energy', '資源卡']];
    const cnt = {}; B.deck.forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
    dl.innerHTML = `<h3>我的牌組 <em>${B.deck.length}/40</em></h3><div class="bar"><i style="width:${Math.min(100, B.deck.length / 40 * 100)}%"></i></div>` +
      (errs.length ? `<ul class="errs">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="okline">牌組可以出戰，已自動儲存</p>') +
      `<div class="lobby-go"><button class="btn btn-primary btn-small" data-b="auto">自動組牌</button><button class="btn btn-ghost btn-small" data-b="clear">清空</button><button class="btn btn-ghost btn-small" data-b="battle" ${errs.length ? 'disabled' : ''}>去對戰</button></div>` +
      groups.map(([k, l]) => {
        const ids = Object.keys(cnt).map(Number).filter(id => card(id).kind === k);
        if (!ids.length) return '';
        const n = ids.reduce((s, id) => s + cnt[id], 0);
        return `<div class="dl-group"><h4>${l}・${n} 張</h4>${ids.map(id => { const c = card(id); return `<div class="dl-row">${c.kind === 'cat' || c.basic ? dot(c.type) : '<span></span>'}<span>${esc(c.name)}</span><b>×${cnt[id]}</b><span style="display:flex;gap:4px"><button data-m="${id}" aria-label="少一張">−</button><button data-p="${id}" aria-label="多一張" ${B.deck.length < 40 && cnt[id] < capOf(id, a) ? '' : 'disabled'}>+</button></span></div>`; }).join('')}</div>`;
      }).join('');
    dl.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => changeDeck(+b.dataset.m, -1)));
    dl.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => changeDeck(+b.dataset.p, 1)));
    dl.querySelector('[data-b="auto"]').addEventListener('click', () => { B.deck = E.autoBuild(avail()); saveDeck(B.deck); renderBuilder(); });
    dl.querySelector('[data-b="clear"]').addEventListener('click', () => { B.deck = []; saveDeck(B.deck); renderBuilder(); });
    dl.querySelector('[data-b="battle"]').addEventListener('click', () => showView('lobby'));
  }

  // ───────── online battles with a friend ─────────
  // The room creator's browser (host) runs the rules engine; the friend (guest) mirrors the table it sends
  // and sends back its moves and choices. Messages travel on a named room: topic "nh" host→guest, "ng" guest→host.
  // Room access comes from the pack page (the framed viewer page), which lends it to this iframe as window.NOXNET.
  const NICK_KEY = 'noxcat-nick', CODE_KEY = 'noxcat-room-last';
  const ls = {
    get(k, sess) { try { return (sess ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, sess) { try { (sess ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }
  };
  const rid = n => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
  const myPid = ls.get('noxcat-pid', true) || (() => { const v = rid(10); ls.set('noxcat-pid', v, true); return v; })();
  const nick = () => ((ls.get(NICK_KEY) || '').trim().slice(0, 12)) || '玩家';
  const NETSRC = (() => { try { return window.parent !== window && window.parent.NOXNET ? window.parent.NOXNET : null; } catch (e) { return null; } })();
  const enc = new TextEncoder();
  const ON = {
    avail: null, err: '', nr: null, role: null, code: '', joining: false, accepted: false, full: false, lostHost: false, searchT: 0,
    hostPeer: null, guestPeer: null, guestPid: null, opp: null, inGame: false, gid: 0,
    pendingAsk: null, askSeq: 0, dirty: false, ft: 0, sentLog: 0, actQ: Promise.resolve(),
    acts: new Map(), actSeq: 0, logIdx: 0, askOpen: 0, answered: null,
    msgSeq: 0, parts: new Map(), queue: Promise.resolve(), unsubs: [],
    oppPeer() { return this.role === 'host' ? this.guestPeer : this.hostPeer; }
  };

  // ── transport: JSON split into ≤4 KiB pieces ──
  function netErr(e) {
    if (e && e.code === 'not_permitted') { ON.err = '你目前的分享權限不能送出對戰訊息。請擁有者把你的權限調成「參與者（Contributor）」以上。'; renderOnline(); }
  }
  function netSend(obj) {
    if (!ON.nr) return;
    const topic = ON.role === 'host' ? 'nh' : 'ng', json = JSON.stringify(obj), m = ++ON.msgSeq;
    if (enc.encode(json).length <= 1300 || enc.encode(JSON.stringify({ m, i: 0, n: 1, d: json })).length <= 3900) { ON.nr.emit(topic, { m, i: 0, n: 1, d: json }).catch(netErr); return; }
    const parts = []; for (let i = 0; i < json.length; i += 900) parts.push(json.slice(i, i + 900));
    parts.forEach((d, i) => ON.nr.emit(topic, { m, i, n: parts.length, d }).catch(netErr));
  }
  function netRecv(msg) {
    if (msg.sameTab) return;
    if (msg.peer !== ON.oppPeer()) return;
    const d = msg.data; if (!d || typeof d.d !== 'string' || !(d.n >= 1)) return;
    let json = d.d;
    if (d.n > 1) {
      const key = msg.peer + ':' + d.m;
      if (ON.parts.size > 40) ON.parts.clear();
      const arr = ON.parts.get(key) || []; arr[d.i] = d.d; ON.parts.set(key, arr);
      for (let i = 0; i < d.n; i++) if (typeof arr[i] !== 'string') return;
      ON.parts.delete(key); json = arr.join('');
    }
    let o; try { o = JSON.parse(json); } catch (e) { return; }
    if (!o || typeof o !== 'object') return;
    if (ON.role === 'host') hostHandle(o);
    else ON.queue = ON.queue.then(() => guestHandle(o)).catch(e => console.error(e));
  }

  // ── rooms ──
  async function joinRoom(code, role) {
    ON.err = ''; ON.joining = true; renderOnline();
    let nr = null;
    try { nr = await NETSRC.join('nox-' + code); }
    catch (e) {
      ON.joining = false;
      ON.err = e && e.code === 'not_permitted' ? '你目前的權限不能使用連線房間。請擁有者把你的分享權限調成「參與者（Contributor）」以上。' : '連不上房間，稍後再試一次。';
      renderOnline(); return false;
    }
    Object.assign(ON, { nr, role, code, joining: false, lastPres: '', myName: nick(), accepted: false, full: false, lostHost: false, hostPeer: null, guestPeer: null, guestPid: null, opp: null });
    ls.set(CODE_KEY, code, true);
    ON.unsubs.push(nr.on(role === 'host' ? 'ng' : 'nh', netRecv, netErr));
    ON.unsubs.push(nr.onPeers(onPeers));
    let was = true;
    ON.unsubs.push(nr.onConnection(c => { if (c && !was && ON.role === 'guest' && ON.accepted) netSend({ t: 'sync' }); was = c; }));
    await pushPresence();
    if (role === 'guest') { clearTimeout(ON.searchT); ON.searchT = setTimeout(() => { if (ON.role === 'guest' && !ON.hostPeer) renderOnline(); }, 6000); }
    renderOnline(); renderLobbyButtons();
    return true;
  }
  async function leaveRoom() {
    const nr = ON.nr; if (!nr) return;
    ON.unsubs.forEach(u => { try { u(); } catch (e) {} }); ON.unsubs = [];
    Object.assign(ON, { nr: null, role: null, code: '', accepted: false, full: false, hostPeer: null, guestPeer: null, guestPid: null, opp: null, pendingAsk: null, inGame: false });
    ON.acts.forEach(r => r(false)); ON.acts.clear();
    try { await nr.leave(); } catch (e) {}
    renderOnline(); renderLobbyButtons();
  }
  function pushPresence() {
    if (!ON.nr) return Promise.resolve();
    const p = { role: ON.role, name: ON.myName || nick(), pid: myPid, code: ON.code };
    if (ON.role === 'guest') p.deck = currentMyDeck();
    if (ON.role === 'host') p.guestPid = ON.guestPid;
    const key = JSON.stringify(p);
    if (key === ON.lastPres) return Promise.resolve();
    ON.lastPres = key;
    return ON.nr.presence(p).catch(() => { ON.lastPres = ''; });
  }
  const fromCode = p => p.presence && p.presence.code === ON.code && typeof p.presence.pid === 'string';
  function onPeers(ch) {
    const others = ch.peers.filter(p => !p.sameTab && p.kind === 'viewer' && fromCode(p));
    if (ON.role === 'host') {
      const live = ON.inGame && G() && !G().over;
      let g = ON.guestPid ? others.find(p => p.presence.role === 'guest' && p.presence.pid === ON.guestPid) : null;
      if (!g && !live) {
        g = others.find(p => p.presence.role === 'guest');
        const pid = g ? g.presence.pid : null;
        if (pid !== ON.guestPid) { ON.guestPid = pid; pushPresence(); }
      }
      const before = ON.guestPeer;
      ON.guestPeer = g ? g.peer : null; ON.opp = g ? g.presence : null;
      if (g && ON.opp.name) UI.oppName = live ? UI.oppName : String(ON.opp.name).slice(0, 12);
      if (g && before !== g.peer && ON.inGame) setTimeout(hostResync, 300);
    } else if (ON.role === 'guest') {
      const h = others.find(p => p.presence.role === 'host');
      const before = ON.hostPeer;
      ON.hostPeer = h ? h.peer : null; ON.opp = h ? h.presence : null;
      ON.accepted = !!(h && h.presence.guestPid === myPid);
      ON.full = !!(h && h.presence.guestPid && h.presence.guestPid !== myPid);
      if (h) ON.lostHost = false; else if (before) ON.lostHost = true;
      if (h && h.presence.name && !ON.inGame) UI.oppName = String(h.presence.name).slice(0, 12);
      if (h && ON.accepted && before !== h.peer) setTimeout(() => netSend({ t: 'sync' }), 300);
    }
    if (!$('v-lobby').hidden) { renderOnline(); renderLobbyButtons(); }
    if (G() && !$('v-game').hidden) renderActionbarSafe();
  }
  function renderLobbyButtons() { const b = $('btn-start'); if (b && myDeck) b.disabled = E.validate(myDeck, avail()).length > 0 || (ON.role === 'guest' && ON.accepted); }

  // ── host side ──
  function markDirty() { if (!hosting()) return; ON.dirty = true; if (!ON.ft) ON.ft = setTimeout(() => flush(), 90); }
  function flush(full) {
    if (ON.ft) { clearTimeout(ON.ft); ON.ft = 0; }
    if (!hosting() || !G()) return;
    if (!ON.dirty && !full) return;
    ON.dirty = false;
    const from = full ? Math.max(0, UI.logLines.length - 40) : ON.sentLog;
    const ln = UI.logLines.slice(from).map(l => [l.t, l.cls || '']);
    ON.sentLog = UI.logLines.length;
    netSend({ t: 'st', g: ON.gid, s: E.snapshot(1), L: from, ln, nm: [E.P(0).name, E.P(1).name] });
  }
  function hostResync() {
    if (!hosting()) return;
    flush(true);
    if (ON.pendingAsk) netSend(ON.pendingAsk.msg);
    if (G() && G().over) netSend({ t: 'over', g: ON.gid, w: G().winner === 0 ? 1 : 0, y: G().why || '' });
  }
  function remoteAsk(req) {
    return new Promise(res => {
      const id = ++ON.askSeq;
      const o = req.options.map(x => ({ c: x.card ? [x.card.uid, x.card.c.id] : null, s: x.slot ? x.slot.uid : null, l: x.label || null, d: !!x.disabled }));
      const msg = { t: 'ask', id, g: ON.gid, q: { title: req.title, sub: req.sub || '', min: req.min, max: req.max, cancel: !!req.cancel, o } };
      ON.pendingAsk = { id, msg, req, res };
      flush(); netSend(msg); renderActionbarSafe();
    });
  }
  function hostAnswer(o) {
    const pa = ON.pendingAsk; if (!pa || o.id !== pa.id) return;
    ON.pendingAsk = null;
    const req = pa.req;
    if (o.v === null && req.cancel) { pa.res(null); renderActionbarSafe(); return; }
    let v = Array.isArray(o.v) ? [...new Set(o.v)].filter(i => Number.isInteger(i) && req.options[i] && !req.options[i].disabled) : [];
    v = v.slice(0, req.max);
    const enabled = req.options.map((x, i) => i).filter(i => !req.options[i].disabled);
    for (const i of enabled) { if (v.length >= Math.min(req.min, enabled.length)) break; if (!v.includes(i)) v.push(i); }
    pa.res(v.map(i => req.options[i].value));
    renderActionbarSafe();
  }
  function hostHandle(o) {
    if (o.t === 'sync') hostResync();
    else if (o.t === 'ans') hostAnswer(o);
    else if (o.t === 'quit') { if (hosting() && G() && !G().over) E.forfeit(1, `${UI.oppName}離開了對戰`); }
    else if (o.t === 'act') ON.actQ = ON.actQ.then(() => hostAct(o)).catch(e => console.error(e));
  }
  async function hostAct(o) {
    const reply = ok => netSend({ t: 'done', id: o.id, ok: !!ok });
    const g = G();
    if (!hosting() || !g || g.over || g.cur !== 1) { flush(true); reply(false); return; }
    const p = E.P(1), args = Array.isArray(o.args) ? o.args : [];
    const hc = u => p.hand.find(c => c.uid === u), so = u => E.inPlay(p).find(s => s.uid === u);
    let ok = false;
    try {
      switch (o.a) {
        case 'playBasic': { const c = hc(args[0]); ok = !!c && await E.playBasic(1, c); break; }
        case 'playCmd': { const c = hc(args[0]); ok = !!c && await E.playCmd(1, c); break; }
        case 'evolve': { const c = hc(args[0]), s = so(args[1]); ok = !!(c && s) && await E.evolve(1, c, s); break; }
        case 'attach': { const c = hc(args[0]), s = so(args[1]); ok = !!(c && s) && await E.attach(1, c, s); break; }
        case 'playTool': { const c = hc(args[0]), s = so(args[1]); ok = !!(c && s) && await E.playTool(1, c, s); break; }
        case 'retreat': { const s = p.bench.find(b => b.uid === args[0]); ok = !!s && await E.retreat(1, s); break; }
        case 'useAbility': { const s = so(args[0]); ok = !!s && await E.useAbility(1, s); break; }
        case 'attack': { const i = args[0], a = p.active; ok = !!a && Number.isInteger(i) && i >= 0 && i < E.top(a).moves.length && await E.attack(1, i); break; }
        case 'endTurn': ok = true; await E.endTurn(); break;
      }
    } catch (e) { console.error(e); io.log('發生錯誤：' + e.message); }
    flush(); reply(ok); render();
  }
  async function hostStart() {
    const a = avail();
    myDeck = currentMyDeck();
    if (E.validate(myDeck, a).length) { showView('lobby'); return; }
    const gd = ON.opp && Array.isArray(ON.opp.deck) ? ON.opp.deck.filter(id => Number.isInteger(id) && id >= 1 && id <= N.CARDS.length) : null;
    if (!ON.guestPeer || !gd || E.validate(gd).length) { showView('lobby'); ON.err = '朋友還沒準備好（不在房間裡，或牌組不完整）。'; renderOnline(); return; }
    UI.oppName = String(ON.opp.name || '朋友').slice(0, 12);
    Object.assign(ON, { inGame: true, gid: Math.floor(Math.random() * 1e9), sentLog: 0, pendingAsk: null, dirty: false, err: '' });
    resetTable();
    await ensureBack();
    await Promise.all([...new Set(myDeck.concat(gd))].map(face));
    renderDetail();
    E.newGame(myDeck.slice(), gd.slice(), io, { names: [ON.myName || nick(), UI.oppName], human1: true }).catch(e => { console.error(e); io.log('發生錯誤：' + e.message); });
  }

  // ── guest side ──
  function remoteAct(a, args) {
    return new Promise(res => {
      const id = ++ON.actSeq;
      const to = setTimeout(() => { if (ON.acts.has(id)) { ON.acts.delete(id); res(false); netSend({ t: 'sync' }); } }, 60000);
      ON.acts.set(id, ok => { clearTimeout(to); res(ok); });
      netSend({ t: 'act', id, a, args });
    });
  }
  function remap() {
    const slotBy = (owner, uid) => E.inPlay(E.P(owner)).find(s => s.uid === uid);
    if (UI.detail && UI.detail.slot) { const s = slotBy(UI.detail.owner, UI.detail.slot.uid); if (s) UI.detail.slot = s; else UI.detail = null; }
    if (UI.sel) UI.sel = me().hand.find(c => c.uid === UI.sel.uid) || null;
    if (UI.mode) {
      if (UI.mode.card) UI.mode.card = UI.sel;
      if (UI.mode.kind !== 'retreat' && !UI.sel) UI.mode = null;
      else UI.mode.valid = new Set([...UI.mode.valid].map(s => slotBy(0, s.uid)).filter(Boolean));
    }
  }
  function applyState(o) {
    if (!o.s || !o.s.P) return;
    if (o.g === ON.leftGid) return;
    if (o.g !== ON.gid || !ON.inGame) {
      if (G() && !G().over && !G().mirror) G().over = true; // drop a vs-computer game in progress
      ON.gid = o.g; ON.inGame = true; ON.logIdx = 0; ON.askOpen = 0; ON.answered = null;
      if (Array.isArray(o.nm)) UI.oppName = String(o.nm[0] || UI.oppName).slice(0, 12);
      resetTable(); ensureBack();
    }
    E.mirror(o.s);
    const from = o.L | 0;
    (o.ln || []).forEach((l, k) => { if (from + k >= ON.logIdx) io.log(String(l[0]), l[1] || undefined); });
    ON.logIdx = Math.max(ON.logIdx, from + (o.ln || []).length);
    remap(); render();
  }
  function guestAsk(o) {
    if (o.g !== ON.gid || !o.q || !Array.isArray(o.q.o)) return;
    if (ON.answered && ON.answered.id === o.id) { netSend({ t: 'ans', id: o.id, v: ON.answered.v }); return; }
    if (ON.askOpen === o.id) return;
    ON.askOpen = o.id;
    const q = o.q, slots = E.inPlay(E.P(0)).concat(E.inPlay(E.P(1)));
    const req = { title: String(q.title || '選擇'), sub: q.sub ? String(q.sub) : '', min: q.min | 0, max: q.max | 0 || 1, cancel: !!q.cancel,
      options: q.o.map((x, i) => {
        const c = Array.isArray(x.c) && card(x.c[1]) ? { uid: x.c[0], c: card(x.c[1]) } : undefined;
        const s = x.s != null ? slots.find(sl => sl.uid === x.s) : undefined;
        return { value: i, card: c, slot: s, label: x.l ? String(x.l) : undefined, disabled: !!x.d };
      }) };
    askModal(req).then(v => { ON.answered = { id: o.id, v }; ON.askOpen = 0; netSend({ t: 'ans', id: o.id, v }); });
  }
  async function guestHandle(o) {
    if (o.t === 'st') applyState(o);
    else if (o.t === 'ask') guestAsk(o);
    else if (o.t === 'done') { const r = ON.acts.get(o.id); if (r) { ON.acts.delete(o.id); r(o.ok); } }
    else if (o.t === 'over') { if (ON.inGame && o.g === ON.gid && G()) setTimeout(() => showResult(o.w, String(o.y || '')), 900); }
    else if (o.t === 'fx' && ON.inGame && !$('v-game').hidden) {
      if (o.k === 'coin') await show.coin(!!o.r, String(o.l || ''));
      else if (o.k === 'banner') show.banner(String(o.x || ''), !!o.s);
      else if (o.k === 'play' && card(o.id)) await show.play(o.id);
      else if (o.k === 'hit') show.hit(o.u, o.n | 0);
      else if (o.k === 'ko') await show.ko(o.u);
      else if (o.k === 'evo') show.evo(o.u);
      else if (o.k === 'en' && card(o.id)) await show.energy(o.u, o.id);
      else if (o.k === 'atk') await show.attack(o.a, o.d, /^#[0-9a-f]{6}$/i.test(o.c) ? o.c : '#eceee4', String(o.x || ''), o.n | 0);
    }
  }
  function leaveOnlineGame(silent) {
    if (!ON.inGame) return;
    if (G() && !G().over) {
      UI.noResult = true;
      if (ON.role === 'host') E.forfeit(0, `${E.P(0).name}離開了對戰`);
      else { netSend({ t: 'quit' }); G().over = true; }
    }
    ON.inGame = false; ON.pendingAsk = null; ON.leftGid = ON.gid;
    if (!silent) showView('lobby');
  }

  // ── lobby panel ──
  function renderOnline() {
    const box = $('online-box'); if (!box) return;
    const head = '<div><span class="who" style="font-size:12px;color:var(--muted);letter-spacing:.08em">連線對戰</span><h2>跟朋友對戰</h2></div>';
    const warn = ON.err ? `<p class="owarn">${esc(ON.err)}</p>` : '';
    if (ON.avail === null) { box.innerHTML = head + '<p class="tip">連線功能載入中…</p>'; return; }
    if (!ON.avail) { box.innerHTML = head + '<p class="tip">連線對戰要在 claude.ai 上打開卡包網站，再從「對戰」進來才能用。</p>'; return; }
    const deckOk = !E.validate(currentMyDeck(), avail()).length;
    if (!ON.nr) {
      box.innerHTML = head + `<p class="tip">一個人建立房間、把房間代碼傳給朋友，朋友輸入代碼加入。雙方都用自己抽到的卡組成的牌組。</p>
        <div class="row"><label class="field">你的暱稱<input id="nick-in" maxlength="12" autocomplete="nickname" value="${esc(ls.get(NICK_KEY) || '')}" placeholder="玩家"></label></div>
        <div class="row"><button class="btn btn-primary" id="btn-host" ${deckOk && !ON.joining ? '' : 'disabled'}>建立房間</button><span class="or">或</span>
        <label class="field">房間代碼<input id="code-in" class="codein" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCDE" value="${esc((ls.get(CODE_KEY, true) || '').toUpperCase())}"></label>
        <button class="btn btn-ghost" id="btn-join" ${deckOk && !ON.joining ? '' : 'disabled'}>加入房間</button></div>
        ${deckOk ? '' : '<p class="owarn">先把牌組組好（40 張）才能連線對戰。</p>'}${warn}`;
      const ni = $('nick-in');
      ni.addEventListener('input', () => ls.set(NICK_KEY, ni.value.trim().slice(0, 12)));
      $('btn-host').addEventListener('click', () => joinRoom(rid(5), 'host'));
      const go = () => {
        const c = $('code-in').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (c.length !== 5) { ON.err = '房間代碼是 5 個字。'; renderOnline(); return; }
        joinRoom(c, 'guest');
      };
      $('btn-join').addEventListener('click', go);
      $('code-in').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      return;
    }
    const code = `<div class="roomcode"><b>${esc(ON.code.toUpperCase())}</b><button class="btn btn-ghost btn-small" id="btn-copy">複製代碼</button><button class="btn btn-ghost btn-small" id="btn-leave">離開房間</button></div>`;
    let st = '', actions = '';
    if (ON.role === 'host') {
      const g = ON.guestPeer && ON.opp;
      const gd = g && Array.isArray(ON.opp.deck) ? ON.opp.deck : null;
      const gOk = gd && !E.validate(gd).length;
      st = g ? `<p class="ostate"><i class="on"></i><b>${esc(String(ON.opp.name || '朋友').slice(0, 12))}</b> 已加入${gOk ? '，牌組 OK' : '，但牌組還沒組好'}</p>`
        : '<p class="ostate"><i class="wait"></i>等待朋友輸入代碼加入…</p>';
      const live = ON.inGame && G() && !G().over;
      actions = `<div class="row"><button class="btn btn-primary" id="btn-ostart" ${g && gOk && deckOk ? '' : 'disabled'}>${live ? '回到對戰' : '開始連線對戰'}</button></div>`;
      box.innerHTML = head + '<p class="tip">把這組代碼傳給朋友，朋友在這裡輸入就能加入。</p>' + code + st + actions + warn;
      $('btn-ostart').addEventListener('click', () => { if (live) showView('game'); else hostStart(); });
    } else {
      if (ON.accepted) st = `<p class="ostate"><i class="on"></i>已加入 <b>${esc(UI.oppName)}</b> 的房間，等房主開始對戰</p>`;
      else if (ON.full) st = '<p class="ostate"><i></i>這個房間已經有人了。</p>';
      else if (ON.lostHost) st = '<p class="ostate"><i></i>房主離開了房間。</p>';
      else if (!ON.hostPeer) st = '<p class="ostate"><i class="wait"></i>正在找房間…（找很久的話，確認代碼有沒有打錯）</p>';
      const live = ON.inGame && G() && !G().over;
      actions = live ? '<div class="row"><button class="btn btn-primary" id="btn-back">回到對戰</button></div>' : '';
      box.innerHTML = head + code + st + actions + '<p class="tip">換牌組的話，到「組牌」改好再回來，房主開局時會用你最新的牌組。</p>' + warn;
      if ($('btn-back')) $('btn-back').addEventListener('click', () => showView('game'));
      pushPresence();
    }
    $('btn-copy').addEventListener('click', () => {
      const t = ON.code.toUpperCase();
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { $('btn-copy').textContent = '已複製'; }, () => { $('btn-copy').textContent = t; });
    });
    $('btn-leave').addEventListener('click', () => {
      if (ON.inGame && G() && !G().over && !confirm('離開房間會放棄這場對戰，確定嗎？')) return;
      if (ON.inGame) leaveOnlineGame(true);
      ON.inGame = false; leaveRoom();
    });
  }
  async function initOnline() {
    if (!NETSRC) { ON.avail = false; renderOnline(); return; }
    renderOnline();
    let r = null; try { r = await NETSRC.ready; } catch (e) {}
    ON.avail = !!r; renderOnline();
  }
  addEventListener('pagehide', () => { if (ON.nr) ON.nr.leave().catch(() => {}); });

  // ───────── views ─────────
  function showView(v) {
    $('v-lobby').hidden = v !== 'lobby'; $('v-game').hidden = v !== 'game'; $('v-deck').hidden = v !== 'deck';
    $('tab-battle').setAttribute('aria-selected', String(v !== 'deck'));
    $('tab-deck').setAttribute('aria-selected', String(v === 'deck'));
    if (v === 'lobby') renderLobby();
    if (v === 'deck') { B.deck = currentMyDeck().slice(); renderBuilder(); }
    window.scrollTo(0, 0);
  }
  $('tab-battle').addEventListener('click', () => { if (G() && !G().over && !$('v-game').hidden) return; showView(G() && !G().over ? 'game' : 'lobby'); });
  $('tab-deck').addEventListener('click', () => {
    if (G() && !G().over && !$('v-game').hidden) {
      if (!confirm('離開會放棄這場對戰，確定嗎？')) return;
      if (ON.inGame) leaveOnlineGame(true); else G().over = true;
    }
    showView('deck');
  });
  $('btn-start').addEventListener('click', startGame);
  $('btn-reroll').addEventListener('click', () => { pickAiDeck(); renderLobby(); });
  $('btn-end').addEventListener('click', () => { if (myTurnNow()) act(() => A.endTurn()); });
  if (window.parent !== window) {
    $('btn-close').hidden = false;
    $('btn-close').addEventListener('click', () => {
      if (ON.nr && !confirm(ON.inGame && G() && !G().over ? '關掉會中斷這場連線對戰，確定嗎？' : '關掉對戰會離開房間，確定嗎？')) return;
      if (ON.inGame && G() && !G().over) leaveOnlineGame(true);
      leaveRoom().finally(() => window.parent.postMessage({ type: 'nox-battle-close' }, '*'));
    });
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('modal').hidden) return; if (UI.sel || UI.mode) clearSel(); closeSheet(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('v-lobby').hidden) renderLobby(); });

  pickAiDeck(); showView('lobby');
  ensureBack().then(() => { if (!$('v-lobby').hidden) renderLobby(); });
  window.__nox = { E, UI, io, ON, show };
  initOnline();
})();
