/* 只缓存语音 mp3（audio/v/*.mp3）：听过一次，以后打开不用再等网络。
 * 文件名是台词内容的哈希，同一个名字的内容基本不会变；万一重新生成了语音，把下面的 CACHE 版本号加一即可。
 * 其它文件（页面、脚本）不经过这里，照常由浏览器按 ?v= 版本号处理。 */
'use strict';
const CACHE = 'ng-voice-v1';
const CLIP = /\/audio\/v\/[0-9a-f]+\.mp3$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.indexOf('ng-voice-') === 0 && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// <audio> 会带 Range 请求；缓存里是整个文件，需要切出 206 响应（iOS Safari 对此很严格）
async function slice(req, res) {
  const range = req.headers.get('range');
  if (!range) return res;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const buf = await res.arrayBuffer(), n = buf.byteLength;
  let s = m && m[1] ? +m[1] : 0, e = m && m[2] ? +m[2] : n - 1;
  if (s >= n) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + n } });
  e = Math.min(e, n - 1);
  return new Response(buf.slice(s, e + 1), {
    status: 206,
    headers: { 'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes ' + s + '-' + e + '/' + n, 'Content-Length': String(e - s + 1) }
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin || !CLIP.test(u.pathname) || u.search) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(u.pathname);
    if (hit) return slice(req, hit);
    if (req.headers.get('range')) {                       // 带 Range 的请求先直接走网络，同时在后台取一份完整文件存起来
      e.waitUntil(fetch(u.pathname).then(r => { if (r.ok) return cache.put(u.pathname, r); }).catch(() => {}));
      return fetch(req);
    }
    const res = await fetch(req);
    if (res.ok) { try { await cache.put(u.pathname, res.clone()); } catch (x) { /* ignore */ } }
    return res;
  })());
});
