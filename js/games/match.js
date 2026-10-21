/* 数字配对：数字、点阵、手指、方块塔，把“一样多”的连起来（同一个数的多种表示）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const T = {
    num: '哪个数字和它一样多？', dots: '哪一个点点和它一样多？',
    fingers: '哪个手势和它一样多？', blocks: '哪一座方块塔和它一样多？'
  };
  const NAME = { num: '数字', dots: '点点', fingers: '手势', blocks: '方块塔' };

  NG.registerGame({
    id: 'match', stage: 1, icon: '🔗', title: '数字配对', blurb: '找一样多的',
    round(level, api) {
      const q = L.genMatch(level);
      api.prompt(T[q.to]);
      const target = h('button', {
        class: 'target', type: 'button', html: NG.blocks.rep(q.from, q.n, 130),
        title: '点一点，听听它是几', onClick: () => api.say(L.numZh(q.n))
      });
      const tag = h('div', { class: 'small' }, '点一点它，听听是几');
      const row = NG.ui.choices(api, q.options, q.n, {
        key: NAME[q.from] + '→' + NAME[q.to] + q.n,
        cls: 'wide', render: v => NG.blocks.rep(q.to, v, 96),
        right: { say: L.numZh(q.n) }
      });
      api.stage.append(target, tag, row);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
