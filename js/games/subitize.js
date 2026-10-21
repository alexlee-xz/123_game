/* 闪现点阵：点阵只亮一小会儿，凭“一眼”判断数量（Subitizing 瞬间识数）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'subitize', stage: 1, icon: '⚡', title: '闪现点阵', blurb: '看一眼，有几个点',
    round(level, api) {
      const q = L.genSubitize(level);
      api.prompt('看一眼，有几个点？');
      const card = h('div', { class: 'dotcard' });
      const replay = h('button', { class: 'btn', type: 'button', disabled: true }, '👀 再看一眼');
      const choiceBox = h('div');
      api.stage.append(card, replay, choiceBox);
      let shown = false;

      function show() {
        card.innerHTML = NG.blocks.dots(q.n, { size: 150 });
        replay.disabled = true; shown = true;
        api.after(q.ms, hide);
      }
      function hide() {
        shown = false;
        card.innerHTML = '<div class="mystery">?</div>';
        if (!api.locked) replay.disabled = false;
      }
      replay.addEventListener('click', () => { if (!api.locked && !shown) show(); });

      card.innerHTML = '<div class="mystery">?</div>';
      api.after(700, () => {
        show();
        api.after(q.ms + 150, () => {
          choiceBox.appendChild(NG.ui.choices(api, q.options, q.n, {
            key: '点阵' + q.n,
            right: { say: L.numZh(q.n) + '个点' },
            onRight: () => { card.innerHTML = NG.blocks.dots(q.n, { size: 150 }); },
            onReveal: () => { card.innerHTML = NG.blocks.dots(q.n, { size: 150 }); replay.disabled = true; }
          }));
        });
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
