/* 天平：让两边一样多。用来理解“=”的含义（等量），也是加法/拆数的另一种看法。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const BEAM = 140, ROPE = 64, UNIT = 20;

  function pan(counts) {
    // counts: [{n, color, add}]，从左到右、5 个一行向上堆
    let out = '<line x1="0" y1="0" x2="-52" y2="' + ROPE + '" class="rope"/><line x1="0" y1="0" x2="52" y2="' + ROPE + '" class="rope"/>' +
      '<rect x="-60" y="' + ROPE + '" width="120" height="9" rx="4" class="plate"/>';
    let i = 0;
    counts.forEach(c => {
      for (let k = 0; k < c.n; k++, i++) {
        const col = i % 5, row = Math.floor(i / 5);
        out += '<rect x="' + (-50 + col * (UNIT + 1)) + '" y="' + (ROPE - (row + 1) * (UNIT + 1)) + '" width="' + UNIT + '" height="' + UNIT +
          '" rx="4" fill="' + c.color + '" stroke="rgba(0,0,0,.3)" stroke-width="1.5"' + (c.add ? ' class="added" data-add="1"' : '') + '/>';
      }
    });
    return out;
  }

  NG.registerGame({
    id: 'balance', stage: 3, icon: '⚖️', title: '天平', blurb: '让两边一样多',
    round(level, api) {
      const q = L.genBalance(level);
      api.prompt('让天平平起来！右边还要放几块？');
      const C1 = '#ff6b6b', C2 = '#48dbfb', C3 = '#feca57';
      let added = 0;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 420 270');
      svg.setAttribute('class', 'balance');
      svg.innerHTML = '<path d="M200 70 L170 250 L250 250 Z" class="stand"/><g transform="translate(210,70)">' +
        '<g class="beam"><rect x="' + (-BEAM) + '" y="-5" width="' + (2 * BEAM) + '" height="10" rx="5" class="beamrect"/></g>' +
        '<g class="panL"></g><g class="panR"></g><circle r="9" class="pivot"/></g>';
      const beam = svg.querySelector('.beam'), panL = svg.querySelector('.panL'), panR = svg.querySelector('.panR');

      const leftGroups = q.left.length === 1 ? [{ n: q.left[0], color: C3 }] : [{ n: q.left[0], color: C3 }, { n: q.left[1], color: '#a29bfe' }];
      const eq = h('div', { class: 'equation' });
      const leftTxt = q.left.join(' + ');

      function update() {
        const R = q.right + added, Lt = q.total;
        const th = Math.max(-16, Math.min(16, (R - Lt) * 6));
        const rad = th * Math.PI / 180;
        beam.style.transform = 'rotate(' + th + 'deg)';
        panL.style.transform = 'translate(' + (-BEAM * Math.cos(rad)) + 'px,' + (-BEAM * Math.sin(rad)) + 'px)';
        panR.style.transform = 'translate(' + (BEAM * Math.cos(rad)) + 'px,' + (BEAM * Math.sin(rad)) + 'px)';
        panL.innerHTML = pan(leftGroups);
        panR.innerHTML = pan([{ n: q.right, color: C1 }, { n: added, color: C2, add: true }]);
        eq.textContent = leftTxt + ' = ' + q.right + ' + ' + (added || '?');
      }
      update();

      const addBtn = h('button', { class: 'btn primary', type: 'button' }, '➕ 放一块');
      const subBtn = h('button', { class: 'btn', type: 'button' }, '➖ 拿一块');
      const row = h('div', { class: 'row' }, subBtn, addBtn);
      api.stage.append(svg, eq, row);

      function check() {
        const R = q.right + added;
        if (R === q.total) {
          eq.textContent = leftTxt + ' = ' + q.right + ' + ' + added;
          api.right({ say: L.numZh(q.total) + '等于' + L.numZh(q.right) + '加' + L.numZh(q.need) + '，平衡啦！' });
        } else if (R > q.total) {
          api.wrong({
            say: '放多啦，拿走一块试试',
            key: q.total + '=' + q.right + '+?',
            reveal: () => { added = q.need; update(); }
          });
        }
      }
      addBtn.addEventListener('click', () => {
        if (api.locked || q.right + added >= 12) return;
        added++; NG.audio.sfx.drop(); update(); api.say(L.numZh(q.right + added), {});
        api.after(500, check);
      });
      subBtn.addEventListener('click', () => {
        if (api.locked || added <= 0) return;
        added--; NG.audio.sfx.pop(); update();
      });
      svg.addEventListener('click', e => {
        if (api.locked) return;
        if (e.target.getAttribute && e.target.getAttribute('data-add') && added > 0) { added--; NG.audio.sfx.pop(); update(); }
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
