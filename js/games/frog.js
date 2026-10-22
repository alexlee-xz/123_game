/* 青蛙跳跳：在数轴上跳着做加减。向前跳 = 加，向后跳 = 减。
 * land：点“跳一下”，青蛙每次跳一格，跳完选落在哪个数。
 * steps（第 4 级）：青蛙在起点，旗子在终点，选要跳几步。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const CELL = 30, PADX = 20;

  function lineSvg(q, hide) {
    const w = q.max * CELL + 2 * PADX, y = q.max > 10 ? 68 : 62, ly = q.max > 10 ? 32 : 26;
    const dense = q.max > 10;
    let s = '<svg class="numline' + (dense ? ' dense' : '') + '" viewBox="0 0 ' + w + ' ' + (dense ? 106 : 100) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<line x1="' + PADX + '" y1="' + y + '" x2="' + (w - PADX) + '" y2="' + y + '" class="axis"/>';
    for (let i = 0; i <= q.max; i++) {
      const x = PADX + i * CELL, big = !dense || i % 5 === 0 || i === q.start;
      s += '<line x1="' + x + '" y1="' + (y - (big ? 7 : 4)) + '" x2="' + x + '" y2="' + (y + (big ? 7 : 4)) + '" class="tick"/>';
      if (big && !(hide !== undefined && i === hide)) {
        s += '<text x="' + x + '" y="' + (y + ly) + '" text-anchor="middle" class="tlabel' + (i === q.start ? ' start' : '') + '">' + i + '</text>';
      }
    }
    if (hide !== undefined) {
      s += '<text x="' + (PADX + hide * CELL) + '" y="' + (y + ly) + '" text-anchor="middle" class="tlabel qmark">?</text>';
    }
    return s + '<g class="flagg"></g><g class="frogg"><text class="frog" text-anchor="middle" x="0" y="' + (y - 12) + '">🐸</text></g></svg>';
  }

  NG.registerGame({
    id: 'frog', stage: 6, icon: '🐸', title: '青蛙跳跳', blurb: '在数轴上跳一跳',
    round(level, api) {
      const q = L.genFrog(level);
      const adding = q.op === 'add', steps = q.kind === 'steps';
      const dir = adding ? '向前' : '向后';
      api.prompt(steps
        ? '青蛙要' + (adding ? '跳到' : '跳回') + '旗子那里，要' + dir + '跳几步呢？'
        : '青蛙在' + L.numZh(q.start) + '，' + dir + '跳' + L.qtyZh(q.k) + '步，落在哪里？点一点，让它跳');

      const wrap = h('div', { class: 'frogwrap', html: lineSvg(q, steps ? undefined : q.end) });
      const svg = wrap.querySelector('svg'), frogG = svg.querySelector('.frogg'), frogT = svg.querySelector('.frog');
      const flagG = svg.querySelector('.flagg');
      const info = h('div', { class: 'bigq' });
      const eq = h('div', { class: 'equation' });
      const choiceBox = h('div');
      const xOf = (i) => PADX + i * CELL;
      const place = (i, animate) => {
        frogG.style.transition = animate ? 'transform .32s ease-out' : 'none';
        frogG.style.transform = 'translate(' + xOf(i) + 'px, 0)';
      };
      place(q.start, false);
      if (steps) {
        const yy = q.max > 10 ? 68 : 62;
        flagG.innerHTML = '<line class="pole" x1="' + xOf(q.end) + '" y1="' + (yy - 8) + '" x2="' + xOf(q.end) + '" y2="' + (yy - 38) + '"/>' +
          '<text x="' + (xOf(q.end) + 11) + '" y="' + (yy - 28) + '" text-anchor="middle" class="flag">🚩</text>';
      }
      const sign = adding ? ' + ' : ' - ';
      const eqText = q.start + sign + q.k + ' = ' + q.end;

      function hop(to) {
        place(to, true);
        frogT.classList.remove('hop'); void frogT.getBoundingClientRect(); frogT.classList.add('hop');
        NG.audio.sfx.hop();
      }
      function reveal() {
        const lab = svg.querySelector('.qmark');
        if (lab) { lab.textContent = String(q.end); lab.classList.remove('qmark'); lab.classList.add('got'); }
        eq.textContent = eqText;
      }

      let pos = q.start, moved = 0, asked = false;
      const bar = h('div');
      api.stage.append(wrap, info, bar, eq, choiceBox);

      function ask() {
        if (asked) return; asked = true;
        bar.innerHTML = '';
        info.textContent = steps ? '要跳几步呢？' : '青蛙落在几？';
        api.say(steps ? '要跳几步呢？' : '青蛙落在几？');
        choiceBox.appendChild(NG.ui.choices(api, q.options, q.answer, {
          key: eqText,
          right: { say: L.numZh(q.start) + (adding ? '加' : '减') + L.numZh(q.k) + '等于' + L.numZh(q.end) },
          onRight: () => { if (steps) autoHop(); reveal(); },
          onReveal: () => { if (steps) autoHop(); reveal(); }
        }));
      }
      // 第 4 级“跳几步”：答对或演示时，让青蛙自己一步一步跳过去
      function autoHop() {
        let i = 0, cur = q.start;
        place(cur, false);
        const go = () => {
          if (i >= q.k) return;
          cur += adding ? 1 : -1; i++; hop(cur);
          api.after(380, go);
        };
        api.after(60, go);
      }

      if (steps) {
        info.textContent = '🐸 从 ' + q.start + ' 出发，到 🚩 ' + q.end;
        ask();
      } else {
        info.textContent = '👆 点“跳一下”';
        const btn = h('button', { class: 'btn primary hopbtn', type: 'button' }, '🐸 跳一下');
        btn.addEventListener('click', () => {
          if (api.locked || moved >= q.k) return;
          pos += adding ? 1 : -1; moved++;
          hop(pos);
          // 只报跳了几步，不报落在几，答案要自己看数轴
          api.say(L.numZh(moved));
          info.textContent = '跳了 ' + moved + ' 步';
          if (moved === q.k) { btn.disabled = true; api.after(900, ask); }
        });
        bar.appendChild(btn);
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
