/* 切水果：平均分。
 * 第 1 级：选哪个切得一样大；第 2 级：沿虚线把水果切成一样大的两半；
 * 第 3 级：自己切两半；第 4 级：切两刀，分成一样大的四份。
 * 判断“一样大”用的是切出来每一块的面积占比（logic.js 的 judgeCut），不是看线画得直不直。 */
(function (root) {
  'use strict';
  const NG = root.NG, L = NG.logic, h = NG.ui.h;
  const NS = 'http://www.w3.org/2000/svg';
  const VIEW = '-30 -30 260 260';

  // 每种食物的画法（画在 200 x 200 的格子里，形状与 L.CUT_SHAPES 一致）
  function body(kind) {
    switch (kind) {
      case 'melon': return '<circle cx="100" cy="100" r="70" fill="#ff6b6b" stroke="#2f9e44" stroke-width="9"/>' +
        '<circle cx="100" cy="100" r="62" fill="none" stroke="#fff5f5" stroke-width="3"/>' +
        [[78, 82], [118, 76], [96, 112], [126, 116], [74, 120], [104, 140], [140, 96]].map(p =>
          '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="3" ry="5" fill="#343a40"/>').join('');
      case 'pizza': return '<circle cx="100" cy="100" r="70" fill="#ffd43b" stroke="#e8590c" stroke-width="9"/>' +
        [[80, 74], [122, 82], [96, 112], [132, 122], [70, 118], [102, 144], [58, 96]].map(p =>
          '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#e03131"/>').join('');
      case 'cake': return '<rect x="30" y="30" width="140" height="140" rx="12" fill="#fff0f6" stroke="#c2255c" stroke-width="7"/>' +
        '<rect x="30" y="30" width="140" height="34" rx="12" fill="#f783ac"/>' +
        [[56, 96], [100, 128], [146, 98], [60, 146], [142, 148]].map(p =>
          '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#e03131"/>').join('');
      default: return '<rect x="30" y="30" width="140" height="140" rx="10" fill="#8d5a3b" stroke="#5c3a21" stroke-width="7"/>' +
        '<path d="M77 30V170M123 30V170M30 77H170M30 123H170" stroke="#a9744f" stroke-width="3" fill="none"/>';
    }
  }
  const lineEl = (ln, cls) => '<line class="' + cls + '" x1="' + ln.x1.toFixed(1) + '" y1="' + ln.y1.toFixed(1) +
    '" x2="' + ln.x2.toFixed(1) + '" y2="' + ln.y2.toFixed(1) + '"/>';

  // 一个选项的小图：水果 + 一刀
  function miniSvg(q, ln) {
    return '<svg viewBox="10 10 180 180" class="fruitmini" xmlns="http://www.w3.org/2000/svg">' + body(q.item.kind) +
      '<line x1="' + ln.x1 + '" y1="' + ln.y1 + '" x2="' + ln.x2 + '" y2="' + ln.y2 + '" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' +
      '<line x1="' + ln.x1 + '" y1="' + ln.y1 + '" x2="' + ln.x2 + '" y2="' + ln.y2 + '" stroke="#495057" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/></svg>';
  }

  let uid = 0;
  // 把水果沿着切线分成几块，并让它们散开一点。lines 是用户切的（或演示用的）直线
  function piecesSvg(q, lines, gap) {
    const id = 'fc' + (++uid);
    let defs = '', out = '';
    const unit = lines.map(ln => {
      const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1, d = Math.hypot(dx, dy) || 1;
      return { ux: dx / d, uy: dy / d, nx: -dy / d, ny: dx / d, mx: (ln.x1 + ln.x2) / 2, my: (ln.y1 + ln.y2) / 2 };
    });
    unit.forEach((u, i) => [1, -1].forEach(s => {
      const K = 600, p = [
        [u.mx - u.ux * K, u.my - u.uy * K], [u.mx + u.ux * K, u.my + u.uy * K],
        [u.mx + u.ux * K + s * u.nx * K, u.my + u.uy * K + s * u.ny * K],
        [u.mx - u.ux * K + s * u.nx * K, u.my - u.uy * K + s * u.ny * K]];
      defs += '<clipPath id="' + id + '_' + i + (s > 0 ? 'p' : 'n') + '"><polygon points="' + p.map(a => a[0].toFixed(0) + ',' + a[1].toFixed(0)).join(' ') + '"/></clipPath>';
    }));
    const n = lines.length;
    for (let key = 0; key < (1 << n); key++) {
      let inner = body(q.item.kind), tx = 0, ty = 0;
      for (let i = 0; i < n; i++) {
        const s = (key >> i) & 1 ? 1 : -1;
        inner = '<g clip-path="url(#' + id + '_' + i + (s > 0 ? 'p' : 'n') + ')">' + inner + '</g>';
        tx += s * unit[i].nx * gap; ty += s * unit[i].ny * gap;
      }
      out += '<g class="piece" data-tx="' + tx.toFixed(1) + '" data-ty="' + ty.toFixed(1) + '">' + inner + '</g>';
    }
    return '<defs>' + defs + '</defs>' + out;
  }

  NG.registerGame({
    id: 'fruit', stage: 6, icon: '🍉', title: '切水果', blurb: '平均分，一样大',
    round(level, api) {
      const q = L.genFruit(level);
      const name = q.item.name;

      if (q.mode === 'choose') {
        api.prompt('两个小朋友要分一个' + name + '。哪一个切得一样大？');
        api.stage.append(h('div', { class: 'bigq' }, '👆 选切得一样大的'), NG.ui.choices(api, q.options, q.answerIndex, {
          key: '平均分', cls: 'fruitopts', render: (i) => miniSvg(q, q.lines[i]),
          right: { say: '对啦，一样大，每个小朋友一半' }
        }));
        return;
      }

      api.prompt(q.pieces === 4
        ? '把' + name + '分给四个小朋友，要切成一样大的四份。用手指划两刀'
        : (q.guide ? '把' + name + '切成一样大的两半。沿着虚线，从一边划到另一边'
          : '把' + name + '切成一样大的两半，分给两个小朋友。用手指从外面划过去'));
      const need = q.pieces === 4 ? 2 : 1;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'fruitpad');
      svg.setAttribute('viewBox', VIEW);
      svg.innerHTML = '<g class="plate"><ellipse cx="100" cy="108" rx="100" ry="96" class="platebg"/></g>' +
        '<g class="whole">' + body(q.item.kind) + '</g><g class="guides"></g><g class="cuts"></g><g class="trail"></g><g class="pieces"></g>';
      const gWhole = svg.querySelector('.whole'), gGuide = svg.querySelector('.guides');
      const gCuts = svg.querySelector('.cuts'), gTrail = svg.querySelector('.trail'), gPieces = svg.querySelector('.pieces');
      const info = h('div', { class: 'bigq' });
      api.stage.append(svg, info);

      let cuts = [], drawing = false, p0 = null, lastHint = 0;
      const setInfo = () => {
        info.textContent = need === 1 ? '👆 从水果外面划过去' : (cuts.length === 0 ? '👆 切第 1 刀' : '👆 再切第 2 刀');
      };
      setInfo();

      function showGuide() {
        gGuide.innerHTML = q.ideal.map(ln => lineEl(ln, 'guideline')).join('') + q.ideal.map(ln => {
          const d = Math.hypot(ln.x2 - ln.x1, ln.y2 - ln.y1) || 1;
          return '<circle class="startdot" cx="' + (100 - (ln.x2 - ln.x1) / d * 92).toFixed(1) + '" cy="' + (100 - (ln.y2 - ln.y1) / d * 92).toFixed(1) + '" r="7"/>';
        }).join('');
      }
      if (q.guide) showGuide();

      function toPt(e) {
        const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
        const r = p.matrixTransform(svg.getScreenCTM().inverse());
        return [r.x, r.y];
      }
      function say(txt, gapMs) {
        const now = Date.now();
        if (now - lastHint < (gapMs || 2500)) return;
        lastHint = now; api.say(txt);
      }
      function separate(lines) {
        gWhole.style.display = 'none'; gCuts.innerHTML = ''; gGuide.innerHTML = '';
        gPieces.innerHTML = piecesSvg(q, lines, q.pieces === 4 ? 7 : 11);
        NG.audio.sfx.cut();
        const ps = Array.prototype.slice.call(gPieces.querySelectorAll('.piece'));
        setTimeout(() => ps.forEach(p => { p.style.transform = 'translate(' + p.dataset.tx + 'px,' + p.dataset.ty + 'px)'; }), 30);
      }

      svg.addEventListener('pointerdown', e => {
        if (api.locked) return;
        e.preventDefault();
        p0 = toPt(e); drawing = true;
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        gTrail.innerHTML = '<line class="knife" x1="' + p0[0].toFixed(1) + '" y1="' + p0[1].toFixed(1) + '" x2="' + p0[0].toFixed(1) + '" y2="' + p0[1].toFixed(1) + '"/>';
      });
      svg.addEventListener('pointermove', e => {
        if (!drawing) return;
        e.preventDefault();
        const p = toPt(e), ln = gTrail.firstChild;
        ln.setAttribute('x2', p[0].toFixed(1)); ln.setAttribute('y2', p[1].toFixed(1));
      });
      function up(e) {
        if (!drawing) return;
        drawing = false; gTrail.innerHTML = '';
        if (api.locked) return;
        const p1 = toPt(e);
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 40 || !L.knifeCrossesShape(q.shape, p0, p1)) {
          say('要从水果的外面，划到另一边的外面哦');
          return;
        }
        const ln = { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] };
        cuts.push(ln);
        gCuts.insertAdjacentHTML('beforeend', lineEl(ln, 'cutline'));
        NG.audio.sfx.cut();
        if (cuts.length < need) { setInfo(); say('再切一刀', 1200); return; }
        const j = L.judgeCut(q.shape, cuts, q.pieces);
        if (j.ok) {
          separate(cuts);
          info.textContent = q.pieces === 4 ? '四份一样大！' : '两半一样大！';
          api.right({ say: q.pieces === 4 ? '切成了一样大的四份，每个小朋友一份' : '切成了一样大的两半，每个小朋友一半', delay: 2800 });
        } else {
          const msg = j.reason === 'miss'
            ? (q.pieces === 4 ? '要切成四块哦，两刀要交叉' : '没有切开哦')
            : '切得不一样大，大小要一样才公平';
          api.wrong({
            key: '平均分', say: msg,
            reveal: () => { cuts = []; separate(q.ideal); }
          });
          if (!api.locked && api.wrongs < 2) {
            cuts = []; gCuts.innerHTML = ''; setInfo();
            showGuide();        // 第一次切歪：给出虚线，下次照着切
          }
        }
      }
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', () => { drawing = false; gTrail.innerHTML = ''; });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
