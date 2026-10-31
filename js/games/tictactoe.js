/* 三子棋：和电脑轮流下，先把三个连成一条线就赢。赢了或平局都算过关；输了可以再来一局，输两局就看提示、换下一题。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'tictactoe', stage: 6, icon: '⭕', title: '三子棋', blurb: '三个连成一条线就赢', rounds: 3,
    round(level, api) {
      const q = L.genTicTacToe(level);
      api.prompt('你先走，三个连成一条线就赢！');
      let b = [], busy = false;
      const board = h('div', { class: 'tttboard' });
      const cells = [];
      for (let i = 0; i < 9; i++) {
        const c = h('button', { class: 'tttcell', type: 'button', 'aria-label': '格子' + (i + 1) });
        c.addEventListener('click', () => play(i));
        cells.push(c); board.appendChild(c);
      }
      const legend = h('div', { class: 'tttlegend' }, '你是 ' + q.mine.e + '　电脑是 ' + q.theirs.e);
      const tip = h('div', { class: 'msg' });
      api.stage.append(legend, board, tip);

      function draw() {
        cells.forEach((c, i) => {
          c.textContent = b[i] === 1 ? q.mine.e : b[i] === 2 ? q.theirs.e : '';
          c.classList.toggle('taken', !!b[i]);
        });
      }
      function newGame() {
        b = [0, 0, 0, 0, 0, 0, 0, 0, 0]; busy = false; tip.textContent = '';
        cells.forEach(c => c.classList.remove('win'));
        draw();
      }

      function finish(r) {
        busy = true;
        if (r.line) r.line.forEach(i => cells[i].classList.add('win'));
        if (r.winner === 1) api.right({ say: '你连成三个，赢啦！' });
        else if (r.winner === 0) api.right({ say: '平局，也很棒！' });
        else {
          api.wrong({
            say: '这局输啦，再来一局', key: '三子棋',
            reveal: () => { tip.textContent = '小提示：先占中间的格子，再占角'; }
          });
          if (!api.locked) api.after(1500, () => { newGame(); api.prompt('再来一局，你先走！'); });
        }
      }
      function reply() {
        const m = L.tttMove(level, b);
        b[m] = 2; NG.audio.sfx.drop(); draw();
        const r = L.tttResult(b);
        if (r.over) finish(r); else busy = false;
      }
      function play(i) {
        if (api.locked || busy || b[i]) return;
        b[i] = 1; NG.audio.sfx.pop(); draw();
        const r = L.tttResult(b);
        if (r.over) return finish(r);
        busy = true;
        api.after(550, reply);
      }
      newGame();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
