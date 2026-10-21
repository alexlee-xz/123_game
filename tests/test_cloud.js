// 对已部署的云端做端到端检查：node tests/test_cloud.js [云服务地址]
// 用一个随机同步码，测完调用 DELETE /api/family 清掉自己写的数据。
'use strict';
const assert = require('assert');
const URL_ = (process.argv[2] || 'https://123-sync.alexlee10100110.workers.dev').replace(/\/+$/, '');
const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = Array.from({ length: 20 }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
const other = Array.from({ length: 20 }, () => CH[Math.floor(Math.random() * CH.length)]).join('');

async function api(method, path, body, fam) {
  const h = { 'X-Family': fam || code };
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(URL_ + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) { /* ignore */ }
  return { s: r.status, j };
}
let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.message || e)); process.exitCode = 1; }
}

(async () => {
  await test('ping（不需要同步码）', async () => {
    const r = await fetch(URL_ + '/api/ping'); const j = await r.json();
    assert.strictEqual(r.status, 200); assert.strictEqual(j.ok, true); assert.strictEqual(j.app, '123-sync');
  });
  await test('同步码格式不对 -> 401', async () => {
    assert.strictEqual((await api('GET', '/api/kids', null, 'SHORT')).s, 401);
  });
  await test('新家庭：列表为空；读不存在的记录 -> 404', async () => {
    const r = await api('GET', '/api/kids'); assert.strictEqual(r.s, 200); assert.deepStrictEqual(r.j.kids, []);
    assert.strictEqual((await api('GET', '/api/kid/main')).s, 404);
  });
  await test('新建（base=0）-> rev 1；重复新建 -> 409', async () => {
    const a = await api('PUT', '/api/kid/main', { base: 0, name: '小明', data: { v: 1, d: { n: 1 } } });
    assert.strictEqual(a.s, 200); assert.strictEqual(a.j.rev, 1);
    const b = await api('PUT', '/api/kid/main', { base: 0, name: '小明', data: { v: 1, d: { n: 2 } } });
    assert.strictEqual(b.s, 409); assert.strictEqual(b.j.rev, 1);
  });
  await test('乐观锁：版本对 -> rev 2；版本过期 -> 409 且数据不被覆盖', async () => {
    const a = await api('PUT', '/api/kid/main', { base: 1, name: '小明', data: { v: 1, d: { n: 3 } } });
    assert.strictEqual(a.s, 200); assert.strictEqual(a.j.rev, 2);
    const b = await api('PUT', '/api/kid/main', { base: 1, name: 'X', data: { v: 1, d: { n: 99 } } });
    assert.strictEqual(b.s, 409); assert.strictEqual(b.j.rev, 2);
    const g = await api('GET', '/api/kid/main');
    assert.strictEqual(g.j.rev, 2); assert.strictEqual(g.j.data.d.n, 3); assert.strictEqual(g.j.name, '小明');
  });
  await test('列表里能看到这条记录', async () => {
    const r = await api('GET', '/api/kids');
    assert.strictEqual(r.j.kids.length, 1); assert.strictEqual(r.j.kids[0].id, 'main'); assert.strictEqual(r.j.kids[0].rev, 2);
  });
  await test('不同同步码互相看不到', async () => {
    const r = await api('GET', '/api/kids', null, other); assert.deepStrictEqual(r.j.kids, []);
    assert.strictEqual((await api('GET', '/api/kid/main', null, other)).s, 404);
  });
  await test('坏请求：非法 id / 缺 base / 数据不是对象', async () => {
    assert.strictEqual((await api('GET', '/api/kid/' + encodeURIComponent('a b'))).s, 400);
    assert.strictEqual((await api('PUT', '/api/kid/main', { name: 'x', data: {} })).s, 400);
    assert.strictEqual((await api('PUT', '/api/kid/main', { base: 2, data: [1] })).s, 400);
  });
  await test('中文名字和较大的数据（约 200KB）能存取', async () => {
    const big = { v: 1, d: { log: Array.from({ length: 4000 }, (_, i) => ({ t: i, g: 'merge', ok: i % 2, k: '3+2' })) } };
    const size = JSON.stringify(big).length; assert(size > 150000, 'size ' + size);
    const p = await api('PUT', '/api/kid/main', { base: 2, name: '小红😀', data: big });
    assert.strictEqual(p.s, 200); assert.strictEqual(p.j.rev, 3);
    const g = await api('GET', '/api/kid/main');
    assert.strictEqual(g.j.name, '小红😀'); assert.strictEqual(g.j.data.d.log.length, 4000);
  });
  await test('同时两台设备写同一个版本：只有一个成功', async () => {
    const rs = await Promise.all([1, 2, 3, 4].map(i => api('PUT', '/api/kid/main', { base: 3, name: 'p' + i, data: { v: 1, d: { who: i } } })));
    assert.strictEqual(rs.filter(r => r.s === 200).length, 1, JSON.stringify(rs.map(r => r.s)));
    assert.strictEqual(rs.filter(r => r.s === 409).length, 3);
  });
  await test('删除家庭后数据消失', async () => {
    assert.strictEqual((await api('DELETE', '/api/family')).s, 200);
    assert.deepStrictEqual((await api('GET', '/api/kids')).j.kids, []);
  });
  console.log('\n' + passed + ' 项通过' + (process.exitCode ? '，有失败' : ''));
  await api('DELETE', '/api/family').catch(() => {});
  await api('DELETE', '/api/family', null, other).catch(() => {});
})();
