/* 声音：Web Speech 朗读（普通话）+ WebAudio 合成的柔和音效。无需任何音频文件。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  let ctx = null, voice = null;

  const on = (k) => { try { return NG.store.get().settings[k] !== false; } catch (e) { return true; } };

  function ac() {
    if (!ctx) {
      const C = root.AudioContext || root.webkitAudioContext;
      if (C) { try { ctx = new C(); } catch (e) { ctx = null; } }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
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
    star() { if (on('sfx')) { tone(880, 0, 0.12, 'sine', 0.13); tone(1175, 0.1, 0.22, 'sine', 0.13); } }
  };

  function hasTTS() { return !!(root.speechSynthesis && root.SpeechSynthesisUtterance); }
  function pickVoice() {
    if (voice || !hasTTS()) return voice;
    const vs = root.speechSynthesis.getVoices() || [];
    voice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    return voice;
  }
  if (hasTTS()) root.speechSynthesis.onvoiceschanged = () => { voice = null; };

  function say(text, o) {
    o = o || {};
    if (!text || !on('voice') || !hasTTS()) return Promise.resolve();
    try {
      if (!o.queue) root.speechSynthesis.cancel();
      const u = new root.SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      const v = pickVoice(); if (v) u.voice = v;
      u.rate = o.rate || 0.85; u.pitch = 1.1;
      return new Promise(res => {
        u.onend = u.onerror = () => res();
        root.speechSynthesis.speak(u);
        setTimeout(res, 3000 + text.length * 350);
      });
    } catch (e) { return Promise.resolve(); }
  }
  function cancel() { try { if (hasTTS()) root.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }

  NG.audio = { say, cancel, sfx, unlock: ac };
})(typeof window !== 'undefined' ? window : globalThis);
