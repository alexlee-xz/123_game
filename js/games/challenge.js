/* 数字挑战关：混合出题，难度随等级逐步加入更多类型。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic;

  NG.registerGame({
    id: 'challenge', stage: 5, icon: '🏆', title: '挑战关', blurb: '各种题目一起来',
    round(level, api) {
      const id = L.pickChallenge(level);
      const g = NG.byId(id);
      const sub = Math.max(1, Math.min(4, level + (Math.random() < 0.3 ? -1 : 0)));
      g.round(sub, api);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
