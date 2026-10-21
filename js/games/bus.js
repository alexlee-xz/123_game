/* 小动物上下车：用小故事做加减法。上车 = 加，下车 = 减。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  NG.registerGame({
    id: 'bus', stage: 3, icon: '🚌', title: '上下车', blurb: '小动物上车、下车',
    round(level, api) {
      const q = L.genBus(level);
      const e = q.animal.e, name = q.animal.name;
      const adding = q.op === 'add';
      api.prompt(adding
        ? '车上有' + L.qtyZh(q.n) + '只' + name + '，又上来' + L.qtyZh(q.k) + '只。现在车上有几只？点一点，让它们上车'
        : '车上有' + L.qtyZh(q.n) + '只' + name + '，下去' + L.qtyZh(q.k) + '只。现在车上还有几只？点一点，让它们下车');

      // 车厢：两排 5 个座位
      const seats = [];
      const bus = h('div', { class: 'bus' });
      const body = h('div', { class: 'busbody' });
      for (let i = 0; i < 10; i++) {
        const s = h('div', { class: 'seat' });
        seats.push(s); body.appendChild(s);
      }
      bus.append(h('div', { class: 'busroof' }, '🚌'), body);
      const stop = h('div', { class: 'stop' });
      const info = h('div', { class: 'bigq' });
      const eq = h('div', { class: 'equation' });
      const choiceBox = h('div');
      const scene = h('div', { class: 'busscene' }, bus, stop);
      api.stage.append(scene, info, eq, choiceBox);

      let onBus = q.n, moved = 0, asked = false;
      const animals = [];
      function seatAnimal(i) {
        const a = h('button', { class: 'animal', type: 'button' }, e);
        seats[i].appendChild(a); animals[i] = a; return a;
      }
      for (let i = 0; i < q.n; i++) seatAnimal(i);

      if (adding) {
        info.textContent = '👆 点一点，上车';
        for (let i = 0; i < q.k; i++) {
          const w = h('button', { class: 'animal waiting', type: 'button' }, e);
          w.addEventListener('click', () => {
            if (api.locked || w.dataset.used) return;
            w.dataset.used = '1';
            w.classList.add('boarding');
            NG.audio.sfx.pop();
            const slot = onBus; onBus++; moved++;
            api.after(250, () => { w.remove(); seatAnimal(slot).classList.add('pop'); });
            // 只报“上来了几只”，不报车上总数，否则就把答案说出来了
            api.say(L.numZh(moved));
            info.textContent = '上来了 ' + moved + ' 只';
            if (moved === q.k) api.after(1000, ask);
          });
          stop.appendChild(w);
        }
      } else {
        info.textContent = '👆 点一点，下车';
        stop.appendChild(h('div', { class: 'stoptext' }, '🚏 站台'));
        const handler = (i) => () => {
          if (api.locked || moved >= q.k || !animals[i] || animals[i].dataset.gone) return;
          animals[i].dataset.gone = '1';
          animals[i].classList.add('leaving');
          NG.audio.sfx.pop();
          onBus--; moved++;
          api.say(L.numZh(moved));
          info.textContent = '下车了 ' + moved + ' 只';
          if (moved === q.k) api.after(1000, ask);
        };
        for (let i = 0; i < q.n; i++) animals[i].addEventListener('click', handler(i));
      }

      function ask() {
        if (asked) return; asked = true;
        info.textContent = '现在车上有几只？';
        api.say('现在车上有几只？');
        choiceBox.appendChild(NG.ui.choices(api, q.options, q.answer, {
          key: adding ? q.n + '+' + q.k : q.n + '-' + q.k,
          right: { say: adding ? L.numZh(q.n) + '加' + L.numZh(q.k) + '等于' + L.numZh(q.answer) : L.numZh(q.n) + '减' + L.numZh(q.k) + '等于' + L.numZh(q.answer) },
          onRight: () => { if (level >= 3) eq.textContent = q.n + (adding ? ' + ' : ' - ') + q.k + ' = ' + q.answer; },
          onReveal: () => { eq.textContent = q.n + (adding ? ' + ' : ' - ') + q.k + ' = ' + q.answer; }
        }));
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
