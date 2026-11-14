/* 跑道：NG.track({cells, rows:[{e, v, t}]}) 画出跑道和小动物，点“出发”后小动物按每秒 v 格跑 t 秒（时间加快为 1 秒 = 0.6 秒）。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  const h = () => NG.ui.h;
  const SCALE = 0.6;

  function track(o) {
    const H = h();
    const wrap = H('div', { class: 'trackbox' });
    const rows = o.rows.map(r => {
      const animal = H('span', { class: 'tkanimal' }, r.e);
      const lane = H('div', { class: 'tklane' }, animal);
      lane.style.setProperty('--n', o.cells);
      if (r.label) wrap.appendChild(H('div', { class: 'tklabel' }, r.label));
      wrap.appendChild(lane);
      return { r, animal };
    });
    const nums = H('div', { class: 'tknums' });
    for (let i = 0; i <= o.cells - 1; i++) nums.appendChild(H('span', { style: { left: (i / o.cells * 100) + '%' } }, String(i)));
    wrap.appendChild(nums);
    const place = (animal, cell, secs) => {
      animal.style.transition = secs ? 'left ' + secs + 's linear' : 'none';
      animal.style.left = (cell / o.cells * 100) + '%';
    };
    rows.forEach(x => place(x.animal, 0, 0));
    let timer = null;
    const btn = H('button', { class: 'gobtn', type: 'button' }, '▶ 出发');
    const clock = H('span', { class: 'tkclock' }, '');
    function run() {
      rows.forEach(x => place(x.animal, 0, 0));
      if (timer) clearInterval(timer);
      void wrap.offsetWidth;
      const T = Math.max.apply(null, rows.map(x => x.r.t));
      rows.forEach(x => place(x.animal, x.r.v * x.r.t, x.r.t * SCALE));
      const t0 = Date.now();
      timer = setInterval(() => {
        const sec = Math.min(T, (Date.now() - t0) / 1000 / SCALE);
        clock.textContent = '⏱ ' + Math.floor(sec) + ' 秒';
        if (sec >= T) { clearInterval(timer); timer = null; clock.textContent = '⏱ ' + T + ' 秒'; if (o.onDone) o.onDone(); }
      }, 100);
      if (o.onStart) o.onStart();
    }
    btn.addEventListener('click', () => { NG.audio.unlock && NG.audio.unlock(); run(); });
    const bar = H('div', { class: 'tkbar' }, btn, clock);
    // 直接显示结果位置（不动画），用于答错后的演示
    return { el: H('div', null, wrap, bar), run, showEnd() { rows.forEach(x => place(x.animal, x.r.v * x.r.t, 0)); } };
  }
  NG.track = track;
})(typeof window !== 'undefined' ? window : globalThis);
