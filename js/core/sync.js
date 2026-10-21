/* ============ 云同步（客户端）：本机优先，云端只是中转 ============
   学习记录始终先存在本机 localStorage（离线也能玩）；开启云同步后，这里负责：
     • 答题保存后几秒内把改动上传（touch → 防抖 → now）
     • 打开页面 / 切回前台 / 每 30 秒拉一次云端的新内容
     • 两边都改过时按规则合并（merge），不是谁覆盖谁
   云端是 cloud/worker.mjs（Cloudflare Worker + D1），用“同步码”识别家庭，不需要注册账号。
   目前一个家庭只有一条记录（id = 'main'）。本文件只管数据，不画页面；页面在 pages/parent.js 和 pages/home.js。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};

  const SYNC_KEY = '123game.sync.v1';
  // 云服务地址（部署方法见 README）。留空则家长页会让你手动填。
  const SYNC_URL = 'https://123-sync.alexlee10100110.workers.dev';
  const REC = 'main';
  const PUSH_MS = 4000, PUSH_MAXWAIT = 12000, POLL_MS = 30000, TIMEOUT_MS = 15000;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', CODE_LEN = 20;     // 去掉了容易看错的 0 O 1 I L
  const LOG_MAX = 500, DAILY_DAYS = 30;

  const cleanUrl = s => { s = String(s || '').trim().replace(/\/+$/, ''); return /^https?:\/\/[^\s\/?#]+(\/[^\s?#]*)?$/.test(s) ? s : ''; };
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const validCode = c => c.length === CODE_LEN && /^[A-Z0-9]+$/.test(c);
  const fmtCode = c => c.replace(/(.{4})(?=.)/g, '$1-');
  function newCode() {
    const b = new Uint8Array(CODE_LEN);
    try { root.crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < CODE_LEN; i++) b[i] = Math.floor(Math.random() * 256); }
    return Array.from(b, x => CODE_CHARS[x % CODE_CHARS.length]).join('');
  }
  function b64enc(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64dec(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = atob(s), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* ---------- 合并 ---------- */
  // 键排好序再转文字：内容相同就得到相同文字（用来判断“两边是不是一样”）
  function stableStr(o) {
    if (Array.isArray(o)) return '[' + o.map(stableStr).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stableStr(o[k])).join(',') + '}';
    return JSON.stringify(o);
  }
  const logKey = r => [r.t, r.g, r.ok, r.k, r.lv].join('|');
  // 逐题记录：两边相同的条目只留一份，各自多出来的都保留；按（时间、内容）排成固定顺序，两台设备合并出的结果完全一样
  function mergeLog(la, lb) {
    const seen = new Set(), out = [];
    la.concat(lb).forEach(r => { const k = logKey(r); if (!seen.has(k)) { seen.add(k); out.push(r); } });
    out.sort((p, q) => p.t - q.t || (logKey(p) < logKey(q) ? -1 : logKey(p) > logKey(q) ? 1 : 0));
    return out.slice(-LOG_MAX);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* 合并两份学习记录（x、y 顺序无关，结果相同）：
     • “清空 / 覆盖导入”（resetAt）：更晚的一边整体胜出（清空就是要让所有设备一起清空）
     • 每个游戏：最近玩过（stats.last 更晚）的一边提供等级、连击和统计；易错点取每个题目的较大次数
     • 星星取较大值；贴纸取并集
     • 每天的时长取较大值；逐题记录取并集（去重）
     • 名字和设置：改动时间（cfgAt）更晚的一边胜出 */
  function merge(x, y) {
    const S = NG.store;
    const a = S.normalize(x), b = S.normalize(y);
    if (a.resetAt !== b.resetAt) return clone(a.resetAt > b.resetAt ? a : b);
    const r = S.normalize({});
    r.resetAt = a.resetAt;
    r.created = Math.min(a.created, b.created);
    const cfg = a.cfgAt !== b.cfgAt ? (a.cfgAt > b.cfgAt ? a : b) : (stableStr([a.name, a.settings]) >= stableStr([b.name, b.settings]) ? a : b);
    r.name = cfg.name; r.settings = clone(cfg.settings); r.cfgAt = cfg.cfgAt;

    r.levels = {}; r.streaks = {}; r.stats = {};
    new Set(Object.keys(a.stats).concat(Object.keys(b.stats), Object.keys(a.levels), Object.keys(b.levels))).forEach(g => {
      const ta = a.stats[g], tb = b.stats[g];
      let win;
      const own = side => stableStr([side.stats[g], side.levels[g], side.streaks[g]]);   // 同一个游戏的自身记录，用来在时间相同时分胜负
      if (ta && tb) win = ta.last !== tb.last ? (ta.last > tb.last ? a : b) : (own(a) >= own(b) ? a : b);
      else win = ta ? a : tb ? b : (a.levels[g] ? a : b);
      const st = clone(win.stats[g] || { rounds: 0, ok: 0, last: 0, wrong: {} });
      st.wrong = st.wrong || {};
      [a, b].forEach(side => {
        const w = (side.stats[g] && side.stats[g].wrong) || {};
        Object.keys(w).forEach(k => { st.wrong[k] = Math.max(st.wrong[k] || 0, w[k]); });
      });
      r.stats[g] = st;
      if (win.levels[g] != null) r.levels[g] = win.levels[g];
      if (win.streaks[g]) r.streaks[g] = clone(win.streaks[g]);
    });
    r.stars = Math.max(a.stars, b.stars);
    r.stickers = Array.from(new Set(a.stickers.concat(b.stickers))).sort();
    r.log = mergeLog(a.log, b.log);
    const days = new Set(Object.keys(a.daily).concat(Object.keys(b.daily)));
    r.daily = {};
    Array.from(days).sort().slice(-DAILY_DAYS).forEach(d => { r.daily[d] = Math.max(a.daily[d] || 0, b.daily[d] || 0); });
    return r;
  }
  // 两份记录“内容是否一样”的签名：键顺序、逐题记录和贴纸的排列顺序都不影响
  function sig(d) {
    const c = clone(NG.store.normalize(d));
    c.log = mergeLog(c.log, []);
    c.stickers = c.stickers.slice().sort();
    return stableStr(c);
  }

  /* ---------- 同步状态（存在本机，不上传） ----------
     url/code  云服务地址、同步码；空 code = 没开启
     rev       “我已经合并到的云端版本号”
     dirty     本机有改动、还没上传成功 */
  function readState() {
    const s = { url: SYNC_URL, code: '', rev: 0, dirty: 0, last: 0, err: '' };
    try {
      const o = JSON.parse(root.localStorage.getItem(SYNC_KEY));
      if (o && typeof o === 'object') {
        if (!SYNC_URL && cleanUrl(o.url)) s.url = cleanUrl(o.url);
        if (validCode(normCode(o.code))) s.code = normCode(o.code);
        s.rev = Math.max(0, parseInt(o.rev, 10) || 0); s.dirty = o.dirty ? 1 : 0;
        s.last = Math.max(0, parseInt(o.last, 10) || 0);
      }
    } catch (e) { /* ignore */ }
    return s;
  }
  let ST = readState();
  const persist = () => { try { root.localStorage.setItem(SYNC_KEY, JSON.stringify(ST)); } catch (e) { /* ignore */ } };
  const on = () => !!(ST.url && ST.code);
  let busy = false, again = false, timer = 0, timerAt = 0, pollId = 0, seq = 0;
  const listeners = [];
  const unref = t => { if (t && t.unref) t.unref(); return t; };

  function enable(url, code) {
    ST.url = SYNC_URL || cleanUrl(url);
    ST.code = normCode(code);
    ST.rev = 0; ST.dirty = 0; ST.last = 0; ST.err = '';   // 云端没有记录时 run() 会自己上传；已有记录则先合并，有差异才上传
    persist(); startPoll();
  }
  function leave() {
    ST.code = ''; ST.rev = 0; ST.dirty = 0; ST.last = 0; ST.err = '';
    if (timer) { clearTimeout(timer); timer = 0; }
    persist();
  }
  // 本机有改动（store.save 时调用）：标记并在几秒后上传。连续答题时最多拖 12 秒
  function touch() {
    if (!on()) return;
    seq++;
    if (!ST.dirty) { ST.dirty = 1; persist(); }
    soon(PUSH_MS);
  }
  function soon(ms) {
    if (!on()) return;
    if (timer) {
      if (Date.now() - timerAt > PUSH_MAXWAIT) return;
      clearTimeout(timer);
    } else timerAt = Date.now();
    timer = unref(setTimeout(() => { timer = 0; now(); }, ms));
  }
  function startPoll() {
    if (pollId || typeof document === 'undefined' || typeof setInterval === 'undefined') return;
    pollId = setInterval(() => { if (on() && document.visibilityState !== 'hidden') now(); }, POLL_MS);
  }

  /* ---------- 和云端通信 ---------- */
  async function api(method, path, body) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ac ? setTimeout(() => ac.abort(), TIMEOUT_MS) : 0;
    try {
      const h = { 'X-Family': ST.code };
      if (body) h['Content-Type'] = 'application/json';
      const r = await fetch(ST.url + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, signal: ac ? ac.signal : undefined, cache: 'no-store' });
      let j = {}; try { j = await r.json(); } catch (e) { /* ignore */ }
      return { status: r.status, ok: r.ok, j: j || {} };
    } catch (e) {
      return { status: 0, ok: false, j: {} };
    } finally { if (tm) clearTimeout(tm); }
  }
  function apiErr(r) {
    const s = r.status;
    return new Error(s === 0 ? '连不上云端（网络不好，稍后会自动重试）'
      : s === 401 ? '同步码不对' : s === 403 ? '云端不允许这个网址访问'
      : s === 413 ? '记录太大，无法上传' : s === 429 ? '请求太频繁，稍后再试'
      : s >= 500 ? '云端暂时出错，稍后会自动重试' : '云端拒绝了请求（' + s + '）');
  }
  const recPath = '/api/kid/' + REC;

  async function run() {
    const out = { pulled: false, pushed: false, changed: false };
    const L = await api('GET', '/api/kids');
    if (!L.ok) throw apiErr(L);
    const c = (L.j.kids || []).find(k => k && k.id === REC);
    if (c && c.deleted) throw new Error('云端的这份记录已被删除。请在家长页关闭同步后重新开启');
    let cloudRev = c ? c.rev : 0, dirty = !!ST.dirty || !c;
    for (let n = 0; n < 4; n++) {
      if (cloudRev > 0 && cloudRev !== ST.rev) {
        const r = await api('GET', recPath);
        if (!r.ok) throw apiErr(r);
        if (r.j.deleted) throw new Error('云端的这份记录已被删除。请在家长页关闭同步后重新开启');
        const theirs = r.j.data && r.j.data.d && typeof r.j.data.d === 'object' ? r.j.data.d : null;
        if (theirs) {
          const mine = NG.store.get();                 // 等网络回来之后再取本机最新的，期间孩子答的题不会丢
          const merged = merge(mine, theirs);
          if (sig(merged) !== sig(mine)) { NG.store.replaceFromSync(merged); out.pulled = true; out.changed = true; }
          if (sig(merged) !== sig(theirs)) dirty = true;
        } else dirty = true;
        ST.rev = cloudRev = r.j.rev;
      }
      if (!dirty) return out;
      const mySeq = seq, d = NG.store.get();
      const q = await api('PUT', recPath, { base: cloudRev, name: d.name, data: { v: 1, d } });
      if (q.ok) {
        ST.rev = q.j.rev; out.pushed = true;
        if (seq === mySeq) ST.dirty = 0;
        return out;
      }
      if (q.status !== 409) throw apiErr(q);
      if (q.j.deleted) throw new Error('云端的这份记录已被删除。请在家长页关闭同步后重新开启');
      cloudRev = q.j.rev || 0;                         // 别的设备刚写过：回到循环开头，拉取、合并后再传
      if (cloudRev === 0) ST.rev = 0;
    }
    throw new Error('云端数据一直在变化，稍后会自动重试');
  }

  // 检查一个云服务地址能不能连上（开启同步前先试一下，地址填错了马上能知道）
  async function ping(url) {
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = ac ? setTimeout(() => ac.abort(), 10000) : 0;
    try {
      const r = await fetch(url + '/api/ping', { cache: 'no-store', signal: ac ? ac.signal : undefined });
      let j = null; try { j = await r.json(); } catch (e) { /* ignore */ }
      if (j && j.ok) return { ok: true, why: '' };
      return { ok: false, why: r.ok ? '这个地址不是云同步服务（返回的内容不对）' : '服务返回了错误（' + r.status + '）' };
    } catch (e) {
      return { ok: false, why: (e && e.name === 'AbortError') ? '等了 10 秒没有响应（超时）' : '浏览器没能连接到这个地址' };
    } finally { if (tm) clearTimeout(tm); }
  }

  // 立即同步一次（同一时间只跑一个；跑的时候又有新改动，跑完再来一次）
  async function now() {
    if (!on()) return { skip: true };
    if (busy) { again = true; return { busy: true }; }
    busy = true; again = false;
    let res;
    try { res = await run(); ST.err = ''; ST.last = Date.now(); }
    catch (e) { ST.err = (e && e.message) || '同步失败'; res = { err: ST.err }; }
    busy = false; persist();
    listeners.slice().forEach(fn => { try { fn(res); } catch (e) { /* ignore */ } });
    if (again) { again = false; soon(500); }
    return res;
  }

  // 用同步码或邀请链接加入。失败时自动退出同步，不留下半开启的状态。
  // needRemote：本机还没有记录（欢迎页恢复）时，云端必须已经有记录，否则算失败
  async function join(text, opt) {
    const p = text && typeof text === 'object' ? text : parseInput(text);
    if (!p) return { err: '这个同步码或邀请链接不对，请检查后再试' };
    enable(p.url, p.code);
    const res = await now();
    if (res.err) { leave(); return res; }
    if (opt && opt.needRemote && !NG.store.hasProfile()) { leave(); return { err: '云端还没有这个同步码的记录' }; }
    return res;
  }

  // 删除云端全部数据（本机数据不动）
  async function wipeCloud() {
    if (!on()) return false;
    const r = await api('DELETE', '/api/family');
    if (!r.ok) throw apiErr(r);
    ST.rev = 0; ST.dirty = 1; persist();
    return true;
  }

  function statusText() {
    if (!on()) return '未开启';
    if (busy) return '🔄 正在同步…';
    if (ST.err) return '⚠️ ' + ST.err + (ST.dirty ? '（本机有改动等待上传，已保存在本机，不会丢）' : '');
    if (!ST.last) return '还没有同步过';
    const d = new Date(ST.last), pad = n => String(n).padStart(2, '0');
    return '✅ 已同步（' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + '）' + (ST.dirty ? '，有改动等待上传' : '');
  }

  /* ---------- 邀请链接 ----------
     放在网址的 #s= 后面。打开后 app.js 会把它存为“待加入”，转到家长页让大人确认。 */
  function link() {
    if (!on() || !root.location || !/^https?:$/.test(root.location.protocol)) return '';
    return root.location.origin + root.location.pathname + '#s=' + b64enc(JSON.stringify({ u: ST.url, c: ST.code }));
  }
  // 家长输入的可能是邀请链接，也可能只是同步码。返回 {url, code}（只有同步码时 url 为空），无效返回 null
  function parseInput(text) {
    const s = String(text || '').trim();
    const m = /[#&?]s=([A-Za-z0-9_-]{8,})/.exec(s);
    if (m) {
      try {
        const o = JSON.parse(b64dec(m[1])), code = normCode(o && o.c);
        if (validCode(code)) return { url: cleanUrl(o.u), code };
      } catch (e) { /* ignore */ }
      return null;
    }
    const code = normCode(s);
    return validCode(code) ? { url: '', code } : null;
  }

  /* ---------- 自动触发 ---------- */
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(300); });
  }
  if (root.addEventListener) root.addEventListener('online', () => soon(500));

  NG.sync = {
    SYNC_URL, merge, sig, on, enable, leave, join, touch, now, ping, wipeCloud, statusText, link, parseInput,
    newCode, fmtCode, normCode, validCode, cleanUrl, listeners,
    get state() { return ST; },
    get busy() { return busy; },
    pending: null,       // 邀请链接解析出来、等家长确认的 {url, code}
    start() { if (on()) { startPoll(); soon(800); } }     // 打开页面：稍等一下（让首页先显示出来）就拉一次
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = NG.sync;
})(typeof window !== 'undefined' ? window : globalThis);
