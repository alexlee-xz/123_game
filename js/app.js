/* 路由：#/ 首页，#/play/<id> 玩游戏，#/stickers 贴纸册，#/parent 家长页。 */
(function (root) {
  'use strict';
  const NG = root.NG;
  const rootEl = document.getElementById('app');
  let cleanup = null;

  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    NG.audio.cancel();
    rootEl.innerHTML = '';
    window.scrollTo(0, 0);
    const parts = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean);

    if (!NG.store.hasProfile()) return NG.pages.welcome(rootEl);
    switch (parts[0]) {
      case 'play': {
        const g = NG.byId(parts[1]);
        if (!g) { NG.go('/'); return; }
        const s = NG.session.start(g, rootEl, { onExit: () => NG.go('/') });
        cleanup = s.destroy;
        break;
      }
      case 'stickers': NG.pages.stickers(rootEl); break;
      case 'parent': NG.pages.parent(rootEl); break;
      default: NG.pages.home(rootEl);
    }
  }
  window.addEventListener('hashchange', route);
  route();
})(typeof window !== 'undefined' ? window : globalThis);
