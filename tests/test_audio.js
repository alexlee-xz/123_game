// 朗读模块测试：node tests/test_audio.js
// 用一个模拟的 speechSynthesis 复现 Chrome/Edge 的几个坑（cancel 后立刻 speak 会被吞掉、在线语音会失败等）。
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'audio.js'), 'utf8');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let blobSeq = 0;

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
    Audio: opt.Audio, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    fetch: opt.fetch, Blob: opt.fetch ? function Blob(parts, o) { this.parts = parts; this.type = o && o.type; } : undefined,
    URL: opt.fetch ? { createObjectURL: (b) => 'blob:mem/' + (++blobSeq), revokeObjectURL() {} } : undefined,
    navigator: { userAgent: opt.ua || 'Mozilla/5.0' },
    NG: { store: { get: () => ({ settings }) } }
  });
  ctx.window = ctx;
  vm.runInContext(SRC, ctx);
  return { A: ctx.NG.audio, NG: ctx.NG, synth, settings };
}

// 模拟 <audio>：behavior(src) 返回 ok / error / blocked / hang
function mkAudio(behavior) {
  const played = [];
  class Au {
    constructor() { this.src = ''; this.duration = 0.02; }
    play() {
      played.push(this.src);
      const b = behavior(this.src);
      if (b === 'blocked') return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
      if (b === 'error') { setTimeout(() => this.onerror && this.onerror(), 5); return Promise.resolve(); }
      if (b === 'hang') return Promise.resolve();
      const me = this.src;
      setTimeout(() => { if (this.src !== me) return; this.onplaying && this.onplaying(); setTimeout(() => this.src === me && this.onended && this.onended(), 10); }, 5);
      return Promise.resolve();
    }
    pause() {} load() {}
  }
  Au.played = played;
  return Au;
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

  await test('mp3：有现成的录音就播录音，不开浏览器朗读（微信里没有朗读也能出声）', async () => {
    for (const noTTS of [false, true]) {
      const Au = mkAudio(() => 'ok');
      const { A, NG, synth } = load({ Audio: Au, noTTS, ua: 'MicroMessenger/8.0' });
      NG.voiceMap = {}; NG.voiceMap[A.vid('三加四等于七')] = 1;
      await A.say('三加四等于七');
      assert.strictEqual(Au.played.length, 1);
      assert(Au.played[0].endsWith('audio/v/' + A.vid('三加四等于七') + '.mp3'), Au.played[0]);
      if (synth) assert.strictEqual(synth.spoken.length, 0);
      const s = A.status();
      assert.strictEqual(s.clips, 1); assert.strictEqual(s.wechat, true); assert.strictEqual(s.player, true);
    }
  });

  await test('mp3：没有录音时，有朗读用朗读；没有朗读（微信）时走在线朗读', async () => {
    let Au = mkAudio(() => 'ok');
    let r = load({ Audio: Au });
    r.NG.voiceMap = {};
    await r.A.say('没录过的话');
    assert.strictEqual(Au.played.length, 0); assert.strictEqual(r.synth.spoken.length, 1);
    Au = mkAudio(() => 'ok');
    r = load({ Audio: Au, noTTS: true });
    await r.A.say('没录过的话');
    assert.strictEqual(Au.played.length, 1);
    assert(/^https:\/\/.*text=/.test(Au.played[0]) && Au.played[0].indexOf(encodeURIComponent('没录过的话')) > 0, Au.played[0]);
  });

  await test('mp3：加载失败先重试一次，再失败或被拦截时回退到朗读', async () => {
    let Au = mkAudio(() => 'error');
    let r = load({ Audio: Au });
    r.NG.voiceMap = {}; r.NG.voiceMap[r.A.vid('坏了')] = 1;
    await r.A.say('坏了');
    assert.strictEqual(Au.played.length, 2); assert(Au.played[1].indexOf('r=') > 0);
    assert.strictEqual(r.synth.spoken.length, 1);
    Au = mkAudio(() => 'blocked');
    r = load({ Audio: Au });
    r.NG.voiceMap = {}; r.NG.voiceMap[r.A.vid('被拦')] = 1;
    await r.A.say('被拦');
    assert.strictEqual(Au.played.length, 1);          // 被拦截重试没有用
    assert.strictEqual(r.synth.spoken.length, 1);
    // 第一次失败、重试成功：不需要朗读
    let n = 0;
    Au = mkAudio(() => (n++ === 0 ? 'error' : 'ok'));
    r = load({ Audio: Au });
    r.NG.voiceMap = {}; r.NG.voiceMap[r.A.vid('重试')] = 1;
    await r.A.say('重试');
    assert.strictEqual(Au.played.length, 2); assert.strictEqual(r.synth.spoken.length, 0);
  });

  await test('mp3：连续 say 只有最后一句算数；cancel 后不再出声；声音关着时不播', async () => {
    const Au = mkAudio(() => 'ok');
    const { A, NG, settings } = load({ Audio: Au });
    NG.voiceMap = {};
    ['甲', '乙', '丙'].forEach(t => { NG.voiceMap[A.vid(t)] = 1; });
    const p1 = A.say('甲'), p2 = A.say('乙'), p3 = A.say('丙');
    await Promise.all([p1, p2, p3]);
    assert(Au.played[Au.played.length - 1].indexOf(A.vid('丙')) > 0);
    const n = Au.played.length;
    settings.voice = false;
    await A.say('甲');
    assert.strictEqual(Au.played.length, n);
    settings.voice = true;
    const p = A.say('乙'); A.cancel(); await p;
    assert(Au.played.length >= n);       // 不崩溃、不挂起
  });

  await test('mp3：播着播着不出声也不触发 ended（加载卡住）时不会把游戏卡死', async () => {
    const Au = mkAudio(() => 'hang');
    const { A, NG } = load({ Audio: Au, noTTS: true });
    NG.voiceMap = {}; NG.voiceMap[A.vid('卡')] = 1;
    const t0 = Date.now();
    await A.say('卡');
    assert(Date.now() - t0 < 15000);
  });

  await test('提前下载：下载好的句子直接用内存地址播放；没下载好的用网址；失败时回退网址', async () => {
    const urls = [];
    const fetchOk = (u) => { urls.push(u); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); };
    const Au = mkAudio(() => 'ok');
    const { A, NG } = load({ Audio: Au, fetch: fetchOk, noTTS: true });
    NG.voiceMap = {}; ['甲', '乙'].forEach(t => { NG.voiceMap[A.vid(t)] = 1; });
    A.prefetch(['甲', '没有录音的']);
    await sleep(20);
    assert.strictEqual(urls.length, 1); assert(urls[0].endsWith(A.vid('甲') + '.mp3'));    // 没有录音的不会去下载
    await A.say('甲');
    assert(/^blob:mem\//.test(Au.played[0]), Au.played[0]);
    await A.say('乙');                                                                       // 没提前下载：走网址
    assert(Au.played[1].endsWith('audio/v/' + A.vid('乙') + '.mp3'), Au.played[1]);
    // 内存地址播不出来：回退到网址
    const Au2 = mkAudio((src) => (/^blob:/.test(src) ? 'error' : 'ok'));
    const r2 = load({ Audio: Au2, fetch: fetchOk, noTTS: true });
    r2.NG.voiceMap = {}; r2.NG.voiceMap[r2.A.vid('甲')] = 1;
    r2.A.prefetch(['甲']); await sleep(20);
    await r2.A.say('甲');
    assert.strictEqual(Au2.played.length, 2); assert(/^blob:/.test(Au2.played[0])); assert(Au2.played[1].endsWith('.mp3'));
  });

  await test('提前下载：下载失败不影响播放；没有 fetch 的环境（旧浏览器）什么都不做', async () => {
    const Au = mkAudio(() => 'ok');
    const { A, NG } = load({ Audio: Au, fetch: () => Promise.reject(new Error('offline')), noTTS: true });
    NG.voiceMap = {}; NG.voiceMap[A.vid('甲')] = 1;
    A.prefetch(['甲']); await sleep(20);
    await A.say('甲');
    assert(Au.played[0].endsWith('.mp3') && !/^blob:/.test(Au.played[0]));
    const r = load({ Audio: mkAudio(() => 'ok') });
    r.NG.voiceMap = {}; r.NG.voiceMap[r.A.vid('甲')] = 1;
    r.A.prefetch(['甲']);                    // 不报错即可
  });

  await test('vid：稳定、不同台词不同名、只含十六进制', async () => {
    const { A } = load();
    const ids = new Set();
    const words = ['一', '二', '三', '三加四等于七', '三加五等于八', '七减三等于四', '你好，听到我说话了吗？'];
    words.forEach(w => { const id = A.vid(w); assert(/^[0-9a-f]{1,14}$/.test(id), id); assert.strictEqual(A.vid(w), id); ids.add(id); });
    assert.strictEqual(ids.size, words.length);
    assert.strictEqual(A.vid('三加四等于七'), 'd6fb9aad784d4');      // 录音文件是按这个名字生成的，改哈希算法会让所有录音失效
    assert.strictEqual(A.vid('三'), '142f3e1c3c0b55');
  });

  await test('录音文件：voicemap 里的每一项都有文件；文件名和台词的哈希一致；夸奖、试听等固定台词都有', async () => {
    const root = path.join(__dirname, '..');
    const { A, NG } = load();
    vm.runInContext(fs.readFileSync(path.join(root, 'js', 'core', 'voicemap.js'), 'utf8'), vm.createContext({ NG, window: undefined }));
    const ids = Object.keys(NG.voiceMap);
    assert(ids.length > 1000, '录音太少：' + ids.length);
    ids.forEach(i => { const f = path.join(root, 'audio', 'v', i + '.mp3'); assert(fs.existsSync(f) && fs.statSync(f).size > 400, '缺文件 ' + i); });
    assert(NG.voiceWarm.length > 100 && NG.voiceWarm.every(i => NG.voiceMap[i]), '预下载名单有问题');
    const lines = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'voice_lines.json'), 'utf8'));
    Object.keys(lines).forEach(i => assert.strictEqual(A.vid(lines[i]), i, '哈希对不上：' + lines[i]));
    ['太棒了！', '答对啦！', '真厉害！', '好聪明！', '做得好！', '再想一想', '我们一起看看', '完成啦，真棒！', '声音打开啦', A.TEST_LINE, '三加四等于七', '七减三等于四']
      .forEach(t => assert(NG.voiceMap[A.vid(t)], '没有录音：' + t));
  });

  console.log('\n' + passed + ' 项通过' + (process.exitCode ? '，有失败' : ''));
  process.exit(process.exitCode || 0);
})();
