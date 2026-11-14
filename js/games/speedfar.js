/* 走多远：每秒走几格，走几秒，一共走几格。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'speedfar', stage: 9, icon: '🛤️', title: '走多远', blurb: '每秒几格，走几秒',
    round(level, api) {
      const q = L.genSpeedFar(level);
      const a = q.animal;
      const rows = q.parts
        ? [{ e: a.e, v: q.parts[0].v, t: q.parts[0].t, label: a.name + '先每秒走 ' + q.parts[0].v + ' 格，走 ' + q.parts[0].t + ' 秒；再每秒走 ' + q.parts[1].v + ' 格，走 ' + q.parts[1].t + ' 秒' }]
        : [{ e: a.e, v: q.v, t: q.t, label: a.name + '每秒走 ' + q.v + ' 格，走 ' + q.t + ' 秒' }];
      api.prompt(rows[0].label + '。一共走几格？');
      const tr = NG.track({ cells: q.cells, rows: q.parts ? [{ e: a.e, v: q.d / (q.parts[0].t + q.parts[1].t), t: q.parts[0].t + q.parts[1].t, label: rows[0].label }] : rows });
      api.stage.append(tr.el, h('div', { class: 'hintline' }, q.parts ? '分两段算，再加起来' : '每一秒走 ' + q.v + ' 格，' + q.t + ' 秒就有 ' + q.t + ' 个 ' + q.v),
        NG.ui.choices(api, q.options, q.answer, { key: '走多远', onReveal: () => tr.run(), right: { say: '一共走了' + L.numZh(q.d) + '格' } }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
