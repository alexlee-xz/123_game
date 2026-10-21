/*
 * 纯逻辑层（不依赖 DOM），可在 Node 里直接测试。
 * 包含：随机工具、数字读法、选项生成、自适应难度、各游戏的出题器、描红笔画数据与判定器。
 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  const L = NG.logic = {};

  /* ---------- 随机工具 ---------- */
  L.randInt = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  L.pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  L.shuffle = (rnd, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  L.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const lv = (level) => Math.max(1, Math.min(4, Math.round(level) || 1));
  L.clampLevel = lv;

  /* ---------- 数字读法 ---------- */
  const ZH = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  L.numZh = (n) => n <= 10 ? ZH[n] : n < 20 ? '十' + ZH[n - 10] : n === 20 ? '二十' : String(n);
  // 数量读法：2 读“两”
  L.qtyZh = (n) => n === 2 ? '两' : L.numZh(n);

  /* ---------- 选项生成：包含正确答案，其余干扰项取自附近的数 ---------- */
  L.makeOptions = function (rnd, answer, opt) {
    const o = Object.assign({ min: 0, max: 10, count: 3 }, opt);
    const pool = [];
    for (let v = o.min; v <= o.max; v++) if (v !== answer) pool.push(v);
    const keyed = pool.map(v => ({ v, d: Math.abs(v - answer) + rnd() * 0.9 }));
    keyed.sort((a, b) => a.d - b.d);
    const need = Math.min(o.count - 1, pool.length);
    const cand = keyed.slice(0, Math.min(keyed.length, need + 2)).map(x => x.v);
    const picked = L.shuffle(rnd, cand).slice(0, need);
    return L.shuffle(rnd, picked.concat([answer]));
  };

  /* ---------- 自适应难度（最近发展区 + 脚手架） ----------
   * 连续 3 次“第一次就答对”升一级；连续 2 次没有第一次答对降一级。 */
  L.MAX_LEVEL = 4;
  L.adapt = function (state, firstTry) {
    let level = state.level || 1, ok = state.streakOk || 0, bad = state.streakBad || 0;
    let changed = null;
    if (firstTry) {
      ok++; bad = 0;
      if (ok >= 3) { ok = 0; if (level < L.MAX_LEVEL) { level++; changed = 'up'; } }
    } else {
      bad++; ok = 0;
      if (bad >= 2) { bad = 0; if (level > 1) { level--; changed = 'down'; } }
    }
    return { level, streakOk: ok, streakBad: bad, changed };
  };

  /* ---------- 素材 ---------- */
  L.COUNT_ITEMS = [
    { e: '🍎', name: '苹果', unit: '个' }, { e: '🐟', name: '小鱼', unit: '条' },
    { e: '⭐', name: '星星', unit: '颗' }, { e: '🎈', name: '气球', unit: '个' },
    { e: '🐥', name: '小鸡', unit: '只' }, { e: '🚗', name: '小汽车', unit: '辆' }
  ];
  L.ANIMALS = [
    { e: '🐱', name: '小猫' }, { e: '🐶', name: '小狗' }, { e: '🐰', name: '小兔' },
    { e: '🐼', name: '熊猫' }, { e: '🐵', name: '小猴' }, { e: '🐷', name: '小猪' }, { e: '🐸', name: '青蛙' }
  ];
  L.SHOP_ITEMS = [
    { e: '🍎', name: '苹果' }, { e: '🍪', name: '饼干' }, { e: '🍦', name: '冰淇淋' }, { e: '🎈', name: '气球' },
    { e: '🍬', name: '糖果' }, { e: '🧸', name: '小熊' }, { e: '🍓', name: '草莓' }, { e: '🥕', name: '萝卜' }
  ];
  L.RHYME = {
    0: '0像鸡蛋圆溜溜', 1: '1像铅笔细又长', 2: '2像鸭子水上漂', 3: '3像耳朵听声音', 4: '4像小旗随风飘',
    5: '5像秤钩来买菜', 6: '6像哨子吹口哨', 7: '7像镰刀割青草', 8: '8像麻花拧一道', 9: '9像蝌蚪尾巴摇'
  };
  L.STICKERS = ['🐶', '🐱', '🐰', '🐼', '🦊', '🐯', '🦁', '🐸', '🐵', '🐙', '🦄', '🐢',
    '🐳', '🦋', '🐞', '🐥', '🚀', '🚒', '🚂', '🌈', '🍎', '🍓', '🍦', '🎈'];
  L.STARS_PER_STICKER = 5;
  L.nextSticker = (rnd, owned) => {
    const left = L.STICKERS.filter(s => owned.indexOf(s) < 0);
    return left.length ? L.pick(rnd, left) : null;
  };

  /* ---------- 各游戏出题器 ---------- */
  // 数数乐：点着数，最后回答总数（基数原则）
  L.genCount = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const max = [3, 5, 8, 10][l - 1];
    const n = L.randInt(rnd, 1, max);
    return {
      n, item: L.pick(rnd, L.COUNT_ITEMS), layout: l <= 2 ? 'line' : 'scatter',
      options: L.makeOptions(rnd, n, { min: 1, max: Math.min(10, max + 2), count: 3 })
    };
  };

  // 闪现点阵（瞬间识数）
  L.genSubitize = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const hi = [3, 5, 5, 10][l - 1];
    const n = L.randInt(rnd, 1, hi);
    return {
      n, ms: [3000, 2000, 1400, 1600][l - 1],
      options: L.makeOptions(rnd, n, { min: 1, max: hi, count: l === 1 ? 3 : 4 })
    };
  };

  // 数字配对：数字 / 点阵 / 手势 / 方块塔 之间互相对应
  L.REPS = ['num', 'dots', 'fingers', 'blocks'];
  L.genMatch = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    let pairs, max;
    if (l === 1) { pairs = [['num', 'dots'], ['num', 'blocks']]; max = 5; }
    else if (l === 2) { pairs = [['dots', 'num'], ['blocks', 'num'], ['dots', 'blocks']]; max = 5; }
    else if (l === 3) { pairs = [['fingers', 'num'], ['num', 'fingers'], ['fingers', 'dots']]; max = 10; }
    else {
      pairs = [];
      L.REPS.forEach(a => L.REPS.forEach(b => { if (a !== b) pairs.push([a, b]); }));
      max = 10;
    }
    const p = L.pick(rnd, pairs);
    const n = L.randInt(rnd, 1, max);
    return { from: p[0], to: p[1], n, options: L.makeOptions(rnd, n, { min: 1, max, count: 3 }) };
  };

  // 积木合体（加法）。level 4 会出现“缺少的加数”
  L.genAdd = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const max = [5, 7, 10, 10][l - 1];
    const sum = L.randInt(rnd, 2, max);
    const a = L.randInt(rnd, 1, sum - 1), b = sum - a;
    const kind = (l === 4 && rnd() < 0.6) ? 'missing' : 'add';
    const answer = kind === 'add' ? sum : b;
    return {
      kind, a, b, sum, answer,
      options: L.makeOptions(rnd, answer, { min: 1, max: Math.min(10, max + 1), count: 3 })
    };
  };

  // 积木掉落（减法）。level 4 允许答案为 0
  L.genTake = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const max = [5, 7, 10, 10][l - 1];
    const n = L.randInt(rnd, 2, max);
    const k = l === 4 ? L.randInt(rnd, 1, n) : L.randInt(rnd, 1, Math.min(n - 1, l === 1 ? 2 : n - 1));
    const answer = n - k;
    return {
      n, k, answer,
      options: L.makeOptions(rnd, answer, { min: l === 4 ? 0 : 1, max: Math.min(10, max + 1), count: 3 })
    };
  };

  // 小动物上下车（故事情境）
  L.genBus = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const max = [5, 5, 8, 10][l - 1];
    const op = l === 1 ? 'add' : l === 2 ? 'sub' : (rnd() < 0.5 ? 'add' : 'sub');
    const animal = L.pick(rnd, L.ANIMALS);
    let n, k, answer;
    if (op === 'add') {
      const sum = L.randInt(rnd, 2, max);
      n = L.randInt(rnd, 1, sum - 1); k = sum - n; answer = sum;
    } else {
      n = L.randInt(rnd, 2, max); k = L.randInt(rnd, 1, n - 1); answer = n - k;
    }
    return {
      op, n, k, answer, animal,
      options: L.makeOptions(rnd, answer, { min: 1, max: Math.min(10, max + 2), count: 3 })
    };
  };

  // 拆数房子（部分-整体）
  L.genSplit = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    if (l <= 3) {
      const max = [5, 7, 10][l - 1];
      const N = L.randInt(rnd, 2, max);
      const a = L.randInt(rnd, 1, N - 1), answer = N - a;
      return { mode: 'missing', N, a, answer, options: L.makeOptions(rnd, answer, { min: 0, max, count: 3 }) };
    }
    const N = L.randInt(rnd, 4, 10);
    const a = L.randInt(rnd, 1, N - 1);
    const good = [a, N - a];
    const seen = {}; seen[good.join('+')] = 1; seen[[good[1], good[0]].join('+')] = 1;
    const cards = [good];
    let guard = 0;
    while (cards.length < 3 && guard++ < 200) {
      const sum = N + L.pick(rnd, [-2, -1, 1, 2]);
      if (sum < 2) continue;
      const x = L.randInt(rnd, 1, sum - 1), y = sum - x;
      const key = x + '+' + y, key2 = y + '+' + x;
      if (seen[key] || seen[key2]) continue;
      seen[key] = 1; cards.push([x, y]);
    }
    const order = L.shuffle(rnd, [0, 1, 2].slice(0, cards.length));
    const shuffled = order.map(i => cards[i]);
    return { mode: 'pairs', N, cards: shuffled, answerIndex: order.indexOf(0) };
  };

  // 十格框（凑十、位值）
  L.genTen = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const mode = l === 1 ? 'fill' : l === 2 ? 'choose' : l === 3 ? 'teen' : (rnd() < 0.6 ? 'pair' : 'teen');
    if (mode === 'teen') {
      const n = L.randInt(rnd, 11, 19), answer = n - 10;
      return { mode, n, answer, options: L.makeOptions(rnd, answer, { min: 1, max: 9, count: 3 }) };
    }
    const k = L.randInt(rnd, 1, 9), answer = 10 - k;
    return { mode, k, answer, options: L.makeOptions(rnd, answer, { min: 1, max: 9, count: 3 }) };
  };

  // 天平（等号 = 两边一样多）
  L.genBalance = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    if (l < 4) {
      const max = [5, 8, 10][l - 1];
      const total = L.randInt(rnd, 2, max), right = L.randInt(rnd, 1, total - 1);
      return { left: [total], right, total, need: total - right };
    }
    const total = L.randInt(rnd, 4, 10), x = L.randInt(rnd, 1, total - 1);
    const right = L.randInt(rnd, 1, total - 1);
    return { left: [x, total - x], right, total, need: total - right };
  };

  // 商店
  L.COINS = [1, 2, 5];
  L.minCoins = function (total, coins) {
    coins = coins || L.COINS;
    const best = [[]];
    for (let t = 1; t <= total; t++) {
      let b = null;
      coins.forEach(c => {
        if (c <= t && best[t - c] && (!b || best[t - c].length + 1 < b.length)) b = best[t - c].concat([c]);
      });
      best[t] = b;
    }
    return best[total] ? best[total].slice().sort((a, b) => b - a) : null;
  };
  L.genShop = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const item = L.pick(rnd, L.SHOP_ITEMS);
    let mode, price, paid = 0;
    if (l === 1) { mode = 'pay'; price = L.randInt(rnd, 1, 5); }
    else if (l === 2) { mode = 'change'; paid = 5; price = L.randInt(rnd, 1, 4); }
    else if (l === 3) { mode = 'pay'; price = L.randInt(rnd, 3, 10); }
    else if (rnd() < 0.5) { mode = 'change'; paid = 10; price = L.randInt(rnd, 1, 9); }
    else { mode = 'pay'; price = L.randInt(rnd, 6, 10); }
    const answer = mode === 'pay' ? price : paid - price;
    const q = { mode, item, price, paid, answer, showTotal: l < 3 };
    if (mode === 'change') q.options = L.makeOptions(rnd, answer, { min: 1, max: 9, count: 3 });
    return q;
  };

  // 挑战关：按等级混合各类题目
  L.CHALLENGE_POOLS = [
    ['match', 'merge', 'take'],
    ['match', 'merge', 'take', 'bus', 'split'],
    ['merge', 'take', 'bus', 'split', 'tenframe', 'balance'],
    ['merge', 'take', 'bus', 'split', 'tenframe', 'balance', 'shop']
  ];
  L.pickChallenge = (level, rnd) => L.pick(rnd || Math.random, L.CHALLENGE_POOLS[lv(level) - 1]);

  /* ---------- 描红：笔画数据（100 x 140 的格子，原点在左上） ---------- */
  function arc(cx, cy, rx, ry, a0, a1) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 12)), pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  }
  const DIGITS = {
    '0': [arc(50, 70, 32, 56, -90, -450)],
    '1': [[[30, 40], [52, 16], [52, 126]]],
    '2': [arc(50, 46, 29, 28, 180, 405).concat([[20, 122], [84, 122]])],
    '3': [arc(46, 40, 26, 22, 205, 450).concat(arc(46, 94, 32, 30, 270, 520))],
    '4': [[[62, 14], [14, 90], [88, 90]], [[66, 50], [66, 130]]],
    '5': [[[78, 14], [30, 14], [26, 62]].concat(arc(46, 92, 34, 30, 240, 510))],
    '6': [[[72, 12], [52, 22], [34, 48], [24, 86]].concat(arc(50, 98, 28, 28, 180, -180))],
    '7': [[[20, 16], [82, 16], [42, 128]]],
    '8': [arc(50, 38, 24, 23, -45, -270).concat(arc(50, 98, 30, 33, -90, 270))],
    '9': [arc(50, 42, 26, 26, 0, -360).concat([[75, 72], [72, 100], [60, 122], [34, 132]])]
  };
  L.digitStrokes = (ch) => DIGITS[ch];
  L.GLYPH_W = 100; L.GLYPH_H = 140; L.GLYPH_GAP = 30;
  L.layoutText = function (text) {
    const strokes = [];
    text.split('').forEach((ch, gi) => {
      const dx = gi * (L.GLYPH_W + L.GLYPH_GAP);
      DIGITS[ch].forEach((pts, si) => {
        strokes.push({ glyph: gi, ch, order: si, count: DIGITS[ch].length, pts: pts.map(p => [p[0] + dx, p[1]]) });
      });
    });
    const n = text.length;
    return { strokes, width: n * L.GLYPH_W + (n - 1) * L.GLYPH_GAP, height: L.GLYPH_H };
  };
  L.densify = function (pts, step) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(d / step));
      for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  };
  L.genTrace = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    if (l === 1) return { text: L.pick(rnd, '12345'.split('')), mode: 'guide', bee: true, tol: 18 };
    if (l === 2) return { text: L.pick(rnd, '0123456789'.split('')), mode: 'guide', bee: false, tol: 17 };
    if (l === 3) return { text: L.pick(rnd, '0123456789'.split('')), mode: 'dictate', bee: false, tol: 20 };
    return { text: String(L.randInt(rnd, 10, 20)), mode: 'dictate', bee: false, tol: 20 };
  };

  /* 描红判定器：按笔画顺序、沿着路线依次经过各个点才算写对。
   * 起笔点必须在当前笔画的起点附近；提前抬笔或偏离路线则这一笔重来。 */
  L.TraceChecker = class {
    constructor(strokes, opt) {
      const o = Object.assign({ tol: 18, startTol: 28, step: 5 }, opt);
      this.tol = o.tol; this.startTol = o.startTol;
      this.dense = strokes.map(s => L.densify(s.pts, o.step));
      this.total = strokes.length;
      this.s = 0; this.p = 0; this.active = false;
    }
    get done() { return this.s >= this.total; }
    get strokeIndex() { return this.s; }
    begin(pt) {
      if (this.done) return false;
      const st = this.dense[this.s][0];
      if (Math.hypot(pt[0] - st[0], pt[1] - st[1]) > this.startTol) { this.active = false; return false; }
      this.active = true; this.p = 1;
      return true;
    }
    move(pt) {
      if (!this.active || this.done) return;
      const d = this.dense[this.s];
      // 在前方 8 个点（约 40 个单位）的窗口里找离手指最近的点，允许手速较快时稀疏采样
      let hit = -1, best = Infinity;
      for (let j = this.p; j < Math.min(d.length, this.p + 8); j++) {
        const dd = Math.hypot(pt[0] - d[j][0], pt[1] - d[j][1]);
        if (dd <= this.tol && dd < best) { best = dd; hit = j; }
      }
      if (hit >= 0) this.p = hit + 1;
    }
    // 返回 'none' | 'retry' | 'stroke' | 'done'
    end() {
      if (!this.active) return 'none';
      this.active = false;
      const len = this.dense[this.s].length;
      if (this.p >= len - 2) {
        this.s++; this.p = 0;
        return this.done ? 'done' : 'stroke';
      }
      this.p = 0;
      return 'retry';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NG;
})(typeof window !== 'undefined' ? window : globalThis);
