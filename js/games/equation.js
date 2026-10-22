/* 算式工坊：把图画、故事和算式连起来。
 * picture：看图选对应的算式；blank：算式里缺一个数；compare：在圆圈里放 > < =；swap：3 + 4 = 4 + □ */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;

  const esc = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 把算式里的 □ / ○ 变成醒目的空格
  const fmt = (t) => esc(t).replace('□', '<span class="hole">?</span>').replace('○', '<span class="hole round">?</span>');

  function sayEq(full) {
    const m = full.match(/^(\d+) ([+-]) (\d+) = (\d+)$/);
    return m ? L.numZh(+m[1]) + (m[2] === '+' ? '加' : '减') + L.numZh(+m[3]) + '等于' + L.numZh(+m[4]) : '';
  }

  NG.registerGame({
    id: 'equation', stage: 6, icon: '🧮', title: '算式工坊', blurb: '图画变算式',
    round(level, api) {
      const q = L.genEquation(level);
      const eq = h('div', { class: 'equation big', html: q.mode === 'picture' ? '' : fmt(q.text) });
      const choiceBox = h('div');
      const stage = api.stage;

      if (q.mode === 'picture') {
        const it = q.item, adding = q.op === 'add';
        const grp = (n, cls, gone) => h('div', { class: 'grp ' + cls },
          Array.from({ length: n }, (_, i) => {
            const off = gone && i >= n - gone;
            return h('span', { class: 'em' + (off ? ' gone' : '') }, h('span', { class: 'ico' }, it.e), off ? h('span', { class: 'x' }, '✖') : null);
          }));
        const pic = adding
          ? h('div', { class: 'eqpic' }, grp(q.a, 'a'), h('div', { class: 'eqmid' }, '＋'), grp(q.b, 'b'))
          : h('div', { class: 'eqpic' }, grp(q.a, 'a', q.b));
        api.prompt(adding
          ? '有' + L.qtyZh(q.a) + it.unit + it.name + '，又来了' + L.qtyZh(q.b) + it.unit + '。哪个算式是对的？'
          : '有' + L.qtyZh(q.a) + it.unit + it.name + '，拿走了' + L.qtyZh(q.b) + it.unit + '。哪个算式是对的？');
        stage.append(pic, eq, choiceBox);
      } else if (q.mode === 'blank') {
        api.prompt('算式里藏了一个数，是几？');
        stage.append(eq, choiceBox);
      } else if (q.mode === 'compare') {
        api.prompt('算一算，圆圈里放哪个符号？大于、小于，还是等于？');
        stage.append(eq, h('div', { class: 'hintline' }, '大于 >　小于 <　等于 ='), choiceBox);
      } else {
        api.prompt(L.numZh(q.a) + '加' + L.numZh(q.b) + '，等于' + L.numZh(q.b) + '加几？换一换位置，结果不变哦');
        stage.append(eq, choiceBox);
      }

      const isEq = q.mode === 'picture';
      choiceBox.appendChild(NG.ui.choices(api, q.options, q.answer, {
        key: q.full,
        cls: isEq ? 'wide' : '',
        render: (v) => isEq ? '<span class="eqopt">' + esc(v) + '</span>' : '<span class="numeral">' + esc(v) + '</span>',
        right: sayEq(q.full) ? { say: sayEq(q.full) } : undefined,
        onRight: () => { eq.innerHTML = esc(q.full); },
        onReveal: () => { eq.innerHTML = esc(q.full); }
      }));
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
