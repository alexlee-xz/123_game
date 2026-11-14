/* 认经线：竖着的线叫经线。0 度的经线叫本初子午线，往右是东、往左是西。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['竖着的线叫经线，中间绿色粗线是本初子午线', '本初子午线把地球分成左右两半：右边是东，左边是西', '每条线相隔 30 度：离本初子午线越远，数字越大', '没有数字了：从绿色粗线开始，一条线是 30 度，数一数'];

  NG.registerGame({
    id: 'geolon', stage: 8, icon: '🧭', title: '认经线', blurb: '本初子午线、东西',
    round(level, api) {
      const q = L.genLon(level);
      api.stage.appendChild(h('div', { class: 'hintline' }, HINT[q.level - 1]));
      if (q.mode === 'choice') {
        api.prompt(q.ask + '在哪边？');
        const m = NG.geo.map({ labels: true });
        api.stage.append(m.el, NG.ui.choices(api, q.options, q.answer, {
          cls: 'wide', key: '认经线', render: v => '<span class="clocklabel">' + v + '</span>',
          onReveal: () => m.hilite({ lon: 0 }), right: { say: q.ask + '在本初子午线的' + (q.east ? '右边' : '左边') }
        }));
        return;
      }
      api.prompt(q.target === 0 ? '点一点，哪条线是本初子午线？' : '点一点，' + L.sayLon(q.target) + '是哪条线？');
      const lons = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
      const m = NG.geo.map({
        labels: q.labels,
        onTap(lat, lon) {
          if (api.locked) return;
          NG.audio.sfx.pop();
          const v = NG.geo.nearest(lons, lon);
          if (v === q.target) { m.hilite({ lon: v }); api.right({ say: q.target === 0 ? '对啦，这条是本初子午线' : '这条是' + L.sayLon(q.target) }); }
          else api.wrong({ key: '认经线', reveal: () => m.hilite({ lon: q.target }) });
        }
      });
      api.stage.appendChild(m.el);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
