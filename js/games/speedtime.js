/* 同样路程比时间：走一样远，用的时间少，速度就快。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'speedtime', stage: 9, icon: '⌛', title: '谁先到', blurb: '同样的路，比时间',
    round(level, api) {
      const q = L.genSpeedTime(level);
      const A = { e: q.A.e, v: q.va, t: q.ta, label: q.A.name + '：每秒 ' + q.va + ' 格' }, B = { e: q.B.e, v: q.vb, t: q.tb, label: q.B.name + '：每秒 ' + q.vb + ' 格' };
      const tr = NG.track({ cells: q.cells, rows: [A, B] });
      if (q.mode === 'who') {
        api.prompt('都要走 ' + q.D + ' 格，谁先到终点？');
        api.stage.append(tr.el, h('div', { class: 'hintline' }, '走一样远，用的时间少，就是跑得快'),
          NG.ui.choices(api, q.options, q.answer, { cls: 'wide', key: '谁先到', render: v => '<span class="clocklabel">' + v + '</span>', onReveal: () => tr.run(), right: { say: q.answer + '先到，它每秒走得多' } }));
      } else {
        api.prompt(q.who.name + '要走 ' + q.D + ' 格，要用几秒？');
        api.stage.append(tr.el, h('div', { class: 'hintline' }, '每秒走 ' + (q.who === q.A ? q.va : q.vb) + ' 格，几个“' + (q.who === q.A ? q.va : q.vb) + '”合起来是 ' + q.D + '？'),
          NG.ui.choices(api, q.options, q.answer, { key: '谁先到', onReveal: () => tr.run(), right: { say: '要用' + L.qtyZh(q.t) + '秒' } }));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
