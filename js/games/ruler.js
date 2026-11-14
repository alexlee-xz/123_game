/* 读尺子：看物体量出来有几厘米。1-2 级物体从 0 开始；3 级要用右边的数减左边的数；4 级还会有半厘米。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['物体的左边对着 0，右边对着几，就是几厘米', '物体的左边对着 0，右边对着几，就是几厘米', '左边不在 0：用右边的数，减去左边的数', '一小格是半厘米，半格也要算上'];
  const U = 26, X0 = 14;     // 1 厘米 = 26 像素

  function svg(q) {
    const x = (v2) => X0 + v2 * U / 2;
    let s = '<svg class="rulersvg" viewBox="0 0 340 120" width="100%" aria-hidden="true">';
    const ox = x(q.start2), ow = q.len2 * U / 2;
    s += '<rect x="' + ox + '" y="14" width="' + (ow - 14) + '" height="24" rx="4" fill="#ffb84d" stroke="#c97b00" stroke-width="2"/>';
    s += '<rect x="' + ox + '" y="14" width="10" height="24" rx="4" fill="#ff8fa3"/>';
    s += '<path d="M' + (ox + ow - 14) + ' 14 L' + (ox + ow) + ' 26 L' + (ox + ow - 14) + ' 38Z" fill="#f4d9a8" stroke="#c97b00" stroke-width="2"/>';
    s += '<rect x="4" y="50" width="332" height="52" rx="6" fill="#fff3bf" stroke="#d9a400" stroke-width="2"/>';
    for (let v2 = 0; v2 <= 24; v2++) {
      const cm = v2 % 2 === 0, len = cm ? 18 : 11;
      s += '<line x1="' + x(v2) + '" y1="50" x2="' + x(v2) + '" y2="' + (50 + len) + '" stroke="#5b4300" stroke-width="' + (cm ? 2 : 1.2) + '"/>';
      if (cm) s += '<text x="' + x(v2) + '" y="' + 92 + '" text-anchor="middle" font-size="15" font-weight="800" fill="#5b4300">' + (v2 / 2) + '</text>';
    }
    // 把物体的两端用虚线垂到尺子上
    [q.start2, q.end2].forEach(v2 => { s += '<line x1="' + x(v2) + '" y1="38" x2="' + x(v2) + '" y2="50" stroke="#c97b00" stroke-width="1.5" stroke-dasharray="3 3"/>'; });
    return s + '</svg>';
  }

  NG.registerGame({
    id: 'ruler', stage: 5, icon: '📏', title: '读尺子', blurb: '量一量，有几厘米',
    round(level, api) {
      const q = L.genRuler(level);
      api.prompt('这支铅笔有多长？');
      api.stage.appendChild(h('div', { class: 'rulerbox', html: svg(q) }));
      api.stage.appendChild(h('div', { class: 'hintline' }, HINT[q.level - 1]));
      api.stage.appendChild(NG.ui.choices(api, q.options, q.answer, {
        cls: 'wide', key: '读尺子', render: v => '<span class="clocklabel">' + v + '</span>',
        right: { say: '长' + q.say }
      }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
