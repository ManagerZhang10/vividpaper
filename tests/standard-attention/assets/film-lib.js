// Attention Is All You Need · HyperFrames prototype · helpers shared by this film's scenes
// (the counterpart of the helpers at the top of references/example-attention.js)
window.FILM = (() => {
  const COL = {
    bg: '#0B0B0E', panel: '#15151A', fg: '#F4F3EF', sub: '#C9C9CF', dim: '#8A8A92', faint: '#3A3A42',
    acc: '#FF6A2C', blue: '#5AA9FF', green: '#3DDC97',
  };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const WORDS = ['The', 'Law', 'will', 'never', 'be', 'perfect', ',', 'but', 'its', 'application', 'should', 'be', 'just'];
  const ITS = 8, LAW = 1, APP = 9;
  // paper Figure 4: in two heads its looks at Law and application; the rest are small illustrative weights (sum 1)
  const ATT = [.03, .38, .03, .03, .02, .05, .01, .05, .04, .30, .02, .02, .02];
  const NS = 'http://www.w3.org/2000/svg';
  function svg(parent, tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e); return e;
  }
  // quadratic curve from a to b bent sideways by `bend` px (pm.js g.curve)
  function curveD(a, b, bend) {
    const [x1, y1] = a, [x2, y2] = b, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const cx = mx - dy / L * bend, cy = my + dx / L * bend;
    return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, mid: [.25 * x1 + .5 * cx + .25 * x2, .25 * y1 + .5 * cy + .25 * y2] };
  }
  // the same sentence, laid out the same way in every scene (pm.js g.tokens with breaks [7], size 38, h 66.5, gap 12)
  function sentence(parent, y, rowGap, prefix) {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '700 38px "VP Sans"';
    const ws = WORDS.map(w => ctx.measureText(w).width + 32), h = 66.5, gap = 12, rows = [[0, 1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]];
    const R = [];
    rows.forEach((r, ri) => {
      let x = 540 - (r.reduce((a, i) => a + ws[i], 0) + gap * (r.length - 1)) / 2;
      r.forEach(i => {
        const el = document.createElement('div');
        el.className = 'tok'; el.id = `${prefix}-w${i}`; el.textContent = WORDS[i];
        const top = y + ri * (h + rowGap);
        Object.assign(el.style, { left: `${x}px`, top: `${top}px`, width: `${ws[i]}px`, height: `${h}px` });
        parent.appendChild(el);
        R[i] = { el, row: ri, x, y: top, w: ws[i], h, cx: x + ws[i] / 2, cy: top + h / 2, top, bottom: top + h };
        x += ws[i] + gap;
      });
    });
    return R;
  }
  // a text label as a DOM element (so HyperFrames' layout audit sees it); x is the anchor per align
  function label(parent, id, html, x, y, o = {}) {
    const el = document.createElement('div');
    el.id = id; el.className = 'lbl ' + (o.cls || ''); el.innerHTML = html;
    const tx = o.align === 'right' ? '-100%' : o.align === 'left' ? '0' : '-50%';
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, fontSize: `${o.size || 30}px`, color: o.color || COL.fg, transform: `translate(${tx}, -50%)` });
    parent.appendChild(el); return el;
  }
  // pill chip (pm.js g.chip); `**…**` → coloured
  function chip(parent, id, s, x, y, o = {}) {
    const c = o.color || COL.acc, size = o.size || 28;
    const html = String(s).replace(/\*\*([^*]+)\*\*/g, `<b style="color:${o.solid ? '#111' : COL.fg}">$1</b>`);
    const el = label(parent, id, html, x, y, { size, align: o.align, color: o.solid ? '#111' : c, cls: 'chip' });
    Object.assign(el.style, { background: o.solid ? c : rgba(c, .16), border: o.solid ? 'none' : `2px solid ${rgba(c, .5)}`,
      padding: `0 ${size * .55}px`, height: `${size * 1.6}px`, lineHeight: `${size * 1.6 - (o.solid ? 0 : 4)}px`, borderRadius: `${size * .8}px` });
    return el;
  }
  // stroke-dash "draw on" for an svg path: returns the from/to vars for gsap
  const drawOn = p => { const n = p.getTotalLength(); p.style.strokeDasharray = `${n} ${n}`; return { from: { strokeDashoffset: n }, to: { strokeDashoffset: 0 } }; };
  return { COL, rgba, WORDS, ITS, LAW, APP, ATT, svg, curveD, sentence, label, chip, drawOn };
})();
