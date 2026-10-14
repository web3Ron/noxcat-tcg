// NOXCAT TCG rules engine: game state, turn flow, damage, statuses, card effects and the AI.
// UI-agnostic: everything visual goes through the IO hooks, so the same code runs headless for simulations.
window.NOXGAME = (function () {
  const N = window.NOX;
  const { CARDS, WEAK, RESIST, TYPE } = N;
  const byName = {}; CARDS.forEach(c => { byName[c.name] = c; });

  // ───────── card helpers ─────────
  const isCat = c => c.kind === 'cat';
  const isBasicCat = c => c.kind === 'cat' && c.stage === 0;
  const isEvo = c => c.kind === 'cat' && c.stage > 0;
  const isEnergy = c => c.kind === 'energy';
  const isBasicEnergy = c => c.kind === 'energy' && !!c.basic;
  const isCmd = (c, sub) => c.kind === 'cmd' && (!sub || c.sub === sub);
  const dmgNum = m => parseInt(m.dmg, 10) || 0;
  const top = s => s.cards[s.cards.length - 1].c;
  const hpOf = s => top(s).np;
  const hpLeft = s => Math.max(0, hpOf(s) - s.dmg);
  const basicOf = c => { let x = c; while (x && x.from) x = byName[x.from]; return x; };

  // ───────── state ─────────
  let G = null, IO = null, uidSeq = 1;
  const P = i => G.players[i];
  const other = i => 1 - i;
  const idxOf = p => G.players.indexOf(p);
  const inPlay = p => (p.active ? [p.active] : []).concat(p.bench);
  const fxOn = (s, k) => !!(s && s.fx[k] && G.turn <= s.fx[k].until);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const inst = id => ({ uid: uidSeq++, c: CARDS[id - 1] });
  function mkPlayer(name, ids, ai) {
    return { name, ai, deck: shuffle(ids.map(inst)), hand: [], discard: [], prizes: [], active: null, bench: [],
      attached: false, forestUsed: false, supporter: false, stadiumPlayed: false, retreated: false, noItems: -1, abilityUsed: {}, prizesTaken: 0 };
  }
  function newSlot(card) { return { uid: card.uid, cards: [card], energy: [], tool: null, dmg: 0, status: {}, played: G.turn, evolved: -1, fx: {} }; }

  const log = (t, cls) => IO.log(t, cls);
  const nm = p => p.name;
  const wait = ms => IO.wait(ms);

  // ───────── energy ─────────
  function eUnits(e) {
    const c = e.c;
    if (c.basic) return [c.type];
    if (c.name === '雙重資源') return ['any', 'any'];
    if (c.name === '彩虹資源') return ['rainbow'];
    return ['any'];
  }
  function canPay(energies, cost) {
    const have = {}; let rainbow = 0, plain = 0;
    energies.flatMap(eUnits).forEach(u => { if (u === 'rainbow') rainbow++; else if (u === 'any') plain++; else have[u] = (have[u] || 0) + 1; });
    let anyNeed = 0; const need = {};
    cost.forEach(t => { if (t === 'any') anyNeed++; else need[t] = (need[t] || 0) + 1; });
    for (const t in need) {
      const h = have[t] || 0;
      if (h >= need[t]) have[t] = h - need[t];
      else { const d = need[t] - h; have[t] = 0; if (rainbow < d) return false; rainbow -= d; }
    }
    return Object.values(have).reduce((a, b) => a + b, 0) + rainbow + plain >= anyNeed;
  }
  // how many more units (and of which type) this slot needs for a move
  function missing(s, cost) {
    const ens = s.energy.slice(), out = [];
    for (let k = 0; k < 6 && !canPay(ens, cost); k++) {
      const need = {}; cost.forEach(t => { if (t !== 'any') need[t] = (need[t] || 0) + 1; });
      const have = {}; ens.flatMap(eUnits).forEach(u => { have[u] = (have[u] || 0) + 1; });
      let t = Object.keys(need).find(t => (have[t] || 0) < need[t]) || 'any';
      out.push(t); ens.push({ c: t === 'any' ? { basic: true, type: top(s).type } : { basic: true, type: t } });
    }
    return out;
  }
  const units = s => s.energy.reduce((a, e) => a + eUnits(e).length, 0);
  function retreatCost(p, s) {
    const c = top(s);
    if (G.stadium && G.stadium.c.name === '地下礦坑' && c.type === 'earth') return 0;
    let n = c.retreat;
    if (s.tool && s.tool.c.name === 'NOX 吊牌') n -= 1;
    return Math.max(0, n);
  }

  // ───────── prompts ─────────
  // ask(pi, {title, options:[{value,label,card,slot}], min, max, cancel, score}) → array of values (or null when cancelled)
  async function ask(pi, req) {
    req.min = req.min == null ? 1 : req.min; req.max = req.max == null ? 1 : req.max;
    const opts = req.options.filter(o => !o.disabled);
    if (!opts.length) return [];
    if (P(pi).ai) return aiPick(pi, req, opts);
    return IO.ask(pi, req);
  }
  function aiPick(pi, req, opts) {
    const sc = req.score || (() => 0);
    const ranked = opts.map(o => ({ o, v: sc(o) })).sort((a, b) => b.v - a.v);
    const out = [];
    for (const r of ranked) { if (out.length >= req.max) break; if (out.length >= req.min && r.v <= 0) break; out.push(r.o.value); }
    return out;
  }
  async function coin(label) {
    const r = Math.random() < 0.5;
    await IO.coin(r, label);
    log(`擲硬幣（${label}）：${r ? '正面' : '反面'}`, 'coin');
    return r;
  }
  async function coins(n, label) { let h = 0; for (let i = 0; i < n; i++) if (await coin(label)) h++; return h; }

  // ───────── zones ─────────
  function draw(p, n) {
    let k = 0;
    for (; k < n && p.deck.length; k++) p.hand.push(p.deck.shift());
    return k;
  }
  function discardSlot(p, s) {
    p.discard.push(...s.cards, ...s.energy); if (s.tool) p.discard.push(s.tool);
  }
  function removeSlot(p, s) {
    if (p.active === s) p.active = null; else p.bench = p.bench.filter(b => b !== s);
  }
  function clearOnMove(s) { s.status = {}; s.fx = {}; }
  async function switchActive(p, benchSlot) {
    const old = p.active;
    p.bench = p.bench.filter(b => b !== benchSlot);
    if (old) { clearOnMove(old); p.bench.push(old); }
    p.active = benchSlot;
    IO.render();
  }

  // ───────── damage ─────────
  function defend(t, n) {
    if (t.tool && t.tool.c.name === '鈦合金背心') n -= 20;
    n -= 10 * t.energy.filter(e => e.c.name === '護盾資源').length;
    if (top(t).name === '終極機甲') n -= 30;
    if (fxOn(t, 'reduce')) n -= t.fx.reduce.n;
    return Math.max(0, n);
  }
  function attackBonus(a) {
    let b = 0;
    if (G.stadium && G.stadium.c.name === '夜之城' && ['dark', 'volt'].includes(top(a).type)) b += 10;
    return b;
  }
  function calcHit(a, t, base, o = {}) {
    let n = base + attackBonus(a);
    if (o.main && a.tool && a.tool.c.name === '綠光護目鏡') n += 20;
    const dt = top(t), at = top(a).type;
    if (o.wr) {
      if (WEAK[dt.type] === at && dt.name !== '純金') n *= 2;
      if (!o.ignoreResist && RESIST[dt.type] === at && (dt.stage > 0 || dt.legend)) n -= 30;
    }
    return defend(t, Math.max(0, n));
  }
  function place(owner, s, n, why) {
    if (n <= 0 || !s) return;
    s.dmg += n;
    IO.hit(s, n);
    log(`${top(s).name} 受到 ${n} 傷害${why ? '（' + why + '）' : ''}，剩 ${hpLeft(s)} NP`, 'dmg');
  }
  async function hitTarget(x, t, base, o = {}) {
    if (!t || base <= 0) return 0;
    if (fxOn(t, 'prevent')) { log(`${top(t).name} 受到保護，傷害無效`); return 0; }
    const n = calcHit(x.s, t, base, o);
    const owner = G.players.find(p => inPlay(p).includes(t));
    place(owner, t, n);
    await wait(260);
    return n;
  }

  // ───────── status ─────────
  function setStatus(s, st, fromOpp = true) {
    if (!s) return;
    if (top(s).name === '水晶透明') { log('水晶透明不會陷入異常狀態'); return; }
    if (fromOpp && fxOn(s, 'prevent') && s.fx.prevent.all) return;
    if (st === 'poison' || st === 'burn') s.status[st] = true;
    else { delete s.status.sleep; delete s.status.par; delete s.status.conf; s.status[st] = st === 'par' ? G.turn : true; }
    log(`${top(s).name} 陷入${STATUS_NAME[st]}`, 'status');
    IO.render();
  }
  const STATUS_NAME = { poison: '毒蝕', burn: '灼燒', sleep: '沉睡', par: '癱瘓', conf: '錯亂' };
  function heal(s, n) {
    if (!s || !s.dmg) return;
    const h = Math.min(n, s.dmg); s.dmg -= h;
    log(`${top(s).name} 回復 ${h} NP`, 'heal'); IO.render();
  }

  // ───────── knock outs / win ─────────
  async function checkKOs() {
    for (let round = 0; round < 3; round++) {
      let any = false;
      for (const pi of [G.cur, other(G.cur)]) {
        const p = P(pi);
        for (const s of inPlay(p).slice()) if (s.dmg >= hpOf(s)) { any = true; await knockOut(pi, s); if (G.over) return; }
      }
      if (!any) break;
    }
    for (const pi of [G.cur, other(G.cur)]) {
      const p = P(pi);
      if (!p.active && !p.bench.length) { endGame(other(pi), `${nm(p)}場上已經沒有 NOXCAT`); return; }
    }
    for (const pi of [G.cur, other(G.cur)]) {
      const p = P(pi);
      if (!p.active && p.bench.length) await promote(pi);
    }
  }
  async function knockOut(pi, s) {
    const p = P(pi), c = top(s), q = P(other(pi));
    log(`${c.name} 被擊倒了！`, 'ko');
    await IO.ko(s);
    removeSlot(p, s);
    let reborn = false;
    if (c.name === '闇鳳凰' && await coin('紫灰重生')) {
      reborn = true;
      const t = s.cards.pop(); p.hand.push(t);
      log('紫灰重生：闇鳳凰回到手牌');
    }
    s.energy.filter(e => e.c.name === '回收資源').forEach(e => { p.hand.push(e); log('回收資源回到手牌'); });
    s.energy = s.energy.filter(e => e.c.name !== '回收資源');
    discardSlot(p, s);
    const n = Math.min(c.legend ? 2 : 1, q.prizes.length);
    for (let i = 0; i < n; i++) q.hand.push(q.prizes.pop());
    q.prizesTaken += n;
    log(`${nm(q)}拿到 ${n} 張戰利品（剩 ${q.prizes.length} 張）`, 'prize');
    IO.render();
    if (!q.prizes.length) endGame(other(pi), `${nm(q)}拿完了所有戰利品`);
    void reborn;
  }
  async function promote(pi) {
    const p = P(pi);
    const v = await ask(pi, { title: '選一隻 NOXCAT 上前線', options: p.bench.map(s => ({ value: s, slot: s })), min: 1, max: 1, score: o => aiSlotValue(pi, o.value) });
    const s = v[0] || p.bench[0];
    p.bench = p.bench.filter(b => b !== s); p.active = s;
    log(`${nm(p)}派 ${top(s).name} 上前線`);
    IO.render();
  }
  function endGame(winner, why) {
    if (G.over) return;
    G.over = true; G.winner = winner; G.why = why;
    log(`${why}。${nm(P(winner))}獲勝！`, 'win');
    IO.render(); IO.gameOver(winner, why);
  }

  // ───────── search helpers ─────────
  async function searchDeck(pi, filter, max, title, min = 0) {
    const p = P(pi);
    const opts = p.deck.map(card => ({ value: card, card, disabled: !filter(card.c) }));
    const got = await ask(pi, { title, sub: '從牌庫選擇（找不到也可以不選）', options: opts, min: Math.min(min, opts.filter(o => !o.disabled).length), max, cancel: false, score: o => aiCardValue(pi, o.value) });
    p.deck = p.deck.filter(c => !got.includes(c));
    shuffle(p.deck);
    return got;
  }
  async function toHand(pi, cards, how) {
    const p = P(pi); p.hand.push(...cards);
    if (cards.length) log(`${nm(p)}${how}：${cards.map(c => c.c.name).join('、')}`);
    else log(`${nm(p)}${how}：沒有找到`);
    IO.render();
  }
  async function attachTo(pi, slot, e, quiet) {
    slot.energy.push(e);
    if (!quiet) log(`${nm(P(pi))}把${e.c.name}貼到 ${top(slot).name}`);
    IO.render();
    if (IO.energy) await IO.energy(slot, e);
    if (e.c.name === '彩虹資源') { place(P(pi), slot, 10, '彩虹資源'); IO.render(); }
  }
  async function chooseOwn(pi, title, filter, score) {
    const opts = inPlay(P(pi)).map(s => ({ value: s, slot: s, disabled: filter && !filter(s) }));
    const v = await ask(pi, { title, options: opts, min: 1, max: 1, score: o => score ? score(o.value) : aiSlotValue(pi, o.value) });
    return v[0];
  }
  async function discardOwnEnergy(pi, s, n, filter, title) {
    const opts = s.energy.map(e => ({ value: e, card: e, disabled: filter && !filter(e) }));
    const k = Math.min(n, opts.filter(o => !o.disabled).length);
    const v = await ask(pi, { title: title || `選 ${k} 張要棄掉的資源`, options: opts, min: k, max: k, score: o => 10 - aiEnergyKeep(s, o.value) });
    s.energy = s.energy.filter(e => !v.includes(e));
    P(pi).discard.push(...v);
    if (v.length) log(`棄掉 ${v.map(e => e.c.name).join('、')}`);
    IO.render();
  }
  async function discardOppEnergy(pi, t) {
    if (!t || !t.energy.length) return;
    const q = P(other(pi));
    const v = await ask(pi, { title: `選 1 張要棄掉的對手資源`, options: t.energy.map(e => ({ value: e, card: e })), min: 1, max: 1, score: o => 5 + eUnits(o.value).length });
    t.energy = t.energy.filter(e => !v.includes(e)); q.discard.push(...v);
    log(`棄掉對手 ${top(t).name} 身上的${v.map(e => e.c.name).join('、')}`);
    IO.render();
  }
  async function pickOppBench(pi, title, score) {
    const q = P(other(pi));
    const v = await ask(pi, { title, options: q.bench.map(s => ({ value: s, slot: s })), min: 1, max: 1, score: o => (score ? score(o.value) : 100 - hpLeft(o.value)) });
    return v[0];
  }

  // ───────── attack effects ─────────
  // each entry is async (x) with x = { pi, me, op, s, base, hit(n, o) } and does its own damage
  const reduceNext = (x, n) => { x.s.fx.reduce = { n, until: G.turn + 1 }; };
  const preventNext = (x, all) => { x.s.fx.prevent = { all, until: G.turn + 1 }; log(`${top(x.s).name} 下回合受到保護`); };
  const snipe = async (x, n) => { if (!x.op.bench.length) return; const t = await pickOppBench(x.pi, `選對手後援區 1 隻 NOXCAT（${n} 傷害）`, s => (hpLeft(s) <= n ? 200 : 0) + 100 - hpLeft(s)); await hitTarget(x, t, n); };
  const spray = async (x, p, n) => { for (const t of p.bench.slice()) await hitTarget(x, t, n); };
  const selfDiscard = (x, n, f) => discardOwnEnergy(x.pi, x.s, n, f);
  const FX = {
    'OG 經典/初代認證': async x => { await x.hit(); const g = await searchDeck(x.pi, isBasicEnergy, 1, '找 1 張基本資源貼到 OG 經典'); for (const e of g) await attachTo(x.pi, x.s, e); },
    '宇航員/無重力漫步': async x => { await x.hit(); reduceNext(x, 20); },
    '雷射眼/綠光射線': async x => { const b = await coin('綠光射線') ? 30 : 0; await x.hit(x.base + b); },
    '賽博武士/霓虹一閃': async x => { await x.hit(x.base, { ignoreResist: true }); },
    '皇冠國王/王之權杖': async x => { await toHand(x.pi, await searchDeck(x.pi, c => isCmd(c, '夥伴'), 1, '找 1 張夥伴卡'), '從牌庫找到'); },
    '禮服紳士/舉杯致意': async x => { heal(x.s, 30); },
    '電競玩家/連擊': async x => { await x.hit(10 * await coins(3, '連擊')); },
    '巫師/熬夜研究': async x => { draw(x.me, 2); log(`${nm(x.me)}抽 2 張`); },
    '黑客/入侵': async x => { if (!x.me.ai) await IO.ask(x.pi, { title: '對手的手牌', options: x.op.hand.map(c => ({ value: c, card: c })), viewOnly: true, min: 0, max: 0 }); log(`${nm(x.me)}查看了對手的手牌`); },
    '黑客/病毒植入': async x => { await x.hit(); setStatus(x.op.active, 'poison'); },
    '惡魔/綠焰': async x => { await x.hit(); setStatus(x.op.active, 'burn'); },
    '天使/光之祝福': async x => { const s = await chooseOwn(x.pi, '回復 1 隻 NOXCAT 40 NP', s => s.dmg > 0, s => s.dmg); heal(s, 40); },
    '忍者/手裏劍': async x => {
      const opts = inPlay(x.op).map(s => ({ value: s, slot: s }));
      const t = (await ask(x.pi, { title: '選對手 1 隻 NOXCAT（20 傷害）', options: opts, score: o => (hpLeft(o.value) <= 20 ? 200 : 0) + 100 - hpLeft(o.value) }))[0];
      await hitTarget(x, t, 20);
    },
    '殭屍/綠色藥水': async x => { heal(x.s, 20); },
    '斗笠俠客/扇風': async x => { await x.hit(); if (x.op.active) x.op.active.fx.cantRetreat = { until: G.turn + 1 }; },
    '龍帝/金龍纏身': async x => { await x.hit(); reduceNext(x, 20); },
    '鳳凰/浴火': async x => { await x.hit(); heal(x.s, 30); },
    '鳳凰/燃盡過去': async x => { await x.hit(); await selfDiscard(x, 1); },
    '雷神/落雷': async x => { await x.hit(); if (await coin('落雷')) setStatus(x.op.active, 'par'); },
    '仙尊/太極': async x => { await x.hit(); reduceNext(x, 30); },
    '創始者/創世區塊': async x => {
      if (x.me.bench.length >= 4) { log('後援區已滿'); return; }
      const g = await searchDeck(x.pi, isBasicCat, 1, '找 1 張基礎 NOXCAT 放到後援區');
      g.forEach(c => { x.me.bench.push(newSlot(c)); log(`${c.c.name} 放到後援區`); }); IO.render();
    },
    '水晶透明/折射': async x => { await x.hit(); await snipe(x, 30); },
    '水晶透明/水晶風暴': async x => { await x.hit(); x.s.fx.cantAttack = { until: G.turn + 2 }; },
    '外星人/未知訊號': async x => { setStatus(x.op.active, 'conf'); },
    '機械體/綠能核心': async x => {
      const opts = x.me.discard.map(c => ({ value: c, card: c, disabled: !isBasicEnergy(c.c) }));
      const v = await ask(x.pi, { title: '從棄牌區選 1 張基本資源貼上', options: opts, min: 0, max: 1, score: o => 5 });
      for (const e of v) { x.me.discard = x.me.discard.filter(c => c !== e); await attachTo(x.pi, x.s, e); }
    },
    '殭屍腦/想太多': async x => { await x.hit(30 * await coins(2, '想太多')); },
    '殭屍腦/腦波干擾': async x => { await x.hit(); setStatus(x.op.active, 'conf'); },
    '彩虹全息/全息投影': async x => { await x.hit(); if (await coin('全息投影')) preventNext(x, true); },
    '像素忍者/影分身': async x => { await x.hit(); if (await coin('影分身')) preventNext(x, false); },
    '像素電競/連打': async x => { await x.hit(20 * await coins(4, '連打')); },
    '網點海盜/黑旗掠奪': async x => { await x.hit(); await discardOppEnergy(x.pi, x.op.active); },
    '網點街頭/網點噴射': async x => { await x.hit(); setStatus(x.op.active, 'burn'); },
    '夜視黑客/關燈': async x => { await x.hit(); x.op.noItems = G.turn + 1; log(`${nm(x.op)}下回合不能使用道具卡`); },
    '夜視黑客/系統癱瘓': async x => { await x.hit(); if (await coin('系統癱瘓')) setStatus(x.op.active, 'par'); },
    '墨韻俠客/潑墨': async x => { await snipe(x, 20); },
    '白夜殭屍/白夜甦醒': async x => { await x.hit(); if (await coin('白夜甦醒')) setStatus(x.op.active, 'sleep'); },
    '白夜殭屍/不死之身': async x => { await x.hit(); heal(x.s, 30); },
    '霓虹武士/斷訊斬': async x => { await x.hit(); const t = x.op.active; if (t && t.tool) { x.op.discard.push(t.tool); log(`棄掉 ${top(t).name} 的${t.tool.c.name}`); t.tool = null; } },
    '霓虹武士/霓虹居合': async x => { await x.hit(x.base, { ignoreResist: true }); },
    '冰霜宇航員/結霜護目鏡': async x => { await x.hit(); if (await coin('結霜護目鏡')) setStatus(x.op.active, 'par'); },
    '熔岩惡魔/冒煙腳步': async x => { await x.hit(); await snipe(x, 20); },
    '熔岩惡魔/熔岩爆發': async x => { await x.hit(); await selfDiscard(x, 1, e => e.c.type === 'fire' && e.c.basic); },
    '霓光巫師/光圈': async x => {
      const look = x.me.deck.slice(0, 4);
      const v = await ask(x.pi, { title: '牌庫上方 4 張，選 1 張加入手牌', options: look.map(c => ({ value: c, card: c })), min: Math.min(1, look.length), max: 1, score: o => aiCardValue(x.pi, o.value) });
      x.me.deck = x.me.deck.filter(c => !v.includes(c)); shuffle(x.me.deck); await toHand(x.pi, v, '用光圈拿到');
    },
    '紫外雷射眼/瞄準': async x => { await snipe(x, 20); },
    '普普紳士/四杯連飲': async x => { inPlay(x.me).forEach(s => heal(s, 20)); },
    '黑金天使/黃金祝福': async x => { inPlay(x.me).forEach(s => heal(s, 30)); },
    '雙生雷神/平行雷擊': async x => { await x.hit(); await snipe(x, 30); },
    '雙生雷神/雙生雷霆': async x => { await x.hit(); place(x.me, x.s, 20, '反作用'); },
    '故障外星人/傳送故障': async x => {
      await x.hit();
      if (x.op.active && x.op.bench.length && x.op.active.dmg < hpOf(x.op.active)) {
        const oi = other(x.pi);
        const t = (await ask(oi, { title: '傳送故障：選 1 隻後援區 NOXCAT 換上前線', options: x.op.bench.map(s => ({ value: s, slot: s })), score: o => aiSlotValue(oi, o.value) }))[0];
        await switchActive(x.op, t); log(`${nm(x.op)}的 ${top(t).name} 被換上前線`);
      }
    },
    '紫電仙尊/紫電修為': async x => { await x.hit(); if (await coin('紫電修為')) setStatus(x.op.active, 'sleep'); },
    '血月機械體/核心過熱': async x => { await x.hit(); place(x.me, x.s, 10, '過熱'); },
    '黑金國王/夜之王權': async x => { await x.hit(); await spray(x, x.op, 10); },
    '冰龍帝/冰封': async x => { await x.hit(); if (await coin('冰封')) setStatus(x.op.active, 'par'); },
    '宇宙 OG/星際訊號': async x => { await toHand(x.pi, await searchDeck(x.pi, () => true, 2, '找 2 張卡加入手牌'), '從牌庫找到'); },
    '宇宙 OG/宇宙大爆炸': async x => { await x.hit(); await selfDiscard(x, 2); },
    '全息創始者/全息區塊': async x => { await x.hit(); await toHand(x.pi, await searchDeck(x.pi, () => true, 2, '找 2 張卡加入手牌'), '從牌庫找到'); },
    '竹林劍聖/葉刃旋風': async x => { await x.hit(); await spray(x, x.op, 10); },
    '煉獄魔王/地獄王座': async x => { await x.hit(); setStatus(x.op.active, 'burn'); setStatus(x.s, 'burn', false); },
    '煉獄魔王/煉獄審判': async x => { await x.hit(); await selfDiscard(x, 2); },
    '深海船長/觸手纏繞': async x => { await x.hit(); if (await coin('觸手纏繞')) setStatus(x.op.active, 'par'); },
    '雷霆主宰/雷雲統御': async x => {
      const g = await searchDeck(x.pi, c => isBasicEnergy(c) && c.type === 'volt', 2, '找最多 2 張雷電資源');
      for (const e of g) { const s = await chooseOwn(x.pi, `把${e.c.name}貼到哪一隻？`, null, s => (top(s).type === 'volt' ? 50 : 0) + missing(s, bestCost(s)).length * 5); await attachTo(x.pi, s, e); }
    },
    '雷霆主宰/萬雷審判': async x => { await x.hit(); await selfDiscard(x, 2); },
    '大魔導師/星陣崩落': async x => { await x.hit(); setStatus(x.op.active, 'conf'); },
    '粉紅甜心/甜心馬卡龍': async x => { const s = await chooseOwn(x.pi, '回復 1 隻 NOXCAT 30 NP', s => s.dmg > 0, s => s.dmg); heal(s, 30); },
    '粉紅甜心/愛心攻勢': async x => { await x.hit(); if (await coin('愛心攻勢')) setStatus(x.op.active, 'conf'); },
    '影子貓/融入陰影': async x => { if (await coin('融入陰影')) preventNext(x, false); },
    '深淵之影/黑洞吸引': async x => {
      if (!x.op.bench.length) return;
      const t = await pickOppBench(x.pi, '黑洞吸引：選對手後援區 1 隻換到前線', s => 300 - hpLeft(s));
      await switchActive(x.op, t); log(`${nm(x.op)}的 ${top(t).name} 被拉到前線`);
    },
    '深淵之影/深淵吞噬': async x => { await x.hit(); heal(x.s, 30); },
    '影之上忍/千影手裏劍': async x => {
      const opts = inPlay(x.op).map(s => ({ value: s, slot: s }));
      const v = await ask(x.pi, { title: '選對手最多 3 隻 NOXCAT（各 30 傷害）', options: opts, min: Math.min(1, opts.length), max: 3, score: o => (hpLeft(o.value) <= 30 ? 200 : 0) + 100 - hpLeft(o.value) / 10 });
      for (const t of v) await hitTarget(x, t, 30);
    },
    '影之上忍/月下暗殺': async x => { await x.hit(x.base + (x.op.active && x.op.active.dmg > 0 ? 50 : 0)); },
    '終極機甲/全彈發射': async x => { await x.hit(); x.s.fx.lockMove = { name: '全彈發射', until: G.turn + 2 }; },
    '石像守衛/石盾': async x => { reduceNext(x, 30); log('石像守衛下回合受到的傷害 −30'); },
    '遠古石像/岩石軌道': async x => { await x.hit(); if (await coin('岩石軌道')) setStatus(x.op.active, 'par'); },
    '大地泰坦/山脈崩裂': async x => { await x.hit(); await spray(x, x.op, 10); await spray(x, x.me, 10); },
    '水晶礦工/挖礦': async x => { const g = await searchDeck(x.pi, c => isBasicEnergy(c) && c.type === 'earth', 1, '找 1 張大地資源貼上'); for (const e of g) await attachTo(x.pi, x.s, e); },
    '鑽頭礦工/破岩鑽': async x => { await x.hit(x.base, { ignoreResist: true }); },
    '鑽頭礦工/鑽穿': async x => { await x.hit(); await discardOppEnergy(x.pi, x.op.active); }
  };

  // ───────── commands ─────────
  const evoTargets = (p, evo) => inPlay(p).filter(s => canEvolveOnto(evo, s));
  function candyPairs(p) {
    const out = [];
    p.hand.forEach(h => {
      if (!isEvo(h.c) || h.c.stage !== 2) return;
      const mid = byName[h.c.from]; if (!mid) return;
      inPlay(p).forEach(s => { if (top(s).name === mid.from && top(s).stage === 0 && s.played < G.turn && G.turn >= 3) out.push({ h, s }); });
    });
    return out;
  }
  const CMD = {
    '首席研究員': { ok: () => true, run: async pi => { const p = P(pi); p.discard.push(...p.hand); log(`${nm(p)}棄掉 ${p.hand.length} 張手牌`); p.hand = []; draw(p, 7); log(`${nm(p)}抽 7 張`); } },
    '夜班店長': { ok: () => true, run: async pi => { draw(P(pi), 3); log(`${nm(P(pi))}抽 3 張`); } },
    '交易員': { ok: () => true, run: async pi => { for (const p of G.players) { p.deck.push(...p.hand); p.hand = []; shuffle(p.deck); draw(p, 4); } log('雙方把手牌洗回牌庫，各抽 4 張'); } },
    '鏈上偵探': { ok: () => true, run: async pi => {
      const a = await searchDeck(pi, isCat, 1, '找 1 張 NOXCAT 卡');
      const b = await searchDeck(pi, isBasicEnergy, 1, '找 1 張基本資源');
      await toHand(pi, a.concat(b), '從牌庫找到');
    } },
    '保安隊長': { ok: pi => P(other(pi)).bench.length > 0, run: async pi => {
      const q = P(other(pi));
      const t = await pickOppBench(pi, '選對手後援區 1 隻換到前線', s => 300 - hpLeft(s));
      await switchActive(q, t); log(`${nm(q)}的 ${top(t).name} 被換到前線`);
    } },
    '覺醒導師': { ok: () => G.turn >= 3, run: async pi => {
      const p = P(pi);
      const g = await searchDeck(pi, c => isEvo(c) && inPlay(p).some(s => canEvolveOnto({ c }, s)), 1, '找 1 張可以立刻覺醒的卡');
      for (const e of g) {
        const s = await chooseOwn(pi, `${e.c.name} 要覺醒哪一隻？`, s => canEvolveOnto(e, s));
        if (s) await evolveSlot(pi, s, e); else p.hand.push(e);
      }
    } },
    '貓薄荷探測器': { ok: () => true, run: async pi => { await toHand(pi, await searchDeck(pi, isBasicCat, 1, '找 1 張基礎 NOXCAT'), '從牌庫找到'); } },
    '傳送門': { ok: pi => P(pi).bench.length > 0, run: async pi => {
      const p = P(pi);
      const t = (await ask(pi, { title: '選 1 隻後援區 NOXCAT 換上前線', options: p.bench.map(s => ({ value: s, slot: s })), score: o => aiSlotValue(pi, o.value) }))[0];
      await switchActive(p, t); log(`${nm(p)}把 ${top(t).name} 換上前線`);
    } },
    '急救罐頭': { ok: pi => inPlay(P(pi)).some(s => s.dmg > 0), run: async pi => { const s = await chooseOwn(pi, '回復 1 隻 NOXCAT 30 NP', s => s.dmg > 0, s => s.dmg); heal(s, 30); } },
    '九條命': { ok: pi => P(pi).discard.some(c => isCat(c.c)), run: async pi => {
      const p = P(pi);
      const v = await ask(pi, { title: '從棄牌區選 1 張 NOXCAT 卡', options: p.discard.map(c => ({ value: c, card: c, disabled: !isCat(c.c) })), score: o => aiCardValue(pi, o.value) });
      p.discard = p.discard.filter(c => !v.includes(c)); await toHand(pi, v, '從棄牌區拿回');
    } },
    '覺醒糖果': { ok: pi => candyPairs(P(pi)).length > 0, run: async pi => {
      const p = P(pi), pairs = candyPairs(p);
      const v = await ask(pi, { title: '選要直接二階覺醒的組合', options: pairs.map(pr => ({ value: pr, card: pr.h, label: `${top(pr.s).name} → ${pr.h.c.name}` })), score: o => 10 + (o.value.s === p.active ? 5 : 0) });
      const pr = v[0]; if (!pr) return;
      p.hand = p.hand.filter(c => c !== pr.h); await evolveSlot(pi, pr.s, pr.h, true);
    } },
    '幸運貓爪': { ok: () => true, run: async pi => { if (await coin('幸運貓爪')) { draw(P(pi), 2); log(`${nm(P(pi))}抽 2 張`); } } },
    '資源補給包': { ok: pi => P(pi).discard.some(c => isBasicEnergy(c.c)), run: async pi => {
      const p = P(pi);
      const v = await ask(pi, { title: '從棄牌區選最多 2 張基本資源', options: p.discard.map(c => ({ value: c, card: c, disabled: !isBasicEnergy(c.c) })), min: 1, max: 2, score: o => 5 });
      p.discard = p.discard.filter(c => !v.includes(c)); await toHand(pi, v, '從棄牌區拿回');
    } },
    '訊號干擾器': { ok: pi => { const t = P(other(pi)).active; return !!(t && t.energy.length); }, run: async pi => { if (await coin('訊號干擾器')) await discardOppEnergy(pi, P(other(pi)).active); } }
  };

  // ───────── legality ─────────
  const myTurn = pi => !G.over && G.cur === pi;
  function canEvolveOnto(card, s) {
    const c = card.c;
    return isEvo(c) && c.from === top(s).name && G.turn >= 3 && s.played < G.turn && s.evolved < G.turn;
  }
  function canAttach(pi, card, s) {
    const p = P(pi);
    if (!isEnergy(card.c)) return false;
    if (!p.attached) return true;
    return !!(G.stadium && G.stadium.c.name === '翡翠森林' && !p.forestUsed && card.c.basic && card.c.type === 'grass' && top(s).type === 'grass');
  }
  function canPlayCmd(pi, card) {
    const p = P(pi), c = card.c;
    if (!isCmd(c)) return false;
    if (c.sub === '道具') return p.noItems < G.turn && (CMD[c.name] ? CMD[c.name].ok(pi) : true);
    if (c.sub === '夥伴') return !p.supporter && G.turn > 1 && CMD[c.name].ok(pi);
    if (c.sub === '場地') return !p.stadiumPlayed && !(G.stadium && G.stadium.c.name === c.name);
    if (c.sub === '裝備') return inPlay(p).some(s => !s.tool);
    return false;
  }
  function canRetreat(pi) {
    const p = P(pi), s = p.active;
    return !!(s && !p.retreated && p.bench.length && !s.status.sleep && !s.status.par && !fxOn(s, 'cantRetreat') && units(s) >= retreatCost(p, s));
  }
  function moveState(pi, i) {
    const p = P(pi), s = p.active; if (!s) return { ok: false, why: '' };
    const m = top(s).moves[i];
    if (m.ability) return { ok: false, why: '特性' };
    if (G.turn === 1) return { ok: false, why: '先攻第一回合不能攻擊' };
    if (s.status.sleep) return { ok: false, why: '沉睡中' };
    if (s.status.par) return { ok: false, why: '癱瘓中' };
    if (fxOn(s, 'cantAttack')) return { ok: false, why: '這回合不能用招式' };
    if (fxOn(s, 'lockMove') && s.fx.lockMove.name === m.name) return { ok: false, why: '這回合不能用這招' };
    if (!canPay(s.energy, m.cost)) return { ok: false, why: '資源不足' };
    return { ok: true };
  }
  const canAbility = (pi, s) => top(s).name === '大魔導師' && !P(pi).abilityUsed[s.uid] && P(pi).deck.some(c => isCmd(c.c));

  // ───────── actions ─────────
  async function playBasic(pi, card) {
    const p = P(pi);
    if (!myTurn(pi) || !isBasicCat(card.c) || p.bench.length >= 4) return false;
    p.hand = p.hand.filter(c => c !== card);
    const s = newSlot(card);
    if (!p.active) p.active = s; else p.bench.push(s);
    log(`${nm(p)}把 ${card.c.name} 放到${p.active === s ? '前線' : '後援區'}`);
    IO.render(); return true;
  }
  async function evolveSlot(pi, s, card, viaCandy) {
    const before = top(s).name;
    s.cards.push(card); s.evolved = G.turn; s.status = {};
    log(`${before} ${viaCandy ? '吃了覺醒糖果，' : ''}覺醒成 ${card.c.name}！`, 'evo');
    IO.evolve(s); IO.render();
  }
  async function evolve(pi, card, s) {
    const p = P(pi);
    if (!myTurn(pi) || !canEvolveOnto(card, s)) return false;
    p.hand = p.hand.filter(c => c !== card);
    await evolveSlot(pi, s, card); return true;
  }
  async function attach(pi, card, s) {
    const p = P(pi);
    if (!myTurn(pi) || !canAttach(pi, card, s)) return false;
    if (p.attached) p.forestUsed = true; else p.attached = true;
    p.hand = p.hand.filter(c => c !== card);
    await attachTo(pi, s, card); return true;
  }
  async function playTool(pi, card, s) {
    const p = P(pi);
    if (!myTurn(pi) || !isCmd(card.c, '裝備') || s.tool) return false;
    p.hand = p.hand.filter(c => c !== card); s.tool = card;
    log(`${nm(p)}給 ${top(s).name} 裝上${card.c.name}`); IO.render(); return true;
  }
  async function playCmd(pi, card) {
    const p = P(pi), c = card.c;
    if (!myTurn(pi) || !canPlayCmd(pi, card) || c.sub === '裝備') return false;
    p.hand = p.hand.filter(x => x !== card);
    log(`${nm(p)}使用${c.sub}卡「${c.name}」`, 'cmd');
    await IO.showPlay(pi, card);
    if (c.sub === '場地') {
      if (G.stadium) { G.stadiumOwner.discard.push(G.stadium); }
      G.stadium = card; G.stadiumOwner = p; p.stadiumPlayed = true; IO.render(); return true;
    }
    if (c.sub === '夥伴') p.supporter = true;
    await CMD[c.name].run(pi);
    p.discard.push(card);
    IO.render();
    await checkKOs();
    return true;
  }
  async function retreat(pi, to) {
    const p = P(pi);
    if (!myTurn(pi) || !canRetreat(pi)) return false;
    const s = p.active, cost = retreatCost(p, s);
    if (cost > 0) {
      // pay with the energy this cat needs least
      const sorted = s.energy.slice().sort((a, b) => aiEnergyKeep(s, a) - aiEnergyKeep(s, b));
      let paid = 0; const out = [];
      for (const e of sorted) { if (paid >= cost) break; out.push(e); paid += eUnits(e).length; }
      s.energy = s.energy.filter(e => !out.includes(e)); p.discard.push(...out);
    }
    p.retreated = true;
    log(`${nm(p)}把 ${top(s).name} 撤離到後援區${cost ? `（棄掉 ${cost} 個資源）` : ''}`);
    await switchActive(p, to);
    log(`${top(to).name} 上前線`);
    return true;
  }
  async function useAbility(pi, s) {
    if (!myTurn(pi) || !canAbility(pi, s)) return false;
    P(pi).abilityUsed[s.uid] = true;
    log(`大魔導師發動特性「禁書」`, 'cmd');
    await toHand(pi, await searchDeck(pi, c => isCmd(c), 1, '找 1 張指令卡'), '用禁書找到');
    return true;
  }
  async function attack(pi, i) {
    const me = P(pi), op = P(other(pi)), s = me.active;
    if (!myTurn(pi) || !moveState(pi, i).ok) return false;
    const m = top(s).moves[i];
    G.busyAttack = true;
    log(`${top(s).name} 使用「${m.name}」`, 'atk');
    await IO.attackFx(pi, m);
    if (s.status.conf && !(await coin('錯亂'))) {
      log(`${top(s).name} 錯亂了，攻擊失敗`); place(me, s, 30, '錯亂');
    } else {
      const x = { pi, me, op, s, base: dmgNum(m) };
      x.hit = (n = x.base, o = {}) => hitTarget(x, op.active, n, Object.assign({ main: true, wr: true }, o));
      const f = FX[top(s).name + '/' + m.name];
      if (f) await f(x); else if (x.base) await x.hit();
    }
    G.busyAttack = false;
    await checkKOs();
    if (!G.over) await endTurn();
    return true;
  }

  // ───────── turn flow ─────────
  async function checkup(endedPi) {
    for (const pi of [endedPi, other(endedPi)]) {
      const s = P(pi).active; if (!s) continue;
      const n = top(s).name;
      if (s.status.poison) place(P(pi), s, 10, '毒蝕');
      if (s.status.burn) { place(P(pi), s, 20, '灼燒'); if (await coin(`${n} 灼燒`)) { delete s.status.burn; log(`${n} 的灼燒解除了`); } }
      if (s.status.sleep && await coin(`${n} 沉睡`)) { delete s.status.sleep; log(`${n} 醒來了`); }
      if (pi === endedPi && s.status.par && s.status.par < G.turn) { delete s.status.par; log(`${n} 的癱瘓解除了`); }
    }
    IO.render();
    await checkKOs();
  }
  async function endTurn() {
    if (G.over) return;
    const ended = G.cur;
    log(`${nm(P(ended))}結束回合`, 'turn');
    await checkup(ended);
    if (G.over) return;
    G.cur = other(ended);
    await startTurn();
  }
  async function startTurn() {
    if (G.over) return;
    G.turn++;
    const p = P(G.cur);
    Object.assign(p, { attached: false, forestUsed: false, supporter: false, stadiumPlayed: false, retreated: false, abilityUsed: {} });
    IO.turnBanner(G.cur);
    log(`── 第 ${G.turn} 回合：${nm(p)} ──`, 'turn');
    if (!p.deck.length) { endGame(other(G.cur), `${nm(p)}的牌庫沒牌了`); return; }
    draw(p, 1);
    IO.render();
    if (p.ai && !G.over) await aiTurn(G.cur);
  }

  // ───────── setup ─────────
  async function newGame(deck0, deck1, io, opts = {}) {
    IO = io; uidSeq = 1;
    G = { turn: 0, cur: 0, players: [mkPlayer(opts.names ? opts.names[0] : '你', deck0, !!opts.ai0), mkPlayer(opts.names ? opts.names[1] : '電腦', deck1, !opts.human1)], stadium: null, stadiumOwner: null, over: false, winner: null };
    IO.render();
    // opening hands with mulligans
    const mull = [0, 0];
    for (const pi of [0, 1]) {
      const p = P(pi);
      for (let k = 0; k < 20; k++) {
        draw(p, 7);
        if (p.hand.some(c => isBasicCat(c.c))) break;
        mull[pi]++; log(`${nm(p)}手上沒有基礎 NOXCAT，重新洗牌抽 7 張`);
        p.deck.push(...p.hand); p.hand = []; shuffle(p.deck);
      }
    }
    for (const pi of [0, 1]) if (mull[other(pi)]) { const n = draw(P(pi), mull[other(pi)]); log(`${nm(P(pi))}因為對手重抽，多抽 ${n} 張`); }
    IO.render();
    // place active + bench
    for (const pi of [0, 1]) {
      const p = P(pi);
      const basics = () => p.hand.filter(c => isBasicCat(c.c));
      const a = (await ask(pi, { title: '選 1 隻基礎 NOXCAT 放到前線', options: basics().map(c => ({ value: c, card: c })), min: 1, max: 1, score: o => aiOpenerValue(o.value) }))[0] || basics()[0];
      p.hand = p.hand.filter(c => c !== a); p.active = newSlot(a);
      IO.render();
      const rest = basics();
      if (rest.length) {
        const b = await ask(pi, { title: '選要放到後援區的基礎 NOXCAT（可以不選）', options: rest.map(c => ({ value: c, card: c })), min: 0, max: Math.min(4, rest.length), score: () => 1 });
        b.forEach(c => { p.hand = p.hand.filter(x => x !== c); p.bench.push(newSlot(c)); });
      }
      for (let i = 0; i < 4; i++) p.prizes.push(p.deck.shift());
      IO.render();
    }
    log(`${nm(P(0))}的前線：${top(P(0).active).name}；${nm(P(1))}的前線：${top(P(1).active).name}`);
    const first = (await coin('決定先攻')) ? 0 : 1;
    log(`${nm(P(first))}先攻`, 'turn');
    G.cur = first;
    await startTurn();
  }

  // ───────── online sync: host snapshots, guest mirrors ─────────
  // snapshot(viewPi) is the table as viewPi may see it, re-indexed so that viewer is player 0.
  // Hidden zones (opponent hand/deck, both prize piles) travel as counts; your own deck as sorted ids.
  const cd = c => c ? [c.uid, c.c.id] : null;
  const sl = s => s && { u: s.uid, c: s.cards.map(cd), e: s.energy.map(cd), t: cd(s.tool), d: s.dmg, s: s.status, p: s.played, v: s.evolved, f: s.fx };
  function snapshot(viewPi) {
    const o = other(viewPi);
    const pl = (p, own) => ({ n: p.name, h: own ? p.hand.map(cd) : p.hand.length, k: own ? p.deck.map(c => c.c.id).sort((a, b) => a - b) : p.deck.length,
      x: p.discard.map(cd), z: p.prizes.length, zt: p.prizesTaken || 0, a: sl(p.active), b: p.bench.map(sl),
      f: [p.attached, p.forestUsed, p.supporter, p.stadiumPlayed, p.retreated, p.noItems], ab: p.abilityUsed });
    const flip = i => i == null ? null : (i === viewPi ? 0 : 1);
    return { T: G.turn, c: flip(G.cur), P: [pl(P(viewPi), true), pl(P(o), false)], st: cd(G.stadium),
      so: G.stadiumOwner ? flip(idxOf(G.stadiumOwner)) : -1, o: G.over, w: flip(G.winner), y: G.why || '' };
  }
  let hidSeq = 1;
  const ci = a => a ? { uid: a[0], c: CARDS[a[1] - 1] } : null;
  const hid = n => Array.from({ length: n }, () => ({ uid: -(hidSeq++), c: null }));
  const us = d => d && { uid: d.u, cards: d.c.map(ci), energy: d.e.map(ci), tool: ci(d.t), dmg: d.d, status: d.s || {}, played: d.p, evolved: d.v, fx: d.f || {} };
  function mirror(S) {
    const pl = (d, own) => {
      const p = mkPlayer(d.n, [], false);
      p.hand = own ? d.h.map(ci) : hid(d.h);
      p.deck = own ? d.k.map(id => ({ uid: -(hidSeq++), c: CARDS[id - 1] })) : hid(d.k);
      p.discard = d.x.map(ci); p.prizes = hid(d.z); p.prizesTaken = d.zt;
      p.active = us(d.a); p.bench = d.b.map(us);
      [p.attached, p.forestUsed, p.supporter, p.stadiumPlayed, p.retreated, p.noItems] = d.f; p.abilityUsed = d.ab || {};
      return p;
    };
    const players = [pl(S.P[0], true), pl(S.P[1], false)];
    G = { turn: S.T, cur: S.c, players, stadium: ci(S.st), stadiumOwner: S.so >= 0 ? players[S.so] : null, over: S.o, winner: S.w, why: S.y, mirror: true };
    return G;
  }
  function forfeit(pi, why) { if (G && !G.over) endGame(other(pi), why); }

  // ───────── AI ─────────
  function bestCost(s) {
    const ms = top(s).moves.filter(m => !m.ability);
    if (!ms.length) return [];
    return ms.reduce((a, b) => (dmgNum(b) >= dmgNum(a) ? b : a)).cost;
  }
  function estMove(pi, s, m, t) {
    if (!t) return 0;
    let b = dmgNum(m);
    const name = top(s).name + '/' + m.name;
    const exp = { '電競玩家/連擊': 15, '殭屍腦/想太多': 30, '像素電競/連打': 40, '雷射眼/綠光射線': b + 15, '影之上忍/月下暗殺': b + (t.dmg > 0 ? 50 : 0) };
    if (exp[name] != null) b = exp[name];
    if (!b) return 0;
    if (fxOn(t, 'prevent')) return 0;
    return calcHit(s, t, b, { main: true, wr: true, ignoreResist: /霓虹一閃|霓虹居合|破岩鑽/.test(name) });
  }
  const UTIL = {
    '皇冠國王/王之權杖': 18, '巫師/熬夜研究': 20, '天使/光之祝福': 15, '禮服紳士/舉杯致意': 12, '殭屍/綠色藥水': 10, '創始者/創世區塊': 18,
    '外星人/未知訊號': 14, '機械體/綠能核心': 16, '墨韻俠客/潑墨': 15, '霓光巫師/光圈': 16, '紫外雷射眼/瞄準': 15, '普普紳士/四杯連飲': 14,
    '黑金天使/黃金祝福': 18, '宇宙 OG/星際訊號': 22, '雷霆主宰/雷雲統御': 24, '粉紅甜心/甜心馬卡龍': 12, '影子貓/融入陰影': 10, '深淵之影/黑洞吸引': 20,
    '影之上忍/千影手裏劍': 60, '石像守衛/石盾': 10, '黑客/入侵': 4, '忍者/手裏劍': 20
  };
  function aiMoveScore(pi, i) {
    const me = P(pi), op = P(other(pi)), s = me.active, m = top(s).moves[i], t = op.active;
    const name = top(s).name + '/' + m.name;
    let v = estMove(pi, s, m, t);
    if (t && v >= hpLeft(t)) v += 200 + (top(t).legend ? 150 : 0);
    v += UTIL[name] || 0;
    if (/heal|回復/.test(m.text) && s.dmg === 0 && !dmgNum(m)) v -= 10;
    if (/棄掉自己身上/.test(m.text)) v -= 12;
    return v;
  }
  function aiSlotValue(pi, s) {
    const p = P(pi);
    let v = hpLeft(s) / 10;
    const ms = top(s).moves.filter(m => !m.ability);
    ms.forEach(m => { if (canPay(s.energy, m.cost)) v += dmgNum(m) / 5 + 10; });
    v -= retreatCost(p, s);
    return v;
  }
  function aiOpenerValue(card) { const c = card.c; return c.np / 10 + (c.legend ? -5 : 0) + (c.moves.some(m => m.cost && m.cost.length <= 1) ? 4 : 0); }
  function aiEnergyKeep(s, e) {
    const need = bestCost(s);
    const t = e.c.basic ? e.c.type : 'x';
    return (need.includes(t) ? 5 : 0) + eUnits(e).length;
  }
  function aiCardValue(pi, card) {
    const p = P(pi), c = card.c;
    if (isEvo(c)) return inPlay(p).some(s => top(s).name === c.from) ? 30 : 8;
    if (isBasicCat(c)) return p.bench.length < 4 ? 20 + c.np / 20 : 4;
    if (isEnergy(c)) return p.hand.some(h => isEnergy(h.c)) ? 6 : 18;
    if (isCmd(c, '夥伴')) return 14;
    return 10;
  }
  const pause = () => wait(IO.aiDelay || 0);
  async function aiTurn(pi) {
    const g0 = G;
    const me = P(pi), op = P(other(pi));
    const dead = () => G !== g0 || G.over || G.cur !== pi;
    let guard = 0;
    const again = async () => {
      let did = false;
      // basics to bench
      for (const c of me.hand.filter(c => isBasicCat(c.c))) { if (me.bench.length < 4) { await playBasic(pi, c); did = true; await pause(); } }
      // evolve
      for (const c of me.hand.filter(c => isEvo(c.c))) {
        const ts = evoTargets(me, c);
        if (ts.length) { const t = ts.includes(me.active) ? me.active : ts[0]; await evolve(pi, c, t); did = true; await pause(); }
      }
      return did;
    };
    while (guard++ < 4 && await again()) { if (dead()) return; }
    // items
    for (let k = 0; k < 12 && !dead(); k++) {
      const item = me.hand.find(c => isCmd(c.c, '道具') && canPlayCmd(pi, c) && aiWantsItem(pi, c));
      if (!item) break;
      await playCmd(pi, item); await pause(); await again();
    }
    if (dead()) return;
    // supporter
    const sup = me.hand.filter(c => isCmd(c.c, '夥伴') && canPlayCmd(pi, c)).sort((a, b) => aiSupporterValue(pi, b) - aiSupporterValue(pi, a))[0];
    if (sup && aiSupporterValue(pi, sup) > 0) { await playCmd(pi, sup); await pause(); await again(); }
    if (dead()) return;
    for (let k = 0; k < 8 && !dead(); k++) {
      const item = me.hand.find(c => isCmd(c.c, '道具') && canPlayCmd(pi, c) && aiWantsItem(pi, c));
      if (!item) break;
      await playCmd(pi, item); await pause(); await again();
    }
    if (dead()) return;
    // stadium
    const st = me.hand.find(c => isCmd(c.c, '場地') && canPlayCmd(pi, c) && aiWantsStadium(pi, c));
    if (st) { await playCmd(pi, st); await pause(); }
    // tools
    for (const tl of me.hand.filter(c => isCmd(c.c, '裝備'))) {
      const order = [me.active].concat(me.bench).filter(s => s && !s.tool);
      if (order.length) { await playTool(pi, tl, order[0]); await pause(); }
    }
    // ability
    for (const s of inPlay(me)) if (canAbility(pi, s)) { await useAbility(pi, s); await pause(); }
    if (dead()) return;
    // energy
    await aiAttach(pi); await pause();
    if (dead()) return;
    // retreat?
    await aiMaybeRetreat(pi);
    if (dead()) return;
    // attack
    const s = me.active;
    if (s) {
      let best = -1, bv = 0;
      top(s).moves.forEach((m, i) => { if (moveState(pi, i).ok) { const v = aiMoveScore(pi, i); if (v > bv) { bv = v; best = i; } } });
      if (best >= 0) { await pause(); if (dead()) return; await attack(pi, best); return; }
    }
    await pause();
    if (dead()) return;
    await endTurn();
    void op;
  }
  function aiWantsItem(pi, card) {
    const me = P(pi), op = P(other(pi)), n = card.c.name;
    if (n === '貓薄荷探測器') return me.bench.length < 4 && me.deck.some(c => isBasicCat(c.c));
    if (n === '傳送門') { const a = me.active; const best = me.bench.slice().sort((x, y) => aiSlotValue(pi, y) - aiSlotValue(pi, x))[0]; return !!(a && best && (a.status.sleep || a.status.par || aiSlotValue(pi, best) > aiSlotValue(pi, a) + 15)); }
    if (n === '急救罐頭') return inPlay(me).some(s => s.dmg >= 30);
    if (n === '九條命') return me.hand.filter(c => isCat(c.c)).length < 2;
    if (n === '覺醒糖果') return true;
    if (n === '幸運貓爪') return me.deck.length > 8;
    if (n === '資源補給包') return !me.hand.some(c => isEnergy(c.c));
    if (n === '訊號干擾器') return !!(op.active && op.active.energy.length);
    return true;
  }
  function aiSupporterValue(pi, card) {
    const me = P(pi), op = P(other(pi)), n = card.c.name, h = me.hand.length;
    const dk = me.deck.length;
    if (n === '首席研究員') return dk < 14 ? 0 : h <= 4 ? 30 : 5;
    if (n === '夜班店長') return dk < 8 ? 0 : 20;
    if (n === '交易員') return dk < 8 ? 0 : h <= 3 ? 22 : op.hand.length >= 7 ? 12 : 0;
    if (n === '鏈上偵探') return 18;
    if (n === '保安隊長') { const s = me.active; if (!s) return 0; return op.bench.some(t => top(s).moves.some(m => !m.ability && canPay(s.energy, m.cost) && estMove(pi, s, m, t) >= hpLeft(t))) ? 40 : 0; }
    if (n === '覺醒導師') return inPlay(me).some(s => me.deck.some(c => canEvolveOnto(c, s))) ? 26 : 0;
    return 1;
  }
  function aiWantsStadium(pi, card) {
    const me = P(pi), types = inPlay(me).map(s => top(s).type);
    const n = card.c.name;
    if (n === '夜之城') return types.some(t => t === 'dark' || t === 'volt');
    if (n === '翡翠森林') return types.includes('grass');
    if (n === '地下礦坑') return types.includes('earth');
    return false;
  }
  async function aiAttach(pi) {
    const me = P(pi);
    for (let round = 0; round < 2; round++) {
      const ens = me.hand.filter(c => isEnergy(c.c));
      if (!ens.length) return;
      let best = null, bv = -1;
      for (const s of inPlay(me)) for (const e of ens) {
        if (!canAttach(pi, e, s)) continue;
        const cost = bestCost(s);
        const miss = missing(s, cost);
        if (!miss.length) continue;
        const helps = eUnits(e).some(u => u === 'rainbow' || miss.includes(u) || (u === 'any' && miss.includes('any')) || (e.c.basic && miss.includes('any')));
        let v = (helps ? 20 : 2) + (s === me.active ? 12 : 0) - miss.length + (top(s).stage) * 3;
        if (e.c.name === '彩虹資源' && hpLeft(s) <= 10) v = -1;
        if (v > bv) { bv = v; best = { s, e }; }
      }
      if (!best || bv < 2) return;
      await attach(pi, best.e, best.s);
      if (G.over) return;
    }
  }
  async function aiMaybeRetreat(pi) {
    const me = P(pi), op = P(other(pi)), a = me.active;
    if (!a || !canRetreat(pi)) return;
    const canHit = top(a).moves.some((m, i) => moveState(pi, i).ok && dmgNum(m) > 0);
    const ready = me.bench.filter(s => top(s).moves.some(m => !m.ability && canPay(s.energy, m.cost) && dmgNum(m) > 0));
    const threatened = op.active && top(op.active).moves.some(m => !m.ability && canPay(op.active.energy, m.cost) && estMove(other(pi), op.active, m, a) >= hpLeft(a));
    if (ready.length && (!canHit || (threatened && retreatCost(me, a) <= 1 && hpLeft(a) < hpOf(a) / 2))) {
      const to = ready.sort((x, y) => aiSlotValue(pi, y) - aiSlotValue(pi, x))[0];
      await retreat(pi, to); await pause();
    }
  }

  // ───────── deck building ─────────
  const CMD_PLAN = [['鏈上偵探', 2], ['夜班店長', 2], ['貓薄荷探測器', 3], ['首席研究員', 2], ['急救罐頭', 2], ['傳送門', 2], ['覺醒糖果', 2], ['覺醒導師', 1], ['保安隊長', 1],
    ['綠光護目鏡', 1], ['資源補給包', 1], ['九條命', 1], ['幸運貓爪', 1], ['鈦合金背心', 1], ['訊號干擾器', 1], ['NOX 吊牌', 1], ['交易員', 1]];
  // avail: id → copies available (basic resources unlimited). types: optional list to restrict to.
  function autoBuild(avail, opt = {}) {
    const cap = id => (CARDS[id - 1].basic ? 99 : Math.min(3, avail[id] || 0));
    const deck = [];
    const add = (id, n) => { const k = Math.min(n, cap(id) - deck.filter(x => x === id).length); for (let i = 0; i < k; i++) deck.push(id); return k; };
    // evolution lines from basics
    const lines = CARDS.filter(c => isBasicCat(c) && cap(c.id) > 0).map(b => {
      const s1 = CARDS.filter(c => c.from === b.name && cap(c.id) > 0);
      const s2 = CARDS.filter(c => s1.some(m => c.from === m.name) && cap(c.id) > 0);
      const all = [b].concat(s1, s2);
      const power = Math.max(...all.map(c => Math.max(0, ...c.moves.map(dmgNum)))) + all.length * 15 + all.reduce((a, c) => a + N.TIERS[c.tier].rank * 6, 0);
      return { b, s1, s2, all, power, types: [...new Set(all.map(c => c.type))] };
    });
    let types = opt.types;
    if (!types) {
      const score = {};
      lines.forEach(l => l.types.forEach(t => { score[t] = (score[t] || 0) + l.power; }));
      types = Object.keys(score).sort((a, b) => score[b] - score[a]).slice(0, 2);
    }
    const chosen = lines.filter(l => l.types.every(t => types.includes(t)) || l.types.includes(types[0])).sort((a, b) => b.power - a.power);
    let cats = 0;
    for (const l of chosen) {
      if (cats >= 13) break;
      const more = l.s1.length ? 3 : 2;
      cats += add(l.b.id, more);
      l.s1.forEach(c => { cats += add(c.id, l.s2.length ? 2 : 2); });
      l.s2.forEach(c => { cats += add(c.id, 1); });
    }
    if (!deck.some(id => isBasicCat(CARDS[id - 1]))) {
      const any = CARDS.find(c => isBasicCat(c) && cap(c.id) > 0);
      if (any) add(any.id, 1);
    }
    while (deck.length > 16) deck.pop();
    let cmds = 0;
    const hasStage2 = deck.some(id => CARDS[id - 1].stage === 2);
    for (const [name, n] of CMD_PLAN) {
      if (cmds >= 12 || deck.length >= 27) break;
      if (name === '覺醒糖果' && !hasStage2) continue;
      cmds += add(byName[name].id, Math.min(n, 12 - cmds, 27 - deck.length));
    }
    const deckTypes = [...new Set(deck.map(id => CARDS[id - 1]).filter(isCat).map(c => c.type))];
    const stad = { dark: '夜之城', volt: '夜之城', grass: '翡翠森林', earth: '地下礦坑' };
    for (const t of deckTypes) if (stad[t] && deck.length < 28) add(byName[stad[t]].id, 1);
    if (deck.length < 28) add(byName['雙重資源'].id, 2);
    // basic energy split by the deck's typed costs
    const need = {};
    deck.map(id => CARDS[id - 1]).filter(isCat).forEach(c => c.moves.forEach(m => (m.cost || []).forEach(t => { if (t !== 'any') need[t] = (need[t] || 0) + 1; })));
    const keys = Object.keys(need);
    if (!keys.length) keys.push(deckTypes[0] || 'grass'), need[keys[0]] = 1;
    const total = keys.reduce((a, k) => a + need[k], 0);
    const room = 40 - deck.length;
    let given = 0;
    keys.sort((a, b) => need[b] - need[a]).forEach((k, i) => {
      const n = i === keys.length - 1 ? room - given : Math.max(1, Math.round(room * need[k] / total));
      const id = CARDS.find(c => c.basic && c.type === k).id;
      const m = Math.max(0, Math.min(n, room - given)); for (let j = 0; j < m; j++) deck.push(id); given += m;
    });
    while (deck.length < 40) deck.push(CARDS.find(c => c.basic && c.type === keys[0]).id);
    return deck.slice(0, 40).sort((a, b) => a - b);
  }
  function validate(deck, avail) {
    const errs = [];
    if (deck.length !== 40) errs.push(`牌組要剛好 40 張（現在 ${deck.length} 張）`);
    if (!deck.some(id => isBasicCat(CARDS[id - 1]))) errs.push('至少要有 1 張基礎 NOXCAT');
    const cnt = {}; deck.forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
    for (const id in cnt) {
      const c = CARDS[id - 1];
      if (c.basic) continue;
      if (cnt[id] > 3) errs.push(`「${c.name}」最多 3 張`);
      if (avail && cnt[id] > (avail[id] || 0)) errs.push(`「${c.name}」你只有 ${avail[id] || 0} 張`);
    }
    return errs;
  }

  return {
    newGame, get G() { return G; }, P, other, top, hpOf, hpLeft, inPlay, units, eUnits, canPay, retreatCost, fxOn,
    isCat, isBasicCat, isEvo, isEnergy, isBasicEnergy, isCmd, byName, STATUS_NAME,
    canEvolveOnto, canAttach, canPlayCmd, canRetreat, moveState, canAbility, evoTargets,
    playBasic, evolve, attach, playTool, playCmd, retreat, useAbility, attack, endTurn, myTurn,
    autoBuild, validate, dmgNum, snapshot, mirror, forfeit
  };
})();
