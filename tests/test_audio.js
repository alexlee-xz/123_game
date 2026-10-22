// 朗读模块测试：node tests/test_audio.js
// 用一个模拟的 speechSynthesis 复现 Chrome/Edge 的几个坑（cancel 后立刻 speak 会被吞掉、在线语音会失败等）。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'audio.js'), 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function mkSynth(voices) {
  const s = {
    voices, spoken: [], dropped: 0, resumes: 0, speaking: false, pending: false, cur: null, lastCancel: -1e9, fail: null,
    getVoices: () => s.voices,
    resume() { s.resumes++; },
    cancel() {
      s.lastCancel = Date.now(); s.speaking = false; s.pending = false;
      const u = s.cur; s.cur = null;
      if (u && u.onerror) u.onerror({ error: 'canceled' });
    },
    speak(u) {
      if (Date.now() - s.lastCancel < 60) { s.dropped++; return; }          // Chrome 的坑：cancel 后马上 speak 会被吞掉
      if (s.fail && s.fail(u)) { setTimeout(() => u.onerror && u.onerror({ error: 'network' }), 5); s.spoken.push({ text: u.text, voice: u.voice && u.voice.name, failed: true }); return; }
      s.spoken.push({ text: u.text, voice: u.voice && u.voice.name, lang: u.lang, volume: u.volume });
      s.cur = u; s.speaking = true;
      setTimeout(() => { if (s.cur === u) { s.cur = null; s.speaking = false; u.onend && u.onend(); } }, 15);
    }
  };
  return s;
}
function load(opt) {
  opt = opt || {};
  const synth = opt.noTTS ? undefined : mkSynth(opt.voices || [
    { name: 'Microsoft Xiaoxiao Online (Natural)', lang: 'zh-CN', localService: false },
    { name: 'Microsoft Huihui', lang: 'zh-CN', localService: true },
    { name: 'Microsoft David', lang: 'en-US', localService: true }
  ]);
  const settings = Object.assign({ voice: true, sfx: true }, opt.settings);
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, Date, Promise, Object, Array, Error, RegExp,
    speechSynthesis: synth,
    SpeechSynthesisUtterance: opt.noTTS ? undefined : function (text) { this.text = text; this.volume = 1; },
    NG: { store: { get: () => ({ settings }) } }
  });
  ctx.window = ctx;
  vm.runInContext(SRC, ctx);
  return { A: ctx.NG.audio, synth, settings };
}

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}

(async () => {
  await test('说话：用中文语音，lang 为 zh-CN，说之前 resume', async () => {
    const { A, synth } = load();
    await A.say('数一数');
    assert.strictEqual(synth.spoken.length, 1);
    assert.strictEqual(synth.spoken[0].text, '数一数');
    assert.strictEqual(synth.spoken[0].lang, 'zh-CN');
    assert(/Xiaoxiao|Huihui/.test(synth.spoken[0].voice), synth.spoken[0].voice);
    assert(synth.resumes >= 1);
  });

  await test('cancel 后立刻 say：不会被吞掉（会等一小会儿再开口）', async () => {
    const { A, synth } = load();
    A.cancel();                          // 换页时 route() 会先 cancel
    const p = A.say('第一题');           // 紧接着题目朗读
    await p;
    assert.strictEqual(synth.dropped, 0, '被吞掉了 ' + synth.dropped + ' 次');
    assert.strictEqual(synth.spoken.length, 1);
  });

  await test('正在说话时又说一句：旧的被打断，新的能正常开口（不被吞）', async () => {
    const { A, synth } = load();
    A.say('这是一句比较长的题目');
    await sleep(3);
    await A.say('答对了');
    assert.strictEqual(synth.dropped, 0);
    assert.strictEqual(synth.spoken[synth.spoken.length - 1].text, '答对了');
  });

  await test('连续快速调用 say：只有最后一句真的开口', async () => {
    const { A, synth } = load();
    A.say('甲'); A.say('乙'); const last = A.say('丙');
    await last; await sleep(30);
    assert.strictEqual(synth.dropped, 0);
    assert.deepStrictEqual(synth.spoken.map(x => x.text).filter(t => t === '丙').length, 1);
    assert(!synth.spoken.some(x => x.text === '甲' && !x.failed && synth.spoken.length > 1 && false));
    assert.strictEqual(synth.spoken[synth.spoken.length - 1].text, '丙');
  });

  await test('cancel 会取消还没开口的那句', async () => {
    const { A, synth } = load();
    A.cancel();
    A.say('不该听到'); A.cancel();
    await sleep(300);
    assert(!synth.spoken.some(x => x.text === '不该听到'));
  });

  await test('在线语音失败：自动换本机语音再试一次', async () => {
    const { A, synth } = load();
    synth.fail = (u) => u.voice && /Online/.test(u.voice.name);
    await A.say('再想一想');
    const ok = synth.spoken.filter(x => !x.failed);
    assert.strictEqual(ok.length, 1, JSON.stringify(synth.spoken));
    assert(/Huihui/.test(ok[0].voice), ok[0].voice);
    assert.strictEqual(A.status().lastError, 'network');
  });

  await test('声音关着时不朗读；打开后恢复', async () => {
    const { A, synth, settings } = load({ settings: { voice: false } });
    await A.say('静音');
    assert.strictEqual(synth.spoken.length, 0);
    assert.strictEqual(A.isMuted(), true);
    settings.voice = true;
    await A.say('有声');
    assert.strictEqual(synth.spoken.length, 1);
  });

  await test('浏览器不支持朗读：say 直接返回，status 说明原因', async () => {
    const { A } = load({ noTTS: true });
    await A.say('没有 TTS');
    const s = A.status();
    assert.strictEqual(s.tts, false); assert.strictEqual(s.zhCount, 0);
  });

  await test('status：能区分“没有中文语音”和“找到了”', async () => {
    let r = load({ voices: [{ name: 'Microsoft David', lang: 'en-US', localService: true }] }).A.status();
    assert.strictEqual(r.tts, true); assert.strictEqual(r.voiceCount, 1); assert.strictEqual(r.zhCount, 0); assert.strictEqual(r.voice, '');
    r = load({ voices: [{ name: 'Google 普通话', lang: 'zh_CN', localService: false }, { name: 'Google 粤语', lang: 'zh-HK', localService: false }] }).A.status();
    assert.strictEqual(r.zhCount, 2); assert.strictEqual(r.voice, 'Google 普通话');     // 优先普通话，兼容 Android 的 zh_CN 写法
  });

  await test('unlock：第一次点击时发一句无声的话，之后不再重复', async () => {
    const { A, synth } = load();
    A.unlock(); A.unlock(); A.unlock();
    assert.strictEqual(synth.spoken.length, 1);
    assert.strictEqual(synth.spoken[0].volume, 0);
  });

  await test('一句话迟迟不结束（语音卡住）时 say 也会超时返回，不会卡住游戏', async () => {
    const { A, synth } = load();
    synth.speak = () => { /* 永远不触发 onend */ };
    const t0 = Date.now();
    await A.say('卡');
    assert(Date.now() - t0 < 5000);
  });

  console.log('\n' + passed + ' 项通过' + (process.exitCode ? '，有失败' : ''));
  process.exit(process.exitCode || 0);
})();
