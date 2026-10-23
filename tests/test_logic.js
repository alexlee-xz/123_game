// 纯逻辑单元测试：node tests/test_logic.js
'use strict';
const assert = require('assert');

// 给 store 提供一个内存版 localStorage
const mem = {};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } }
});
const NG = require('../js/core/logic.js');
require('../js/core/store.js');
const L = NG.logic;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}
const rnd = L.mulberry32(12345);
const distinct = (a) => new Set(a).size === a.length;

test('数字读法', () => {
  assert.strictEqual(L.numZh(0), '零'); assert.strictEqual(L.numZh(10), '十');
  assert.strictEqual(L.numZh(13), '十三'); assert.strictEqual(L.numZh(20), '二十');
  assert.strictEqual(L.qtyZh(2), '两'); assert.strictEqual(L.qtyZh(3), '三');
});

test('makeOptions：含答案、互不相同、在范围内', () => {
  for (let i = 0; i < 2000; i++) {
    const min = L.randInt(rnd, 0, 2), max = L.randInt(rnd, min + 3, 12), ans = L.randInt(rnd, min, max);
    const o = L.makeOptions(rnd, ans, { min, max, count: 3 });
    assert.strictEqual(o.length, 3);
    assert(o.includes(ans) && distinct(o));
    o.forEach(v => assert(v >= min && v <= max));
  }
  // 范围太小时不会死循环，也不会重复
  const small = L.makeOptions(rnd, 1, { min: 1, max: 2, count: 3 });
  assert(small.includes(1) && distinct(small));
});

test('自适应难度：连对 3 升级，连错 2 降级，不越界', () => {
  let s = { level: 1, streakOk: 0, streakBad: 0 };
  s = L.adapt(s, true); s = L.adapt(s, true);
  assert.strictEqual(s.level, 1);
  s = L.adapt(s, true);
  assert.strictEqual(s.level, 2); assert.strictEqual(s.changed, 'up');
  s = L.adapt(s, false); assert.strictEqual(s.level, 2);
  s = L.adapt(s, true); assert.strictEqual(s.streakBad, 0);   // 中间答对会打断连错
  s = L.adapt(s, false); s = L.adapt(s, false);
  assert.strictEqual(s.level, 1); assert.strictEqual(s.changed, 'down');
  s = L.adapt(s, false); s = L.adapt(s, false);
  assert.strictEqual(s.level, 1);                              // 不会低于 1
  let t = { level: 4, streakOk: 0, streakBad: 0 };
  for (let i = 0; i < 6; i++) t = L.adapt(t, true);
  assert.strictEqual(t.level, 4);                              // 不会高于 4
});

test('出题器不变量（每级 400 次）', () => {
  for (let level = 1; level <= 4; level++) {
    for (let i = 0; i < 400; i++) {
      let q = L.genCount(level, rnd);
      assert(q.n >= 1 && q.n <= [3, 5, 8, 10][level - 1] && q.options.includes(q.n) && distinct(q.options));

      q = L.genSubitize(level, rnd);
      assert(q.n >= 1 && q.options.includes(q.n) && distinct(q.options));

      q = L.genMatch(level, rnd);
      assert(q.from !== q.to && q.options.includes(q.n) && distinct(q.options));
      if (level <= 2) assert(q.n <= 5);

      q = L.genAdd(level, rnd);
      assert(q.a >= 1 && q.b >= 1 && q.a + q.b === q.sum && q.sum <= [5, 7, 10, 10][level - 1]);
      assert(q.options.includes(q.answer) && distinct(q.options));
      assert(q.kind === 'add' || level === 4);
      assert.strictEqual(q.answer, q.kind === 'add' ? q.sum : q.b);

      q = L.genTake(level, rnd);
      assert(q.k >= 1 && q.k <= q.n && q.n - q.k === q.answer && q.n <= [5, 7, 10, 10][level - 1]);
      assert(q.answer >= (level === 4 ? 0 : 1) && q.options.includes(q.answer) && distinct(q.options));

      q = L.genBus(level, rnd);
      assert(q.op === 'add' || q.op === 'sub');
      if (q.op === 'add') assert.strictEqual(q.n + q.k, q.answer); else assert(q.n - q.k === q.answer && q.answer >= 1);
      assert(q.n >= 1 && q.k >= 1 && q.answer <= 10 && q.options.includes(q.answer) && distinct(q.options));
      if (level === 1) assert.strictEqual(q.op, 'add');
      if (level === 2) assert.strictEqual(q.op, 'sub');

      q = L.genSplit(level, rnd);
      if (level <= 3) {
        assert.strictEqual(q.mode, 'missing');
        assert(q.a >= 1 && q.a + q.answer === q.N && q.options.includes(q.answer) && distinct(q.options));
      } else {
        assert.strictEqual(q.mode, 'pairs');
        assert.strictEqual(q.cards.length, 3);
        q.cards.forEach((c, idx) => {
          assert(c[0] >= 1 && c[1] >= 1);
          assert.strictEqual(c[0] + c[1] === q.N, idx === q.answerIndex);   // 只有一张卡是对的
        });
        assert(distinct(q.cards.map(c => c.slice().sort().join('+'))));
      }

      q = L.genTen(level, rnd);
      if (q.mode === 'teen') assert(q.n >= 11 && q.n <= 19 && q.answer === q.n - 10);
      else assert(q.k >= 1 && q.k <= 9 && q.answer === 10 - q.k);
      assert(q.options.includes(q.answer) && distinct(q.options));

      q = L.genBalance(level, rnd);
      assert(q.left.reduce((a, b) => a + b, 0) === q.total && q.need === q.total - q.right && q.need >= 1 && q.right >= 1);
      assert.strictEqual(q.left.length, level === 4 ? 2 : 1);

      q = L.genShop(level, rnd);
      assert(q.price >= 1 && q.price <= 10);
      if (q.mode === 'pay') assert.strictEqual(q.answer, q.price);
      else { assert(q.paid > q.price && q.answer === q.paid - q.price && q.options.includes(q.answer) && distinct(q.options)); }

      q = L.genTrace(level, rnd);
      assert(/^\d+$/.test(q.text) && q.text.split('').every(ch => L.digitStrokes(ch)));
      assert.strictEqual(q.mode, level <= 2 ? 'guide' : 'dictate');

      q = L.genFrog(level, rnd);
      assert(q.start >= 0 && q.end >= 0 && q.start <= q.max && q.end <= q.max && q.k >= 1);
      assert.strictEqual(q.end, q.op === 'add' ? q.start + q.k : q.start - q.k);
      assert.strictEqual(q.answer, q.kind === 'land' ? q.end : q.k);
      assert(q.options.includes(q.answer) && distinct(q.options));
      assert.strictEqual(q.max, [5, 10, 10, 20][level - 1]);
      if (level === 1) assert.strictEqual(q.op, 'add');
      if (level === 2) assert.strictEqual(q.op, 'sub');
      if (level < 4) assert.strictEqual(q.kind, 'land');

      q = L.genEquation(level, rnd);
      assert(q.options.length === 3 && q.options.includes(q.answer) && distinct(q.options));
      assert(q.text.length > 0 && q.full.length > 0);
      if (level === 1) assert.strictEqual(q.mode, 'picture');
      if (q.mode === 'picture') {
        assert.strictEqual(q.answer, q.a + (q.op === 'add' ? ' + ' : ' - ') + q.b + ' = ' + q.c);
        assert.strictEqual(q.op === 'add' ? q.a + q.b : q.a - q.b, q.c);
        assert(q.c >= 1 && q.a <= [5, 7, 10, 10][level - 1]);
        // 选项都不相同；错的选项不能恰好是同一个算式
        q.options.forEach(s => assert(/^\d+ [+-] \d+ = \d+$/.test(s)));
      } else if (q.mode === 'blank') {
        assert(/□/.test(q.text) && !/□/.test(q.full));
        const m = q.full.match(/^(\d+) ([+-]) (\d+) = (\d+)$/);
        assert(m, q.full);
        assert.strictEqual(m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3], +m[4]);
        assert(q.answer >= 1 && q.answer <= [5, 7, 10, 10][level - 1]);
      } else if (q.mode === 'compare') {
        assert(level >= 3);
        assert.strictEqual(q.answer, q.val > q.n ? '>' : q.val < q.n ? '<' : '=');
        assert.deepStrictEqual(q.options.slice().sort(), ['<', '=', '>']);
      } else {
        assert.strictEqual(q.mode, 'swap');
        assert(level === 4 && q.a !== q.b && q.a + q.b <= 10);
      }

      q = L.genFruit(level, rnd);
      if (level === 1) {
        assert.strictEqual(q.mode, 'choose');
        assert.strictEqual(q.lines.length, 3);
        const mins = q.lines.map(ln => L.cutAreas(q.shape, [ln])).map(f => f[f.length - 1]);
        mins.forEach((m, i) => { if (i === q.answerIndex) assert(m > 0.47, '公平的那个应该是一半一半 ' + m); else assert(m < 0.36, '不公平的要明显不一样大 ' + m); });
      } else {
        assert.strictEqual(q.mode, 'cut');
        assert.strictEqual(q.pieces, level === 4 ? 4 : 2);
        assert.strictEqual(q.guide, level === 2);
        assert.strictEqual(q.ideal.length, q.pieces === 4 ? 2 : 1);
        assert(L.judgeCut(q.shape, q.ideal, q.pieces).ok);
      }
    }
  }
});

test('挑战关：每一级都只会选已定义的游戏', () => {
  const ids = ['match', 'merge', 'take', 'bus', 'split', 'tenframe', 'balance', 'shop', 'frog', 'equation'];
  for (let level = 1; level <= 4; level++) for (let i = 0; i < 100; i++) assert(ids.includes(L.pickChallenge(level, rnd)));
});

test('切水果：面积占比（圆、方形，切一刀、切两刀）', () => {
  [L.CUT_SHAPES.circle, L.CUT_SHAPES.rect].forEach(shape => {
    [0, 30, 45, 90, 135].forEach(a => {
      const f = L.cutAreas(shape, [L.lineAt(a, 0)]);
      assert.strictEqual(f.length, 2);
      assert(Math.abs(f[0] - 0.5) < 0.02 && Math.abs(f[1] - 0.5) < 0.02, shape.type + ' ' + a + ' ' + f);
      assert(Math.abs(f[0] + f[1] - 1) < 1e-9);
    });
    [0, 45].forEach(a => {
      const f = L.cutAreas(shape, [L.lineAt(a, 0), L.lineAt(a + 90, 0)]);
      assert.strictEqual(f.length, 4);
      f.forEach(x => assert(Math.abs(x - 0.25) < 0.02, shape.type + ' ' + f));
    });
    assert.strictEqual(L.cutAreas(shape, [L.lineAt(0, 200)]).length, 1);            // 完全没碰到水果
  });
  // 圆形偏移 d 的小块面积有公式可对照：r^2 (acos(d/r) - (d/r) sqrt(1-(d/r)^2)) / (pi r^2)
  const c = L.CUT_SHAPES.circle;
  [10, 30, 50].forEach(d => {
    const t = d / c.r, want = (Math.acos(t) - t * Math.sqrt(1 - t * t)) / Math.PI;
    const f = L.cutAreas(c, [L.lineAt(0, d)]);
    assert(Math.abs(f[1] - want) < 0.01, d + ' ' + f[1] + ' vs ' + want);
  });
});

test('切水果：判定（小偏差算对，明显偏了不算，没切开不算）', () => {
  [L.CUT_SHAPES.circle, L.CUT_SHAPES.rect].forEach(shape => {
    [0, 45, 90, 135].forEach(a => {
      [-6, 0, 6].forEach(d => assert(L.judgeCut(shape, [L.lineAt(a, d)], 2).ok, shape.type + ' ' + a + ' ' + d));
      [-30, 30, 45].forEach(d => {
        const j = L.judgeCut(shape, [L.lineAt(a, d)], 2);
        assert(!j.ok && j.reason === 'uneven', shape.type + ' ' + a + ' ' + d);
      });
    });
    assert(L.judgeCut(shape, [L.lineAt(0, 200)], 2).reason === 'miss');
    // 两刀：十字对齐算对；一刀只能分两块；十字中心偏 30 或夹角不是直角都不算
    assert(L.judgeCut(shape, [L.lineAt(0, 5), L.lineAt(90, -5)], 4).ok);
    assert.strictEqual(L.judgeCut(shape, [L.lineAt(0, 0)], 4).reason, 'miss');
    assert.strictEqual(L.judgeCut(shape, [L.lineAt(0, 30), L.lineAt(90, 30)], 4).reason, 'uneven');
    assert.strictEqual(L.judgeCut(shape, [L.lineAt(0, 0), L.lineAt(60, 0)], 4).reason, 'uneven');
    assert.strictEqual(L.judgeCut(shape, [L.lineAt(0, 0), L.lineAt(0, 20)], 4).reason, 'miss');   // 两刀平行只有 3 块
  });
});

test('切水果：刀要从水果外面划过去（两端在外面且穿过）', () => {
  const c = L.CUT_SHAPES.circle;
  assert(L.knifeCrossesShape(c, [100, -20], [100, 220]));
  assert(!L.knifeCrossesShape(c, [100, 100], [100, 220]));       // 起点在里面
  assert(!L.knifeCrossesShape(c, [-20, 0], [-20, 200]));         // 完全在水果外面
  assert(!L.knifeCrossesShape(c, [20, 20], [30, 30]));           // 在外面的短线
});

test('硬币：1~10 元都能凑，且用最少枚数', () => {
  for (let t = 1; t <= 10; t++) {
    const c = L.minCoins(t);
    assert(c && c.reduce((a, b) => a + b, 0) === t);
    let g = t, greedy = 0; [5, 2, 1].forEach(v => { greedy += Math.floor(g / v); g %= v; });
    assert(c.length <= greedy);
  }
  assert.strictEqual(L.minCoins(9).length, 3);
});

/* ---------- 描红 ---------- */
function trace(checker, strokes, opt) {
  opt = opt || {};
  const noise = opt.noise || 0, r = L.mulberry32(opt.seed || 7);
  let last = null;
  strokes.forEach(s => {
    const d = L.densify(s.pts, opt.step || 5);
    const jit = p => [p[0] + (r() * 2 - 1) * noise, p[1] + (r() * 2 - 1) * noise];
    assert(checker.begin(jit(d[0])), '起笔点应被接受 ' + s.ch);
    for (let i = 1; i < d.length; i++) checker.move(jit(d[i]));
    last = checker.end();
  });
  return last;
}
const allTexts = '0123456789'.split('').concat(['10', '11', '12', '15', '20']);

test('描红：8 是一笔写成的“8”——上圈、下圈，中间交叉一次，回到起点；不是两个圆叠在一起', () => {
  const st = L.digitStrokes('8');
  assert.strictEqual(st.length, 1);
  const p = L.densify(st[0], 2);
  // 起点和终点重合（封闭）
  assert(Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 4);
  // 自交叉恰好 1 次
  const cross = (a, b, c, d) => {
    const o = (p1, p2, p3) => (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  let x = 0;
  for (let i = 1; i < p.length; i++) for (let j = i + 2; j < p.length; j++) {
    if (i === 1 && j >= p.length - 1) continue;      // 首尾相接处不算交叉
    if (cross(p[i - 1], p[i], p[j - 1], p[j])) x++;
  }
  assert.strictEqual(x, 1, '交叉次数 ' + x);
  // 上圈比下圈小，整体在格子里，宽不超过 70、高占满
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  assert(Math.min(...xs) > 8 && Math.max(...xs) < 92 && Math.min(...ys) < 18 && Math.max(...ys) > 126 && Math.min(...ys) >= 0 && Math.max(...ys) <= 140);
  const widthAt = (y) => { const v = p.filter(q => Math.abs(q[1] - y) < 3).map(q => q[0]); return Math.max(...v) - Math.min(...v); };
  assert(widthAt(38) < widthAt(98), '上圈应比下圈窄');
  // 起笔在右上；先向左绕过上圈顶部（逆时针）
  assert(p[0][0] > 55 && p[0][1] < 35);
  const topIdx = p.findIndex(q => q[1] < 17);
  assert(topIdx > 0 && p[topIdx][0] < p[0][0] + 1);
  // 两个圆叠在一起（旧的画法）的路线不能通过 8 的判定
  const c8 = new L.TraceChecker(L.layoutText('8').strokes, { tol: 14, minAcc: 0.8 });
  const circles = L.densify([].concat(...[0, 1].map(k => {
    const cy = k ? 98 : 38, rx = k ? 30 : 24, ry = k ? 33 : 24, o = [];
    for (let a = -90; a <= 270; a += 15) o.push([50 + rx * Math.cos(a * Math.PI / 180), cy + ry * Math.sin(a * Math.PI / 180)]);
    return o;
  })), 3);
  if (c8.begin(circles[0])) { circles.forEach(q => c8.move(q)); assert.notStrictEqual(c8.end(), 'done'); }
});

test('描红：标准笔顺描写每个数字都能完成', () => {
  allTexts.forEach(t => {
    const lay = L.layoutText(t);
    const c = new L.TraceChecker(lay.strokes, { tol: 18 });
    assert.strictEqual(trace(c, lay.strokes), 'done', '数字 ' + t);
  });
});

test('描红：有抖动（±6）和较快的手速（间隔 20）也能完成', () => {
  allTexts.forEach(t => {
    const lay = L.layoutText(t);
    assert.strictEqual(trace(new L.TraceChecker(lay.strokes, { tol: 18 }), lay.strokes, { noise: 6 }), 'done', '抖动 ' + t);
    assert.strictEqual(trace(new L.TraceChecker(lay.strokes, { tol: 18 }), lay.strokes, { step: 20 }), 'done', '快速 ' + t);
  });
});

test('描红：起笔点不对、方向反了、抬笔太早、抄近路都不算', () => {
  '0123456789'.split('').forEach(ch => {
    const lay = L.layoutText(ch);
    const s0 = lay.strokes[0];
    // 从别处起笔
    let c = new L.TraceChecker(lay.strokes, { tol: 18 });
    assert.strictEqual(c.begin([300, 300]), false);
    // 方向反了（从第一笔的终点开始）：对起点和终点相距较远的笔画必须被拒绝
    const end = s0.pts[s0.pts.length - 1], st = s0.pts[0];
    if (Math.hypot(end[0] - st[0], end[1] - st[1]) > 60) {
      c = new L.TraceChecker(lay.strokes, { tol: 18 });
      assert.strictEqual(c.begin(end), false, ch + ' 反向');
    }
    // 只写了一半就抬笔
    c = new L.TraceChecker(lay.strokes, { tol: 18 });
    const d = L.densify(s0.pts, 5);
    assert(c.begin(d[0]));
    for (let i = 1; i < Math.floor(d.length / 2); i++) c.move(d[i]);
    assert.strictEqual(c.end(), 'retry', ch + ' 半途抬笔');
    // 重来后仍可以从头写
    assert.strictEqual(trace(c, lay.strokes), 'done', ch + ' 重来');
  });
  // 弯曲的数字：起点到终点画一条直线不算
  '0235689'.split('').forEach(ch => {
    const lay = L.layoutText(ch), s0 = lay.strokes[0];
    const c = new L.TraceChecker(lay.strokes, { tol: 18 });
    const a = s0.pts[0], b = s0.pts[s0.pts.length - 1];
    assert(c.begin(a));
    for (let i = 1; i <= 40; i++) c.move([a[0] + (b[0] - a[0]) * i / 40, a[1] + (b[1] - a[1]) * i / 40]);
    assert.notStrictEqual(c.end(), 'done', ch + ' 直线');
    assert.notStrictEqual(c.end(), 'stroke');
  });
});

test('描红：多笔画必须按顺序（4 先斜折后竖）', () => {
  const lay = L.layoutText('4');
  const c = new L.TraceChecker(lay.strokes, { tol: 18 });
  assert.strictEqual(c.begin(lay.strokes[1].pts[0]), false);    // 想先写竖
  assert.strictEqual(trace(c, lay.strokes), 'done');
});

/* ----- 描红：“写得很偏”不能通过；轨道模式会把人引回轨道 ----- */
// 沿着笔画走一遍。side：沿法线方向偏离轨道多少（正负表示两侧，起笔点保持在起点）；amp/wave：蛇形摆动；返回 end() 的结果
function walkStroke(checker, s, o) {
  o = o || {};
  const d = L.densify(s.pts, o.step || 4), shift = o.shift || [0, 0], amp = o.amp || 0, wave = o.wave || 40, side = o.side || 0;
  assert(checker.begin(d[0]), '起笔点应被接受');
  const states = [];
  for (let i = 1; i < d.length; i++) {
    const a = d[i - 1], b = d[i], nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1;
    const w = side + amp * Math.sin(i * (o.step || 4) / wave * Math.PI * 2);
    states.push(checker.move([b[0] + shift[0] + nx / nl * w, b[1] + shift[1] + ny / nl * w]));
  }
  return { end: checker.end(), states };
}
const LEVEL_OPTS = [1, 2, 3, 4].map(l => { const q = L.genTrace(l, L.mulberry32(5)); return { tol: q.tol, rail: q.rail, minAcc: q.minAcc, maxStrays: q.maxStrays }; });

test('描红：每一级的标准参数下，标准笔顺、抖动 ±6、快速描写都能完成', () => {
  LEVEL_OPTS.forEach((opt, li) => allTexts.forEach(t => {
    const lay = L.layoutText(t);
    assert.strictEqual(trace(new L.TraceChecker(lay.strokes, opt), lay.strokes), 'done', 'L' + (li + 1) + ' ' + t);
    assert.strictEqual(trace(new L.TraceChecker(lay.strokes, opt), lay.strokes, { noise: 6 }), 'done', 'L' + (li + 1) + ' 抖动 ' + t);
    assert.strictEqual(trace(new L.TraceChecker(lay.strokes, opt), lay.strokes, { step: 20 }), 'done', 'L' + (li + 1) + ' 快速 ' + t);
  }));
});

test('描红：整条路径偏离轨道 20 个单位（约字高的 1/7）不算写对，偏 6 个单位仍然算', () => {
  LEVEL_OPTS.forEach((opt, li) => '0123456789'.split('').forEach(ch => {
    const lay = L.layoutText(ch);
    [20, -20, 24, -24].forEach(side => {
      const c = new L.TraceChecker(lay.strokes, opt);
      const r = walkStroke(c, lay.strokes[0], { side });
      assert.strictEqual(r.end, 'retry', 'L' + (li + 1) + ' ' + ch + ' 偏移 ' + side);
      assert.strictEqual(c.report.reason, 'wobbly');
    });
    [6, -6].forEach(side => {
      const c2 = new L.TraceChecker(lay.strokes, opt);
      assert.notStrictEqual(walkStroke(c2, lay.strokes[0], { side }).end, 'retry', 'L' + (li + 1) + ' ' + ch + ' 偏 ' + side + ' 应通过');
    });
  }));
});

test('描红：蛇形乱晃（幅度 18）不算，轻微晃动（幅度 5）算', () => {
  [2, 3].forEach(li => '0123456789'.split('').forEach(ch => {
    const lay = L.layoutText(ch), opt = LEVEL_OPTS[li];
    assert.strictEqual(walkStroke(new L.TraceChecker(lay.strokes, opt), lay.strokes[0], { amp: 18, wave: 30 }).end, 'retry', 'L' + (li + 1) + ' ' + ch + ' 乱晃');
    assert.notStrictEqual(walkStroke(new L.TraceChecker(lay.strokes, opt), lay.strokes[0], { amp: 5, wave: 30 }).end, 'retry', 'L' + (li + 1) + ' ' + ch + ' 轻晃');
  }));
});

test('描红：采样稀疏时抄近路（直线穿过弯曲的中间）不算', () => {
  '0689'.split('').forEach(ch => {
    const lay = L.layoutText(ch), s = lay.strokes[0], d = L.densify(s.pts, 4);
    [2, 3].forEach(li => {
      const c = new L.TraceChecker(lay.strokes, LEVEL_OPTS[li]);
      assert(c.begin(d[0]));
      for (let i = 1; i < Math.floor(d.length * 0.25); i++) c.move(d[i]);
      c.move(d[Math.floor(d.length * 0.75)]);                  // 一下跳到后面
      for (let i = Math.floor(d.length * 0.75) + 1; i < d.length; i++) c.move(d[i]);
      assert.strictEqual(c.end(), 'retry', 'L' + (li + 1) + ' ' + ch + ' 跳过中间');
    });
  });
});

test('描红：不成功时说明原因（没写完 / 偏出轨道）', () => {
  const lay = L.layoutText('2');
  let c = new L.TraceChecker(lay.strokes, LEVEL_OPTS[2]);
  const d = L.densify(lay.strokes[0].pts, 4);
  c.begin(d[0]); for (let i = 1; i < d.length / 2; i++) c.move(d[i]);
  assert.strictEqual(c.end(), 'retry'); assert.strictEqual(c.report.reason, 'short');       // 贴着轨道但抬笔太早
  c = new L.TraceChecker(lay.strokes, LEVEL_OPTS[2]);
  assert.strictEqual(walkStroke(c, lay.strokes[0], { side: 22 }).end, 'retry'); assert.strictEqual(c.report.reason, 'wobbly');
});

test('描红·轨道模式：走出轨道时进度停住并返回 off，回到轨道返回 back，回位圈放在最后一个在轨道上的位置', () => {
  const lay = L.layoutText('7'), s = lay.strokes[0], d = L.densify(s.pts, 4);
  const c = new L.TraceChecker(lay.strokes, LEVEL_OPTS[0]);
  assert(c.begin(d[0]));
  let i = 1;
  for (; i < 20; i++) assert.strictEqual(c.move(d[i]), 'on');
  const pAt = c.p, anchor0 = c.anchor.slice();
  // 走偏 40 个单位，持续 10 个点。刚离开轨道的头几步仍然贴着轨道，进度可以前进一点点；一旦 off，进度就必须停住
  let sawOff = 0, pOff = -1, anchorOff = null;
  for (let k = 0; k < 10; k++) {
    const r = c.move([d[i][0] + 40, d[i][1] + 40]);
    if (r === 'off') { sawOff++; if (pOff < 0) { pOff = c.p; anchorOff = c.anchor.slice(); } }
  }
  assert(sawOff >= 9, '应连续 off');
  assert(pOff >= pAt && pOff - pAt <= 5, '离开轨道时进度不应跳变 ' + pAt + ' -> ' + pOff);
  assert.strictEqual(c.p, pOff, '走偏之后进度不能再前进');
  assert.deepStrictEqual(c.anchor, anchorOff);
  assert(Math.hypot(c.anchor[0] - anchor0[0], c.anchor[1] - anchor0[1]) <= 25);
  assert.strictEqual(c.strays, 1);
  // 回到轨道（在锚点附近）
  assert.strictEqual(c.move(c.anchor), 'back');
  for (let j = c.p; j < d.length; j++) c.move(d[j]);
  assert.strictEqual(c.end(), 'done');      // “7”只有一笔
});

test('描红·轨道模式：走偏后在“前方很远处”回到轨道（抄近路）不算继续', () => {
  const lay = L.layoutText('0'), d = L.densify(lay.strokes[0].pts, 4);
  const c = new L.TraceChecker(lay.strokes, LEVEL_OPTS[0]);
  c.begin(d[0]);
  for (let i = 1; i < 10; i++) c.move(d[i]);
  const p0 = c.p;
  assert.strictEqual(c.move(d[Math.floor(d.length / 2)]), 'off');   // 一下子跳到椭圆另一边
  assert(c.p < p0 + 8 && c.p < d.length / 4, '不能靠跳跃推进进度：' + p0 + ' -> ' + c.p + ' / ' + d.length);
});

test('描红：genTrace 的轨道参数', () => {
  for (let level = 1; level <= 4; level++) {
    const q = L.genTrace(level, L.mulberry32(level));
    assert(q.tol >= 12 && q.tol <= 16, 'tol ' + q.tol);               // 以前是 17~20
    assert.strictEqual(q.rail, level <= 2);
    assert(q.minAcc > 0 && q.minAcc < 1);
  }
});

test('描红：两位数的布局', () => {
  const lay = L.layoutText('10');
  assert.strictEqual(lay.width, 230); assert.strictEqual(lay.strokes.length, 2);
  assert(lay.strokes[1].pts[0][0] >= 130 - 1);
});

/* ---------- 存储 ---------- */
test('存储：升级降级、星星换贴纸、备份导入、休息提醒', () => {
  const S = NG.store;
  S.reset(); S.setName('测试');
  for (let i = 0; i < 3; i++) S.recordRound('merge', { firstTry: true });
  assert.strictEqual(S.getLevel('merge'), 2);
  S.recordRound('merge', { firstTry: false, key: '3+2' }); S.recordRound('merge', { firstTry: false, key: '3+2' });
  assert.strictEqual(S.getLevel('merge'), 1);
  assert.strictEqual(S.stat('merge').wrong['3+2'], 2);
  assert.strictEqual(S.stat('merge').rounds, 5);

  assert.strictEqual(S.awardStars(4).length, 0);
  const got = S.awardStars(1);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(S.get().stickers.length, 1);
  assert.strictEqual(S.starsToNextSticker(), 5);
  assert.strictEqual(S.awardStars(10).length, 2);
  assert(distinct(S.get().stickers));

  const text = S.exportJSON();
  S.reset(); assert.strictEqual(S.get().stars, 0);
  S.importJSON(text);
  assert.strictEqual(S.get().stars, 15); assert.strictEqual(S.get().name, '测试');
  assert.throws(() => S.importJSON('{"a":1}'));

  S.setSetting('restMin', 1);
  assert.strictEqual(S.shouldRest(), false);
  S.addSeconds(61);
  assert.strictEqual(S.shouldRest(), true);
  S.setSetting('restMin', 0);
  assert.strictEqual(S.shouldRest(), false);

  for (let i = 0; i < 600; i++) S.recordRound('count', { firstTry: true });
  assert(S.get().log.length <= 500);
  S.reset();
});

test('贴纸全部收完后不再重复发放', () => {
  const S = NG.store; S.reset();
  S.awardStars(L.STICKERS.length * 5 + 20);
  assert.strictEqual(S.get().stickers.length, L.STICKERS.length);
  assert(distinct(S.get().stickers));
  S.reset();
});

console.log('\n' + passed + ' 项通过' + (process.exitCode ? '，有失败' : ''));
