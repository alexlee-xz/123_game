/* 数数乐：一个一个点，边点边读（一一对应、稳定顺序），数完回答“一共几个”（基数原则）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'count', stage: 1, icon: '👆', title: '数数乐', blurb: '点一点，数一数',
    round(level, api) {
      const q = L.genCount(level);
      const name = q.item.name;
      api.prompt('数一数，有几个' + name + '？一个一个点哦');

      const field = h('div', { class: 'field ' + q.layout });
      let counted = 0, asked = false;
      const items = [];

      if (q.layout === 'line') {
        for (let i = 0; i < q.n; i++) items.push(field.appendChild(mkItem()));
      } else {
        const slots = L.shuffle(Math.random, Array.from({ length: 12 }, (_, i) => i)).slice(0, q.n).sort((a, b) => a - b);
        for (let i = 0; i < 12; i++) {
          const cell = h('div', { class: 'cell-slot' });
          if (slots.indexOf(i) >= 0) {
            const it = mkItem();
            it.style.transform = 'translate(' + (Math.random() * 14 - 7).toFixed(0) + 'px,' + (Math.random() * 10 - 5).toFixed(0) + 'px)';
            cell.appendChild(it); items.push(it);
          }
          field.appendChild(cell);
        }
      }
      const info = h('div', { class: 'bigq' }, '👆 点一点');
      const choiceBox = h('div');
      api.stage.append(field, info, choiceBox);

      function mkItem() {
        const badge = h('span', { class: 'badge' });
        const b = h('button', { class: 'item', type: 'button' }, q.item.e, badge);
        b.addEventListener('click', () => {
          if (api.locked || b.classList.contains('counted')) return;
          counted++;
          b.classList.add('counted');
          badge.textContent = counted;
          NG.audio.sfx.pop();
          api.say(L.numZh(counted));
          info.textContent = counted;
          if (counted === q.n) api.after(900, ask);
        });
        return b;
      }

      function ask() {
        if (asked) return; asked = true;
        info.textContent = '一共有几个？';
        api.say('一共有几个？');
        choiceBox.appendChild(NG.ui.choices(api, q.options, q.n, {
          key: '数数' + q.n,
          right: { say: '一共' + L.qtyZh(q.n) + q.item.unit + name },
          onReveal: () => api.say('一共' + L.qtyZh(q.n) + q.item.unit)
        }));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
