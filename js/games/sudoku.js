/* 数独：每行、每列、每个粗线小格里，数字都不重复。点空格，再点下面的数字。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'sudoku', stage: 6, icon: '🔢', title: '数独', blurb: '每行每列数字不重复',
    round(level, api) {
      const q = L.genSudoku(level);
      const n = q.n;
      api.prompt('把空格填满：每一行、每一列、每个粗线框里，数字都不能重复！');
      const g = q.puzzle.slice();
      let sel = -1;
      const board = h('div', { class: 'sdkboard n' + n });
      const cells = [];
      for (let i = 0; i < n * n; i++) {
        const r = Math.floor(i / n), c = i % n;
        const cell = h('button', { class: 'sdkcell', type: 'button', 'aria-label': '第' + (r + 1) + '行第' + (c + 1) + '列' });
        if (c % q.bw === q.bw - 1 && c !== n - 1) cell.classList.add('rb');
        if (r % q.bh === q.bh - 1 && r !== n - 1) cell.classList.add('bb');
        if (q.puzzle[i]) cell.classList.add('given');
        cell.addEventListener('click', () => select(i));
        cells.push(cell); board.appendChild(cell);
      }
      const pad = h('div', { class: 'sdkpad' });
      for (let v = 1; v <= n; v++) {
        const b = h('button', { class: 'sdknum', type: 'button' }, String(v));
        b.addEventListener('click', () => put(v));
        pad.appendChild(b);
      }
      api.stage.append(board, pad);

      function draw() {
        cells.forEach((c, i) => {
          c.textContent = g[i] ? String(g[i]) : '';
          c.classList.toggle('sel', i === sel);
        });
      }
      function select(i) {
        if (api.locked || q.puzzle[i] || g[i]) return;
        sel = i; NG.audio.sfx.pop(); draw();
      }
      function put(v) {
        if (api.locked || sel < 0) return;
        const i = sel;
        if (q.solution[i] === v) {
          g[i] = v; sel = -1; NG.audio.sfx.pop(); draw();
          if (g.every((x, k) => x === q.solution[k])) api.right({ say: '全部填对啦，真棒！' });
          return;
        }
        cells[i].classList.add('shake');
        api.after(500, () => cells[i].classList.remove('shake'));
        api.wrong({
          say: '这个数字这一行、这一列或这个框里已经有啦，再想一想', key: '数独',
          reveal: () => { g[i] = q.solution[i]; sel = -1; draw(); }
        });
      }
      draw();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
