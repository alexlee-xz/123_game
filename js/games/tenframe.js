/* 十格框：凑十和位值（11-19 是“十和几”）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  function frame(filled, onCell) {
    const cells = [];
    const el = h('div', { class: 'tenframe' });
    for (let i = 0; i < 10; i++) {
      const c = h('button', { class: 'tf-cell' + (i < filled ? ' on' : ''), type: 'button' });
      if (i < filled) c.appendChild(h('span', { class: 'counter red' }));
      else if (onCell) c.addEventListener('click', () => onCell(c, i));
      cells.push(c); el.appendChild(c);
    }
    return { el, cells };
  }

  NG.registerGame({
    id: 'tenframe', stage: 4, icon: '🔟', title: '十格框', blurb: '凑满十',
    round(level, api) {
      const q = L.genTen(level);
      const eq = h('div', { class: 'equation' });
      const choiceBox = h('div');
      const holder = h('div', { class: 'frames' });
      api.stage.append(holder, eq, choiceBox);

      const choose = (key, sayRight, eqText) => NG.ui.choices(api, q.options, q.answer, {
        key, right: { say: sayRight },
        onRight: () => { eq.textContent = eqText; },
        onReveal: () => { eq.textContent = eqText; }
      });

      if (q.mode === 'fill') {
        api.prompt('十格框里有' + L.qtyZh(q.k) + '个，点空格子，把它填满！');
        let placed = 0, asked = false;
        const f = frame(q.k, (cell) => {
          if (api.locked || cell.classList.contains('on')) return;
          cell.classList.add('on'); cell.appendChild(h('span', { class: 'counter blue pop' }));
          placed++; NG.audio.sfx.pop();
          api.say(L.numZh(q.k + placed));
          if (q.k + placed === 10 && !asked) {
            asked = true;
            api.after(900, () => {
              eq.textContent = '放了几个？';
              api.say('你放了几个？');
              choiceBox.appendChild(choose('凑十' + q.k, L.numZh(q.k) + '加' + L.numZh(q.answer) + '等于十', q.k + ' + ' + q.answer + ' = 10'));
            });
          }
        });
        holder.appendChild(f.el);
      } else if (q.mode === 'choose') {
        api.prompt('十格框里有' + L.qtyZh(q.k) + '个，再放几个就满十了？');
        holder.appendChild(frame(q.k).el);
        choiceBox.appendChild(choose('凑十' + q.k, L.numZh(q.k) + '加' + L.numZh(q.answer) + '等于十', q.k + ' + ' + q.answer + ' = 10'));
      } else if (q.mode === 'teen') {
        api.prompt(L.numZh(q.n) + '是十和几？');
        holder.append(frame(10).el, frame(q.answer).el);
        eq.textContent = q.n + ' = 10 + ?';
        choiceBox.appendChild(choose('位值' + q.n, '十加' + L.numZh(q.answer) + '等于' + L.numZh(q.n), q.n + ' = 10 + ' + q.answer));
      } else {
        api.prompt(L.numZh(q.k) + '和几凑成十？');
        holder.appendChild(h('div', { class: 'pairq', html:
          '<span class="n">' + q.k + '</span><span class="op">+</span><span class="mystery-box small">?</span><span class="op">=</span><span class="n">10</span>' }));
        choiceBox.appendChild(choose('凑十' + q.k, L.numZh(q.k) + '和' + L.numZh(q.answer) + '凑成十', q.k + ' + ' + q.answer + ' = 10'));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
