/* 游戏注册表：关卡定义 + 游戏列表。游戏文件加载时调用 NG.registerGame()。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  NG.STAGES = [
    { id: 1, title: '认识方块小人', icon: '🧸', blurb: '数一数、看一眼、配一配' },
    { id: 2, title: '描红写数字', icon: '✏️', blurb: '跟着小蜜蜂写数字' },
    { id: 3, title: '合体加法', icon: '🧱', blurb: '把方块合在一起' },
    { id: 4, title: '分身减法', icon: '✂️', blurb: '拿走、拆开、凑十' },
    { id: 5, title: '方块商店', icon: '🛒', blurb: '买东西、找零钱、闯大关' }
  ];
  NG.games = [];
  NG.registerGame = (g) => { NG.games.push(g); };
  NG.byId = (id) => NG.games.find(g => g.id === id);
})(typeof window !== 'undefined' ? window : globalThis);
