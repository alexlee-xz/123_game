/* 小型 DOM 工具：h() 建元素、choices() 选择题按钮、burst() 庆祝、modal() 弹窗。 */
(function (root) {
  'use strict';
  const NG = root.NG = root.NG || {};

  function append(el, kids) {
    kids.forEach(c => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    });
  }
  function h(tag, props) {
    const el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(k => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.length > 2 && k.indexOf('on') === 0) el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }

  /* 选择题按钮行。
   * options: 选项值数组；answer: 正确值；o.render(v) 返回按钮里的 HTML；o.key 记录易错点。
   * 第一次点错：按钮变灰并轻轻晃动；第二次点错：正确答案会亮起来（脚手架），并由会话器进入下一题。 */
  function choices(api, options, answer, o) {
    o = Object.assign({ render: n => '<span class="numeral">' + n + '</span>', key: '', cls: '' }, o || {});
    const row = h('div', { class: 'choices ' + o.cls });
    const btns = new Map();
    options.forEach(v => {
      const b = h('button', { class: 'choice', type: 'button', html: o.render(v) });
      b.addEventListener('click', () => {
        if (api.locked || b.disabled) return;
        NG.audio.sfx.pop();
        if (o.onPick) o.onPick(v);
        if (v === answer) {
          b.classList.add('good');
          if (o.onRight) o.onRight(v);
          api.right(o.right);
        } else {
          b.classList.add('bad'); b.disabled = true;
          api.wrong({
            key: o.key,
            reveal: () => { btns.get(answer).classList.add('hint'); if (o.onReveal) o.onReveal(); }
          });
        }
      });
      btns.set(v, b); row.appendChild(b);
    });
    return row;
  }

  function burst(parent, emojis) {
    emojis = emojis || ['⭐', '🎉', '✨', '🌟'];
    for (let i = 0; i < 14; i++) {
      const s = h('span', { class: 'burst' }, emojis[i % emojis.length]);
      s.style.setProperty('--dx', (Math.random() * 360 - 180).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.random() * -260 - 20).toFixed(0) + 'px');
      parent.appendChild(s);
      setTimeout(() => s.remove(), 1100);
    }
  }

  function modal(content, o) {
    o = o || {};
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal' }, content);
    back.appendChild(box);
    back.addEventListener('click', e => { if (e.target === back && o.dismissible !== false) close(); });
    function close() { back.remove(); if (o.onClose) o.onClose(); }
    document.body.appendChild(back);
    return { close, box };
  }

  NG.ui = { h, choices, burst, modal };
})(typeof window !== 'undefined' ? window : globalThis);
