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
      inner += '<g class="inkdone"></g><g class="inkcur"></g><g class="marker"></g>';
      svg.innerHTML = inner;

      const guide = svg.querySelector('.guide'), inkDone = svg.querySelector('.inkdone');
      const inkCur = svg.querySelector('.inkcur'), marker = svg.querySelector('.marker');

      const checker = new L.TraceChecker(lay.strokes, { tol: q.tol });
      let fails = 0, badStarts = 0, drawing = false, curPath = null, curD = '', peekTimer = null;

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
      function failed() {
        fails++;
        if (dictate) peek();
        if (fails % 2 === 0) {
          api.wrong({
            say: '没关系，再写一次', key: '写' + q.text, delay: 3800,
            reveal: () => {
              guide.style.opacity = 1; guide.classList.add('answer');
              renderMarker(true);
            }
          });
        } else {
          api.say('再试一次，沿着线走哦');
        }
      }

      svg.addEventListener('pointerdown', e => {
        if (api.locked) return;
        e.preventDefault();
        const p = toPt(e);
        if (checker.begin(p)) {
          drawing = true;
          try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          curPath = document.createElementNS(NS, 'path');
          curPath.setAttribute('class', 'ink');
          curD = 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
          curPath.setAttribute('d', curD);
          inkCur.appendChild(curPath);
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
        checker.move(p);
        curD += ' L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        curPath.setAttribute('d', curD);
      });
      function up() {
        if (!drawing) return;
        drawing = false;
        const r = checker.end();
        if (r === 'retry') {
          curPath.remove(); failed();
        } else if (r === 'stroke' || r === 'done') {
          inkDone.appendChild(curPath);
          curPath.setAttribute('class', 'ink okstroke');
          NG.audio.sfx.pop();
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
