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
  // 邀请链接 …/#s=xxxx：先存为“待加入”，让大人在家长页（或欢迎页）确认，不会自动覆盖本机记录
  function takeInvite() {
    const m = /^#s=/.test(location.hash);
    if (!m) return;
    NG.sync.pending = NG.sync.parseInput(location.hash);
    history.replaceState(null, '', location.pathname + location.search + '#/' + (NG.store.hasProfile() ? 'parent' : ''));
  }
  takeInvite();
  window.addEventListener('hashchange', () => { takeInvite(); route(); });
  route();

  // 云端有新内容合并进来后刷新当前页面；孩子正在玩的时候不打断，等回到首页再显示
  NG.sync.listeners.push(res => {
    if (res && res.changed && !/^#\/play\//.test(location.hash)) route();
  });
  NG.sync.start();
})(typeof window !== 'undefined' ? window : globalThis);
