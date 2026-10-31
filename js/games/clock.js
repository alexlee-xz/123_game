/* 认时间：看钟面说几点，或者看时间找钟面。短粗的是时针，细长的是分针。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['短针指着几，就是几点；长针指着 12，就是整点', '长针指着 6，就是半点；指着 12，就是整点', '', ''];

  NG.registerGame({
    id: 'clock', stage: 5, icon: '⏰', title: '认时间', blurb: '看钟面，说几点',
    round(level, api) {
      const q = L.genClock(level);
      const byLabel = {};
      q.times.forEach(t => { byLabel[t.label] = t; });
      const opts = { key: q.label, right: { say: '现在是' + q.say } };

      if (q.mode === 'read') {
        api.prompt(level >= 4 ? '现在几点几分？' : '现在几点？');
        const hint = HINT[L.clampLevel(level) - 1];
        api.stage.appendChild(h('div', { class: 'clockbox', html: NG.blocks.clock(q.h, q.m, { size: 230 }) }));
        if (hint) api.stage.appendChild(h('div', { class: 'hintline' }, hint));
        api.stage.appendChild(NG.ui.choices(api, q.options, q.answer,
          Object.assign({ cls: 'wide', render: v => '<span class="clocklabel">' + v + '</span>' }, opts)));
      } else {
        api.prompt('哪个钟是' + q.say + '？');
        api.stage.append(h('div', { class: 'bigq' }, q.label),
          NG.ui.choices(api, q.options, q.answer, Object.assign({
            cls: 'clockopts', render: v => NG.blocks.clock(byLabel[v].h, byLabel[v].m, { size: 88, mini: true })
          }, opts)));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
