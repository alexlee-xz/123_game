/* 声音：预先录好的普通话 mp3（audio/v/*.mp3）+ 浏览器朗读（备用）+ WebAudio 合成的柔和音效。
 *
 * 为什么要用 mp3：微信内置浏览器没有 speechSynthesis（浏览器自带的朗读），只靠朗读的话，在微信里整个游戏都是哑的。
 * 所以每一句台词都提前生成成 mp3，按台词内容的哈希值命名（vid），js/core/voicemap.js 里列出了有哪些。
 * 播放顺序：mp3 → 浏览器朗读 → （没有朗读时）在线朗读。
 *
 * mp3 播放用同一个 <audio> 元素：第一次点击时“解锁”（播一段静音），之后换 src 就能自动播放，
 * 这是 iOS / 微信允许的做法。
 *
 * 浏览器朗读在 Chrome/Edge 等里有几个常见的“悄悄失声”原因，这里也处理了：
 *  1. cancel() 之后立刻 speak()，新的一句会被吞掉 → cancel 后至少等一小会儿再说；
 *  2. 连续调用 say()（换题、答对、夸奖）时只让最新的一句开口；
 *  3. 在线的“自然”语音偶尔失败 → 出错时换一个本机语音再试一次；
 *  4. 语音被暂停（paused）→ 说话前先 resume()；
 *  5. 找不到中文语音时，status() 能告诉家长页原因。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  let ctx = null, gen = 0, lastCancelAt = 0, lastError = '', primed = false;
  let player = null, unlocked = false, stopCurrent = null, lastClip = '';
  const CLIP_DIR = 'audio/v/';
  const START_MS = 6000, EXTRA_MS = 2500;

  const on = (k) => { try { return NG.store.get().settings[k] !== false; } catch (e) { return true; } };

  /* ---------- 台词 → 文件名（和 tools/gen_voice.py 用的是同一个名字，由 tests/collect_voice 生成） ---------- */
  function vid(str) {
    str = String(str);
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  const hasClip = (id) => !!(NG.voiceMap && NG.voiceMap[id]);
  const clipCount = () => { try { return Object.keys(NG.voiceMap || {}).length; } catch (e) { return 0; } };
  const inWeChat = () => { try { return /MicroMessenger/i.test(root.navigator.userAgent || ''); } catch (e) { return false; } };

  /* ---------- WebAudio 音效 ---------- */
  function ac() {
    if (!ctx) {
      const C = root.AudioContext || root.webkitAudioContext;
      if (C) { try { ctx = new C(); } catch (e) { ctx = null; } }
    }
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }
  function tone(freq, t0, dur, type, vol) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    const t = c.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol || 0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // 音效都很轻柔；“答错”是缓缓下行的两个音，不用刺耳的蜂鸣
  const sfx = {
    pop() { if (on('sfx')) tone(620, 0, 0.09, 'sine', 0.14); },
    drop() { if (on('sfx')) { tone(300, 0, 0.14, 'triangle', 0.14); } },
    ok() { if (on('sfx')) { tone(523, 0, 0.14, 'sine', 0.16); tone(659, 0.1, 0.14, 'sine', 0.16); tone(784, 0.2, 0.26, 'sine', 0.16); } },
    oops() { if (on('sfx')) { tone(330, 0, 0.2, 'sine', 0.12); tone(262, 0.17, 0.26, 'sine', 0.1); } },
    star() { if (on('sfx')) { tone(880, 0, 0.12, 'sine', 0.13); tone(1175, 0.1, 0.22, 'sine', 0.13); } },
    cut() { if (on('sfx')) { tone(900, 0, 0.05, 'sawtooth', 0.07); tone(500, 0.04, 0.12, 'triangle', 0.1); } },
    hop() { if (on('sfx')) { tone(440, 0, 0.08, 'sine', 0.12); tone(587, 0.06, 0.1, 'sine', 0.12); } }
  };

  /* ---------- mp3 播放 ---------- */
  function getPlayer() {
    if (!player && typeof root.Audio === 'function') {
      try { player = new root.Audio(); player.preload = 'auto'; } catch (e) { player = null; }
    }
    return player;
  }
  // 一小段静音 wav（8kHz、8 位、0.1 秒），用来在点击时“解锁”播放器
  function silentWav() {
    const n = 800, b = new Uint8Array(44 + n), dv = new DataView(b.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true);
    dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b[44 + i] = 128;
    let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return 'data:audio/wav;base64,' + root.btoa(s);
  }
  function unlockPlayer() {
    const p = getPlayer(); if (!p || unlocked || stopCurrent) return;     // 正在播台词时不要被静音打断
    try {
      p.src = silentWav();
      const r = p.play();
      if (r && r.then) r.then(() => { unlocked = true; }, () => { /* 这次不是在点击里，等下一次 */ });
      else unlocked = true;
    } catch (e) { /* ignore */ }
  }

  // 播放一个地址。结果：ended 播完 / fail 加载或播放失败 / blocked 浏览器拒绝自动播放 / cancel 被新的一句取代
  function playUrl(url, my) {
    return new Promise(res => {
      const p = getPlayer();
      if (!p) return res('fail');
      let fin = false, t1 = null, t2 = null;
      const done = (r) => {
        if (fin) return; fin = true;
        clearTimeout(t1); clearTimeout(t2);
        p.onended = p.onerror = p.onplaying = null;
        if (stopCurrent === stop) stopCurrent = null;
        res(r);
      };
      const stop = () => done('cancel');
      if (stopCurrent) stopCurrent();
      stopCurrent = stop;
      p.onended = () => done('ended');
      p.onerror = () => done('fail');
      p.onplaying = () => {
        clearTimeout(t1);
        const d = p.duration;
        t2 = setTimeout(() => done('ended'), (isFinite(d) && d > 0 ? d * 1000 : 8000) + EXTRA_MS);   // 出了声却没触发 ended 时不卡住
      };
      t1 = setTimeout(() => done(my !== gen ? 'cancel' : 'fail'), START_MS);                        // 一直不出声（没加载出来）
      try {
        p.src = url;
        const r = p.play();
        if (r && r.catch) r.catch(e => {
          if (fin) return;
          const n = e && e.name;
          done(n === 'NotAllowedError' ? 'blocked' : n === 'AbortError' ? 'cancel' : 'fail');
        });
      } catch (e) { done('fail'); }
    });
  }
  const bust = (u) => u + (u.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now();
  const onlineUrl = (text) => 'https://fanyi.baidu.com/gettts?lan=zh&spd=5&source=web&text=' + encodeURIComponent(text);

  /* ---------- 浏览器朗读（备用） ---------- */
  const synth = () => root.speechSynthesis;
  function hasTTS() { return !!(root.speechSynthesis && root.SpeechSynthesisUtterance); }
  function voices() { try { return (synth().getVoices() || []).slice(); } catch (e) { return []; } }
  const isZh = (v) => /^(zh|cmn|yue)/i.test(v.lang || '') || /chinese|中文|普通话|mandarin/i.test(v.name || '');
  // 优先 zh-CN（普通话）；preferLocal 时优先本机语音（不依赖网络，更可靠）
  function pickVoice(preferLocal) {
    const zh = voices().filter(isZh);
    const cn = zh.filter(v => /(^|[-_])(CN|Hans)/i.test(v.lang || ''));
    const list = cn.length ? cn : zh;
    if (preferLocal) return list.find(v => v.localService) || list[0] || null;
    return list[0] || null;
  }

  function speakTTS(text, o, my) {
    if (!hasTTS()) return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const speak = (attempt) => {
        if (my !== gen && !o.queue) return finish();
        try {
          const u = new root.SpeechSynthesisUtterance(text);
          u.lang = 'zh-CN';
          const v = pickVoice(attempt > 0);
          if (v) { u.voice = v; if (v.lang) u.lang = v.lang; }
          u.rate = o.rate || 0.85; u.pitch = 1.1; u.volume = 1;
          u.onend = finish;
          u.onerror = (e) => {
            const err = (e && e.error) || 'error';
            if (err === 'canceled' || err === 'interrupted') return finish();
            lastError = err;
            if (attempt < 1 && my === gen) { speak(1); return; }     // 在线语音失败 → 换本机语音再试一次
            finish();
          };
          try { synth().resume(); } catch (e) { /* ignore */ }
          synth().speak(u);
        } catch (e) { lastError = (e && e.message) || 'error'; finish(); }
      };
      const s = synth(), since = Date.now() - lastCancelAt;
      if (!o.queue && (s.speaking || s.pending)) {
        try { s.cancel(); } catch (e) { /* ignore */ }
        lastCancelAt = Date.now();
        setTimeout(() => speak(0), 90);
      } else if (!o.queue && since < 150) {
        setTimeout(() => speak(0), 160 - since);
      } else speak(0);
      setTimeout(finish, 3500 + text.length * 350);
    });
  }

  function say(text, o) {
    o = o || {};
    if (!text || !on('voice')) return Promise.resolve();
    text = String(text);
    const my = ++gen;                       // 只有最新的一句才会真的开口
    const id = vid(text);
    const clip = hasClip(id) && getPlayer() ? CLIP_DIR + id + '.mp3' : '';
    if (clip) {
      lastClip = id;
      try { if (hasTTS() && (synth().speaking || synth().pending)) { synth().cancel(); lastCancelAt = Date.now(); } } catch (e) { /* ignore */ }
      return (async () => {
        let r = await playUrl(clip, my);
        if (r === 'fail' && my === gen) r = await playUrl(bust(clip), my);          // 加载失败：再来一次
        if ((r === 'fail' || r === 'blocked') && my === gen) {
          lastError = 'clip-' + r;
          if (hasTTS()) await speakTTS(text, o, my);
        }
      })();
    }
    // 没有现成的 mp3：有朗读就朗读；没有（比如微信）就试试在线朗读
    if (hasTTS()) { if (stopCurrent) stopCurrent(); return speakTTS(text, o, my); }
    if (getPlayer() && o.online !== false) {
      return (async () => {
        const r = await playUrl(onlineUrl(text), my);
        if (r === 'fail' || r === 'blocked') lastError = 'online-' + r;
      })();
    }
    return Promise.resolve();
  }
  function cancel() {
    gen++;
    if (stopCurrent) stopCurrent();
    try { if (player) player.pause(); } catch (e) { /* ignore */ }
    try { if (hasTTS()) { synth().cancel(); lastCancelAt = Date.now(); } } catch (e) { /* ignore */ }
  }

  // 在一次点击里调用：唤醒 AudioContext 和 mp3 播放器，并让 iOS Safari 允许之后的朗读
  function unlock() {
    ac();
    unlockPlayer();
    if (!primed && hasTTS()) {
      primed = true;
      try { const u = new root.SpeechSynthesisUtterance(' '); u.volume = 0; synth().speak(u); } catch (e) { /* ignore */ }
    }
    return ctx;
  }

  const isMuted = () => !on('voice');
  function status() {
    const tts = hasTTS(), vs = tts ? voices() : [], zh = vs.filter(isZh), v = pickVoice(false);
    return {
      tts, voiceCount: vs.length, zhCount: zh.length, voice: v ? v.name : '', muted: isMuted(), sfxMuted: !on('sfx'), lastError,
      clips: clipCount(), player: !!getPlayer(), unlocked, wechat: inWeChat()
    };
  }
  // 给家长页“试听”用：说一句话并返回当前状态
  const TEST_LINE = '你好，听到我说话了吗？';
  function test() {
    unlock(); sfx.ok();
    return say(TEST_LINE).then(status);
  }

  // 第一次触摸/点击时解锁播放器（微信里用户没点之前不允许发声）
  if (root.document && root.document.addEventListener) {
    const first = () => {
      unlock();
      if (unlocked) ['pointerdown', 'touchend', 'click'].forEach(t => root.document.removeEventListener(t, first, true));
    };
    ['pointerdown', 'touchend', 'click'].forEach(t => root.document.addEventListener(t, first, true));
    // 微信：JSBridge 就绪后再预热一次
    root.document.addEventListener('WeixinJSBridgeReady', () => {
      try { root.WeixinJSBridge.invoke('getNetworkType', {}, () => unlockPlayer()); } catch (e) { /* ignore */ }
      try { if (getPlayer()) player.load(); } catch (e) { /* ignore */ }
    }, false);
  }

  NG.audio = { say, cancel, sfx, unlock, status, test, isMuted, vid, TEST_LINE };
})(typeof window !== 'undefined' ? window : globalThis);
