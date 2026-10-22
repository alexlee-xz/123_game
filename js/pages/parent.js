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

  function syncCard() {
    const Y = NG.sync;
    const card = h('div', { class: 'card' });
    let statusEl = null, msgText = '';
    const refreshStatus = () => { if (statusEl) statusEl.textContent = Y.statusText(); };
    const listener = () => {
      if (!card.isConnected) { const i = Y.listeners.indexOf(listener); if (i >= 0) Y.listeners.splice(i, 1); return; }
      refreshStatus();
    };
    Y.listeners.push(listener);

    const say = (t) => { msgText = t; render(); };
    const act = async (fn, okMsg) => {      // 跑一个异步动作：期间显示“正在处理”，结束后显示结果
      say('正在处理…');
      let r;
      try { r = await fn(); } catch (e) { r = { err: (e && e.message) || '失败' }; }
      say(r && r.err ? '⚠️ ' + r.err : okMsg || '');
    };

    function render() {
      card.innerHTML = '';
      card.appendChild(h('h3', null, '☁️ 云同步'));
      const msg = h('div', { class: 'small' }, msgText);
      if (!Y.on()) {
        statusEl = null;
        card.appendChild(h('div', { class: 'small' }, '开启后，多台设备（平板、手机、电脑）会自动共用同一份学习记录。未开启时记录只在本机，不会联网。'));
        if (Y.pending) {
          const p = Y.pending;
          card.appendChild(h('div', { class: 'card', style: { background: '#fff8e1' } },
            h('b', null, '收到一个同步邀请'),
            h('div', { class: 'small' }, '同步码 ' + Y.fmtCode(p.code) + '。加入后会把这台设备和云端的记录合并，两边的进度都不会丢。'),
            h('div', { class: 'row' },
              h('button', { class: 'btn primary', type: 'button', onClick: () => { Y.pending = null; act(() => Y.join(p), '已加入同步'); } }, '加入'),
              h('button', { class: 'btn', type: 'button', onClick: () => { Y.pending = null; render(); } }, '忽略'))));
        }
        card.appendChild(h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onClick: () => { Y.enable('', Y.newCode()); act(() => Y.now(), '已开启。请在其它设备上用下面的同步码或邀请链接加入。'); } }, '开启同步（生成新同步码）')));
        const inp = h('input', { type: 'text', class: 'nameinput', placeholder: '已有同步码或邀请链接', style: { fontSize: '16px', maxWidth: '100%' } });
        card.appendChild(h('div', { class: 'row' }, inp,
          h('button', { class: 'btn', type: 'button', onClick: () => act(() => Y.join(inp.value), '已加入同步') }, '加入')));
      } else {
        const code = Y.fmtCode(Y.state.code), link = Y.link();
        statusEl = h('div', { class: 'kv' }, Y.statusText());
        card.appendChild(statusEl);
        card.appendChild(h('div', { class: 'kv' }, h('b', null, '同步码'), ' ', h('span', { class: 'codebox' }, code)));
        card.appendChild(h('div', { class: 'small' }, '在其它设备的“家长页 → 云同步”里输入同步码，或直接打开下面的邀请链接。请只分享给家人：知道同步码的人都能看到和修改记录。'));
        if (link) {
          const li = h('input', { type: 'text', readonly: true, value: link, style: { width: '100%', fontSize: '13px' } });
          li.addEventListener('focus', () => li.select());
          card.appendChild(li);
        }
        card.appendChild(h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onClick: () => act(() => Y.now(), '') }, '立即同步'),
          h('button', { class: 'btn', type: 'button', onClick: () => { if (confirm('关闭后这台设备不再同步，本机记录保留。确定吗？')) { Y.leave(); say('已关闭同步'); } } }, '关闭同步'),
          h('button', { class: 'btn', type: 'button', onClick: () => { if (confirm('确定删除云端的全部记录吗？本机记录不受影响，之后有设备同步时会把记录重新上传。')) act(() => Y.wipeCloud().then(() => ({})), '云端记录已删除'); } }, '删除云端记录')));
      }
      card.appendChild(msg);
    }
    render();
    return card;
  }

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
    const sndMsg = h('div', { class: 'small' });
    const describeSound = (s) => {
      if (!s.tts) return '⚠️ 这个浏览器不支持朗读。请改用 Chrome、Edge 或 Safari 打开（微信内置浏览器通常不支持）。';
      if (s.muted) return '🔇 声音和朗读开关是关着的，请勾选上面的“声音和朗读”。';
      if (s.voiceCount === 0) return '这台设备还没有加载出语音列表。请稍等几秒再点一次“试听”。';
      if (s.zhCount === 0) return '⚠️ 没有找到中文语音（共 ' + s.voiceCount + ' 个语音都不是中文）。Windows：设置 → 时间和语言 → 语音 里添加中文；Android：系统设置 → 文字转语音输出；iPhone：设置 → 辅助功能 → 朗读内容。';
      return '已找到中文语音：' + (s.voice || '默认') + '。如果还是听不到，请检查设备音量、有没有静音（iPhone 侧边的静音拨片）。' + (s.lastError ? '（最近一次报错：' + s.lastError + '）' : '');
    };
    const sndBtn = h('button', { class: 'btn small', type: 'button', onClick: async () => {
      sndMsg.textContent = '正在试听…';
      sndMsg.textContent = describeSound(await NG.audio.test());
    } }, '🔊 试听');
    voice.addEventListener('change', () => { sndMsg.textContent = describeSound(NG.audio.status()); });
    sndMsg.textContent = describeSound(NG.audio.status());
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '设置'),
      h('label', { class: 'kv' }, '小朋友名字 ', nameIn),
      h('label', { class: 'kv' }, '每天玩多久后提醒休息 ', rest),
      h('label', { class: 'kv' }, '声音和朗读 ', voice, ' ', sndBtn),
      sndMsg));

    // 云同步
    body.appendChild(syncCard());

    // 备份
    const ta = h('textarea', { rows: 4, class: 'backup', placeholder: '把备份文字粘贴到这里，再点“导入”' });
    const bmsg = h('div', { class: 'small' });
    body.appendChild(h('div', { class: 'card' }, h('h3', null, '备份与换设备'),
      h('div', { class: 'small' }, '记录默认保存在这台设备的浏览器里，换设备可以用上面的“云同步”，也可以手动复制备份。'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: () => { ta.value = NG.store.exportJSON(); ta.select(); try { document.execCommand('copy'); bmsg.textContent = '已生成并复制'; } catch (e) { bmsg.textContent = '已生成，请手动复制'; } } }, '导出'),
        h('button', { class: 'btn', type: 'button', onClick: () => { try { NG.store.importJSON(ta.value); bmsg.textContent = '导入成功'; NG.go('/'); } catch (e) { bmsg.textContent = '导入失败：' + e.message; } } }, '导入')),
      ta, bmsg));

    body.appendChild(h('div', { class: 'card danger' }, h('h3', null, '危险操作'),
      h('button', { class: 'btn', type: 'button', onClick: () => { if (confirm('确定清空全部学习记录吗？')) { NG.store.reset(); unlockedAt = 0; NG.go('/'); location.reload(); } } }, '清空全部记录')));
  }
})(typeof window !== 'undefined' ? window : globalThis);
