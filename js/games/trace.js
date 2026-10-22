/* 描红写数字：沿着笔顺描写。
 * 关卡 1：小蜜蜂带路 + 浅色字形；关卡 2：只有浅色字形；关卡 3-4：听写（先不显示字形，需要时可“偷看”）。
 * 判定：必须从起点出发、沿路线依次经过各个点，抬笔太早则这一笔重来（见 logic.js 的 TraceChecker）。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const NS = 'http://www.w3.org/2000/svg';
  const pathD = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

  NG.registerGame({
    id: 'trace', stage: 2, icon: '✏️', title: '描红写数字', blurb: '跟着小蜜蜂写',
    round(level, api) {
      const q = L.genTrace(level);
      const lay = L.layoutText(q.text);
      const dictate = q.mode === 'dictate';
      const numWord = L.numZh(parseInt(q.text, 10));
      api.prompt(dictate ? '听一听，写数字' + numWord : '跟着小蜜蜂，写数字' + numWord);

      const PAD = 26;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'tracepad');
      svg.setAttribute('viewBox', (-PAD) + ' ' + (-PAD) + ' ' + (lay.width + 2 * PAD) + ' ' + (lay.height + 2 * PAD));
      let inner = '';
      // 田字格式的书写框
      for (let g = 0; g < q.text.length; g++) {
        const x = g * (L.GLYPH_W + L.GLYPH_GAP);
        inner += '<rect x="' + (x - 10) + '" y="-10" width="' + (L.GLYPH_W + 20) + '" height="' + (L.GLYPH_H + 20) + '" rx="14" class="box"/>' +
          '<line x1="' + (x + 50) + '" y1="-10" x2="' + (x + 50) + '" y2="' + (L.GLYPH_H + 10) + '" class="mid"/>' +
          '<line x1="' + (x - 10) + '" y1="70" x2="' + (x + L.GLYPH_W + 10) + '" y2="70" class="mid"/>';
      }
      inner += '<g class="guide" style="opacity:' + (dictate ? 0 : 1) + '">' +
        lay.strokes.map(s => '<path d="' + pathD(s.pts) + '"/>').join('') + '</g>';
      inner += '<g class="inkdone"></g><g class="inkcur"></g><g class="ringg"></g><g class="marker"></g>';
      svg.innerHTML = inner;

      const guide = svg.querySelector('.guide'), inkDone = svg.querySelector('.inkdone');
      const inkCur = svg.querySelector('.inkcur'), marker = svg.querySelector('.marker');

      const ringG = svg.querySelector('.ringg');
      const guidePaths = Array.prototype.slice.call(guide.querySelectorAll('path'));
      const checker = new L.TraceChecker(lay.strokes, { tol: q.tol, rail: q.rail, minAcc: q.minAcc, maxStrays: q.maxStrays });
      let fails = 0, badStarts = 0, drawing = false, peekTimer = null;
      let segs = [], curSeg = null, curKind = '', curD = '', offRun = 0, lastHint = 0, lastPt = null;

      // 当前这一笔高亮，写完的变淡，还没写的保持浅灰
      function paintGuide() {
        guidePaths.forEach((gp, i) => {
          gp.setAttribute('class', i < checker.strokeIndex || checker.done ? 'done' : (i === checker.strokeIndex ? 'cur' : ''));
        });
      }
      paintGuide();

      function clearInk() { segs.forEach(s => s.remove()); segs = []; curSeg = null; curKind = ''; curD = ''; hideRing(); }
      function startSeg(p, kind) {
        curSeg = document.createElementNS(NS, 'path');
        curSeg.setAttribute('class', kind === 'off' ? 'ink offpath' : 'ink');
        curD = 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        curSeg.setAttribute('d', curD);
        inkCur.appendChild(curSeg); segs.push(curSeg); curKind = kind;
      }
      function extend(p) {
        curD += ' L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        curSeg.setAttribute('d', curD);
      }
      function showRing() {
        if (ringG.firstChild) return;
        const a = checker.anchor;
        ringG.innerHTML = '<circle class="ring" cx="' + a[0].toFixed(1) + '" cy="' + a[1].toFixed(1) + '" r="14">' +
          '<animate attributeName="r" values="12;19;12" dur="0.9s" repeatCount="indefinite"/></circle>';
      }
      function hideRing() { ringG.innerHTML = ''; offRun = 0; }

      function renderMarker(force) {
        marker.innerHTML = '';
        if (checker.done) return;
        if (dictate && !force) return;
        const s = lay.strokes[checker.strokeIndex], p0 = s.pts[0];
        let m = '<circle class="start" cx="' + p0[0] + '" cy="' + p0[1] + '" r="11"/>';
        if (s.count > 1) m += '<text x="' + p0[0] + '" y="' + (p0[1] + 5) + '" text-anchor="middle" class="ord">' + (s.order + 1) + '</text>';
        if (q.bee || (dictate && force)) {
          m += '<circle class="bee" r="9"><animateMotion dur="2.6s" repeatCount="indefinite" path="' + pathD(s.pts) + '"/></circle>';
        }
        marker.innerHTML = m;
      }
      renderMarker();

      function toPt(e) {
        const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
        const r = p.matrixTransform(svg.getScreenCTM().inverse());
        return [r.x, r.y];
      }
      function peek() {
        guide.style.opacity = 1; renderMarker(true);
        clearTimeout(peekTimer);
        peekTimer = setTimeout(() => { if (dictate && !api.locked) { guide.style.opacity = 0; renderMarker(); } }, 2200);
      }
      function failed(reason) {
        fails++;
        if (dictate) peek();
        else if (q.bee && fails % 2 === 1) renderMarker(true);
        if (fails % 2 === 0) {
          api.wrong({
            say: '没关系，再写一次', key: '写' + q.text, delay: 3800,
            reveal: () => {
              guide.style.opacity = 1; guide.classList.add('answer');
              renderMarker(true);
            }
          });
        } else {
          api.say(reason === 'short' ? '要一直写到终点哦' : '再试一次，沿着线走哦');
        }
      }

      svg.addEventListener('pointerdown', e => {
        if (api.locked) return;
        e.preventDefault();
        const p = toPt(e);
        if (checker.begin(p)) {
          drawing = true;
          try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          clearInk(); startSeg(p, 'on');
        } else {
          badStarts++;
          const s = lay.strokes[checker.strokeIndex];
          marker.classList.remove('flash'); void marker.getBoundingClientRect(); marker.classList.add('flash');
          if (dictate) peek(); else renderMarker();
          if (badStarts % 3 === 0) { api.say('从小圆点开始写'); failed(); }
        }
      });
      svg.addEventListener('pointermove', e => {
        if (!drawing) return;
        e.preventDefault();
        const p = toPt(e);
        const st = checker.move(p);
        if (q.rail) {
          // 轨道模式：走出轨道就不再画线，出现闪动的小圆圈，回到圈里才继续写
          if (st === 'off') {
            curKind = 'off'; offRun++; showRing();
            const now = Date.now();
            if (offRun >= 8 && now - lastHint > 7000) { lastHint = now; api.say('回到小圆圈，沿着线走哦'); }
          } else if (st === 'back') {
            hideRing(); startSeg(p, 'on');
          } else if (curKind !== 'off') {
            extend(p);
          }
        } else {
          // 听写模式：线照常画，偏出轨道的部分变成橙色
          const kind = st === 'off' ? 'off' : (st === 'idle' && curKind ? curKind : 'on');
          if (kind !== curKind) startSeg(lastPt || p, kind);
          extend(p);
        }
        lastPt = p;
      });
      function up() {
        if (!drawing) return;
        drawing = false;
        hideRing();
        const r = checker.end();
        if (r === 'none') { clearInk(); return; }
        if (r === 'retry') {
          clearInk(); failed(checker.report && checker.report.reason);
        } else if (r === 'stroke' || r === 'done') {
          segs.forEach(s => { inkDone.appendChild(s); s.setAttribute('class', 'ink okstroke'); });
          segs = []; curSeg = null;
          NG.audio.sfx.pop();
          paintGuide();
          renderMarker();
          if (r === 'done') {
            marker.innerHTML = '';
            guide.style.opacity = 0.35;
            const single = q.text.length === 1;
            api.right({
              say: single ? L.RHYME[q.text].replace(/^\d/, d => L.numZh(+d)) : numWord,
              delay: 2800
            });
          }
        }
      }
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', up);

      const parts = [svg];
      if (q.text.length === 1) parts.push(h('div', { class: 'rhyme' }, '🎵 ' + L.RHYME[q.text]));
      if (dictate) parts.push(h('button', { class: 'btn', type: 'button', onClick: () => { if (!api.locked) peek(); } }, '👀 偷看一下'));
      api.stage.append.apply(api.stage, parts);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
