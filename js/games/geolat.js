/* 认纬线：横着的线叫纬线。0 度的纬线叫赤道，往上是北、往下是南。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['横着的线叫纬线，最中间红色粗线是赤道', '赤道把地球分成上下两半：上面是北半球，下面是南半球', '每条线相隔 30 度：离赤道越远，数字越大', '没有数字了：从赤道开始，一条线是 30 度，数一数'];

  NG.registerGame({
    id: 'geolat', stage: 8, icon: '🌐', title: '认纬线', blurb: '赤道、南北半球',
    round(level, api) {
      const q = L.genLat(level);
      api.stage.appendChild(h('div', { class: 'hintline' }, HINT[q.level - 1]));
      if (q.mode === 'choice') {
        api.prompt(q.ask + '在哪边？');
        const m = NG.geo.map({ labels: true });
        api.stage.append(m.el, NG.ui.choices(api, q.options, q.answer, {
          cls: 'wide', key: '认纬线', render: v => '<span class="clocklabel">' + v + '</span>',
          onReveal: () => m.hilite({ lat: 0 }), right: { say: q.ask + '在赤道的' + (q.north ? '上面' : '下面') }
        }));
        return;
      }
      api.prompt(q.target === 0 ? '点一点，哪条线是赤道？' : '点一点，' + L.sayLat(q.target) + '是哪条线？');
      const lats = [-60, -30, 0, 30, 60];
      const m = NG.geo.map({
        labels: q.labels,
        onTap(lat) {
          if (api.locked) return;
          NG.audio.sfx.pop();
          const v = NG.geo.nearest(lats, lat);
          if (v === q.target) { m.hilite({ lat: v }); api.right({ say: q.target === 0 ? '对啦，这条是赤道' : '这条是' + L.sayLat(q.target) }); }
          else api.wrong({ key: '认纬线', reveal: () => m.hilite({ lat: q.target }) });
        }
      });
      api.stage.appendChild(m.el);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
