/* 积木合体（加法）与积木掉落（减法）。
 * 先操作方块（具象），再看结果（图像），到一定等级才出现算式（抽象）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h, B = NG.blocks;

  /* ---------- 积木合体 ---------- */
  NG.registerGame({
    id: 'merge', stage: 3, icon: '🧱', title: '积木合体', blurb: '把方块合在一起',
    round(level, api) {
      const q = L.genAdd(level);
      const eq = h('div', { class: 'equation' });
      const choiceBox = h('div');
      const row = h('div', { class: 'mergerow' });
      api.stage.append(row, eq, choiceBox);
      const showEq = level >= 2;

      if (q.kind === 'add') {
        api.prompt('把两堆方块拖到一起，合体！');
        const A = h('div', { class: 'tower', html: B.stack(q.a, { unit: 34 }) });
        const plus = h('div', { class: 'op' }, '+');
        const Bw = h('div', { class: 'tower drag', html: B.stack(q.b, { unit: 34 }) });
        row.append(A, plus, Bw);
        const btn = h('button', { class: 'btn primary', type: 'button' }, '🤝 合体！');
        api.stage.insertBefore(btn, eq);
        let merged = false, sx = 0, sy = 0, moved = 0;

        const doMerge = () => {
          if (merged || api.locked) return;
          merged = true; btn.remove();
          NG.audio.sfx.drop();
          const ra = A.getBoundingClientRect(), rb = Bw.getBoundingClientRect();
          Bw.style.transition = 'transform .35s ease';
          Bw.style.transform = 'translate(' + (ra.right - rb.left + 4) + 'px,' + (ra.bottom - rb.bottom) + 'px)';
          api.after(420, () => {
            row.innerHTML = '';
            row.appendChild(h('div', { class: 'tower pop', html: B.stack(q.sum, { unit: 34 }) }));
            api.say(L.qtyZh(q.a) + '个和' + L.qtyZh(q.b) + '个合起来，一共有几个？');
            eq.textContent = '合起来一共有几个？';
            choiceBox.appendChild(NG.ui.choices(api, q.options, q.sum, {
              key: q.a + '+' + q.b,
              right: { say: level >= 2 ? L.numZh(q.a) + '加' + L.numZh(q.b) + '等于' + L.numZh(q.sum) : L.numZh(q.a) + '和' + L.numZh(q.b) + '合起来是' + L.numZh(q.sum) },
              onRight: () => { eq.textContent = showEq ? q.a + ' + ' + q.b + ' = ' + q.sum : q.a + ' 和 ' + q.b + ' 合起来是 ' + q.sum; },
              onReveal: () => { eq.textContent = q.a + ' + ' + q.b + ' = ' + q.sum; }
            }));
          });
        };
        btn.addEventListener('click', doMerge);

        Bw.addEventListener('pointerdown', e => {
          if (merged || api.locked) return;
          e.preventDefault();
          Bw.setPointerCapture(e.pointerId);
          sx = e.clientX; sy = e.clientY; moved = 0; Bw.style.transition = 'none';
          Bw.dataset.drag = '1';
        });
        Bw.addEventListener('pointermove', e => {
          if (Bw.dataset.drag !== '1') return;
          const dx = e.clientX - sx, dy = e.clientY - sy;
          moved = Math.max(moved, Math.hypot(dx, dy));
          Bw.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        });
        const release = e => {
          if (Bw.dataset.drag !== '1') return;
          Bw.dataset.drag = '';
          const ra = A.getBoundingClientRect(), rb = Bw.getBoundingClientRect(), m = 24;
          const hit = !(rb.right < ra.left - m || rb.left > ra.right + m || rb.bottom < ra.top - m || rb.top > ra.bottom + m);
          if (hit || moved < 8) {
            // 吸附到旁边再合体
            Bw.style.transform = '';
            doMerge();
          } else {
            Bw.style.transition = 'transform .3s ease'; Bw.style.transform = '';
          }
        };
        Bw.addEventListener('pointerup', release);
        Bw.addEventListener('pointercancel', release);
      } else {
        // 缺少的加数：a + ? = sum
        api.prompt('几个方块和' + L.qtyZh(q.a) + '个合起来是' + L.qtyZh(q.sum) + '个？');
        const mystery = h('div', { class: 'mystery-box' }, '?');
        row.append(
          h('div', { class: 'tower', html: B.stack(q.a, { unit: 30 }) }),
          h('div', { class: 'op' }, '+'), mystery, h('div', { class: 'op' }, '='),
          h('div', { class: 'tower', html: B.stack(q.sum, { unit: 30 }) }));
        const fill = () => { mystery.className = 'tower pop'; mystery.innerHTML = B.stack(q.b, { unit: 30 }); eq.textContent = q.a + ' + ' + q.b + ' = ' + q.sum; };
        choiceBox.appendChild(NG.ui.choices(api, q.options, q.b, {
          key: q.a + '+?=' + q.sum,
          right: { say: L.numZh(q.a) + '加' + L.numZh(q.b) + '等于' + L.numZh(q.sum) },
          onRight: fill, onReveal: fill
        }));
      }
    }
  });

  /* ---------- 积木掉落（减法） ---------- */
  NG.registerGame({
    id: 'take', stage: 4, icon: '⬇️', title: '积木掉落', blurb: '拿走几个，还剩几个',
    round(level, api) {
      const q = L.genTake(level);
      api.prompt('有' + L.qtyZh(q.n) + '个方块，拿走' + L.qtyZh(q.k) + '个，还剩几个？点方块塔，把方块拿走');
      const tower = h('div', { class: 'tower tap', html: B.stack(q.n, { unit: 34, cells: true }) });
      const info = h('div', { class: 'bigq' }, '拿走 0 / ' + q.k);
      const eq = h('div', { class: 'equation' });
      const choiceBox = h('div');
      api.stage.append(tower, info, eq, choiceBox);
      let removed = 0;
      const cells = Array.prototype.slice.call(tower.querySelectorAll('.cell'));

      tower.addEventListener('click', () => {
        if (api.locked || removed >= q.k) return;
        const g = cells[q.n - 1 - removed];
        g.classList.add('gone');
        removed++;
        NG.audio.sfx.drop();
        api.say(L.numZh(removed));
        info.textContent = '拿走 ' + removed + ' / ' + q.k;
        if (removed === q.k) {
          tower.classList.remove('tap');
          api.after(900, () => {
            info.textContent = '还剩几个？';
            api.say('还剩几个？');
            choiceBox.appendChild(NG.ui.choices(api, q.options, q.answer, {
              key: q.n + '-' + q.k,
              right: { say: L.numZh(q.n) + '减' + L.numZh(q.k) + '等于' + L.numZh(q.answer) },
              onRight: () => { eq.textContent = level >= 2 ? q.n + ' - ' + q.k + ' = ' + q.answer : '还剩 ' + q.answer + ' 个'; },
              onReveal: () => { eq.textContent = q.n + ' - ' + q.k + ' = ' + q.answer; }
            }));
          });
        }
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
