/* 游戏注册表：关卡定义 + 游戏列表。游戏文件加载时调用 NG.registerGame()。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  NG.STAGES = [
    { id: 1, title: '认识方块小人', icon: '🧸', blurb: '数一数、看一眼、配一配' },
    { id: 2, title: '数字的样子', icon: '✏️', blurb: '写一写、跳一跳、凑十' },
    { id: 3, title: '合体和分身', icon: '🧱', blurb: '合起来、拿走、上下车' },
    { id: 4, title: '等号和算式', icon: '⚖️', blurb: '天平、拆数、写算式' },
    { id: 5, title: '生活里的数学', icon: '🛒', blurb: '买东西、看时钟、分水果' },
    { id: 6, title: '动脑小挑战', icon: '🏆', blurb: '下三子棋、闯大关' }
  ];
  NG.games = [];
  NG.registerGame = (g) => { NG.games.push(g); };
  NG.byId = (id) => NG.games.find(g => g.id === id);
})(typeof window !== 'undefined' ? window : globalThis);
