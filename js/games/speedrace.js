/* 谁快谁慢：两只小动物同时出发，看谁跑得快。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['同样的时间，谁跑得远，谁就跑得快', '同样的时间，谁跑得远，谁就跑得快', '先点出发看一看，再选谁走得更远', '时间不一样：算一算每秒各走几格，再比'];

  NG.registerGame({
    id: 'speedrace', stage: 9, icon: '🏁', title: '谁快谁慢', blurb: '比一比谁跑得快',
    round(level, api) {
      const q = L.genRace(level);
      api.prompt(q.ask === 'far' ? '点出发，看看谁走得更远？' : '点出发，看看谁跑得更快？');
      const rows = [{ e: q.A.e, v: q.va, t: q.ta, label: q.A.name + (q.level === 4 ? '：走了 ' + q.da + ' 格，用了 ' + q.ta + ' 秒' : '') },
        { e: q.B.e, v: q.vb, t: q.tb, label: q.B.name + (q.level === 4 ? '：走了 ' + q.db + ' 格，用了 ' + q.tb + ' 秒' : '') }];
      const tr = NG.track({ cells: q.cells, rows });
      api.stage.append(tr.el, h('div', { class: 'hintline' }, HINT[q.level - 1]),
        NG.ui.choices(api, q.options, q.answer, {
          cls: 'wide', key: '速度比较', render: v => '<span class="clocklabel">' + v + '</span>',
          onReveal: () => tr.showEnd(), right: { say: q.answer + (q.ask === 'far' ? '走得更远' : '跑得更快') }
        }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
