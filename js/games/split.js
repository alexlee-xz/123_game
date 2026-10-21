/* 拆数房子：一个数可以拆成两部分（部分-整体）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h, B = NG.blocks;

  function house(N, leftHtml, rightHtml) {
    return h('div', { class: 'house' },
      h('div', { class: 'roof' }, h('span', { class: 'roofnum' }, N)),
      h('div', { class: 'rooms' },
        h('div', { class: 'room left', html: leftHtml }),
        h('div', { class: 'room right', html: rightHtml })));
  }

  NG.registerGame({
    id: 'split', stage: 4, icon: '🏠', title: '拆数房子', blurb: '一个数住着哪两个数',
    round(level, api) {
      const q = L.genSplit(level);
      const eq = h('div', { class: 'equation' });
      const choiceBox = h('div');

      if (q.mode === 'missing') {
        api.prompt(L.numZh(q.N) + '号房子，一间住着' + L.numZh(q.a) + '，另一间住着几？');
        const rightRoom = '<div class="mystery-box small">?</div>';
        const hs = house(q.N, B.stack(q.a, { unit: 24, face: false, color: '#feca57' }), rightRoom);
        const fill = () => {
          hs.querySelector('.room.right').innerHTML = B.stack(q.answer, { unit: 24, face: false, color: '#a29bfe' });
          eq.textContent = q.a + ' + ' + q.answer + ' = ' + q.N;
        };
        api.stage.append(hs, eq, choiceBox);
        choiceBox.appendChild(NG.ui.choices(api, q.options, q.answer, {
          key: q.N + '拆' + q.a,
          right: { say: L.numZh(q.a) + '和' + L.numZh(q.answer) + '，合起来是' + L.numZh(q.N) },
          onRight: fill, onReveal: fill
        }));
      } else {
        api.prompt('哪两个数合起来是' + L.numZh(q.N) + '？');
        const hs = house(q.N, '<div class="mystery-box small">?</div>', '<div class="mystery-box small">?</div>');
        api.stage.append(hs, choiceBox);
        const idxs = q.cards.map((_, i) => i);
        choiceBox.appendChild(NG.ui.choices(api, idxs, q.answerIndex, {
          key: q.N + '拆',
          cls: 'wide',
          render: i => '<span class="pairrow">' + B.stack(q.cards[i][0], { unit: 14, face: false, color: '#feca57' }) +
            '<b>+</b>' + B.stack(q.cards[i][1], { unit: 14, face: false, color: '#a29bfe' }) +
            '</span><span class="paireq">' + q.cards[i][0] + ' + ' + q.cards[i][1] + '</span>',
          right: { say: L.numZh(q.cards[q.answerIndex][0]) + '加' + L.numZh(q.cards[q.answerIndex][1]) + '等于' + L.numZh(q.N) },
          onRight: () => {
            const c = q.cards[q.answerIndex];
            hs.querySelector('.room.left').innerHTML = B.stack(c[0], { unit: 20, face: false, color: '#feca57' });
            hs.querySelector('.room.right').innerHTML = B.stack(c[1], { unit: 20, face: false, color: '#a29bfe' });
          }
        }));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
