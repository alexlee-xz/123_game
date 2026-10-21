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
    }
  }
});

test('挑战关：每一级都只会选已定义的游戏', () => {
  const ids = ['match', 'merge', 'take', 'bus', 'split', 'tenframe', 'balance', 'shop'];
  for (let level = 1; level <= 4; level++) for (let i = 0; i < 100; i++) assert(ids.includes(L.pickChallenge(level, rnd)));
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
