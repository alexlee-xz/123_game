/* 读角度：看量角器，读出角有多少度。1 级 30 的倍数；2、3 级更细；4 级角的一边不在 0 上，要用两个读数相减。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const HINT = ['一条边对着 0，另一条边对着几，就是几度', '一条边对着 0，另一条边对着几，就是几度', '数字从右边的 0 往左变大，别读成另一圈的数', '两条边都不在 0：用大的数减小的数'];
  const CX = 170, CY = 160, R = 140;

  function pt(deg, r) { const a = deg * Math.PI / 180; return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; }
  function svg(q) {
    const f = (p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    let s = '<svg class="anglesvg" viewBox="0 0 340 176" width="100%" aria-hidden="true">';
    s += '<path d="M' + f(pt(0, R)) + ' A' + R + ' ' + R + ' 0 0 0 ' + f(pt(180, R)) + 'Z" fill="#e7f5ff" stroke="#1c7ed6" stroke-width="2"/>';
    for (let d = 0; d <= 180; d += (q.level === 3 ? 5 : 10)) {
      const big = d % 10 === 0, a = pt(d, R), b = pt(d, R - (big ? 12 : 7));
      s += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="#1864ab" stroke-width="' + (big ? 1.6 : 1) + '"/>';
    }
    const lab = q.level === 1 ? 30 : 10;
    for (let d = 0; d <= 180; d += lab) {
      const p = pt(d, R - 26);
      s += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="middle" font-size="' + (lab === 30 ? 14 : 10) + '" font-weight="800" fill="#1864ab">' + d + '</text>';
    }
    s += '<line x1="' + (CX - R - 8) + '" y1="' + CY + '" x2="' + (CX + R + 8) + '" y2="' + CY + '" stroke="#495057" stroke-width="3"/>';
    const e1 = pt(q.from, R + 6), e2 = pt(q.to, R + 6);
    if (q.from) s += '<line x1="' + CX + '" y1="' + CY + '" x2="' + e1[0].toFixed(1) + '" y2="' + e1[1].toFixed(1) + '" stroke="#e8590c" stroke-width="4" stroke-linecap="round"/>';
    s += '<line x1="' + CX + '" y1="' + CY + '" x2="' + e2[0].toFixed(1) + '" y2="' + e2[1].toFixed(1) + '" stroke="#e8590c" stroke-width="4" stroke-linecap="round"/>';
    s += '<circle cx="' + CX + '" cy="' + CY + '" r="5" fill="#e8590c"/>';
    return s + '</svg>';
  }

  NG.registerGame({
    id: 'angle', stage: 7, icon: '📐', title: '读角度', blurb: '看量角器，读几度',
    round(level, api) {
      const q = L.genAngle(level);
      api.prompt(q.level === 4 ? '这个角是多少度？' : '橙色的角是多少度？');
      api.stage.appendChild(h('div', { class: 'anglebox', html: svg(q) }));
      api.stage.appendChild(h('div', { class: 'hintline' }, HINT[q.level - 1]));
      api.stage.appendChild(NG.ui.choices(api, q.options, q.answer, {
        cls: 'wide', key: '读角度', render: v => '<span class="clocklabel">' + v + '</span>',
        right: { say: '这个角是' + q.say }
      }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
