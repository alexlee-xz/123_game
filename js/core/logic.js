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

  // 青蛙跳跳：数轴上的加减（向前跳 = 加，向后跳 = 减）。kind = land（落在哪）或 steps（跳了几步）
  L.genFrog = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const max = [5, 10, 10, 20][l - 1];
    const maxK = [3, 4, 5, 6][l - 1];
    const op = l === 1 ? 'add' : l === 2 ? 'sub' : (rnd() < 0.5 ? 'add' : 'sub');
    const kind = (l === 4 && rnd() < 0.4) ? 'steps' : 'land';
    let start, k;
    if (op === 'add') {
      k = L.randInt(rnd, 1, maxK);
      start = L.randInt(rnd, l === 1 ? 0 : 1, max - k);
    } else {
      start = L.randInt(rnd, 2, max);
      k = L.randInt(rnd, 1, Math.min(maxK, start));
    }
    const end = op === 'add' ? start + k : start - k;
    const answer = kind === 'land' ? end : k;
    const opt = kind === 'land' ? { min: 0, max, count: 3 } : { min: 1, max: Math.min(max, maxK + 2), count: 3 };
    return { op, kind, start, k, end, max, answer, options: L.makeOptions(rnd, answer, opt) };
  };

  // 算式工坊：看图选算式、填空缺的数、比大小、交换加数
  L.genEquation = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const max = [5, 7, 10, 10][l - 1];
    const modes = l === 1 ? ['picture'] : l === 2 ? ['picture', 'blank'] :
      l === 3 ? ['blank', 'compare', 'picture'] : ['blank', 'compare', 'swap', 'blank'];
    const mode = L.pick(rnd, modes);
    const SY = { add: ' + ', sub: ' - ' };
    if (mode === 'picture') {
      const op = l === 1 ? 'add' : L.pick(rnd, ['add', 'sub']);
      let a, b, c;
      if (op === 'add') { c = L.randInt(rnd, 2, max); a = L.randInt(rnd, 1, c - 1); b = c - a; }
      else { a = L.randInt(rnd, 2, max); b = L.randInt(rnd, 1, a - 1); c = a - b; }
      const eq = (x, o, y, r) => {
        if (r === undefined) r = o === 'add' ? x + y : x - y;
        return r < 0 || y < 1 ? null : x + SY[o] + y + ' = ' + r;
      };
      const answer = eq(a, op, b, c);
      const other = op === 'add' ? 'sub' : 'add';
      const cands = [eq(a, op, b, c + 1), eq(a, op, b, c - 1), eq(a, other, b), eq(a, op, b + 1), eq(a, op, b - 1)]
        .filter((s, i, arr) => s && s !== answer && arr.indexOf(s) === i);
      const wrong = L.shuffle(rnd, cands).slice(0, 2);
      return {
        mode, op, a, b, c, item: L.pick(rnd, L.COUNT_ITEMS), answer, text: answer, full: answer,
        options: L.shuffle(rnd, wrong.concat([answer]))
      };
    }
    if (mode === 'blank') {
      const forms = l === 2 ? ['add_b'] : l === 3 ? ['add_b', 'add_a', 'sub_b'] : ['add_b', 'add_a', 'sub_b', 'sub_a'];
      const form = L.pick(rnd, forms);
      let a, b, c;
      if (form.indexOf('add') === 0) { c = L.randInt(rnd, 2, max); a = L.randInt(rnd, 1, c - 1); b = c - a; }
      else { a = L.randInt(rnd, 2, max); b = L.randInt(rnd, 1, a - 1); c = a - b; }
      let text, answer;
      if (form === 'add_b') { text = a + ' + □ = ' + c; answer = b; }
      else if (form === 'add_a') { text = '□ + ' + b + ' = ' + c; answer = a; }
      else if (form === 'sub_b') { text = a + ' - □ = ' + c; answer = b; }
      else { text = '□ - ' + b + ' = ' + c; answer = a; }
      return {
        mode, form, a, b, c, text, answer, full: text.replace('□', String(answer)),
        options: L.makeOptions(rnd, answer, { min: 1, max, count: 3 })
      };
    }
    if (mode === 'compare') {
      const op = L.pick(rnd, ['add', 'sub']);
      let a, b;
      if (op === 'add') { a = L.randInt(rnd, 1, max - 1); b = L.randInt(rnd, 1, max - a); }
      else { a = L.randInt(rnd, 2, max); b = L.randInt(rnd, 1, a - 1); }
      const val = op === 'add' ? a + b : a - b;
      const n = Math.max(0, val + L.pick(rnd, [-2, -1, 0, 0, 1, 2]));
      const answer = val > n ? '>' : val < n ? '<' : '=';
      return {
        mode, op, a, b, n, val, answer, text: a + SY[op] + b + ' ○ ' + n,
        full: a + SY[op] + b + ' ' + answer + ' ' + n, options: L.shuffle(rnd, ['>', '<', '='])
      };
    }
    // swap：3 + 4 = 4 + □（加法交换）
    let a, b;
    do { a = L.randInt(rnd, 1, 9); b = L.randInt(rnd, 1, 10 - a); } while (a === b);
    return {
      mode: 'swap', a, b, answer: a, text: a + ' + ' + b + ' = ' + b + ' + □',
      full: a + ' + ' + b + ' = ' + b + ' + ' + a, options: L.makeOptions(rnd, a, { min: 1, max: 9, count: 3 })
    };
  };

  /* ---------- 切水果：平均分（公平切分） ----------
   * 水果画在 200 x 200 的格子里，中心 (100,100)。切一刀 = 一条直线；用网格采样算出每一块的面积占比。 */
  L.CUT_SHAPES = {
    circle: { type: 'circle', cx: 100, cy: 100, r: 70 },
    rect: { type: 'rect', x: 30, y: 30, w: 140, h: 140 }
  };
  L.CUT_ITEMS = {
    circle: [{ name: '西瓜', kind: 'melon' }, { name: '披萨', kind: 'pizza' }],
    rect: [{ name: '蛋糕', kind: 'cake' }, { name: '巧克力', kind: 'choc' }]
  };
  L.inShape = function (s, x, y) {
    if (s.type === 'circle') return (x - s.cx) * (x - s.cx) + (y - s.cy) * (y - s.cy) <= s.r * s.r;
    return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
  };
  // 过中心、偏移 offset 的一条长直线（两端都在水果外面）。angle 单位：度
  L.lineAt = function (angle, offset) {
    const a = angle * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const px = 100 + nx * (offset || 0), py = 100 + ny * (offset || 0), K = 130;
    return { x1: px - ux * K, y1: py - uy * K, x2: px + ux * K, y2: py + uy * K };
  };
  // 每一块占整个水果的面积比例（从大到小）；占比不到 1% 的细条忽略
  L.cutAreas = function (shape, lines, step) {
    step = step || 2;
    const bb = shape.type === 'circle'
      ? { x0: shape.cx - shape.r, y0: shape.cy - shape.r, x1: shape.cx + shape.r, y1: shape.cy + shape.r }
      : { x0: shape.x, y0: shape.y, x1: shape.x + shape.w, y1: shape.y + shape.h };
    const counts = {}; let total = 0;
    for (let y = bb.y0 + step * 0.37; y < bb.y1; y += step) {
      for (let x = bb.x0 + step * 0.41; x < bb.x1; x += step) {
        if (!L.inShape(shape, x, y)) continue;
        let key = 0;
        for (let i = 0; i < lines.length; i++) {
          const ln = lines[i];
          if ((ln.x2 - ln.x1) * (y - ln.y1) - (ln.y2 - ln.y1) * (x - ln.x1) > 0) key |= 1 << i;
        }
        counts[key] = (counts[key] || 0) + 1; total++;
      }
    }
    return Object.keys(counts).map(k => counts[k] / total).filter(f => f >= 0.01).sort((a, b) => b - a);
  };
  L.CUT_MIN = { 2: 0.38, 4: 0.19 };     // 理想是 0.5 和 0.25；最小的一块不能比这个小
  // 判断切法：pieces = 2（切一刀）或 4（切两刀）。reason: miss（没切开）/ uneven（切得不一样大）
  L.judgeCut = function (shape, lines, pieces) {
    const f = L.cutAreas(shape, lines);
    if (f.length !== pieces) return { ok: false, reason: 'miss', fractions: f };
    const ok = f[f.length - 1] >= L.CUT_MIN[pieces];
    return { ok, reason: ok ? '' : 'uneven', fractions: f };
  };
  // 点 (x,y) 是否在线段上穿过了水果：两端都在水果外面，且线段确实穿过水果
  L.knifeCrossesShape = function (shape, p0, p1) {
    if (L.inShape(shape, p0[0], p0[1]) || L.inShape(shape, p1[0], p1[1])) return false;
    const n = 40;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (L.inShape(shape, p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t)) return true;
    }
    return false;
  };
  // L1：选一选哪个切得一样大；L2：沿虚线切两半；L3：自己切两半；L4：切两刀分成四份
  L.genFruit = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    const shapeKey = l === 2 ? 'circle' : L.pick(rnd, ['circle', 'rect']);
    const shape = L.CUT_SHAPES[shapeKey], item = L.pick(rnd, L.CUT_ITEMS[shapeKey]);
    if (l === 1) {
      const angles = L.shuffle(rnd, [0, 45, 90, 135]).slice(0, 3);
      const answerIndex = L.randInt(rnd, 0, 2);
      const lines = angles.map((a, i) => L.lineAt(a, i === answerIndex ? 0 : L.pick(rnd, [-1, 1]) * L.randInt(rnd, 30, 46)));
      return { mode: 'choose', pieces: 2, guide: false, shapeKey, shape, item, lines, answerIndex, options: [0, 1, 2] };
    }
    const a0 = L.pick(rnd, [0, 45, 90, 135]);
    const ideal = l === 4 ? [L.lineAt(a0 % 90, 0), L.lineAt(a0 % 90 + 90, 0)] : [L.lineAt(a0, 0)];
    return { mode: 'cut', pieces: l === 4 ? 4 : 2, guide: l === 2, shapeKey, shape, item, ideal };
  };

  // 挑战关：按等级混合各类题目
  L.CHALLENGE_POOLS = [
    ['match', 'merge', 'take'],
    ['match', 'merge', 'take', 'bus', 'split'],
    ['merge', 'take', 'bus', 'split', 'tenframe', 'balance', 'frog', 'equation'],
    ['merge', 'take', 'bus', 'split', 'tenframe', 'balance', 'shop', 'frog', 'equation']
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
  // 三次贝塞尔曲线：从 a 出发（方向 ta）到 b（到达方向 tb），k1/k2 控制弯曲程度；不含起点（接在弧线后面用）
  function bez(a, ta, b, tb, k1, k2, n) {
    const p1 = [a[0] + ta[0] * k1, a[1] + ta[1] * k1], p2 = [b[0] - tb[0] * k2, b[1] - tb[1] * k2], pts = [];
    n = n || 12;
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push([0, 1].map(d => u * u * u * a[d] + 3 * u * u * t * p1[d] + 3 * u * t * t * p2[d] + t * t * t * b[d]));
    }
    return pts;
  }
  // 8：从右上起笔，逆时针绕过上圈、斜着穿过中间到右下，顺时针绕过下圈，再从左下斜着穿回、沿右侧回到起点（一笔写成，中间交叉）
  function eight() {
    const up = arc(50, 38, 24, 24, -40, -230), lo = arc(50, 98, 30, 33, -50, 230);
    const s = up[0], upEnd = up[up.length - 1], loStart = lo[0], loEnd = lo[lo.length - 1];
    const mid = bez(upEnd, [0.77, 0.64], loStart, [0.74, 0.67], 14, 14);
    const back = bez(loEnd, [0.74, -0.67], s, [-0.64, -0.77], 25, 25, 16);
    return up.concat(mid, lo.slice(1), back);
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
    '8': [eight()],
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
  /* 描红难度：
   *  tol    轨道宽度（手指离笔画中线多远算“在轨道里”，单位同 100x140 的字格）
   *  rail   轨道模式：手指走出轨道时墨迹停在原地、出现回位圈，回到圈里才继续写（手把手引导）
   *  minAcc 一笔里至少要有这么多比例的路程走在轨道里，否则这一笔重写
   *  maxStrays （仅非轨道模式）一笔里最多允许走出轨道几次，不让“左右乱晃”过关 */
  L.genTrace = function (level, rnd) {
    rnd = rnd || Math.random; const l = lv(level);
    if (l === 1) return { text: L.pick(rnd, '12345'.split('')), mode: 'guide', bee: true, rail: true, tol: 15, minAcc: 0.5, maxStrays: Infinity };
    if (l === 2) return { text: L.pick(rnd, '0123456789'.split('')), mode: 'guide', bee: false, rail: true, tol: 14, minAcc: 0.6, maxStrays: Infinity };
    if (l === 3) return { text: L.pick(rnd, '0123456789'.split('')), mode: 'dictate', bee: false, rail: false, tol: 13, minAcc: 0.8, maxStrays: 3 };
    return { text: String(L.randInt(rnd, 10, 20)), mode: 'dictate', bee: false, rail: false, tol: 15, minAcc: 0.8, maxStrays: 3 };
  };

  function segDist(p, a, b) {
    const abx = b[0] - a[0], aby = b[1] - a[1], l2 = abx * abx + aby * aby;
    let t = l2 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + aby * t));
  }
  L.distToPath = function (pt, pts) {
    let m = Infinity;
    for (let i = 1; i < pts.length; i++) m = Math.min(m, segDist(pt, pts[i - 1], pts[i]));
    return m;
  };

  /* 描红判定器：按笔画顺序，手指必须“贴着轨道”从起点走到终点。
   *  - 起笔点必须在当前笔画的起点附近；
   *  - 手指与上一个采样点之间会被插值，快速划过、拐弯抛直线（抓近路）都会被查出来；
   *  - 进度只在手指贴着“前方不远处”的轨道时才前进（走偏了就停住，move() 返回 'off'，回到轨道返回 'back'）；
   *  - 抬笔时要求：已走到终点，并且贴着轨道的路程比例 >= minAcc。 */
  L.TraceChecker = class {
    constructor(strokes, opt) {
      const o = Object.assign({ tol: 14, startTol: 22, step: 4, window: 10, rail: false, minAcc: 0.8, maxStrays: Infinity }, opt);
      this.tol = o.tol; this.startTol = o.startTol; this.win = o.window; this.rail = !!o.rail; this.minAcc = o.minAcc;
      this.maxStrays = o.maxStrays;
      this.step = o.step;
      this.dense = strokes.map(s => L.densify(s.pts, o.step));
      this.total = strokes.length;
      this.s = 0; this.report = null;
      this._reset();
    }
    _reset() {
      this.p = 0; this.active = false; this.off = false;
      this.n = 0; this.good = 0; this.strays = 0; this.maxDev = 0; this.last = null;
    }
    get done() { return this.s >= this.total; }
    get strokeIndex() { return this.s; }
    get accuracy() { return this.n ? this.good / this.n : 1; }
    // 最后一个“在轨道上”的位置（走偏时回位圈放在这里）
    get anchor() { const d = this.dense[this.s]; return d ? d[Math.max(0, Math.min(d.length - 1, this.p - 1))] : null; }
    begin(pt) {
      if (this.done) return false;
      const st = this.dense[this.s][0];
      if (Math.hypot(pt[0] - st[0], pt[1] - st[1]) > this.startTol) { this.active = false; return false; }
      this._reset(); this.active = true; this.p = 1; this.last = pt;
      return true;
    }
    _sample(pt) {
      const d = this.dense[this.s];
      let hit = -1, best = Infinity;
      const lo = Math.max(0, this.p - 3), hi = Math.min(d.length, this.p + this.win);
      for (let j = lo; j < hi; j++) {
        const dd = Math.hypot(pt[0] - d[j][0], pt[1] - d[j][1]);
        if (dd <= this.tol && dd < best) { best = dd; hit = j; }
      }
      this.n++;
      if (hit >= 0) {
        this.good++;
        if (hit + 1 > this.p) this.p = hit + 1;
        const was = this.off; this.off = false;
        return was ? 'back' : 'on';
      }
      this.maxDev = Math.max(this.maxDev, L.distToPath(pt, d));
      if (!this.off) { this.off = true; this.strays++; }
      return 'off';
    }
    // 返回当前点的状态：'on' 在轨道上 | 'off' 偏离了 | 'back' 刚刚回到轨道 | 'idle' 没在写
    move(pt) {
      if (!this.active || this.done) return 'idle';
      const a = this.last || pt;
      const dist = Math.hypot(pt[0] - a[0], pt[1] - a[1]);
      const n = Math.max(1, Math.ceil(dist / this.step));
      let r = 'on', sawOff = false;
      for (let k = 1; k <= n; k++) {
        r = this._sample([a[0] + (pt[0] - a[0]) * k / n, a[1] + (pt[1] - a[1]) * k / n]);
        if (r === 'off') sawOff = true;
      }
      this.last = pt;
      if (r !== 'off' && sawOff) r = 'back';
      return r;
    }
    // 返回 'none' | 'retry' | 'stroke' | 'done'；不成功时 this.report.reason 是 'short'（没写完）或 'wobbly'（偏出轨道太多）
    end() {
      if (!this.active) return 'none';
      this.active = false;
      const len = this.dense[this.s].length;
      const reached = this.p >= len - 2, acc = this.accuracy;
      // “偏出轨道”优先于“没写完”：走偏了进度会停住，这时要告诉孩子的是“沿着线”而不是“写完”
      const wobbly = acc < this.minAcc || (!this.rail && (this.strays > this.maxStrays || this.maxDev > this.tol * 2.2));
      const reason = wobbly ? 'wobbly' : (!reached ? 'short' : '');
      this.report = { reached, acc, strays: this.strays, maxDev: this.maxDev, reason };
      if (!this.report.reason) {
        this.s++; this._reset();
        return this.done ? 'done' : 'stroke';
      }
      this._reset();
      return 'retry';
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NG;
})(typeof window !== 'undefined' ? window : globalThis);
