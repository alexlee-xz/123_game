/* 家长页：先答一道算术题（只是防止孩子误点），然后看掌握情况、易错点，调整设置，备份或清空记录。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const pages = NG.pages = NG.pages || {};
  const GATE_MS = 5 * 60 * 1000;
  let unlockedAt = 0;

  const pct = (a, b) => b ? Math.round(a * 100 / b) + '%' : '—';
  const LEVEL_TXT = ['', '入门', '初级', '中级', '高级'];

  pages.parent = function (rootEl) {
    const top = h('div', { class: 'topbar' },
      h('button', { class: 'btn round', type: 'button', onClick: () => NG.go('/') }, '←'),
      h('div', { class: 'title' }, '👪 家长页'));
    const body = h('div', { class: 'parentbody' });
    rootEl.appendChild(h('div', { class: 'screen parent' }, top, body));

    if (Date.now() - unlockedAt < GATE_MS) return dashboard(body);

    const a = L.randInt(Math.random, 11, 29), b = L.randInt(Math.random, 3, 9);
    const input = h('input', { type: 'number', inputmode: 'numeric', class: 'nameinput', placeholder: '答案' });
    const msg = h('div', { class: 'small' });
    const ok = () => {
      if (parseInt(input.value, 10) === a + b) { unlockedAt = Date.now(); body.innerHTML = ''; dashboard(body); }
      else { msg.textContent = '不对哦，请大人来答题'; input.value = ''; }
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    body.append(h('div', { class: 'card center' },
      h('p', null, '请大人回答：'), h('h2', null, a + ' + ' + b + ' = ?'), input,
      h('button', { class: 'btn primary', type: 'button', onClick: ok }, '进入'), msg));
  };

  function dashboard(body) {
    const d = NG.store.get();
    const mins = Math.round(NG.store.todaySeconds() / 60);

    // 总览
    let rounds = 0, ok = 0;
    Object.keys(d.stats).forEach(k => { rounds += d.stats[k].rounds; ok += d.stats[k].ok; });
    body.appendChild(h('div', { class: 'card' },
      h('h3', null, d.name + ' 的学习概况'),
      h('div', { class: 'kv' }, h('b', null, '今天玩了'), ' ' + mins + ' 分钟'),
      h('div', { class: 'kv' }, h('b', null, '累计答题'), ' ' + rounds + ' 题，第一次就答对 ' + pct(ok, rounds)),
      h('div', { class: 'kv' }, h('b', null, '星星 / 贴纸'), ' ' + d.stars + ' 颗 / ' + d.stickers.length + ' 张')));

    // 近 7 天
    const days = [];
    for (let i = 6; i >= 0; i--) { const t = new Date(); t.setDate(t.getDate() - i); days.push(NG.store.dayKey(t)); }
    const maxSec = Math.max(60, ...days.map(k => d.daily[k] || 0));
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '最近 7 天（分钟）'),
      h('div', { class: 'bars' }, days.map(k => {
        const s = d.daily[k] || 0;
        return h('div', { class: 'bar' }, h('div', { class: 'fill', style: { height: Math.round(s / maxSec * 80) + 'px' } }), h('div', { class: 'small' }, Math.round(s / 60)), h('div', { class: 'small' }, k.slice(5)));
      }))));

    // 各游戏掌握情况
    const rows = NG.games.map(g => {
      const s = NG.store.stat(g.id), lv = NG.store.getLevel(g.id);
      return h('tr', null, h('td', null, g.icon + ' ' + g.title), h('td', null, lv + ' ' + LEVEL_TXT[lv]), h('td', null, String(s.rounds)), h('td', null, pct(s.ok, s.rounds)));
    });
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '各游戏掌握情况'),
      h('table', null, h('thead', null, h('tr', null, h('th', null, '游戏'), h('th', null, '等级'), h('th', null, '题数'), h('th', null, '一次答对'))), h('tbody', null, rows)),
      h('div', { class: 'small' }, '等级自动调整：连续 3 次一次答对升一级，连续 2 次没答对降一级。')));

    // 易错点
    const wrong = {};
    NG.games.forEach(g => { const w = NG.store.stat(g.id).wrong; Object.keys(w).forEach(k => { wrong[g.title + '：' + k] = w[k]; }); });
    const top = Object.keys(wrong).sort((a, b) => wrong[b] - wrong[a]).slice(0, 8);
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '常错的题'),
      top.length ? h('ul', null, top.map(k => h('li', null, k + '（' + wrong[k] + ' 次）'))) : h('div', { class: 'small' }, '暂时没有')));

    // 建议
    const played = NG.games.filter(g => NG.store.stat(g.id).rounds >= 5);
    let tip = '先让孩子每天玩 10 分钟左右，从“数数乐”和“闪现点阵”开始。';
    if (played.length) {
      const weak = played.slice().sort((a, b) => NG.store.stat(a.id).ok / NG.store.stat(a.id).rounds - NG.store.stat(b.id).ok / NG.store.stat(b.id).rounds)[0];
      tip = '「' + weak.title + '」答对率最低，可以拿真实物品（积木、水果、硬币）陪孩子摆一摆、数一数，再回来玩。';
    }
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '小建议'), h('p', null, tip)));

    // 设置
    const rest = h('select', null, [0, 10, 15, 20, 30].map(m => h('option', { value: m, selected: d.settings.restMin === m }, m ? m + ' 分钟' : '不提醒')));
    rest.addEventListener('change', () => NG.store.setSetting('restMin', parseInt(rest.value, 10)));
    const voice = h('input', { type: 'checkbox', checked: d.settings.voice !== false });
    voice.addEventListener('change', () => { NG.store.setSetting('voice', voice.checked); NG.store.setSetting('sfx', voice.checked); });
    const nameIn = h('input', { type: 'text', value: d.name, maxlength: 12 });
    nameIn.addEventListener('change', () => NG.store.setName(nameIn.value || '小朋友'));
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '设置'),
      h('label', { class: 'kv' }, '小朋友名字 ', nameIn),
      h('label', { class: 'kv' }, '每天玩多久后提醒休息 ', rest),
      h('label', { class: 'kv' }, '声音和朗读 ', voice)));

    // 备份
    const ta = h('textarea', { rows: 4, class: 'backup', placeholder: '把备份文字粘贴到这里，再点“导入”' });
    const bmsg = h('div', { class: 'small' });
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '备份与换设备'),
      h('div', { class: 'small' }, '记录只保存在这台设备的浏览器里。换设备前请先复制备份。'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: () => { ta.value = NG.store.exportJSON(); ta.select(); try { document.execCommand('copy'); bmsg.textContent = '已生成并复制'; } catch (e) { bmsg.textContent = '已生成，请手动复制'; } } }, '导出'),
        h('button', { class: 'btn', type: 'button', onClick: () => { try { NG.store.importJSON(ta.value); bmsg.textContent = '导入成功'; NG.go('/'); } catch (e) { bmsg.textContent = '导入失败：' + e.message; } } }, '导入')),
      ta, bmsg));

    body.appendChild(h('div', { class: 'card danger' }, h('h3', null, '危险操作'),
      h('button', { class: 'btn', type: 'button', onClick: () => { if (confirm('确定清空全部学习记录吗？')) { NG.store.reset(); unlockedAt = 0; NG.go('/'); location.reload(); } } }, '清空全部记录')));
  }
})(typeof window !== 'undefined' ? window : globalThis);
