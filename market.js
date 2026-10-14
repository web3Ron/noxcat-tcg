// NOXCAT 卡片市場 + 帳戶錢包
// Wallet: each signed-in account keeps balance + collection in its private db subtree (data/users/<id>/wallet).
// Market: shared docs. mk_list/<lid> = one card for sale; mk_stat/<cardId> = recent sale prices; mk_meta/feed = latest trades;
// mk_meta/bot = schedule for the AI buyer. There are no transactions, so every claim on a listing goes through a short lease,
// and a seller's card stays in escrow (in their own wallet) until they see the listing marked sold, then they credit themselves.
(function () {
  const CORE = window.NOXCORE; if (!CORE) return;
  const { CARDS, TIERS, TIER_ORDER, SETS, TYPE, TYPE_ORDER } = CORE;
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rid = n => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ───────── economy constants (cents) ─────────
  const PACK = 500, BUYBACK = 60, START = 1000000, MAX_OPEN = 40, MIN_PRICE = 10, MAX_PRICE = 9999900;
  // starting reference prices from pull odds: rarer tier + fewer cards sharing that tier in its set = higher
  const REF = {"1":300,"2":85,"3":65,"4":85,"5":85,"6":300,"7":65,"8":65,"9":85,"10":65,"11":140,"12":140,"13":65,"14":65,"15":65,"16":65,"17":300,"18":300,"19":140,"20":140,"21":300,"22":1200,"23":1200,"24":140,"25":85,"26":85,"27":7800,"28":65,"29":65,"30":65,"31":65,"32":65,"33":65,"34":65,"35":85,"36":85,"37":85,"38":85,"39":85,"40":85,"41":140,"42":140,"43":140,"44":140,"45":140,"46":390,"47":390,"48":390,"49":1700,"50":7800,"51":280,"52":280,"53":280,"54":1800,"55":280,"56":65,"57":65,"58":100,"59":280,"60":280,"61":65,"62":65,"63":280,"64":65,"65":65,"66":65,"67":65,"68":65,"69":65,"70":65,"71":120,"72":65,"73":65,"74":65,"75":65,"76":100,"77":65,"78":65,"79":65,"80":65,"81":65,"82":65,"83":100,"84":100,"85":100,"86":110,"87":6300,"88":110,"89":110};
  const tradable = c => c && !c.basic && c.set > 0;
  const money = c => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const card = id => CARDS[id - 1];
  const STAGE = ['基礎', '一階覺醒', '二階覺醒'];
  const AI_NAME = 'NOXCAT 收購商';

  // ───────── account ─────────
  const A = { mode: 'loading', id: null, name: '', db: null, user: null, wref: null, rev: 0, tab: rid(10), writing: Promise.resolve(), dirty: false, pt: 0, owner: false };
  let readyRes; const ready = new Promise(r => { readyRes = r; });
  const S = () => CORE.S;
  function ensureFields(s) {
    if (typeof s.bal !== 'number' || !isFinite(s.bal)) s.bal = START;
    s.owned = s.owned || {}; s.escrow = s.escrow || {}; s.pend = s.pend || {};
    s.packs = s.packs | 0;
  }
  function persist() {
    CORE.saveLocal();
    refreshMoney();
    if (A.mode !== 'cloud') return;
    A.dirty = true; clearTimeout(A.pt); A.pt = setTimeout(flushWallet, 350);
  }
  function flushWallet() {
    if (A.mode !== 'cloud' || !A.dirty) return A.writing;
    A.dirty = false;
    const s = S(); A.rev++;
    const body = { bal: s.bal, owned: s.owned, packs: s.packs, escrow: s.escrow, pend: s.pend, sec: !!s.sec, cover: s.cover || 'og', rev: A.rev, tab: A.tab, at: Date.now(), v: 1 };
    A.writing = A.writing.then(() => A.wref.set(JSON.parse(JSON.stringify(body)))).catch(e => {
      if (e && e.code === 'invalid_argument') { A.mode = 'readonly'; renderAll(); toast('你目前的權限不能儲存帳戶，改用這個瀏覽器的本機紀錄。'); }
    });
    return A.writing;
  }
  async function persistNow() { CORE.saveLocal(); refreshMoney(); if (A.mode !== 'cloud') return; clearTimeout(A.pt); A.dirty = true; await flushWallet(); }
  function adopt(d) {
    const s = S();
    s.bal = typeof d.bal === 'number' ? d.bal : START;
    s.owned = Object.assign({}, d.owned || {}); s.escrow = Object.assign({}, d.escrow || {}); s.pend = Object.assign({}, d.pend || {});
    s.packs = d.packs | 0; s.sec = !!d.sec; if (d.cover) s.cover = d.cover;
    CARDS.forEach(c => { if (c.basic && !(s.owned[c.id] > 0)) s.owned[c.id] = 1; });
    A.rev = Math.max(A.rev, d.rev | 0);
    CORE.saveLocal(); CORE.refreshStats(); CORE.dexChanged();
  }
  function grantOwnerSec(s) { if (s.sec) return; [27, 50].forEach(id => { s.owned[id] = Math.max(1, s.owned[id] | 0); }); s.sec = true; }
  function localInit() { ensureFields(S()); CORE.saveLocal(); }
  async function initAccount() {
    let db = null, user = null;
    try { if (window.claude && typeof window.claude.use === 'function') [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch (e) {}
    let id = null;
    try { id = user ? await user.id() : null; } catch (e) {}
    if (!db || !id) { A.mode = 'local'; localInit(); readyRes(); renderAll(); return; }
    A.db = db; A.user = user; A.id = id; A.wref = db.doc(`data/users/${id}/wallet`);
    try { A.owner = !!user.isOwner(); } catch (e) {}
    A.name = defaultName();
    let snap = null;
    try { snap = await A.wref.get(); } catch (e) { A.mode = 'local'; localInit(); readyRes(); renderAll(); return; }
    const s = S();
    if (snap.exists) { adopt(snap.data()); A.mode = 'cloud'; }
    else {
      // a new account: $10,000 and an empty binder. Only the artifact owner keeps what this browser already pulled.
      const local = { owned: Object.assign({}, s.owned), packs: s.packs };
      s.owned = {}; s.packs = 0;
      if (A.owner) { s.owned = local.owned; s.packs = local.packs; grantOwnerSec(s); }
      CARDS.forEach(c => { if (c.basic) s.owned[c.id] = 1; });
      s.bal = START; s.escrow = {}; s.pend = {};
      A.mode = 'cloud';
      await persistNow();
      if (A.mode === 'cloud') toast('歡迎！帳戶已開通，送你 $10,000 遊戲額度。');
    }
    if (A.mode === 'cloud' && A.owner && !S().sec) { grantOwnerSec(S()); persist(); }
    CORE.refreshStats(); CORE.dexChanged();
    readyRes(); renderAll();
    if (A.mode !== 'cloud') return;
    A.wref.onSnapshot(sn => {
      if (!sn.exists) return;
      const d = sn.data();
      if (d.tab !== A.tab && (d.rev | 0) > A.rev) { adopt(d); renderAll(); }
    }, () => {});
    startMarket();
  }
  function defaultName() {
    let n = ''; try { n = (localStorage.getItem('noxcat-nick') || '').trim().slice(0, 12); } catch (e) {}
    return n || ('玩家' + (A.id || '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase());
  }

  // pack payment, called by the pack page before a pack opens
  function spend(n) {
    const cost = PACK * n;
    if (A.mode === 'loading') { toast('帳戶還在載入，等一下再開。'); return false; }
    const s = S(); ensureFields(s);
    if (s.bal < cost) { toast(`餘額不足：開 ${n} 包要 ${money(cost)}，你有 ${money(s.bal)}。可以到市場賣卡或回收卡片換額度。`); return false; }
    s.bal -= cost; refreshMoney();
    return true;
  }
  function canAfford(n) {
    if (A.mode === 'loading') { toast('帳戶還在載入，等一下再開。'); return false; }
    const s = S(); ensureFields(s);
    if (s.bal < PACK * n) { toast(`餘額不足：開 ${n} 包要 ${money(PACK * n)}，你有 ${money(s.bal)}。可以到市場賣卡或回收卡片換額度。`); return false; }
    return true;
  }
  function buyback(id, n) {
    const s = S(), c = card(id);
    n = Math.min(n | 0, s.owned[id] | 0);
    if (!tradable(c) || n <= 0) return 0;
    s.owned[id] -= n; s.bal += BUYBACK * n;
    persist(); CORE.refreshStats(); CORE.dexChanged();
    return n;
  }

  // ───────── market state ─────────
  const MK = { open: [], mine: [], stats: {}, feed: [], openReady: false, mineReady: false, unsub: [] };
  const byCard = () => { const m = {}; MK.open.forEach(L => { (m[L.c] = m[L.c] || []).push(L); }); Object.values(m).forEach(a => a.sort((x, y) => x.p - y.p || x.at - y.at)); return m; };
  let OPEN_BY = {};
  function sales(id, sinceMs) { const h = MK.stats[id] || []; return sinceMs ? h.filter(x => x[0] >= sinceMs) : h; }
  function median(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : Math.round((b[m - 1] + b[m]) / 2); }
  function marketPrice(id) {
    const h = sales(id, Date.now() - 14 * 864e5).slice(-5).map(x => x[1]);
    return h.length ? median(h) : REF[id];
  }
  function change24(id) {
    const now = Date.now(), h = sales(id);
    const before = h.filter(x => x[0] < now - 864e5).slice(-5).map(x => x[1]);
    const recent = h.filter(x => x[0] >= now - 864e5).slice(-5).map(x => x[1]);
    if (!recent.length) return null;
    const base = before.length ? median(before) : REF[id];
    return (median(recent) - base) / base;
  }
  const vol24 = id => sales(id, Date.now() - 864e5).length;
  function startMarket() {
    const db = A.db;
    const err = () => {};
    MK.unsub.push(db.collection('mk_list').where('st', '==', 'open').limit(1000).onSnapshot(q => {
      MK.open = q.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(L => card(L.c) && tradable(card(L.c)) && L.p >= MIN_PRICE);
      MK.openReady = true; OPEN_BY = byCard(); renderAll();
    }, err));
    MK.unsub.push(db.collection('mk_list').where('s', '==', A.id).limit(200).onSnapshot(q => {
      MK.mine = q.docs.map(d => Object.assign({ id: d.id }, d.data()));
      MK.mineReady = !q.metadata.fromCache; settle(); renderAll();
    }, err));
    MK.unsub.push(db.collection('mk_stat').limit(200).onSnapshot(q => {
      q.docs.forEach(d => { const v = d.data(); if (v && Array.isArray(v.h)) MK.stats[d.id] = v.h.filter(x => Array.isArray(x) && x.length >= 2); });
      renderAll();
    }, err));
    MK.unsub.push(db.doc('mk_meta/feed').onSnapshot(sn => { const f = sn.exists ? sn.data().f : null; MK.feed = Array.isArray(f) ? f.slice().reverse() : []; renderAll(); }, err));
    reconcilePending();
    setTimeout(botTick, 8000 + Math.random() * 6000);
    setInterval(botTick, 50000);
  }

  // short cooperative lock, retried a few times
  async function lease(ref, ttl) {
    for (let i = 0; i < 4; i++) {
      let r = null; try { r = await ref.acquire({ holder: A.tab, ttlMs: ttl || 8000 }); } catch (e) {}
      if (r && r.acquired) return true;
      await sleep(250 + Math.random() * 500);
    }
    return false;
  }
  async function recordSale(c, p, kind, who) {
    const t = Date.now();
    const st = A.db.doc('mk_stat/' + c);
    if (await lease(st, 4000)) {
      try { const s = await st.get(); const h = s.exists && Array.isArray(s.data().h) ? s.data().h.slice(-79) : []; h.push([t, p, kind]); await st.set({ c, h }); } catch (e) {}
    }
    const fd = A.db.doc('mk_meta/feed');
    if (await lease(fd, 4000)) {
      try { const s = await fd.get(); const f = s.exists && Array.isArray(s.data().f) ? s.data().f.slice(-39) : []; f.push([t, c, p, kind, String(who || '').slice(0, 16)]); await fd.set({ f }); } catch (e) {}
    }
  }

  // ───────── trading ─────────
  let busy = false;
  const guard = fn => async (...a) => { if (busy) return; busy = true; renderAll(); try { await fn(...a); } catch (e) { console.error(e); toast('出了點問題，請再試一次。'); } busy = false; renderAll(); };
  const canTrade = () => A.mode === 'cloud';
  const tradeBlock = () => A.mode === 'loading' ? '帳戶載入中…' : A.mode === 'readonly' ? '你的分享權限只能瀏覽市場，不能交易。' : '要在 claude.ai 上登入打開這個網站，才能使用市場。';

  const buyListing = guard(async lid => {
    if (!canTrade()) { toast(tradeBlock()); return; }
    const s = S(), ref = A.db.doc('mk_list/' + lid);
    if (!(await lease(ref, 12000))) { toast('有人正在買這張，稍後再試。'); return; }
    const sn = await ref.get(), d = sn.exists ? sn.data() : null;
    if (!d || d.st !== 'open') { toast('慢了一步，這張已經賣掉了。'); return; }
    if (d.s === A.id) { toast('這是你自己掛的單。'); return; }
    if (s.bal < d.p) { toast(`餘額不足，還差 ${money(d.p - s.bal)}。`); return; }
    s.bal -= d.p; s.pend[lid] = { c: d.c, p: d.p, at: Date.now() };
    await persistNow();
    try { await ref.update({ st: 'sold', b: A.id, bn: A.name, bt: Date.now() }); }
    catch (e) { s.bal += d.p; delete s.pend[lid]; await persistNow(); toast('交易沒有完成，錢已退回。'); return; }
    delete s.pend[lid]; s.owned[d.c] = (s.owned[d.c] | 0) + 1;
    await persistNow(); CORE.refreshStats(); CORE.dexChanged();
    toast(`買到「${card(d.c).name}」，花了 ${money(d.p)}。`, 'ok');
    recordSale(d.c, d.p, 0, A.name);
  });
  const listCard = guard(async (id, price, qty) => {
    if (!canTrade()) { toast(tradeBlock()); return; }
    const s = S(), c = card(id);
    price = Math.round(price); qty = Math.max(1, qty | 0);
    if (!tradable(c)) return;
    if (!(price >= MIN_PRICE && price <= MAX_PRICE)) { toast(`價格要在 ${money(MIN_PRICE)} 到 ${money(MAX_PRICE)} 之間。`); return; }
    if ((s.owned[id] | 0) < qty) { toast(`你只有 ${s.owned[id] | 0} 張可以賣。`); return; }
    const openMine = MK.mine.filter(L => L.st === 'open').length;
    if (openMine + qty > MAX_OPEN) { toast(`同時最多掛 ${MAX_OPEN} 張，你現在有 ${openMine} 張在賣。`); return; }
    const lids = Array.from({ length: qty }, () => rid(14)), now = Date.now();
    lids.forEach(l => { s.owned[id]--; s.escrow[l] = { c: id, p: price, at: now }; });
    await persistNow();
    let ok = 0;
    for (const l of lids) {
      try { await A.db.doc('mk_list/' + l).set({ c: id, p: price, s: A.id, sn: A.name, at: now, st: 'open' }); ok++; }
      catch (e) { delete s.escrow[l]; s.owned[id]++; if (e && e.code === 'quota_exceeded') { toast('市場目前太滿了，稍後再上架。'); } }
    }
    if (ok < lids.length) await persistNow();
    CORE.refreshStats(); CORE.dexChanged();
    if (ok) toast(`「${c.name}」上架 ${ok} 張，每張 ${money(price)}。`, 'ok');
  });
  const cancelListing = guard(async lid => {
    if (!canTrade()) return;
    const s = S(), ref = A.db.doc('mk_list/' + lid);
    if (!(await lease(ref, 8000))) { toast('這張正在被購買，稍後再試。'); return; }
    const sn = await ref.get(), d = sn.exists ? sn.data() : null;
    if (d && d.st === 'sold') { toast('這張剛剛已經賣出了。'); settle(); return; }
    if (d && d.s !== A.id) return;
    if (d) await ref.delete();
    const e = s.escrow[lid];
    if (e) { s.owned[e.c] = (s.owned[e.c] | 0) + 1; delete s.escrow[lid]; await persistNow(); }
    CORE.refreshStats(); CORE.dexChanged();
    toast('已下架，卡片回到你的收藏。');
  });
  // seller side: credit sold listings, return vanished ones, tidy old sold docs
  let settling = false, again = false;
  async function settle() {
    if (A.mode !== 'cloud') return;
    if (settling) { again = true; return; }
    settling = true;
    try {
      const s = S(), by = new Map(MK.mine.map(L => [L.id, L]));
      let changed = false, earned = 0, n = 0;
      for (const [lid, e] of Object.entries(s.escrow)) {
        const L = by.get(lid);
        if (L && L.st === 'sold') { s.bal += e.p; earned += e.p; n++; delete s.escrow[lid]; changed = true; }
        else if (!L && MK.mineReady && Date.now() - e.at > 120000) { s.owned[e.c] = (s.owned[e.c] | 0) + 1; delete s.escrow[lid]; changed = true; }
      }
      if (changed) { await persistNow(); CORE.refreshStats(); CORE.dexChanged(); }
      if (n) toast(`你賣出了 ${n} 張卡，入帳 ${money(earned)}。`, 'ok');
      const old = MK.mine.filter(L => L.st === 'sold' && !s.escrow[L.id] && Date.now() - (L.bt || 0) > 10 * 60000);
      for (const L of old) { try { await A.db.doc('mk_list/' + L.id).delete(); } catch (e) {} }
    } finally { settling = false; if (again) { again = false; setTimeout(settle, 500); } }
  }
  // buyer side: finish purchases interrupted between paying and receiving
  async function reconcilePending() {
    const s = S(); let changed = false;
    for (const [lid, e] of Object.entries(s.pend)) {
      try {
        const sn = await A.db.doc('mk_list/' + lid).get(), d = sn.exists ? sn.data() : null;
        if (d && d.st === 'open') s.bal += e.p; else s.owned[e.c] = (s.owned[e.c] | 0) + 1;
        delete s.pend[lid]; changed = true;
      } catch (err) {}
    }
    if (changed) { await persistNow(); CORE.dexChanged(); }
  }

  // ───────── the AI buyer ─────────
  // Every few minutes one open page (whoever wins the lease) buys a handful of listings priced at or under what the
  // collector is willing to pay: up to ~70–90% of the lower of reference and market price. Bought cards leave the game.
  async function botTick() {
    if (A.mode !== 'cloud' || document.hidden || !MK.openReady) return;
    const ref = A.db.doc('mk_meta/bot');
    let r = null; try { r = await ref.acquire({ holder: A.tab, ttlMs: 60000 }); } catch (e) {}
    if (!r || !r.acquired) return;
    try {
      const sn = await ref.get(), next = sn.exists ? (sn.data().next || 0) : 0;
      if (Date.now() < next) return;
      await ref.set({ next: Date.now() + (3 + Math.random() * 6) * 60000, last: Date.now() });
      const want = {};
      const bid = id => (want[id] = want[id] || Math.round(Math.min(REF[id], marketPrice(id) * 1.05) * (0.7 + Math.random() * 0.2)));
      const cands = MK.open.filter(L => L.p <= bid(L.c)).sort((a, b) => a.p / REF[a.c] - b.p / REF[b.c]);
      let budget = 25000 + Math.floor(Math.random() * 25000), buys = 0;
      const max = 1 + Math.floor(Math.random() * 4);
      for (const L of cands) {
        if (buys >= max) break;
        if (L.p > budget || Math.random() < 0.3) continue;
        const lr = A.db.doc('mk_list/' + L.id);
        if (!(await lease(lr, 8000))) continue;
        const d = (await lr.get()).data();
        if (!d || d.st !== 'open') continue;
        await lr.update({ st: 'sold', b: 'ai', bn: AI_NAME, bt: Date.now() });
        buys++; budget -= d.p;
        await recordSale(d.c, d.p, 1, AI_NAME);
      }
    } catch (e) { console.error(e); }
  }

  // ───────── UI ─────────
  const ui = { tab: 'browse', q: '', tiers: new Set(), kind: 'all', sub: 'all', types: new Set(), sets: new Set(), stock: false, sort: 'hot', detail: null, open: false };
  const KIND = [['all', '全部'], ['cat', 'NOXCAT'], ['cmd', '指令卡'], ['energy', '特殊資源']];
  const SUBS = { cat: [['all', '全部'], ['s0', '基礎'], ['s1', '一階覺醒'], ['s2', '二階覺醒'], ['legend', '傳奇']], cmd: [['all', '全部'], ['夥伴', '夥伴'], ['道具', '道具'], ['裝備', '裝備'], ['場地', '場地']] };
  const SORTS = [['hot', '最熱門'], ['low', '最低價：低到高'], ['high', '最低價：高到低'], ['mkt', '市價：高到低'], ['up', '24 小時漲幅'], ['no', '卡片編號']];
  const TRADE = CARDS.filter(tradable);
  const tierBadge = c => `<span class="mk-tier" style="--tc:${TIERS[c.tier].col}">${c.tier}</span>`;
  const kindText = c => c.kind === 'cat' ? STAGE[c.stage] + (c.legend ? '・傳奇' : '') + ' NOXCAT' : c.kind === 'cmd' ? c.sub + '卡' : '特殊資源';
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? '剛剛' : s < 3600 ? Math.floor(s / 60) + ' 分鐘前' : s < 86400 ? Math.floor(s / 3600) + ' 小時前' : Math.floor(s / 86400) + ' 天前'; };
  const pct = v => v == null ? '<span class="mk-chg">—</span>' : `<span class="mk-chg ${v > 0.001 ? 'up' : v < -0.001 ? 'down' : ''}">${v > 0.001 ? '▲' : v < -0.001 ? '▼' : '•'} ${Math.abs(v * 100).toFixed(1)}%</span>`;
  function faceImg(c, cls) {
    const img = document.createElement('img'); img.alt = c.name; img.decoding = 'async'; if (cls) img.className = cls;
    CORE.faceURL(c).then(u => { if (u) img.src = u; });
    return img;
  }

  function injectCSS() {
    const st = document.createElement('style');
    st.textContent = `/* Market: a trading-floor overlay in the pack site's black + lime. Header with wallet, filter rail on the left, card grid; a card opens a trade sheet. */
.mk-ov { position: fixed; inset: 0; z-index: 70; background: radial-gradient(70rem 30rem at 50% -8rem, rgba(180,240,30,.08), transparent 70%), var(--void, #090a07); color: var(--ink, #f2f5ea); display: grid; grid-template-rows: auto minmax(0, 1fr); font-family: var(--font-body); }
.mk-top { display: flex; align-items: center; gap: 14px; padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px; border-bottom: 1px solid var(--line, rgba(255,255,255,.1)); background: rgba(9,10,7,.94); }
.mk-brand { display: grid; line-height: 1.15; }
.mk-brand b { font-family: var(--font-mark); font-weight: 800; font-size: 13px; letter-spacing: .14em; color: #8eb943; }
.mk-brand span { font-weight: 900; font-size: 16px; }
.mk-tabs { display: flex; gap: 4px; background: #12140f; border: 1px solid var(--line); border-radius: 999px; padding: 3px; margin-left: 10px; overflow-x: auto; scrollbar-width: none; }
.mk-tabs button { font: inherit; font-size: 14px; color: var(--muted, #9ea592); background: none; border: 0; padding: 6px 14px; border-radius: 999px; cursor: pointer; white-space: nowrap; }
.mk-tabs button[aria-selected="true"] { background: var(--lime); color: var(--lime-ink); font-weight: 700; }
.mk-wallet { margin-left: auto; display: grid; justify-items: end; line-height: 1.1; }
.mk-wallet span { font-size: 11px; color: var(--muted); letter-spacing: .08em; }
.mk-wallet b { font-family: var(--font-mark); font-weight: 600; font-size: 17px; font-variant-numeric: tabular-nums; color: var(--lime); }
.mk-x { font: inherit; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line); background: rgba(255,255,255,.04); color: var(--ink); cursor: pointer; flex: none; font-size: 15px; }
.mk-x:hover { border-color: rgba(255,255,255,.35); }
.mk-body { overflow-y: auto; padding: 16px 16px 60px; max-width: 1320px; width: 100%; margin: 0 auto; box-sizing: border-box; }
.mk-btn { font: inherit; font-weight: 700; font-size: 14px; border-radius: 999px; padding: 9px 18px; border: 1px solid transparent; background: var(--lime); color: var(--lime-ink); cursor: pointer; white-space: nowrap; transition: transform .12s, background-color .2s; }
.mk-btn:hover { background: #c6ff3d; }
.mk-btn:active { transform: scale(.97); }
.mk-btn.mk-ghost { background: rgba(255,255,255,.04); color: var(--ink); border-color: var(--line); }
.mk-btn.mk-ghost:hover { border-color: rgba(255,255,255,.32); }
.mk-btn.small { font-size: 13px; padding: 6px 13px; }
.mk-btn.arm { background: var(--gold, #f5c451); color: #1b1503; }
.mk-btn[disabled] { opacity: .4; cursor: not-allowed; transform: none; }
.mk-notice { margin: 0 0 14px; padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(245,196,81,.35); background: rgba(245,196,81,.08); color: #f3dfa6; font-size: 13.5px; }
.mk-sum { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
.mk-stat { border: 1px solid var(--line); border-radius: 14px; background: #12140f; padding: 10px 14px; display: grid; gap: 2px; min-width: 0; }
.mk-stat span { font-size: 12px; color: var(--muted); }
.mk-stat b { font-family: var(--font-mark); font-weight: 600; font-size: 18px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-stat small { font-size: 11px; color: var(--muted); }
.mk-ticker { overflow: hidden; border-block: 1px solid var(--line); margin: 0 0 16px; mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
.mk-ticker-in { display: flex; gap: 28px; width: max-content; padding: 8px 0; animation: mk-tick 50s linear infinite; }
.mk-ticker:hover .mk-ticker-in { animation-play-state: paused; }
@keyframes mk-tick { to { transform: translateX(-50%); } }
.mk-tk { display: inline-flex; gap: 8px; align-items: baseline; font-size: 13px; white-space: nowrap; }
.mk-tk b { font-weight: 700; }
.mk-tk { font-family: var(--font-body); }
.mk-tk em { font-style: normal; color: var(--muted); font-size: 12px; }
.mk-browse { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 20px; align-items: start; }
.mk-filters { position: sticky; top: 0; display: grid; gap: 16px; padding: 14px; border: 1px solid var(--line); border-radius: 18px; background: #12140f; }
.mk-fg h4 { margin: 0 0 8px; font-size: 12px; color: var(--muted); font-weight: 500; letter-spacing: .06em; }
.mk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mk-chip { font: inherit; font-size: 12.5px; color: var(--ink); background: rgba(255,255,255,.03); border: 1px solid var(--line); border-radius: 999px; padding: 4px 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.mk-chip:hover { border-color: rgba(255,255,255,.3); }
.mk-chip[aria-pressed="true"] { border-color: var(--lime); background: rgba(180,240,30,.12); color: #e7ffb0; }
.mk-chip i { width: 8px; height: 8px; border-radius: 50%; }
.mk-dot { width: 18px !important; height: 18px !important; display: inline-grid; place-items: center; font-style: normal; font-size: 10px; font-weight: 900; color: #0d1203; }
.mk-check { display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer; }
.mk-check input { accent-color: #b4f01e; width: 16px; height: 16px; }
.mk-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mk-bar input[type="search"], .mk-bar select, .mk-field input, .mk-bulk select { font: inherit; font-size: 16px; color: var(--ink); background: #0b0c09; border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; }
.mk-bar input[type="search"] { flex: 1 1 220px; min-width: 0; }
.mk-bar select { font-size: 14px; }
.mk-bar input:focus, .mk-bar select:focus, .mk-field input:focus { outline: 2px solid var(--lime); outline-offset: 1px; }
.mk-ftoggle { display: none; }
.mk-count { margin: 10px 0; color: var(--muted); font-size: 13px; }
.mk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 14px; }
.mk-tile { font: inherit; color: inherit; text-align: left; border: 1px solid var(--line); border-radius: 16px; background: #12140f; padding: 10px; cursor: pointer; display: grid; gap: 10px; transition: border-color .2s, transform .15s; }
.mk-tile:hover { border-color: rgba(180,240,30,.5); transform: translateY(-2px); }
.mk-tile:focus-visible { outline: 2px solid var(--lime); outline-offset: 2px; }
.mk-fig { position: relative; aspect-ratio: 63/88; border-radius: 9px; overflow: hidden; background: #1b1e16; }
.mk-fig img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mk-own { position: absolute; left: 6px; bottom: 6px; font-size: 11px; font-weight: 700; background: rgba(9,10,7,.88); border: 1px solid var(--lime); color: #e7ffb0; padding: 1px 8px; border-radius: 99px; }
.mk-tinfo { display: grid; gap: 6px; min-width: 0; }
.mk-tname { display: flex; gap: 6px; align-items: center; min-width: 0; }
.mk-tname b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-tier { flex: none; font-family: var(--font-mark); font-weight: 800; font-size: 10px; color: #0d1203; background: var(--tc); border-radius: 5px; padding: 1px 5px; }
.mk-prices { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mk-prices div { display: grid; }
.mk-prices span, .mk-rnum span { font-size: 11px; color: var(--muted); }
.mk-prices b, .mk-rnum b { font-family: var(--font-mark); font-weight: 600; font-size: 14px; font-variant-numeric: tabular-nums; }
.mk-tfoot { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; color: var(--muted); }
.mk-chg { font-size: 12px; font-weight: 700; color: var(--muted); font-family: var(--font-body); white-space: nowrap; }
.mk-chg.up { color: #8fe36a; } .mk-chg.down { color: #ff8b7f; }
.mk-empty { color: var(--muted); font-size: 14px; margin: 8px 0; }
.mk-h3 { margin: 22px 0 10px; font-size: 16px; font-weight: 900; display: flex; align-items: baseline; gap: 10px; }
.mk-h3 em { font-style: normal; font-size: 12px; color: var(--muted); font-weight: 500; }
.mk-list { display: grid; gap: 8px; }
.mk-row { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto auto auto; align-items: center; gap: 14px; border: 1px solid var(--line); border-radius: 14px; background: #12140f; padding: 8px 12px 8px 8px; }
.mk-row.mk-click { cursor: pointer; } .mk-row.mk-click:hover { border-color: rgba(180,240,30,.45); }
.mk-thumb { width: 52px; aspect-ratio: 63/88; border-radius: 5px; object-fit: cover; background: #1b1e16; display: block; }
.mk-rinfo { display: grid; gap: 2px; min-width: 0; }
.mk-rinfo > span { font-size: 12.5px; color: var(--muted); }
.mk-rinfo > span b { color: var(--ink); }
.mk-rnum { display: grid; justify-items: end; min-width: 76px; }
.mk-ract { display: flex; gap: 6px; }
.mk-okpill { font-size: 12px; color: #8fe36a; border: 1px solid rgba(143,227,106,.4); border-radius: 99px; padding: 2px 10px; }
.mk-bulk { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; border: 1px solid rgba(180,240,30,.3); border-radius: 16px; padding: 12px 14px; background: rgba(180,240,30,.05); margin: 6px 0 4px; }
.mk-bulk p { margin: 2px 0 0; font-size: 13px; color: var(--muted); }
.mk-bulk select { font-size: 14px; padding: 2px 8px; }
.mk-sheet { position: fixed; inset: 0; z-index: 75; background: rgba(5,6,4,.7); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); display: grid; justify-items: end; }
.mk-sheet-in { position: relative; width: min(980px, 100%); height: 100%; overflow-y: auto; background: #0e100c; border-left: 1px solid var(--line); padding: 22px 22px 60px; box-sizing: border-box; animation: mk-in .26s cubic-bezier(.2,.8,.3,1); }
@keyframes mk-in { from { transform: translateX(40px); opacity: 0; } }
.mk-dx { position: absolute; top: 14px; right: 14px; z-index: 2; }
.mk-dgrid { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 26px; align-items: start; }
.mk-dleft { position: sticky; top: 0; display: grid; gap: 12px; }
.mk-dcard { width: 100%; perspective: 1200px; }
.mk-dcard .card { width: 100%; }
.mk-dmeta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12.5px; color: var(--muted); }
.mk-dmeta span:not(.mk-tier) { border: 1px solid var(--line); border-radius: 99px; padding: 1px 9px; }
.mk-dright h2 { margin: 0 44px 12px 0; font-size: clamp(22px, 3vw, 30px); font-weight: 900; line-height: 1.2; }
.mk-dstats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.mk-dstats .mk-stat b { font-size: 16px; }
.mk-chart { position: relative; border: 1px solid var(--line); border-radius: 14px; background: #12140f; padding: 6px 4px 0; }
.mk-chart svg { width: 100%; height: auto; display: block; touch-action: pan-y; }
.mk-chart text { fill: #8a917f; font-size: 11px; font-family: var(--font-body); }
.mk-chart .g { stroke: rgba(255,255,255,.07); stroke-width: 1; }
.mk-chart .ref { stroke: rgba(245,196,81,.55); stroke-dasharray: 4 4; stroke-width: 1; }
.mk-chart .reft { fill: #d9bf7a; font-size: 10.5px; }
.mk-chart .ln { fill: none; stroke: #b4f01e; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.mk-chart .d { fill: #b4f01e; stroke: #12140f; stroke-width: 2; }
.mk-chart .d.ai { fill: #12140f; stroke: #b4f01e; }
.mk-chart .d.on { r: 6; }
.mk-chart .xh { stroke: rgba(255,255,255,.3); stroke-width: 1; }
.mk-tip { position: absolute; transform: translate(-50%, -100%); pointer-events: none; background: #050604; border: 1px solid rgba(255,255,255,.2); border-radius: 10px; padding: 5px 10px; display: grid; gap: 1px; white-space: nowrap; box-shadow: 0 8px 20px rgba(0,0,0,.5); }
.mk-tip b { font-family: var(--font-mark); font-weight: 600; font-size: 14px; }
.mk-tip span { font-size: 11px; color: var(--muted); }
.mk-nochart { border: 1px dashed var(--line); border-radius: 14px; padding: 22px; color: var(--muted); font-size: 13.5px; text-align: center; }
.mk-book { display: grid; gap: 6px; }
.mk-brow { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 8px 12px; border-radius: 12px; background: #12140f; border: 1px solid var(--line); font-size: 13.5px; }
.mk-brow.best { border-color: rgba(180,240,30,.45); }
.mk-brow b { font-family: var(--font-mark); font-weight: 600; font-variant-numeric: tabular-nums; }
.mk-brow span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mk-brow em { font-style: normal; color: var(--muted); font-size: 12px; white-space: nowrap; }
.mk-more { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
.mk-sell { border: 1px solid rgba(180,240,30,.3); border-radius: 16px; padding: 4px 14px 14px; margin-top: 18px; background: rgba(180,240,30,.04); }
.mk-sell .mk-h3 { margin-top: 12px; }
.mk-sellrow { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
.mk-field { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
.mk-field input { width: 9rem; max-width: 100%; font-family: var(--font-mark); font-weight: 600; }
.mk-field input[type="number"] { width: 5.5rem; }
.mk-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.mk-hint { margin: 10px 0 0; font-size: 12.5px; color: var(--muted); }
.mk-bbrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); font-size: 13px; color: var(--muted); }
.mk-toasts { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 18px); transform: translateX(-50%); z-index: 90; display: grid; gap: 8px; width: min(92vw, 440px); pointer-events: none; }
.mk-toast { background: #050604; border: 1px solid rgba(255,255,255,.18); color: var(--ink, #f2f5ea); border-radius: 14px; padding: 10px 16px; font-size: 14px; box-shadow: 0 12px 30px rgba(0,0,0,.6); animation: mk-up .25s ease-out; transition: opacity .35s, transform .35s; font-family: var(--font-body); }
.mk-toast.ok { border-color: rgba(180,240,30,.55); }
.mk-toast.out { opacity: 0; transform: translateY(8px); }
@keyframes mk-up { from { opacity: 0; transform: translateY(10px); } }
.modal-extra { display: grid; justify-items: center; gap: 8px; font-size: 13.5px; color: var(--muted); text-align: center; }
.modal-extra b { color: var(--ink); font-family: var(--font-mark); font-weight: 600; }
.modal-extra div { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.modal-extra:empty { display: none; }
.price-tag { font-family: var(--font-mark); font-weight: 600; font-size: .86em; opacity: .8; }
@media (max-width: 1000px) {
  .mk-browse { grid-template-columns: minmax(0, 1fr); }
  .mk-filters { display: none; position: static; }
  .mk-filters.open { display: grid; }
  .mk-ftoggle { display: inline-flex; }
  .mk-dgrid { grid-template-columns: minmax(0, 1fr); }
  .mk-dleft { position: static; grid-template-columns: minmax(0, 150px) minmax(0, 1fr); align-items: start; }
  .mk-sheet-in { padding: 16px 14px 60px; }
}
@media (max-width: 720px) {
  .mk-top { flex-wrap: wrap; gap: 8px 10px; padding-inline: 12px; }
  .mk-tabs { order: 3; width: 100%; margin-left: 0; }
  .mk-tabs button { flex: 1 0 auto; padding-inline: 10px; }
  .mk-sum, .mk-dstats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .mk-body { padding: 12px 12px 60px; }
  .mk-row { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; }
  .mk-thumb { width: 44px; }
  .mk-row .mk-rnum:nth-of-type(3) { display: none; }
  .mk-ract { grid-column: 2 / -1; justify-content: flex-start; }
  .mk-brow { grid-template-columns: 78px minmax(0, 1fr) auto; }
  .mk-brow em { display: none; }
  .mk-sheet-in { border-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .mk-ticker-in { animation: none; } .mk-sheet-in, .mk-toast { animation: none; } .mk-tile { transition: none; } }
`;
    document.head.appendChild(st);
  }
  function buildShell() {
    const ov = document.createElement('div');
    ov.className = 'mk-ov'; ov.id = 'mk-ov'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'NOXCAT 卡片市場');
    ov.innerHTML = `
      <header class="mk-top">
        <div class="mk-brand"><b>NOXCAT</b><span>卡片市場</span></div>
        <nav class="mk-tabs" role="tablist" aria-label="市場分頁">
          <button role="tab" data-tab="browse">市場</button><button role="tab" data-tab="mine">我的卡片</button><button role="tab" data-tab="orders">我的掛單</button><button role="tab" data-tab="feed">成交紀錄</button>
        </nav>
        <div class="mk-wallet"><span>餘額</span><b id="mk-bal">—</b></div>
        <button class="mk-x" id="mk-close" aria-label="關閉市場">✕</button>
      </header>
      <div class="mk-body" id="mk-body"></div>
      <div class="mk-sheet" id="mk-sheet" hidden><div class="mk-sheet-in" id="mk-detail" role="dialog" aria-modal="true" aria-label="卡片交易"></div></div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.tab; $('mk-body').scrollTop = 0; renderAll(); }));
    $('mk-close').addEventListener('click', closeMarket);
    $('mk-sheet').addEventListener('click', e => { if (e.target.id === 'mk-sheet') closeDetail(); });
    addEventListener('keydown', e => { if (e.key !== 'Escape' || ov.hidden) return; if (!$('mk-sheet').hidden) closeDetail(); else closeMarket(); });
    const tw = document.createElement('div'); tw.className = 'mk-toasts'; tw.id = 'mk-toasts'; tw.setAttribute('aria-live', 'polite'); document.body.appendChild(tw);
  }
  let lastFocus = null;
  function openMarket(e, cardId) {
    if (e) e.preventDefault();
    lastFocus = document.activeElement;
    $('mk-ov').hidden = false; document.documentElement.style.overflow = 'hidden'; ui.open = true;
    renderAll();
    if (cardId) openDetail(cardId);
    $('mk-close').focus({ preventScroll: true });
  }
  function closeMarket() { $('mk-ov').hidden = true; ui.open = false; closeDetail(); document.documentElement.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }

  function toast(msg, kind) {
    const w = $('mk-toasts'); if (!w) return;
    const t = document.createElement('div'); t.className = 'mk-toast' + (kind ? ' ' + kind : ''); t.textContent = msg; w.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3800);
  }
  function refreshMoney() {
    const s = S(); const v = typeof s.bal === 'number' ? money(s.bal) : '—';
    document.querySelectorAll('.js-bal').forEach(el => { el.textContent = v; });
    const b = $('mk-bal'); if (b) b.textContent = v;
  }

  let rq = 0;
  function renderAll() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; refreshMoney(); if (!ui.open) return; renderTabs(); renderBody(); if (ui.detail) renderDetail(); }); }
  function renderTabs() { document.querySelectorAll('#mk-ov [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab))); }
  function notice() {
    if (A.mode === 'cloud') return '';
    return `<div class="mk-notice">${esc(tradeBlock())}${A.mode === 'local' ? '你還是可以開卡包、回收卡片，額度存在這個瀏覽器裡。' : ''}</div>`;
  }
  function renderBody() {
    const body = $('mk-body');
    if (ui.tab === 'browse') renderBrowse(body);
    else if (ui.tab === 'mine') renderMine(body);
    else if (ui.tab === 'orders') renderOrders(body);
    else renderFeed(body);
  }

  // ── browse ──
  function filtered() {
    const q = ui.q.trim().toLowerCase();
    let list = TRADE.filter(c => {
      if (q && !(c.name.toLowerCase().includes(q) || ('no.' + c.no).includes(q) || c.no.includes(q))) return false;
      if (ui.tiers.size && !ui.tiers.has(c.tier)) return false;
      if (ui.kind !== 'all' && c.kind !== ui.kind) return false;
      if (ui.kind === 'cat' && ui.sub !== 'all') { if (ui.sub === 'legend' ? !c.legend : ui.sub !== 's' + c.stage) return false; }
      if (ui.kind === 'cmd' && ui.sub !== 'all' && c.sub !== ui.sub) return false;
      if (ui.types.size && !ui.types.has(c.type)) return false;
      if (ui.sets.size && !ui.sets.has(c.set)) return false;
      if (ui.stock && !(OPEN_BY[c.id] || []).length) return false;
      return true;
    });
    const low = c => (OPEN_BY[c.id] || [])[0];
    const lowP = c => low(c) ? low(c).p : null;
    const s = ui.sort;
    list.sort((a, b) => {
      if (s === 'low') return (lowP(a) ?? 1e12) - (lowP(b) ?? 1e12);
      if (s === 'high') return (lowP(b) ?? -1) - (lowP(a) ?? -1);
      if (s === 'mkt') return marketPrice(b.id) - marketPrice(a.id);
      if (s === 'up') return (change24(b.id) ?? -9) - (change24(a.id) ?? -9);
      if (s === 'no') return a.id - b.id;
      return (vol24(b.id) * 3 + (OPEN_BY[b.id] || []).length + TIERS[b.tier].rank * .1) - (vol24(a.id) * 3 + (OPEN_BY[a.id] || []).length + TIERS[a.tier].rank * .1);
    });
    return list;
  }
  function chip(group, val, label, on, extra) { return `<button class="mk-chip" data-g="${group}" data-v="${esc(val)}" aria-pressed="${on}"${extra ? ' ' + extra : ''}>${label}</button>`; }
  function filtersHTML() {
    const tiers = TIER_ORDER.map(t => chip('tier', t, `<i style="background:${TIERS[t].col}"></i>${t} ${TIERS[t].label}`, ui.tiers.has(t))).join('');
    const kinds = KIND.map(([k, l]) => chip('kind', k, l, ui.kind === k)).join('');
    const subs = SUBS[ui.kind] ? `<div class="mk-fg"><h4>${ui.kind === 'cat' ? '階段' : '指令類型'}</h4><div class="mk-chips">${SUBS[ui.kind].map(([k, l]) => chip('sub', k, l, ui.sub === k)).join('')}</div></div>` : '';
    const types = TYPE_ORDER.map(t => chip('type', t, `<i class="mk-dot" style="background:${TYPE[t].c}">${TYPE[t].n}</i>${TYPE[t].name}`, ui.types.has(t))).join('');
    const sets = [1, 2, 3].map(st => chip('set', st, `${SETS[st].label}・${SETS[st].name}`, ui.sets.has(st))).join('');
    return `<div class="mk-fg"><h4>稀有度</h4><div class="mk-chips">${tiers}</div></div>
      <div class="mk-fg"><h4>卡片功能</h4><div class="mk-chips">${kinds}</div></div>${subs}
      <div class="mk-fg"><h4>屬性</h4><div class="mk-chips">${types}</div></div>
      <div class="mk-fg"><h4>彈數</h4><div class="mk-chips">${sets}</div></div>
      <label class="mk-check"><input type="checkbox" id="mk-stock" ${ui.stock ? 'checked' : ''}> 只看有人在賣的卡</label>
      <button class="mk-btn mk-ghost small" id="mk-clear">清除篩選</button>`;
  }
  function summaryHTML() {
    const day = Date.now() - 864e5;
    let n = 0, vol = 0; Object.values(MK.stats).forEach(h => h.forEach(x => { if (x[0] >= day) { n++; vol += x[1]; } }));
    const feed = MK.feed.slice(0, 12).map(f => { const c = card(f[1]); return c ? `<span class="mk-tk"><b>${esc(c.name)}</b>${money(f[2])}<em>${f[3] ? '收購商' : ago(f[0])}</em></span>` : ''; }).join('');
    return `<div class="mk-sum">
      <div class="mk-stat"><span>在售卡片</span><b>${MK.open.length.toLocaleString()}</b></div>
      <div class="mk-stat"><span>24 小時成交</span><b>${n}</b></div>
      <div class="mk-stat"><span>24 小時成交額</span><b>${money(vol)}</b></div>
      <div class="mk-stat"><span>回收價（每張）</span><b>${money(BUYBACK)}</b></div>
    </div>${feed ? `<div class="mk-ticker" aria-label="最新成交"><div class="mk-ticker-in">${feed}${feed}</div></div>` : ''}`;
  }
  function renderBrowse(body) {
    const keepFocus = document.activeElement && document.activeElement.id === 'mk-q';
    const list = filtered();
    const active = ui.tiers.size + ui.types.size + ui.sets.size + (ui.kind !== 'all') + ui.stock;
    body.innerHTML = `${notice()}${summaryHTML()}
      <div class="mk-browse">
        <aside class="mk-filters" id="mk-filters">${filtersHTML()}</aside>
        <section class="mk-main">
          <div class="mk-bar">
            <input id="mk-q" type="search" placeholder="搜尋卡名或編號" value="${esc(ui.q)}" aria-label="搜尋卡片">
            <button class="mk-btn mk-ghost small mk-ftoggle" id="mk-ftoggle" aria-expanded="false">篩選${active ? `・${active}` : ''}</button>
            <select id="mk-sort" aria-label="排序">${SORTS.map(([k, l]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          </div>
          <p class="mk-count">${list.length} 種卡片</p>
          <div class="mk-grid" id="mk-grid"></div>
        </section>
      </div>`;
    const grid = $('mk-grid');
    if (!list.length) grid.innerHTML = '<p class="mk-empty">沒有符合條件的卡片。</p>';
    list.forEach(c => {
      const L = OPEN_BY[c.id] || [], low = L[0], mine = S().owned[c.id] | 0;
      const el = document.createElement('button'); el.className = 'mk-tile'; el.type = 'button';
      el.setAttribute('aria-label', `${c.name}，${c.tier}，${low ? '最低 ' + money(low.p) : '無人在賣'}`);
      const fig = document.createElement('div'); fig.className = 'mk-fig'; fig.appendChild(faceImg(c));
      if (mine) fig.insertAdjacentHTML('beforeend', `<span class="mk-own">擁有 ${mine}</span>`);
      el.appendChild(fig);
      el.insertAdjacentHTML('beforeend', `<div class="mk-tinfo"><div class="mk-tname">${tierBadge(c)}<b>${esc(c.name)}</b></div>
        <div class="mk-prices"><div><span>最低</span><b>${low ? money(low.p) : '—'}</b></div><div><span>市價</span><b>${money(marketPrice(c.id))}</b></div></div>
        <div class="mk-tfoot"><span>${L.length ? `在售 ${L.length}` : '無人在賣'}</span>${pct(change24(c.id))}</div></div>`);
      el.addEventListener('click', () => openDetail(c.id));
      grid.appendChild(el);
    });
    const q = $('mk-q');
    q.addEventListener('input', () => { ui.q = q.value; clearTimeout(q._t); q._t = setTimeout(() => renderAll(), 160); });
    if (keepFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    $('mk-sort').addEventListener('change', e => { ui.sort = e.target.value; renderAll(); });
    $('mk-stock').addEventListener('change', e => { ui.stock = e.target.checked; renderAll(); });
    $('mk-clear').addEventListener('click', () => { ui.tiers.clear(); ui.types.clear(); ui.sets.clear(); ui.kind = 'all'; ui.sub = 'all'; ui.stock = false; renderAll(); });
    const fl = $('mk-filters');
    if (ui.fopen) fl.classList.add('open');
    $('mk-ftoggle').setAttribute('aria-expanded', String(!!ui.fopen));
    $('mk-ftoggle').addEventListener('click', () => { ui.fopen = !ui.fopen; fl.classList.toggle('open', ui.fopen); $('mk-ftoggle').setAttribute('aria-expanded', String(ui.fopen)); });
    fl.querySelectorAll('.mk-chip').forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.g, v = b.dataset.v;
      const tog = (set, x) => set.has(x) ? set.delete(x) : set.add(x);
      if (g === 'tier') tog(ui.tiers, v); else if (g === 'type') tog(ui.types, v); else if (g === 'set') tog(ui.sets, +v);
      else if (g === 'kind') { ui.kind = v; ui.sub = 'all'; } else if (g === 'sub') ui.sub = v;
      renderAll();
    }));
  }

  // ── my cards ──
  function renderMine(body) {
    const s = S();
    const own = TRADE.filter(c => (s.owned[c.id] | 0) > 0).sort((a, b) => TIERS[b.tier].rank - TIERS[a.tier].rank || a.id - b.id);
    let value = 0, total = 0, dupes = 0;
    own.forEach(c => { const n = s.owned[c.id] | 0; total += n; value += n * marketPrice(c.id); dupes += Math.max(0, n - (ui.keep ?? 3)); });
    const keep = ui.keep ?? 3;
    body.innerHTML = `${notice()}<div class="mk-sum">
      <div class="mk-stat"><span>餘額</span><b class="js-bal">${money(s.bal)}</b></div>
      <div class="mk-stat"><span>可交易卡片</span><b>${total} 張</b></div>
      <div class="mk-stat"><span>收藏市值（估）</span><b>${money(value)}</b></div>
      <div class="mk-stat"><span>開過的卡包</span><b>${s.packs} 包</b></div>
    </div>
    <div class="mk-bulk"><div><b>一鍵回收重複卡</b><p>每種保留 <select id="mk-keep">${[1, 2, 3, 4].map(k => `<option value="${k}" ${k === keep ? 'selected' : ''}>${k}</option>`).join('')}</select> 張，其餘每張用 ${money(BUYBACK)} 回收。牌組同名卡最多放 3 張。</p></div>
      <button class="mk-btn" id="mk-bulk" ${dupes ? '' : 'disabled'}>回收 ${dupes} 張，拿 ${money(dupes * BUYBACK)}</button></div>
    <div class="mk-list" id="mk-mylist">${own.length ? '' : '<p class="mk-empty">還沒有可以交易的卡片。開卡包或到市場買卡吧。</p>'}</div>`;
    const wrap = $('mk-mylist');
    own.forEach(c => {
      const n = s.owned[c.id] | 0, low = (OPEN_BY[c.id] || [])[0];
      const row = document.createElement('div'); row.className = 'mk-row';
      row.appendChild(faceImg(c, 'mk-thumb'));
      row.insertAdjacentHTML('beforeend', `<div class="mk-rinfo"><div class="mk-tname">${tierBadge(c)}<b>${esc(c.name)}</b></div><span>${kindText(c)}・擁有 <b>${n}</b> 張</span></div>
        <div class="mk-rnum"><span>市價</span><b>${money(marketPrice(c.id))}</b></div>
        <div class="mk-rnum"><span>最低售價</span><b>${low ? money(low.p) : '—'}</b></div>
        <div class="mk-ract"><button class="mk-btn small" data-sell="${c.id}">上架</button><button class="mk-btn mk-ghost small" data-bb="${c.id}">回收 ${money(BUYBACK)}</button></div>`);
      wrap.appendChild(row);
    });
    wrap.querySelectorAll('[data-sell]').forEach(b => b.addEventListener('click', () => openDetail(+b.dataset.sell, true)));
    wrap.querySelectorAll('[data-bb]').forEach(b => b.addEventListener('click', () => confirmBuyback(+b.dataset.bb, 1, b)));
    $('mk-keep').addEventListener('change', e => { ui.keep = +e.target.value; renderAll(); });
    $('mk-bulk').addEventListener('click', e => {
      const b = e.currentTarget;
      if (!b.dataset.arm) { b.dataset.arm = '1'; b.textContent = '再按一次確認回收'; setTimeout(() => { if (b.isConnected) renderAll(); }, 3000); return; }
      let n = 0; own.forEach(c => { const x = Math.max(0, (S().owned[c.id] | 0) - keep); if (x) n += buyback(c.id, x); });
      toast(`回收了 ${n} 張，拿到 ${money(n * BUYBACK)}。`, 'ok'); renderAll();
    });
  }
  function confirmBuyback(id, n, btn) {
    if (!btn.dataset.arm) { btn.dataset.arm = '1'; const t = btn.textContent; btn.textContent = '確認回收？'; setTimeout(() => { if (btn.isConnected) { delete btn.dataset.arm; btn.textContent = t; } }, 3000); return; }
    const got = buyback(id, n);
    if (got) toast(`回收「${card(id).name}」${got} 張，拿到 ${money(got * BUYBACK)}。`, 'ok');
    renderAll();
  }

  // ── orders ──
  function renderOrders(body) {
    const open = MK.mine.filter(L => L.st === 'open').sort((a, b) => b.at - a.at);
    const sold = MK.mine.filter(L => L.st === 'sold').sort((a, b) => (b.bt || 0) - (a.bt || 0));
    const row = (L, sold) => { const c = card(L.c); if (!c) return ''; return `<div class="mk-row" data-id="${L.id}"><span class="mk-thumbslot" data-c="${c.id}"></span>
      <div class="mk-rinfo"><div class="mk-tname">${tierBadge(c)}<b>${esc(c.name)}</b></div><span>${sold ? `${esc(L.bn || '玩家')} 買走・${ago(L.bt || L.at)}` : `上架 ${ago(L.at)}`}</span></div>
      <div class="mk-rnum"><span>${sold ? '成交價' : '售價'}</span><b>${money(L.p)}</b></div>
      <div class="mk-ract">${sold ? '<span class="mk-okpill">已入帳</span>' : `<button class="mk-btn mk-ghost small" data-cancel="${L.id}">下架</button>`}</div></div>`; };
    body.innerHTML = `${notice()}<h3 class="mk-h3">在賣的卡 <em>${open.length} / ${MAX_OPEN}</em></h3>
      <div class="mk-list">${open.length ? open.map(L => row(L, false)).join('') : '<p class="mk-empty">目前沒有在賣的卡。到「我的卡片」或卡片頁面上架。</p>'}</div>
      <h3 class="mk-h3">最近賣出</h3><div class="mk-list">${sold.length ? sold.map(L => row(L, true)).join('') : '<p class="mk-empty">還沒有賣出的紀錄。</p>'}</div>`;
    body.querySelectorAll('.mk-thumbslot').forEach(sl => sl.replaceWith(faceImg(card(+sl.dataset.c), 'mk-thumb')));
    body.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => cancelListing(b.dataset.cancel)));
  }
  function renderFeed(body) {
    body.innerHTML = `${notice()}<h3 class="mk-h3">全站最新成交</h3><div class="mk-list">${MK.feed.length ? MK.feed.map(f => { const c = card(f[1]); if (!c) return ''; return `<div class="mk-row mk-click" data-c="${c.id}"><span class="mk-thumbslot" data-c="${c.id}"></span>
      <div class="mk-rinfo"><div class="mk-tname">${tierBadge(c)}<b>${esc(c.name)}</b></div><span>${f[3] ? AI_NAME + ' 收購' : esc(f[4] || '玩家') + ' 買入'}・${ago(f[0])}</span></div>
      <div class="mk-rnum"><span>成交價</span><b>${money(f[2])}</b></div></div>`; }).join('') : '<p class="mk-empty">還沒有成交紀錄。</p>'}</div>`;
    body.querySelectorAll('.mk-thumbslot').forEach(sl => sl.replaceWith(faceImg(card(+sl.dataset.c), 'mk-thumb')));
    body.querySelectorAll('.mk-click').forEach(r => r.addEventListener('click', () => openDetail(+r.dataset.c)));
  }

  // ── card detail: stats, price history, listings, sell form ──
  function openDetail(id, focusSell) { ui.detail = { id, focusSell, price: null, qty: 1 }; $('mk-sheet').hidden = false; renderDetail(true); }
  function closeDetail() { ui.detail = null; const sh = $('mk-sheet'); if (sh) sh.hidden = true; }
  const CH = { W: 560, H: 190 };
  function chartSVG(id) {
    const h = sales(id, Date.now() - 30 * 864e5);
    if (h.length < 2) return `<div class="mk-nochart">${h.length ? '只有 1 筆成交，再多幾筆就會畫出走勢。' : '還沒有成交紀錄，價格先參考發行參考價。'}</div>`;
    const box = $('mk-detail'), W = Math.round(Math.max(300, Math.min(620, (box ? box.clientWidth : 600) - 60))), H = W < 420 ? 200 : 190, pl = 52, pr = 12, pt = 12, pb = 26;
    CH.W = W; CH.H = H;
    const t0 = h[0][0], t1 = h[h.length - 1][0], ps = h.map(x => x[1]);
    let lo = Math.min(...ps, REF[id]), hi = Math.max(...ps, REF[id]); const pad = (hi - lo) * 0.15 || hi * 0.2 || 10; lo = Math.max(0, lo - pad); hi += pad;
    const X = t => pl + (t1 === t0 ? (W - pl - pr) / 2 : (t - t0) / (t1 - t0) * (W - pl - pr)), Y = p => pt + (1 - (p - lo) / (hi - lo)) * (H - pt - pb);
    const ticks = [0, 1, 2, 3].map(i => lo + (hi - lo) * i / 3);
    const grid = ticks.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="g"/><text x="${pl - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${money(v)}</text>`).join('');
    const fmtD = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
    const xl = `<text x="${pl}" y="${H - 6}">${fmtD(t0)}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${fmtD(t1)}</text>`;
    const path = h.map((x, i) => `${i ? 'L' : 'M'}${X(x[0]).toFixed(1)} ${Y(x[1]).toFixed(1)}`).join(' ');
    const refY = Y(REF[id]).toFixed(1);
    const dots = h.map((x, i) => `<circle cx="${X(x[0]).toFixed(1)}" cy="${Y(x[1]).toFixed(1)}" r="4" class="d${x[2] ? ' ai' : ''}" data-i="${i}"/>`).join('');
    return `<div class="mk-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="近 30 天成交價走勢，共 ${h.length} 筆">
      ${grid}${xl}<line x1="${pl}" x2="${W - pr}" y1="${refY}" y2="${refY}" class="ref"/><text x="${W - pr}" y="${(+refY - 5).toFixed(1)}" text-anchor="end" class="reft">參考價</text>
      <path d="${path}" class="ln"/>${dots}<line class="xh" y1="${pt}" y2="${H - pb}" x1="0" x2="0" visibility="hidden"/></svg><div class="mk-tip" hidden></div></div>`;
  }
  function bindChart(id) {
    const box = document.querySelector('#mk-detail .mk-chart'); if (!box) return;
    const h = sales(id, Date.now() - 30 * 864e5), svg = box.querySelector('svg'), tip = box.querySelector('.mk-tip'), xh = svg.querySelector('.xh');
    const pts = [...svg.querySelectorAll('circle')];
    const show = ev => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * CH.W;
      let best = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.abs(+p.getAttribute('cx') - x); if (d < bd) { bd = d; best = i; } });
      const p = pts[best], s = h[+p.dataset.i]; if (!s) return;
      pts.forEach(q => q.classList.toggle('on', q === p));
      xh.setAttribute('x1', p.getAttribute('cx')); xh.setAttribute('x2', p.getAttribute('cx')); xh.setAttribute('visibility', 'visible');
      const d = new Date(s[0]);
      tip.innerHTML = `<b>${money(s[1])}</b><span>${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}・${s[2] ? '收購商' : '玩家'}</span>`;
      tip.hidden = false;
      const px = +p.getAttribute('cx') / CH.W * r.width, py = +p.getAttribute('cy') / CH.H * r.height;
      tip.style.left = Math.min(Math.max(px, 60), r.width - 60) + 'px'; tip.style.top = Math.max(py - 12, 0) + 'px';
    };
    svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); pts.forEach(q => q.classList.remove('on')); });
  }
  function renderDetail(first) {
    const d = ui.detail; if (!d) return;
    const box = $('mk-detail'), c = card(d.id), s = S();
    const keep = first ? null : { y: box.scrollTop, price: $('mk-price') && $('mk-price').value, qty: $('mk-qty') && $('mk-qty').value, focus: document.activeElement && document.activeElement.id };
    const L = OPEN_BY[c.id] || [], low = L[0], mine = s.owned[c.id] | 0, mp = marketPrice(c.id);
    const recent = sales(c.id).slice(-8).reverse();
    if (d.price == null) d.price = Math.max(MIN_PRICE, low ? Math.min(low.p - 1, mp) : mp);
    const can = canTrade();
    box.innerHTML = `<button class="mk-x mk-dx" id="mk-dclose" aria-label="關閉">✕</button>
      <div class="mk-dgrid">
        <div class="mk-dleft"><div class="mk-dcard" id="mk-dcard"></div>
          <div class="mk-dmeta">${tierBadge(c)}<span>${TIERS[c.tier].label}</span><span>${SETS[c.set].label}「${SETS[c.set].name}」No.${c.no}</span><span>${kindText(c)}</span>${c.type && TYPE[c.type] && c.kind === 'cat' ? `<span>${TYPE[c.type].name}屬性</span>` : ''}</div>
        </div>
        <div class="mk-dright">
          <h2>${esc(c.name)}</h2>
          <div class="mk-dstats">
            <div class="mk-stat"><span>最低售價</span><b>${low ? money(low.p) : '—'}</b></div>
            <div class="mk-stat"><span>市價</span><b>${money(mp)}</b><small>近 5 筆成交中位數</small></div>
            <div class="mk-stat"><span>發行參考價</span><b>${money(REF[c.id])}</b></div>
            <div class="mk-stat"><span>24 小時</span><b>${pct(change24(c.id))}</b><small>${vol24(c.id)} 筆成交</small></div>
          </div>
          <h3 class="mk-h3">成交走勢 <em>近 30 天</em></h3>
          ${chartSVG(c.id)}
          <h3 class="mk-h3">在賣的卡 <em>${L.length} 張</em></h3>
          <div class="mk-book">${L.length ? L.slice(0, 12).map((x, i) => `<div class="mk-brow${i === 0 ? ' best' : ''}"><b>${money(x.p)}</b><span>${esc(x.sn || '玩家')}${x.s === A.id ? '（你）' : ''}</span><em>${ago(x.at)}</em>${x.s === A.id ? `<button class="mk-btn mk-ghost small" data-cancel="${x.id}" ${busy ? 'disabled' : ''}>下架</button>` : `<button class="mk-btn small" data-buy="${x.id}" ${busy || !can || s.bal < x.p ? 'disabled' : ''}>${s.bal < x.p ? '餘額不足' : '購買'}</button>`}</div>`).join('') + (L.length > 12 ? `<p class="mk-more">還有 ${L.length - 12} 張更高價的</p>` : '') : '<p class="mk-empty">目前沒有人在賣這張卡。</p>'}</div>
          <div class="mk-sell" id="mk-sellbox">
            <h3 class="mk-h3">賣這張卡 <em>你擁有 ${mine} 張</em></h3>
            ${mine ? `<div class="mk-sellrow">
              <label class="mk-field">每張售價（美金）<input id="mk-price" inputmode="decimal" value="${(d.price / 100).toFixed(2)}"></label>
              <label class="mk-field">數量<input id="mk-qty" type="number" min="1" max="${mine}" value="${Math.min(d.qty, mine)}"></label>
              <button class="mk-btn" id="mk-list" ${busy || !can ? 'disabled' : ''}>上架</button>
            </div>
            <div class="mk-presets">${low ? `<button class="mk-chip" data-p="${Math.max(MIN_PRICE, low.p - 1)}">比最低價少 $0.01</button>` : ''}<button class="mk-chip" data-p="${mp}">市價 ${money(mp)}</button><button class="mk-chip" data-p="${REF[c.id]}">參考價 ${money(REF[c.id])}</button></div>
            <p class="mk-hint">上架後卡片會先從收藏扣起來，賣出時錢自動入帳；收購商會不定期買下價格合理的卡。</p>
            <div class="mk-bbrow"><span>不想要？直接回收每張 ${money(BUYBACK)}</span><button class="mk-btn mk-ghost small" id="mk-bb">回收 1 張</button></div>`
            : '<p class="mk-empty">你還沒有這張卡。</p>'}
          </div>
          ${recent.length ? `<h3 class="mk-h3">最近成交</h3><div class="mk-book">${recent.map(x => `<div class="mk-brow"><b>${money(x[1])}</b><span>${x[2] ? AI_NAME : '玩家'}</span><em>${ago(x[0])}</em></div>`).join('')}</div>` : ''}
          ${can ? '' : `<p class="mk-notice">${esc(tradeBlock())}</p>`}
        </div>
      </div>`;
    const cardBox = $('mk-dcard'); cardBox.appendChild(CORE.cardEl(c));
    $('mk-dclose').addEventListener('click', closeDetail);
    box.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      if (!b.dataset.arm) { b.dataset.arm = '1'; b.textContent = '確認購買'; b.classList.add('arm'); setTimeout(() => { if (b.isConnected && b.dataset.arm) { delete b.dataset.arm; b.textContent = '購買'; b.classList.remove('arm'); } }, 3500); return; }
      buyListing(b.dataset.buy);
    }));
    box.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => cancelListing(b.dataset.cancel)));
    const pi = $('mk-price'), qi = $('mk-qty');
    if (pi) {
      if (keep && keep.price != null) pi.value = keep.price;
      if (keep && keep.qty != null) qi.value = keep.qty;
      pi.addEventListener('input', () => { const v = Math.round(parseFloat(pi.value) * 100); if (v > 0) d.price = v; });
      qi.addEventListener('input', () => { d.qty = Math.max(1, qi.value | 0); });
      box.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { d.price = +b.dataset.p; pi.value = (d.price / 100).toFixed(2); }));
      $('mk-list').addEventListener('click', () => {
        const v = Math.round(parseFloat(pi.value) * 100);
        if (!isFinite(v)) { toast('請輸入價格。'); return; }
        listCard(c.id, v, Math.min(mine, Math.max(1, qi.value | 0)));
      });
      $('mk-bb').addEventListener('click', e => confirmBuyback(c.id, 1, e.currentTarget));
    }
    bindChart(c.id);
    if (keep) { box.scrollTop = keep.y; if (keep.focus && $(keep.focus)) $(keep.focus).focus({ preventScroll: true }); }
    else if (d.focusSell) { setTimeout(() => { const sb = $('mk-sellbox'); if (sb) sb.scrollIntoView({ block: 'center' }); if (pi) pi.focus({ preventScroll: true }); }, 60); }
    else $('mk-dclose').focus({ preventScroll: true });
  }

  // extras in the pack page's card modal
  function modalExtra(c, el) {
    el.innerHTML = '';
    if (!tradable(c)) return;
    const n = S().owned[c.id] | 0, low = (OPEN_BY[c.id] || [])[0];
    el.innerHTML = `<span>擁有 <b>${n}</b> 張・市價 <b>${money(marketPrice(c.id))}</b>${low ? `・最低 <b>${money(low.p)}</b>` : ''}</span>
      <div><button type="button" class="btn btn-primary btn-small" data-mk="go">到市場</button>${n ? `<button type="button" class="btn btn-ghost btn-small" data-mk="bb">回收 ${money(BUYBACK)}</button>` : ''}</div>`;
    el.querySelector('[data-mk="go"]').addEventListener('click', () => { CORE.closeModal(); openMarket(null, c.id); });
    const bb = el.querySelector('[data-mk="bb"]');
    if (bb) bb.addEventListener('click', () => { if (!bb.dataset.arm) { bb.dataset.arm = 1; bb.textContent = '確認回收？'; return; } const got = buyback(c.id, 1); if (got) toast(`回收「${c.name}」1 張，拿到 ${money(BUYBACK)}。`, 'ok'); modalExtra(c, el); });
  }

  injectCSS(); buildShell();
  document.querySelectorAll('.js-market').forEach(a => a.addEventListener('click', e => openMarket(e)));
  window.NOXACCT = { ready, spend, canAfford, persist, buyback, money, PACK, get mode() { return A.mode; } };
  window.NOXMARKET = { open: openMarket, modalExtra, toast, REF, marketPrice, _t: { botTick, MK, A, settle } };
  refreshMoney();
  initAccount();
})();
