/* 世界格子图：横线是纬线、竖线是经线。NG.geo.map() 返回 { el, hilite, mark }，点一下会把位置换算成 (纬度, 经度)。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  const NS = 'http://www.w3.org/2000/svg';
  const X = (lon) => lon + 180, Y = (lat) => 90 - lat;

  function el(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
    if (text != null) e.textContent = text;
    return e;
  }
  // o: { labels, marks:[{lat,lon,e,name}], onTap(lat,lon), lats, lons }
  function map(o) {
    o = Object.assign({ labels: true, marks: [], lats: [-60, -30, 0, 30, 60], lons: [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150] }, o);
    const svg = el('svg', { viewBox: '-26 -14 412 208', class: 'geosvg', width: '100%' });
    svg.appendChild(el('rect', { x: 0, y: 0, width: 360, height: 180, rx: 6, fill: '#d0ebff', stroke: '#1c7ed6', 'stroke-width': 2 }));
    const lines = { lat: {}, lon: {} };
    o.lats.forEach(v => {
      const ln = el('line', { x1: 0, y1: Y(v), x2: 360, y2: Y(v), stroke: v === 0 ? '#e03131' : '#4dabf7', 'stroke-width': v === 0 ? 3 : 1.2 });
      svg.appendChild(ln); lines.lat[v] = ln;
      if (o.labels || v === 0) svg.appendChild(el('text', { x: -3, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 800, fill: '#1864ab' }, v === 0 ? '0°' : (v > 0 ? '北' : '南') + Math.abs(v)));
    });
    o.lons.forEach(v => {
      const ln = el('line', { x1: X(v), y1: 0, x2: X(v), y2: 180, stroke: v === 0 ? '#2f9e44' : '#4dabf7', 'stroke-width': v === 0 ? 3 : 1.2 });
      svg.appendChild(ln); lines.lon[v] = ln;
      if (o.labels || v === 0) svg.appendChild(el('text', { x: X(v), y: 192, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: '#1864ab' }, v === 0 ? '0°' : (v > 0 ? '东' : '西') + Math.abs(v)));
    });
    svg.appendChild(el('text', { x: 180, y: 10, 'text-anchor': 'middle', 'font-size': 10, fill: '#1864ab' }, '⬆ 北'));
    svg.appendChild(el('text', { x: 180, y: 176, 'text-anchor': 'middle', 'font-size': 10, fill: '#1864ab' }, '⬇ 南'));
    function mark(lat, lon, emoji, name) {
      const g = el('g');
      g.appendChild(el('text', { x: X(lon), y: Y(lat) + 6, 'text-anchor': 'middle', 'font-size': 18 }, emoji));
      if (name) g.appendChild(el('text', { x: X(lon), y: Y(lat) + 18, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 800, fill: '#364fc7' }, name));
      svg.appendChild(g); return g;
    }
    o.marks.forEach(m => mark(m.lat, m.lon, m.e, m.name));
    function hilite(h) {
      if (h.lat != null && lines.lat[h.lat]) { lines.lat[h.lat].setAttribute('stroke', '#f59f00'); lines.lat[h.lat].setAttribute('stroke-width', 4); }
      if (h.lon != null && lines.lon[h.lon]) { lines.lon[h.lon].setAttribute('stroke', '#f59f00'); lines.lon[h.lon].setAttribute('stroke-width', 4); }
      if (h.lat != null && h.lon != null) svg.appendChild(el('circle', { cx: X(h.lon), cy: Y(h.lat), r: 7, fill: 'none', stroke: '#f59f00', 'stroke-width': 3 }));
    }
    svg.addEventListener('click', (ev) => {
      if (!o.onTap) return;
      const m = svg.getScreenCTM(); if (!m) return;
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(m.inverse());
      o.onTap(Math.max(-90, Math.min(90, Math.round(90 - p.y))), Math.max(-180, Math.min(180, Math.round(p.x - 180))));
    });
    const wrap = document.createElement('div'); wrap.className = 'geobox'; wrap.appendChild(svg);
    return { el: wrap, svg, hilite, mark };
  }
  const nearest = (arr, v) => arr.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, arr[0]);
  NG.geo = { map, nearest };
})(typeof window !== 'undefined' ? window : globalThis);
