/* 首页（方块小镇地图）、贴纸册、欢迎页。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const pages = NG.pages = NG.pages || {};
  const go = (p) => { location.hash = '#' + p; };
  NG.go = go;

  function muteBtn() {
    const s = NG.store.get().settings;
    const b = h('button', { class: 'btn round', type: 'button', 'aria-label': '声音开关' }, s.voice ? '🔊' : '🔇');
    b.addEventListener('click', () => {
      const on = !(NG.store.get().settings.voice);
      NG.store.setSetting('voice', on); NG.store.setSetting('sfx', on);
      b.textContent = on ? '🔊' : '🔇';
      if (on) NG.audio.say('声音打开啦');
    });
    return b;
  }

  pages.welcome = function (rootEl) {
    const input = h('input', { type: 'text', maxlength: 12, placeholder: '小朋友的名字', class: 'nameinput' });
    const start = () => {
      NG.audio.unlock();
      NG.store.setName(input.value || '小朋友');
      go('/');
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
    rootEl.appendChild(h('div', { class: 'screen welcome' },
      h('div', { class: 'logo', html: NG.blocks.stack(3, { unit: 40 }) + NG.blocks.stack(5, { unit: 40 }) + NG.blocks.stack(7, { unit: 40 }) }),
      h('h1', null, '方块小镇'),
      h('p', null, '数字小人在等你！你叫什么名字呀？'),
      input,
      h('button', { class: 'btn primary big', type: 'button', onClick: start }, '开始玩'),
      h('p', { class: 'small' }, '请打开声音。游戏会读题目，不认识字也能玩。')));
  };

  pages.home = function (rootEl) {
    const d = NG.store.get();
    const rec = NG.store.recommend(NG.games);

    const top = h('div', { class: 'topbar' },
      h('div', { class: 'title' }, '🧸 ' + (d.name || '小朋友') + '，你好！'),
      h('div', { class: 'starcount' }, '⭐ ' + d.stars),
      h('button', { class: 'btn round', type: 'button', 'aria-label': '贴纸册', onClick: () => go('/stickers') }, '🏅'),
      muteBtn(),
      h('button', { class: 'btn round', type: 'button', 'aria-label': '家长', onClick: () => go('/parent') }, '👪'));

    const hero = rec ? h('button', { class: 'hero', type: 'button', onClick: () => { NG.audio.unlock(); go('/play/' + rec.id); } },
      h('div', { class: 'hico' }, rec.icon),
      h('div', { class: 'htxt' }, h('div', { class: 'small' }, '今天推荐'), h('div', { class: 'hname' }, rec.title), h('div', { class: 'small' }, rec.blurb)),
      h('div', { class: 'hgo' }, '▶')) : null;

    const map = h('div', { class: 'map' });
    NG.STAGES.forEach(st => {
      const tiles = NG.games.filter(g => g.stage === st.id).map(g => {
        const lv = NG.store.getLevel(g.id);
        const s = NG.store.stat(g.id);
        return h('button', { class: 'tile', type: 'button', onClick: () => { NG.audio.unlock(); go('/play/' + g.id); } },
          h('div', { class: 'ico' }, g.icon),
          h('div', { class: 'tname' }, g.title),
          h('div', { class: 'pips', title: '等级' + lv }, '●'.repeat(lv) + '○'.repeat(L.MAX_LEVEL - lv)),
          s.rounds ? h('div', { class: 'small' }, '玩过 ' + s.rounds + ' 题') : h('div', { class: 'small' }, '新游戏'));
      });
      map.appendChild(h('section', { class: 'stagecard s' + st.id },
        h('h2', null, h('span', { class: 'sn' }, st.id), ' ', st.icon + ' ' + st.title),
        h('div', { class: 'small' }, st.blurb),
        h('div', { class: 'tiles' }, tiles)));
    });
    const need = NG.store.starsToNextSticker();
    rootEl.appendChild(h('div', { class: 'screen home' }, top, hero, map,
      h('div', { class: 'small center' }, '再得 ' + need + ' 颗星星，就能换一张新贴纸')));
  };

  pages.stickers = function (rootEl) {
    const d = NG.store.get();
    const grid = h('div', { class: 'stickergrid' });
    L.STICKERS.forEach(s => {
      const own = d.stickers.indexOf(s) >= 0;
      grid.appendChild(h('div', { class: 'sticker slot' + (own ? ' own' : '') }, own ? s : '❔'));
    });
    rootEl.appendChild(h('div', { class: 'screen' },
      h('div', { class: 'topbar' },
        h('button', { class: 'btn round', type: 'button', onClick: () => go('/') }, '←'),
        h('div', { class: 'title' }, '🏅 我的贴纸册'), h('div', { class: 'starcount' }, '⭐ ' + d.stars)),
      h('p', { class: 'center' }, '已收集 ' + d.stickers.length + ' / ' + L.STICKERS.length + ' 张。每 5 颗星星换一张！'),
      grid));
  };
})(typeof window !== 'undefined' ? window : globalThis);
