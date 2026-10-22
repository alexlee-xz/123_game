/* 声音：Web Speech 朗读（普通话）+ WebAudio 合成的柔和音效。无需任何音频文件。
 *
 * 朗读在浏览器里有几个常见的“悄悄失声”原因，这里都做了处理：
 *  1. Chrome/Edge 里 cancel() 之后立刻 speak()，新的一句会被吞掉 → cancel 后至少等一小会儿再说；
 *  2. 连续调用 say()（换题、答对、夸奖）时只让最新的一句开口，不让旧的排队或互相打断；
 *  3. 在线的“自然”语音偶尔失败（没网/被拦）→ 出错时换一个本机语音再试一次；
 *  4. 语音被暂停（paused）→ 说话前先 resume()；
 *  5. iOS Safari 要求第一次朗读发生在点击里 → unlock() 在点击时悄悄说一句无声的话；
 *  6. 找不到中文语音时，status() 能告诉家长页原因，而不是默默没声音。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  let ctx = null, gen = 0, lastCancelAt = 0, lastError = '', primed = false;

  const on = (k) => { try { return NG.store.get().settings[k] !== false; } catch (e) { return true; } };

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

  function say(text, o) {
    o = o || {};
    if (!text || !on('voice') || !hasTTS()) return Promise.resolve();
    const my = ++gen;                       // 只有最新的一句才会真的开口
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
  function cancel() {
    gen++;
    try { if (hasTTS()) { synth().cancel(); lastCancelAt = Date.now(); } } catch (e) { /* ignore */ }
  }

  // 在一次点击里调用：唤醒 AudioContext，并让 iOS Safari 允许之后的朗读
  function unlock() {
    ac();
    if (!primed && hasTTS()) {
      primed = true;
      try { const u = new root.SpeechSynthesisUtterance(' '); u.volume = 0; synth().speak(u); } catch (e) { /* ignore */ }
    }
    return ctx;
  }

  const isMuted = () => !on('voice');
  function status() {
    const tts = hasTTS(), vs = tts ? voices() : [], zh = vs.filter(isZh), v = pickVoice(false);
    return { tts, voiceCount: vs.length, zhCount: zh.length, voice: v ? v.name : '', muted: isMuted(), sfxMuted: !on('sfx'), lastError };
  }
  // 给家长页“试听”用：说一句话并返回当前状态
  function test() {
    unlock(); sfx.ok();
    return say('你好，听到我说话了吗？').then(status);
  }

  NG.audio = { say, cancel, sfx, unlock, status, test, isMuted };
})(typeof window !== 'undefined' ? window : globalThis);
