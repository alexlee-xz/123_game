/* 本地存储：进度、等级、统计、贴纸、设置。localStorage 不可用时退回内存。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};
  const L = NG.logic;
  const KEY = '123game.v1';

  function blank() {
    return {
      name: '', created: Date.now(),
      resetAt: 0,            // 清空/覆盖导入的时间：同步时“更晚清空”的一边整体胜出
      cfgAt: 0,              // 名字和设置最后改动的时间
      levels: {},            // gameId -> 1..4
      streaks: {},           // gameId -> {streakOk, streakBad}
      stats: {},             // gameId -> {rounds, ok, last, wrong:{key:count}}
      stars: 0, stickers: [],
      log: [],               // 最近 500 条 {t,g,ok,k,lv}
      daily: {},             // 'YYYY-MM-DD' -> 秒
      settings: { voice: true, sfx: true, restMin: 15 }
    };
  }
  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return blank();
  }
  function normalize(d) {
    const b = blank();
    const out = Object.assign(b, d || {});
    out.settings = Object.assign(b.settings, (d && d.settings) || {});
    return out;
  }
  let data = load();

  function save() {
    try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    if (NG.sync && NG.sync.touch) NG.sync.touch();     // 本机有改动，通知云同步（未开启时什么也不做）
  }
  function dayKey(t) {
    const d = t ? new Date(t) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const S = NG.store = {
    get: () => data,
    save,
    dayKey,
    hasProfile: () => !!data.name,
    normalize,
    setName(n) { data.name = String(n || '').trim().slice(0, 12); data.cfgAt = Date.now(); save(); },
    getLevel: (id) => data.levels[id] || 1,
    stat: (id) => data.stats[id] || { rounds: 0, ok: 0, last: 0, wrong: {} },

    // 记录一题的结果，并按自适应规则更新该游戏的等级。返回 {level, changed}
    recordRound(id, r) {
      const s = data.stats[id] || (data.stats[id] = { rounds: 0, ok: 0, last: 0, wrong: {} });
      s.rounds++; if (r.firstTry) s.ok++;
      s.last = Date.now();
      if (!r.firstTry && r.key) s.wrong[r.key] = (s.wrong[r.key] || 0) + 1;
      const st = data.streaks[id] || { streakOk: 0, streakBad: 0 };
      const res = L.adapt({ level: S.getLevel(id), streakOk: st.streakOk, streakBad: st.streakBad }, !!r.firstTry);
      data.levels[id] = res.level;
      data.streaks[id] = { streakOk: res.streakOk, streakBad: res.streakBad };
      data.log.push({ t: Date.now(), g: id, ok: r.firstTry ? 1 : 0, k: r.firstTry ? '' : (r.key || ''), lv: r.level || res.level });
      if (data.log.length > 500) data.log.splice(0, data.log.length - 500);
      save();
      return { level: res.level, changed: res.changed };
    },

    // 发星星，每满 5 颗送一张贴纸。返回新得到的贴纸列表
    awardStars(n) {
      data.stars += n;
      const should = Math.floor(data.stars / L.STARS_PER_STICKER);
      const got = [];
      while (data.stickers.length < should) {
        const s = L.nextSticker(Math.random, data.stickers);
        if (!s) break;
        data.stickers.push(s); got.push(s);
      }
      save();
      return got;
    },
    starsToNextSticker() {
      const per = L.STARS_PER_STICKER;
      return per - (data.stars % per);
    },

    addSeconds(sec) {
      const k = dayKey();
      data.daily[k] = (data.daily[k] || 0) + Math.max(0, Math.round(sec));
      const keys = Object.keys(data.daily).sort();
      while (keys.length > 30) delete data.daily[keys.shift()];
      save();
    },
    todaySeconds: () => data.daily[dayKey()] || 0,
    shouldRest() {
      const m = data.settings.restMin;
      return m > 0 && S.todaySeconds() >= m * 60;
    },

    setSetting(k, v) { data.settings[k] = v; data.cfgAt = Date.now(); save(); },

    // 推荐：最久没玩（或没玩过）的游戏
    recommend(games) {
      let best = null;
      games.forEach(g => {
        const last = S.stat(g.id).last;
        if (!best || last < best.last) best = { g, last };
      });
      return best && best.g;
    },

    exportJSON: () => JSON.stringify(data),
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || typeof d !== 'object' || !d.levels || !d.stats) throw new Error('不是有效的记录');
      data = normalize(d); data.resetAt = Date.now(); data.cfgAt = data.resetAt; save();   // 覆盖导入：同步时以这份为准
    },
    reset() { data = blank(); data.resetAt = Date.now(); save(); },

    // 把合并后的云端记录写回本机（不是孩子的操作，不触发上传）
    replaceFromSync(d) {
      data = normalize(d);
      try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
