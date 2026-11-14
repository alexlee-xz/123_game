/* 格子找宝藏：用“第几行第几列”找位置——这是经纬度的第一步：两个数字合起来才能找到一个点。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'geogrid', stage: 8, icon: '🗺️', title: '格子找宝藏', blurb: '第几行，第几列',
    round(level, api) {
      const q = L.genGrid(level);
      const n = q.n;
      const box = h('div', { class: 'ggrid n' + n + (q.onLines ? ' online' : '') });
      const cells = [];
      const nums = (cls) => { const d = h('div', { class: cls }); for (let i = 1; i <= n; i++) d.appendChild(h('span', null, String(i))); return d; };
      const body = h('div', { class: 'gbody' });
      for (let r = 1; r <= n; r++) for (let c = 1; c <= n; c++) {
        const cell = h('button', { class: 'gcell', type: 'button', 'aria-label': '第' + r + '行第' + c + '列' });
        cells.push(cell); body.appendChild(cell);
        if (q.mode === 'tap') cell.addEventListener('click', () => {
          if (api.locked) return;
          NG.audio.sfx.pop();
          if (r === q.r && c === q.c) { cell.textContent = q.item; cell.classList.add('good'); api.right({ say: '找到啦，宝藏在' + q.say }); }
          else { cell.classList.add('bad'); cell.disabled = true; api.wrong({ key: '格子找宝藏', reveal: () => { cells[(q.r - 1) * n + q.c - 1].classList.add('hint'); } }); }
        });
      }
      box.append(h('div', { class: 'gtop' }, h('span', { class: 'gcorner' }, ''), nums('gcols')), h('div', { class: 'grow' }, nums('grows'), body));
      if (q.mode === 'tap') {
        api.prompt(q.onLines ? '' : '宝藏在' + q.say + '，点一点！');
        api.stage.append(h('div', { class: 'hintline' }, '先找第几行（从上往下数），再找第几列（从左往右数）'), box);
      } else {
        cells[(q.r - 1) * n + q.c - 1].textContent = q.item;
        api.prompt(q.onLines ? '宝藏在哪两条线的交叉点上？' : '宝藏在哪里？');
        api.stage.append(h('div', { class: 'hintline' }, q.onLines ? '横线从上往下数，竖线从左往右数' : '先说行，再说列'), box,
          NG.ui.choices(api, q.options, q.answer, { cls: 'wide', key: '格子找宝藏', render: v => '<span class="clocklabel">' + v + '</span>', right: { say: '宝藏在' + q.say } }));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
