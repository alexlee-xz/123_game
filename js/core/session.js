/* 会话器：负责“一局 5 题”的流程、反馈、自适应难度、星星和贴纸。
 * 游戏模块只需实现 round(level, api)，用 api 报告对错：
 *   api.stage        本题的舞台 DOM
 *   api.prompt(txt)  显示并朗读题目
 *   api.say(txt)     朗读
 *   api.after(ms,fn) 带保护的定时器（换题后自动失效）
 *   api.right({say,delay})  答对
 *   api.wrong({key,reveal,delay})  答错：第 1 次给柔和提示，第 2 次调用 reveal 演示正确做法
 *   api.locked       本题已结束（忽略后续点击）
 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  const h = NG.ui.h;
  const PRAISE = ['太棒了！', '答对啦！', '真厉害！', '好聪明！', '做得好！'];
  const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

  function start(game, container, hooks) {
    hooks = hooks || {};
    const rounds = game.rounds || 5;
    let idx = 0, stars = 0, token = 0, timers = [], alive = true, curPrompt = '';

    const dotsEl = h('div', { class: 'progress' });
    const starsEl = h('div', { class: 'starcount' }, '⭐ 0');
    const back = h('button', { class: 'btn round', type: 'button', 'aria-label': '返回' }, '←');
    const top = h('div', { class: 'topbar' }, back, h('div', { class: 'title' }, game.icon + ' ' + game.title), dotsEl, starsEl);
    const ptext = h('span', { class: 'ptext' });
    const speak = h('button', { class: 'btn round small', type: 'button', 'aria-label': '再听一遍' }, '🔊');
    const promptEl = h('div', { class: 'prompt' }, speak, ptext);
    const stage = h('div', { class: 'stage' });
    const toast = h('div', { class: 'toast' });
    const screen = h('div', { class: 'screen play game-' + game.id }, top, promptEl, stage, toast);
    container.appendChild(screen);

    back.addEventListener('click', () => { destroy(); if (hooks.onExit) hooks.onExit(); });
    speak.addEventListener('click', () => NG.audio.say(curPrompt));

    function destroy() {
      alive = false; token++;
      timers.forEach(clearTimeout); timers = [];
      NG.audio.cancel();
    }
    function showToast(msg) {
      toast.textContent = msg; toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }
    function drawDots(marks) {
      dotsEl.innerHTML = '';
      for (let i = 0; i < rounds; i++) {
        const m = marks[i];
        dotsEl.appendChild(h('span', { class: 'pdot' + (i === idx ? ' cur' : '') + (m === 1 ? ' ok' : m === 0 ? ' miss' : '') }));
      }
    }
    const marks = [];

    function nextRound() {
      if (!alive) return;
      token++; timers.forEach(clearTimeout); timers = [];
      if (idx >= rounds) return finish();
      const level = NG.store.getLevel(game.id);
      stage.innerHTML = ''; ptext.textContent = '';
      drawDots(marks);
      const st = { done: false, wrongs: 0, key: '', start: Date.now() };
      const tk = token;

      function after(ms, fn) {
        const t = setTimeout(() => { if (alive && tk === token) fn(); }, ms);
        timers.push(t); return t;
      }
      function resolve(first, delay) {
        st.done = true;
        const info = NG.store.recordRound(game.id, { firstTry: first, key: st.key, level });
        NG.store.addSeconds(Math.min(60, (Date.now() - st.start) / 1000));
        marks[idx] = first ? 1 : 0;
        if (first) { stars++; starsEl.textContent = '⭐ ' + stars; }
        drawDots(marks);
        if (info.changed === 'up') showToast('升级啦！下一题更有挑战 ⬆️');
        else if (info.changed === 'down') showToast('我们慢一点，多练练 🌱');
        after(delay, () => { idx++; nextRound(); });
      }

      const api = {
        stage, level,
        get locked() { return st.done; },
        get wrongs() { return st.wrongs; },
        prompt(text, o) {
          curPrompt = text; ptext.textContent = text;
          if (!o || o.speak !== false) NG.audio.say(text);
        },
        say: (text, o) => NG.audio.say(text, o),
        after,
        right(o) {
          if (st.done) return;
          o = o || {};
          const first = st.wrongs === 0;
          NG.audio.sfx.ok();
          NG.ui.burst(screen);
          stage.classList.add('celebrate');
          NG.audio.say(o.say || pickPraise());
          resolve(first, o.delay || 1900);
        },
        wrong(o) {
          if (st.done) return;
          o = o || {};
          st.wrongs++;
          if (o.key) st.key = o.key;
          NG.audio.sfx.oops();
          stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
          if (st.wrongs === 1) {
            NG.audio.say(o.say || '再想一想');
          } else {
            NG.audio.say('我们一起看看');
            if (o.reveal) o.reveal();
            resolve(false, o.delay || 3000);
          }
        }
      };
      try { game.round(level, api); }
      catch (e) { console.error(e); stage.textContent = '出错了：' + e.message; }
    }

    function finish() {
      const got = NG.store.awardStars(stars);
      const rest = NG.store.shouldRest();
      promptEl.style.display = 'none';
      stage.innerHTML = '';
      const sum = h('div', { class: 'summary' },
        h('div', { class: 'big' }, stars >= rounds ? '🎉 全对！' : '🌟 完成啦！'),
        h('div', { class: 'stars' }, stars > 0 ? '⭐'.repeat(stars) : '多玩几次就会啦'),
        got.length ? h('div', { class: 'newsticker' }, h('div', { class: 'small' }, '获得新贴纸！'), h('div', { class: 'sticker big pop' }, got.join(' '))) : null,
        rest ? h('div', { class: 'restcard' }, '😴 今天玩了好一会儿啦，让眼睛休息一下，明天再来玩吧！') : null,
        h('div', { class: 'row' },
          rest ? null : h('button', { class: 'btn primary', type: 'button', onClick: again }, '再玩一次'),
          h('button', { class: 'btn', type: 'button', onClick: () => { destroy(); if (hooks.onExit) hooks.onExit(); } }, '回小镇')));
      stage.appendChild(sum);
      NG.audio.sfx.star();
      NG.audio.say(got.length ? '得到一张新贴纸啦！' : (stars >= rounds ? '全部答对，太厉害了！' : '完成啦，真棒！'));
      if (got.length) NG.ui.burst(screen, got);
      dotsEl.innerHTML = '';
    }
    function again() {
      idx = 0; stars = 0; marks.length = 0;
      starsEl.textContent = '⭐ 0';
      promptEl.style.display = '';
      nextRound();
    }

    nextRound();
    return { destroy };
  }

  NG.session = { start };
})(typeof window !== 'undefined' ? window : globalThis);
