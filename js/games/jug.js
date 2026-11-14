/* 数水壶容量：看量杯里的水涨到哪一格。1-2 级用“升”，3-4 级用“毫升”。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['每一格是 1 升，水面对着几，就是几升', '每一格是 1 升，水面对着几，就是几升', '每一格是 100 毫升，水面对着几格，就是几百毫升', '每一小格是 50 毫升，两小格就是 100 毫升'];
  const Y0 = 14, H = 220;

  function svg(q) {
    const y = (v) => Y0 + H - v / q.max * H;
    let s = '<svg class="jugsvg" viewBox="0 0 220 260" width="190" aria-hidden="true">';
    s += '<rect x="50" y="' + y(q.value) + '" width="80" height="' + (Y0 + H - y(q.value)) + '" fill="#74c0fc"/>';
    s += '<path d="M50 ' + Y0 + ' L50 ' + (Y0 + H) + ' L130 ' + (Y0 + H) + ' L130 ' + Y0 + '" fill="none" stroke="#495057" stroke-width="4" stroke-linejoin="round"/>';
    s += '<line x1="130" y1="' + y(q.value) + '" x2="150" y2="' + y(q.value) + '" stroke="#1c7ed6" stroke-width="3" stroke-dasharray="4 3"/>';
    const n = q.max / q.unit;
    const labelEvery = q.level === 4 ? 2 : q.level === 2 ? 1 : 1;
    for (let k = 1; k <= n; k++) {
      const v = k * q.unit, lab = k % labelEvery === 0, yy = y(v);
      s += '<line x1="50" y1="' + yy + '" x2="' + (lab ? 72 : 62) + '" y2="' + yy + '" stroke="#495057" stroke-width="2"/>';
      if (lab) s += '<text x="154" y="' + (yy + 5) + '" font-size="14" font-weight="800" fill="#343a40">' + (q.level >= 3 ? v : v) + '</text>';
    }
    s += '<text x="154" y="' + (Y0 + H + 16) + '" font-size="12" fill="#868e96">' + q.uname + '</text>';
    return s + '</svg>';
  }

  NG.registerGame({
    id: 'jug', stage: 7, icon: '🫗', title: '数水壶容量', blurb: '水有几升、几毫升',
    round(level, api) {
      const q = L.genJug(level);
      api.prompt('杯子里有多少水？');
      api.stage.appendChild(h('div', { class: 'jugbox', html: svg(q) }));
      api.stage.appendChild(h('div', { class: 'hintline' }, HINT[q.level - 1]));
      api.stage.appendChild(NG.ui.choices(api, q.options, q.answer, {
        cls: 'wide', key: '数水壶', render: v => '<span class="clocklabel">' + v + '</span>',
        right: { say: '有' + q.say + '水' }
      }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
