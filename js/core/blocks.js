/* 数量的各种“长相”：方块塔、点阵、手指、硬币。全部是内联 SVG，原创绘制。
 * 同一个数用不同方式表示，是 CPA（具象-图像-抽象）和数感训练的基础。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};

  const COLORS = {
    0: '#b0bec5', 1: '#ff6b6b', 2: '#ff9f43', 3: '#feca57', 4: '#1dd1a1', 5: '#48dbfb',
    6: '#54a0ff', 7: '#a29bfe', 8: '#ff78c4', 9: '#a1887f', 10: '#ee5a24'
  };
  const color = (n) => COLORS[n] || '#7f8c8d';
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = f < 0 ? 0 : 255, p = Math.abs(f);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // 方块塔：每 5 块一列（5 格结构，便于一眼识数），最顶上的方块长一张脸
  function stack(n, o) {
    o = Object.assign({ unit: 24, face: true, cells: false }, o || {});
    const u = o.unit;
    if (n <= 0) {
      return '<svg class="blk" width="' + u + '" height="' + u + '" viewBox="0 0 ' + u + ' ' + u + '"><rect x="2" y="2" width="' + (u - 4) +
        '" height="' + (u - 4) + '" rx="4" fill="none" stroke="#b0bec5" stroke-dasharray="4 3" stroke-width="2"/></svg>';
    }
    const col = o.color || color(n), edge = shade(col, -0.35);
    const cols = Math.ceil(n / 5), h = Math.min(n, 5), W = cols * u, H = h * u;
    const topIdx = h - 1;
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = Math.floor(i / 5), r = i % 5;
      const x = c * u, y = H - (r + 1) * u;
      let inner = '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (u - 2) + '" height="' + (u - 2) + '" rx="' + (u * 0.18).toFixed(1) +
        '" fill="' + col + '" stroke="' + edge + '" stroke-width="2"/>';
      if (o.face && i === topIdx && u >= 18) {
        const ex1 = x + u * 0.32, ex2 = x + u * 0.68, ey = y + u * 0.42, er = u * 0.15;
        inner += '<circle cx="' + ex1 + '" cy="' + ey + '" r="' + er + '" fill="#fff" stroke="#333" stroke-width="1"/>' +
          '<circle cx="' + ex2 + '" cy="' + ey + '" r="' + er + '" fill="#fff" stroke="#333" stroke-width="1"/>' +
          '<circle cx="' + ex1 + '" cy="' + (ey + 0.5) + '" r="' + (er * 0.5) + '" fill="#222"/>' +
          '<circle cx="' + ex2 + '" cy="' + (ey + 0.5) + '" r="' + (er * 0.5) + '" fill="#222"/>' +
          '<path d="M' + (x + u * 0.3) + ' ' + (y + u * 0.68) + ' Q' + (x + u * 0.5) + ' ' + (y + u * 0.88) + ' ' + (x + u * 0.7) + ' ' + (y + u * 0.68) +
          '" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round"/>';
      }
      s += '<g class="cell" data-i="' + i + '">' + inner + '</g>';
    }
    return '<svg class="blk" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="overflow:visible">' + s + '</svg>';
  }

  // 点阵：1-6 用骰子排法，7-10 用 5 + 几 的两组排法（便于瞬间识数）
  const DICE = {
    1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]],
    4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]],
    5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]],
    6: [[.28, .2], [.72, .2], [.28, .5], [.72, .5], [.28, .8], [.72, .8]]
  };
  function dots(n, o) {
    o = Object.assign({ size: 110 }, o || {});
    const s = o.size, col = o.color || color(n);
    const groups = n <= 6 ? [n] : [5, n - 5];
    const W = s * groups.length + (groups.length - 1) * 8;
    let out = '';
    groups.forEach((g, gi) => {
      const ox = gi * (s + 8);
      out += '<rect x="' + (ox + 1) + '" y="1" width="' + (s - 2) + '" height="' + (s - 2) + '" rx="' + (s * 0.16) + '" fill="#fff" stroke="#cfd8dc" stroke-width="2"/>';
      (DICE[g] || []).forEach(p => {
        out += '<circle cx="' + (ox + p[0] * s) + '" cy="' + (p[1] * s) + '" r="' + (s * 0.09) + '" fill="' + col + '" stroke="' + shade(col, -0.3) + '" stroke-width="1.5"/>';
      });
    });
    return '<svg class="dots" width="' + W + '" height="' + s + '" viewBox="0 0 ' + W + ' ' + s + '">' + out + '</svg>';
  }

  // 手指：一只手最多 5 根，6-10 用两只手
  function fingers(n, o) {
    o = Object.assign({ size: 110 }, o || {});
    const groups = n <= 5 ? [n] : [5, n - 5];
    const sc = o.size / 120;
    const lens = [40, 52, 56, 50, 38];
    let out = '';
    groups.forEach((k, gi) => {
      const ox = gi * 100;
      for (let i = 0; i < 5; i++) {
        const len = i < k ? lens[i] : 9;
        out += '<rect x="' + (ox + 12 + i * 16) + '" y="' + (74 - len) + '" width="13" height="' + (len + 10) + '" rx="6.5" fill="#ffd9b3" stroke="#c58b5a" stroke-width="2"/>';
      }
      out += '<rect x="' + (ox + 8) + '" y="70" width="84" height="46" rx="18" fill="#ffd9b3" stroke="#c58b5a" stroke-width="2"/>';
    });
    const W = 100 * groups.length;
    return '<svg class="fingers" width="' + (W * sc) + '" height="' + (120 * sc) + '" viewBox="0 0 ' + W + ' 120">' + out + '</svg>';
  }

  function coin(v, size) {
    size = size || 56;
    const fill = v >= 5 ? '#ffd54f' : v >= 2 ? '#ffcc80' : '#e0e6ea';
    const edge = v >= 5 ? '#f9a825' : v >= 2 ? '#ef8f1c' : '#90a4ae';
    return '<svg class="coin" width="' + size + '" height="' + size + '" viewBox="0 0 60 60">' +
      '<circle cx="30" cy="30" r="27" fill="' + fill + '" stroke="' + edge + '" stroke-width="4"/>' +
      '<circle cx="30" cy="30" r="20" fill="none" stroke="' + edge + '" stroke-width="1.5" stroke-dasharray="3 3"/>' +
      '<text x="30" y="39" text-anchor="middle" font-size="26" font-weight="800" fill="#5d4037" font-family="inherit">' + v + '</text></svg>';
  }

  // 统一入口：同一个数的四种表示
  function rep(kind, n, size) {
    size = size || 90;
    switch (kind) {
      case 'dots': return dots(n, { size: size });
      case 'fingers': return fingers(n, { size: size });
      case 'blocks': return stack(n, { unit: Math.max(12, Math.round(size / 5.5)), face: false });
      default: return '<span class="numeral" style="color:' + shade(color(n), -0.25) + '">' + n + '</span>';
    }
  }

  // 时钟：短粗蓝色是时针，细长红色是分针。mini 只画 12/3/6/9，给小尺寸的选项用
  function clock(hh, mm, o) {
    o = o || {};
    const size = o.size || 230, mini = !!o.mini;
    let s = '<svg class="clockface" viewBox="0 0 200 200" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<circle cx="100" cy="100" r="95" class="cf-rim"/>';
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      if (mini && !big) continue;
      const a = i * Math.PI / 30, r1 = big ? 80 : 86, sn = Math.sin(a), cs = Math.cos(a);
      s += '<line x1="' + (100 + r1 * sn).toFixed(1) + '" y1="' + (100 - r1 * cs).toFixed(1) + '" x2="' + (100 + 91 * sn).toFixed(1) +
        '" y2="' + (100 - 91 * cs).toFixed(1) + '" class="cf-tick' + (big ? ' big' : '') + '"/>';
    }
    const ha = ((hh % 12) * 30 + mm * 0.5).toFixed(1), ma = (mm * 6).toFixed(1);
    s += '<line x1="100" y1="100" x2="100" y2="54" class="cf-hour" transform="rotate(' + ha + ' 100 100)"/>' +
      '<line x1="100" y1="100" x2="100" y2="26" class="cf-min" transform="rotate(' + ma + ' 100 100)"/>';
    for (let n = 1; n <= 12; n++) {
      if (mini && n % 3) continue;
      const a = n * Math.PI / 6, r = 65;
      s += '<text x="' + (100 + r * Math.sin(a)).toFixed(1) + '" y="' + (100 - r * Math.cos(a)).toFixed(1) +
        '" dy=".35em" text-anchor="middle" class="cf-num' + (mini ? ' mini' : '') + '">' + n + '</text>';
    }
    return s + '<circle cx="100" cy="100" r="7" class="cf-pin"/></svg>';
  }

  NG.blocks = { color, shade, stack, dots, fingers, coin, rep, clock };
})(typeof window !== 'undefined' ? window : globalThis);
