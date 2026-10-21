// 云同步客户端测试：node tests/test_sync.js
// 每个“设备”是一个独立的 vm 上下文（各有自己的 localStorage 和 NG），共用一个内存版的云端（行为和 cloud/worker.mjs 一致）。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const clock = { t: Date.parse('2026-10-21T08:00:00Z') };
const tick = (ms) => { clock.t += ms; };

/* ---------- 内存版云端 ---------- */
function makeCloud() {
  const fams = {};
  const cloud = {
    fams, calls: [], failAll: false, beforePut: null, status: null,
    fetch: async (url, opt) => {
      opt = opt || {};
      const u = new URL(url), method = opt.method || 'GET', p = u.pathname.replace(/\/+$/, '');
      cloud.calls.push(method + ' ' + p);
      const mk = (status, j) => ({ status, ok: status >= 200 && status < 300, json: async () => j });
      if (cloud.failAll) throw new TypeError('network down');
      if (cloud.status) return mk(cloud.status, {});
      if (p === '/api/ping') return mk(200, { ok: true });
      const fam = (opt.headers && opt.headers['X-Family']) || '';
      if (!/^[A-Z0-9]{20,40}$/.test(fam)) return mk(401, { error: 'bad_code' });
      const kids = fams[fam] || (fams[fam] = {});
      if (p === '/api/kids') return mk(200, { kids: Object.keys(kids).map(id => ({ id, rev: kids[id].rev, name: kids[id].name, updated: 0, deleted: !!kids[id].deleted })) });
      if (p === '/api/family' && method === 'DELETE') { delete fams[fam]; return mk(200, { ok: true }); }
      const m = /^\/api\/kid\/([^/]+)$/.exec(p);
      const id = m && m[1];
      if (method === 'GET') { const k = kids[id]; return k ? mk(200, { id, rev: k.rev, name: k.name, deleted: !!k.deleted, data: JSON.parse(k.data) }) : mk(404, {}); }
      if (method === 'PUT') {
        if (cloud.beforePut) { const f = cloud.beforePut; cloud.beforePut = null; f(); }
        const body = JSON.parse(opt.body), k = kids[id];
        if (body.base === 0) { if (!k) { kids[id] = { rev: 1, name: body.name, data: JSON.stringify(body.data) }; return mk(200, { rev: 1 }); } }
        else if (k && k.rev === body.base && !k.deleted) { k.rev++; k.name = body.name; k.data = JSON.stringify(body.data); return mk(200, { rev: k.rev }); }
        return mk(409, { error: 'conflict', rev: k ? k.rev : 0, deleted: !!(k && k.deleted) });
      }
      return mk(405, {});
    }
  };
  return cloud;
}

/* ---------- 一台“设备” ---------- */
const SRC = ['logic.js', 'store.js', 'sync.js'].map(f => fs.readFileSync(path.join(__dirname, '..', 'js', 'core', f), 'utf8'));
function makeDevice(cloud, origin) {
  const mem = {};
  const FakeDate = class extends Date { static now() { return clock.t; } constructor(...a) { if (a.length) super(...a); else super(clock.t); } };
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, setInterval, clearInterval, JSON, Math, Object, Array, Set, Map, Promise, Error, TypeError, String, Number, parseInt,
    Date: FakeDate, TextEncoder, TextDecoder, btoa, atob, Uint8Array, URL, AbortController,
    localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
    fetch: cloud.fetch, crypto: globalThis.crypto,
    location: origin ? { protocol: 'https:', origin, pathname: '/123_game/' } : undefined
  });
  SRC.forEach((s, i) => vm.runInContext(s, ctx, { filename: ['logic', 'store', 'sync'][i] }));
  const NG = ctx.NG;
  return { NG, S: NG.store, Y: NG.sync, L: NG.logic, mem, ctx };
}
const play = (dev, game, n, okFn) => { for (let i = 0; i < n; i++) { tick(1000); dev.S.recordRound(game, { firstTry: okFn ? okFn(i) : true, key: 'k' + (i % 3) }); } };

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}
const CODE = 'ABCDEFGHJKMNPQRSTUVW';

(async () => {
  /* ---------- 合并规则 ---------- */
  await test('合并：随机数据的交换律、幂等、结合律', async () => {
    const dev = makeDevice(makeCloud());
    const { S, Y, L } = dev;
    let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const GAMES = ['count', 'merge', 'take', 'bus', 'trace'], KEYS = ['3+2', '7-4', '写8', '数5'];
    let last = 1000;
    const gen = () => {
      const d = S.normalize({});
      d.name = ['小明', '小红', ''][ri(0, 2)]; d.cfgAt = ri(0, 3) * 10; d.created = 100 + ri(0, 5);
      d.settings.restMin = [10, 15, 20][ri(0, 2)];
      GAMES.forEach(g => {
        if (rnd() < 0.3) return;
        d.levels[g] = ri(1, 4); d.streaks[g] = { streakOk: ri(0, 2), streakBad: ri(0, 1) };
        const wrong = {}; KEYS.forEach(k => { if (rnd() < 0.5) wrong[k] = ri(1, 5); });
        d.stats[g] = { rounds: ri(1, 40), ok: ri(0, 20), last: rnd() < 0.2 ? 5000 : ++last, wrong };
      });
      d.stars = ri(0, 30); d.stickers = L.STICKERS.filter(() => rnd() < 0.2);
      for (let i = 0; i < ri(0, 30); i++) d.log.push({ t: ri(1, 60), g: GAMES[ri(0, 4)], ok: ri(0, 1), k: KEYS[ri(0, 3)], lv: ri(1, 4) });
      d.log.sort((p, q) => p.t - q.t);
      for (let i = 0; i < 5; i++) if (rnd() < 0.6) d.daily['2026-10-' + (10 + i)] = ri(10, 900);
      d.resetAt = rnd() < 0.2 ? ri(1, 2) : 0;
      return d;
    };
    for (let i = 0; i < 400; i++) {
      const a = gen(), b = gen(), c = gen();
      const ab = Y.merge(a, b), ba = Y.merge(b, a);
      assert.strictEqual(Y.sig(ab), Y.sig(ba), '交换律 #' + i);
      assert.strictEqual(Y.sig(Y.merge(a, a)), Y.sig(a), '幂等 #' + i);
      assert.strictEqual(Y.sig(Y.merge(ab, b)), Y.sig(ab), '再并一次不变 #' + i);
      assert.strictEqual(Y.sig(Y.merge(ab, c)), Y.sig(Y.merge(a, Y.merge(b, c))), '结合律 #' + i);
    }
  });

  await test('合并：星星取大、贴纸取并集、各游戏取最近玩的一边、易错点取大', async () => {
    const dev = makeDevice(makeCloud()); const { S, Y } = dev;
    const a = S.normalize({}), b = S.normalize({});
    a.stars = 12; a.stickers = ['🐶', '🐱']; b.stars = 9; b.stickers = ['🐰'];
    a.levels.merge = 3; a.stats.merge = { rounds: 30, ok: 20, last: 500, wrong: { '3+2': 4 } };
    b.levels.merge = 1; b.stats.merge = { rounds: 5, ok: 1, last: 900, wrong: { '3+2': 1, '5+4': 2 } };
    a.levels.take = 2; a.stats.take = { rounds: 8, ok: 8, last: 700, wrong: {} };
    const m = Y.merge(a, b);
    assert.strictEqual(m.stars, 12); assert.strictEqual(m.stickers.length, 3);
    assert.strictEqual(m.levels.merge, 1); assert.strictEqual(m.stats.merge.rounds, 5);   // b 更晚玩过
    assert.strictEqual(JSON.stringify(m.stats.merge.wrong), JSON.stringify({ '3+2': 4, '5+4': 2 }));
    assert.strictEqual(m.levels.take, 2);
  });

  await test('合并：更晚的“清空”整体胜出，旧设备的旧记录不会复活', async () => {
    const dev = makeDevice(makeCloud()); const { S, Y } = dev;
    const old = S.normalize({}); old.name = '小明'; old.stars = 20; old.levels.count = 4; old.stats.count = { rounds: 90, ok: 80, last: 100, wrong: {} };
    const fresh = S.normalize({}); fresh.resetAt = 500; fresh.name = '小明';
    const m = Y.merge(old, fresh);
    assert.strictEqual(m.stars, 0); assert.strictEqual(JSON.stringify(m.levels), '{}');
    assert.strictEqual(Y.sig(Y.merge(fresh, old)), Y.sig(m));
  });

  /* ---------- 邀请链接 ---------- */
  await test('同步码和邀请链接的生成与解析', async () => {
    const dev = makeDevice(makeCloud(), 'https://alexlee-xz.github.io'); const { Y } = dev;
    const code = Y.newCode(); assert(Y.validCode(code), code);
    assert.strictEqual(Y.normCode(Y.fmtCode(code)), code);
    assert.strictEqual(JSON.stringify(Y.parseInput(Y.fmtCode(code).toLowerCase())), JSON.stringify({ url: '', code }));
    assert.strictEqual(Y.parseInput('随便写写'), null);
    assert.strictEqual(Y.parseInput('#s=!!!'), null);
    Y.enable('', code);
    const link = Y.link();
    assert(link.startsWith('https://alexlee-xz.github.io/123_game/#s='), link);
    const p = Y.parseInput('请加入：' + link + ' 谢谢');
    assert.strictEqual(p.code, code); assert.strictEqual(p.url, Y.SYNC_URL);
  });

  /* ---------- 两台设备 ---------- */
  await test('A 开启同步 -> B 用同步码加入 -> 数据一致', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud), B = makeDevice(cloud);
    A.S.setName('小明'); play(A, 'merge', 6); A.S.awardStars(7);
    A.Y.enable('', CODE);
    let r = await A.Y.now(); assert(r.pushed && !r.err, JSON.stringify(r));
    assert.strictEqual(A.Y.state.dirty, 0);

    B.Y.enable('', CODE);
    r = await B.Y.now(); assert(r.pulled && !r.err, JSON.stringify(r));
    assert.strictEqual(B.S.get().name, '小明');
    assert.strictEqual(B.S.getLevel('merge'), A.S.getLevel('merge'));
    assert.strictEqual(B.S.get().stars, 7);
    assert.strictEqual(B.Y.sig(B.S.get()), A.Y.sig(A.S.get()));
    // 拉下来的东西不应让 B 再传回去
    assert.strictEqual(B.Y.state.dirty, 0); assert(!r.pushed);
  });

  await test('两台设备各自离线玩不同游戏，同步后两边完全一致且都不丢', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud), B = makeDevice(cloud);
    A.S.setName('小明'); A.Y.enable('', CODE); await A.Y.now();
    B.Y.enable('', CODE); await B.Y.now();
    cloud.failAll = true;
    play(A, 'count', 5); play(B, 'take', 4); A.S.awardStars(3); B.S.awardStars(6);
    await A.Y.now(); await B.Y.now();
    assert(A.Y.state.err && A.Y.state.dirty, '离线时应有错误提示并保留改动标记');
    cloud.failAll = false;
    await A.Y.now(); await B.Y.now(); await A.Y.now();
    assert.strictEqual(A.Y.sig(A.S.get()), B.Y.sig(B.S.get()));
    const d = A.S.get();
    assert.strictEqual(d.stats.count.rounds, 5); assert.strictEqual(d.stats.take.rounds, 4);
    assert.strictEqual(d.stars, 6); assert.strictEqual(d.log.length, 9);
    assert.strictEqual(A.Y.state.err, ''); assert.strictEqual(A.Y.state.dirty, 0);
  });

  await test('上传时被别的设备抢先（409）：自动拉取、合并后重传，不丢数据', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud), B = makeDevice(cloud);
    A.S.setName('小明'); A.Y.enable('', CODE); await A.Y.now();
    B.Y.enable('', CODE); await B.Y.now();
    play(A, 'merge', 3); play(B, 'bus', 3);
    await B.Y.now();                                  // B 先传
    A.Y.state.dirty = 1;
    cloud.beforePut = () => { /* A 的 PUT 之前，云端已被 B 改过 */ };
    const r = await A.Y.now();
    assert(r.pushed && r.pulled && !r.err, JSON.stringify(r));
    await B.Y.now();
    assert.strictEqual(A.Y.sig(A.S.get()), B.Y.sig(B.S.get()));
    assert(A.S.get().stats.merge && A.S.get().stats.bus);
  });

  await test('拉取到上传之间孩子又答了题：新答的题不会被覆盖掉', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud), B = makeDevice(cloud);
    A.S.setName('小明'); A.Y.enable('', CODE); await A.Y.now();
    B.Y.enable('', CODE); await B.Y.now();
    play(B, 'bus', 2); await B.Y.now();
    A.Y.state.dirty = 1;
    cloud.beforePut = () => { play(A, 'count', 2); };   // A 正在上传时，孩子又答了 2 题
    await A.Y.now();
    await A.Y.now(); await B.Y.now();
    assert.strictEqual(A.S.get().stats.count.rounds, 2);
    assert.strictEqual(A.Y.sig(A.S.get()), B.Y.sig(B.S.get()));
    assert.strictEqual(B.S.get().stats.count.rounds, 2);
  });

  await test('A 清空记录 -> B 同步后跟着清空（不会把旧记录传回来）', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud), B = makeDevice(cloud);
    A.S.setName('小明'); play(A, 'merge', 5); A.Y.enable('', CODE); await A.Y.now();
    B.Y.enable('', CODE); await B.Y.now();
    assert.strictEqual(B.S.get().stats.merge.rounds, 5);
    tick(5000); A.S.reset(); await A.Y.now(); await B.Y.now();
    assert.strictEqual(B.S.get().stats.merge, undefined);
    assert.strictEqual(B.S.hasProfile(), false);
    await B.Y.now(); await A.Y.now();
    assert.strictEqual(A.S.get().stats.merge, undefined);
  });

  await test('错误同步码 -> 401 提示；云端宕机 -> 提示并保留改动', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud);
    A.S.setName('x'); A.Y.enable('', 'SHORT'); A.Y.state.code = 'SHORT';
    assert.strictEqual(A.Y.on(), true);               // 状态里是脏值，请求会被云端拒绝
    const r1 = await A.Y.now(); assert(/同步码不对/.test(r1.err), JSON.stringify(r1));
    A.Y.leave(); A.Y.enable('', CODE); play(A, 'count', 1);
    cloud.status = 503; const r2 = await A.Y.now(); assert(/云端暂时出错/.test(r2.err)); assert.strictEqual(A.Y.state.dirty, 1);
    cloud.status = 413; const r3 = await A.Y.now(); assert(/太大/.test(r3.err));
    cloud.status = null; const r4 = await A.Y.now(); assert(!r4.err); assert.strictEqual(A.Y.state.dirty, 0);
  });

  await test('未开启同步时不发任何网络请求；关闭后不再请求', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud);
    A.S.setName('小明'); play(A, 'count', 3);
    assert.strictEqual(JSON.stringify(await A.Y.now()), '{"skip":true}');
    A.Y.enable('', CODE); await A.Y.now();
    const n = cloud.calls.length; A.Y.leave(); play(A, 'count', 2); await A.Y.now();
    assert.strictEqual(cloud.calls.length, n); assert.strictEqual(A.Y.statusText(), '未开启');
  });

  await test('同步状态重启后仍在（localStorage）；本机数据不依赖云端', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud);
    A.S.setName('小明'); A.Y.enable('', CODE); await A.Y.now();
    const A2 = makeDevice(cloud); Object.keys(A.mem).forEach(k => { A2.mem[k] = A.mem[k]; });
    // 重新加载脚本以模拟刷新页面
    const B = (() => { const d = makeDevice(cloud); Object.assign(d.mem, A.mem); SRC.forEach((s, i) => vm.runInContext(s, d.ctx)); return d; })();
    assert.strictEqual(B.ctx.NG.sync.on(), true);
    assert.strictEqual(B.ctx.NG.sync.state.code, CODE);
    assert.strictEqual(B.ctx.NG.store.get().name, '小明');
  });

  await test('删除云端数据后，再次同步会把本机记录重新传上去', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud);
    A.S.setName('小明'); play(A, 'merge', 3); A.Y.enable('', CODE); await A.Y.now();
    await A.Y.wipeCloud();
    assert.deepStrictEqual(Object.keys(cloud.fams[CODE] || {}), []);
    const r = await A.Y.now(); assert(r.pushed && !r.err, JSON.stringify(r));
    assert.strictEqual(JSON.parse(cloud.fams[CODE].main.data).d.stats.merge.rounds, 3);
  });

  await test('join：用邀请链接/同步码加入；码不对或云端没有记录时失败并自动退出同步', async () => {
    const cloud = makeCloud(), A = makeDevice(cloud, 'https://x.github.io'), B = makeDevice(cloud), C = makeDevice(cloud);
    A.S.setName('小明'); play(A, 'count', 4); A.Y.enable('', CODE); await A.Y.now();
    let r = await B.Y.join(A.Y.link(), { needRemote: true });
    assert(!r.err && B.Y.on() && B.S.hasProfile(), JSON.stringify(r));
    assert.strictEqual(B.S.get().stats.count.rounds, 4);
    r = await C.Y.join('不是同步码'); assert(/不对/.test(r.err)); assert(!C.Y.on());
    r = await C.Y.join('ZZZZZZZZZZZZZZZZZZZZ', { needRemote: true }); assert(/还没有/.test(r.err)); assert(!C.Y.on());
    cloud.failAll = true; r = await C.Y.join(CODE, { needRemote: true }); assert(r.err && !C.Y.on());
  });

  console.log('\n' + passed + ' 项通过' + (process.exitCode ? '，有失败' : ''));
  process.exit(process.exitCode || 0);
})();
