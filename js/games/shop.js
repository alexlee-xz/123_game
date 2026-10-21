/* 商店：用 1、2、5 元的硬币付钱（凑数），以及找零（减法）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h, B = NG.blocks;

  NG.registerGame({
    id: 'shop', stage: 5, icon: '🛒', title: '小商店', blurb: '付钱、找零',
    round(level, api) {
      const q = L.genShop(level);
      const card = h('div', { class: 'itemcard' }, h('div', { class: 'ie' }, q.item.e), h('div', { class: 'price' }, q.price + ' 元'));
      const msg = h('div', { class: 'msg' });
      const choiceBox = h('div');

      if (q.mode === 'change') {
        api.prompt(q.item.name + L.numZh(q.price) + '元，你给了' + L.numZh(q.paid) + '元，要找回几元？');
        const paid = h('div', { class: 'paid', html: B.coin(q.paid, 72) + '<div class="small">你给的钱</div>' });
        api.stage.append(h('div', { class: 'shoprow' }, card, paid), msg, choiceBox);
        choiceBox.appendChild(NG.ui.choices(api, q.options, q.answer, {
          key: q.paid + '-' + q.price,
          right: { say: '找回' + L.numZh(q.answer) + '元' },
          onRight: () => { msg.textContent = q.paid + ' - ' + q.price + ' = ' + q.answer; },
          onReveal: () => { msg.textContent = q.paid + ' - ' + q.price + ' = ' + q.answer; }
        }));
        return;
      }

      api.prompt(q.item.name + L.numZh(q.price) + '元，请用硬币付钱吧');
      let tray = [];
      const total = () => tray.reduce((a, b) => a + b, 0);
      const trayEl = h('div', { class: 'tray' });
      const totalEl = h('div', { class: 'total' });
      const purse = h('div', { class: 'purse' });

      function redraw() {
        trayEl.innerHTML = '';
        if (!tray.length) trayEl.appendChild(h('span', { class: 'small' }, '点下面的硬币，放到这里'));
        tray.forEach((v, i) => {
          const b = h('button', { class: 'traycoin', type: 'button', html: B.coin(v, 52), 'aria-label': '拿回' + v + '元' });
          b.addEventListener('click', () => { if (api.locked) return; tray.splice(i, 1); NG.audio.sfx.pop(); msg.textContent = ''; redraw(); });
          trayEl.appendChild(b);
        });
        totalEl.textContent = q.showTotal ? '一共 ' + total() + ' 元' : '';
      }
      L.COINS.forEach(v => {
        const b = h('button', { class: 'coinbtn', type: 'button', html: B.coin(v, 64), 'aria-label': v + '元' });
        b.addEventListener('click', () => {
          if (api.locked || tray.length >= 12) return;
          tray.push(v); NG.audio.sfx.pop(); msg.textContent = ''; redraw();
          api.say(L.numZh(v) + '元', {});
        });
        purse.appendChild(b);
      });
      const pay = h('button', { class: 'btn primary', type: 'button' }, '付钱');
      pay.addEventListener('click', () => {
        if (api.locked) return;
        const t = total();
        if (t === q.price) {
          api.right({ say: '刚好' + L.numZh(q.price) + '元，谢谢！' });
        } else {
          const diff = Math.abs(q.price - t);
          const text = t === 0 ? '先放几个硬币吧' : t < q.price ? '还差' + L.numZh(diff) + '元' : '多了' + L.numZh(diff) + '元';
          msg.textContent = text;
          if (t === 0) { api.say(text); return; }
          api.wrong({
            say: text,
            key: '付' + q.price,
            reveal: () => { tray = L.minCoins(q.price); redraw(); msg.textContent = q.price + ' 元可以这样付'; }
          });
        }
      });
      api.stage.append(card, trayEl, totalEl, msg, purse, pay);
      redraw();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
