/* 看温度计：红色的“水银柱”爬到哪里，就是几度。每格表示多少度要先看清；零下在 0 的下面。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['每一大格是 10 度，红柱顶端对着几，就是几度', '每一小格是 5 度，红柱顶端对着几，就是几度', '每一小格是 1 度：先看最近的整数，再数小格', '0 的下面是零下，越往下越冷'];
  const Y0 = 14, H = 230;

  function svg(q) {
    const span = q.hi - q.lo, y = (v) => Y0 + H - (v - q.lo) / span * H;
    const unit = q.level === 1 ? 10 : q.level === 2 ? 5 : 1;
    let s = '<svg class="thermosvg" viewBox="0 0 200 270" width="170" aria-hidden="true">';
    s += '<rect x="86" y="6" width="28" height="' + (H + 16) + '" rx="14" fill="#fff" stroke="#868e96" stroke-width="3"/>';
    s += '<circle cx="100" cy="' + (Y0 + H + 8) + '" r="20" fill="#fa5252" stroke="#868e96" stroke-width="3"/>';
    s += '<rect x="94" y="' + y(q.temp) + '" width="12" height="' + (Y0 + H + 8 - y(q.temp)) + '" fill="#fa5252"/>';
    for (let v = q.lo; v <= q.hi; v += unit) {
      const big = v % 10 === 0, mid = v % 5 === 0;
      const len = big ? 20 : mid ? 14 : 8;
      s += '<line x1="' + (114) + '" y1="' + y(v) + '" x2="' + (114 + len) + '" y2="' + y(v) + '" stroke="#495057" stroke-width="' + (big ? 2 : 1.2) + '"/>';
      if (big || (q.level === 2 && mid)) s += '<text x="' + (140) + '" y="' + (y(v) + 5) + '" font-size="14" font-weight="800" fill="#343a40">' + v + '</text>';
    }
    return s + '</svg>';
  }

  NG.registerGame({
    id: 'thermo', stage: 7, icon: '🌡️', title: '看温度计', blurb: '红柱到几度了',
    round(level, api) {
      const q = L.genThermo(level);
      api.prompt('现在几度？');
      api.stage.appendChild(h('div', { class: 'thermobox', html: svg(q) }));
      api.stage.appendChild(h('div', { class: 'hintline' }, HINT[q.level - 1]));
      api.stage.appendChild(NG.ui.choices(api, q.options, q.answer, {
        cls: 'wide', key: '温度计', render: v => '<span class="clocklabel">' + v + '</span>',
        right: { say: '现在' + q.say + '，' + q.feel }
      }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
