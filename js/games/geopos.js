/* 找位置：纬度（横线）+ 经度（竖线）两个数合起来，就能在地球上找到一个地方。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'geopos', stage: 8, icon: '📍', title: '找位置', blurb: '用经纬度找城市',
    round(level, api) {
      const q = L.genGeoPos(level);
      const c = q.city;
      if (q.mode === 'read') {
        api.prompt(c.name + '在哪里？看它靠近哪条纬线、哪条经线');
        const m = NG.geo.map({ labels: true, marks: [{ lat: c.lat, lon: c.lon, e: c.e, name: c.name }] });
        api.stage.append(h('div', { class: 'hintline' }, '先读横线（纬度）：北还是南；再读竖线（经度）：东还是西'), m.el,
          NG.ui.choices(api, q.options, q.answer, {
            cls: 'wide', key: '找位置', render: v => '<span class="clocklabel">' + v + '</span>',
            onReveal: () => m.hilite(q.target), right: { say: c.name + '大约在' + q.say }
          }));
        return;
      }
      api.prompt(c ? '找一找' + c.name + '：' + q.say : '找一找：' + q.say);
      const lats = [-60, -30, 0, 30, 60], lons = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
      const m = NG.geo.map({
        labels: true,
        onTap(lat, lon) {
          if (api.locked) return;
          NG.audio.sfx.pop();
          const ok = q.level === 4
            ? NG.geo.nearest(lats, lat) === q.target.lat && NG.geo.nearest(lons, lon) === q.target.lon
            : Math.abs(lat - q.target.lat) <= q.tol && Math.abs(lon - q.target.lon) <= q.tol;
          if (ok) { m.mark(q.target.lat, q.target.lon, c ? c.e : '📍', c ? c.name : ''); api.right({ say: '找到了，就是这里' }); }
          else api.wrong({ key: '找位置', reveal: () => { m.hilite(q.target); } });
        }
      });
      api.stage.append(h('div', { class: 'hintline' }, q.level === 4 ? '横线读纬度，竖线读经度，两条线交叉的地方就是答案' : '先找纬线，再找经线，看它们交叉在哪里'), m.el);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
