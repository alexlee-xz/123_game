/* 每秒走几格：速度就是“每一秒走了几格”。先看动画，再算。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['走 1 秒，走了几格，就是每秒几格', '走 2 秒，每一秒走的一样多：总格数分成 2 份', '走 3 秒，每一秒走的一样多：总格数分成 3 份', '总格数除以秒数，就是每秒几格'];

  NG.registerGame({
    id: 'speedsec', stage: 9, icon: '⏱️', title: '每秒几格', blurb: '算出每秒走几格',
    round(level, api) {
      const q = L.genSpeedSec(level);
      api.prompt(q.animal.name + '走了 ' + q.d + ' 格，用了 ' + q.t + ' 秒。每秒走几格？');
      const tr = NG.track({ cells: q.cells, rows: [{ e: q.animal.e, v: q.v, t: q.t, label: q.animal.name + '：' + q.d + ' 格，' + q.t + ' 秒' }] });
      api.stage.append(tr.el, h('div', { class: 'hintline' }, HINT[q.level - 1]),
        NG.ui.choices(api, q.options, q.answer, { key: '每秒几格', onReveal: () => tr.run(), right: { say: '每秒走' + L.qtyZh(q.v) + '格' } }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
