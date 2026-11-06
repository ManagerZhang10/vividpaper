// VividPaper standard engine · https://github.com/ManagerZhang10/vividpaper
// What a scene can read: window.VP. build.py copies this file to assets/vp/kit.js and loads it after assets/vp/timing.js
// (window.VP_TIMING: every scene's start and length and every caption line's start and end, in seconds, computed from
// film.json and the voice-over). Scenes hang their motion on caption lines with VP.scene(id).L(i), so a voiced build and a
// silent build of the same scenes stay in step.
(() => {
  const T = window.VP_TIMING;
  if (!T) throw new Error('assets/vp/timing.js 没有加载：index.html 是 build.py 生成的，不要手改');
  function scene(id) {
    const s = T.scenes.find(x => x.id === id);
    if (!s) throw new Error(`film.json 里没有这一幕：${id}`);
    const line = i => { if (!s.lines[i]) throw new Error(`L(${i}) 超出「${id}」的字幕条数 ${s.lines.length}`); return s.lines[i]; };
    return {
      ...s,
      L: i => line(i).t0,                                          // when caption line i starts (seconds, scene-local)
      Le: i => line(i).t1,                                         // when it ends
      at: (i, f) => line(i).t0 + (line(i).t1 - line(i).t0) * f,    // when line i is f of the way through (0.6 = 六成)
    };
  }
  // A paper figure with its source written under it (AGENTS.md rule 4). Plain markup: animate the returned <figure> like
  // anything else. The same markup can be written by hand: <figure class="vp-figure"><img …><figcaption class="vp-source">…
  function figure(parent, o) {
    if (!o || !o.src || !o.source) throw new Error('VP.figure 要给 src 和 source（出处，例如「图：论文 Figure 4」）');
    const f = document.createElement('figure'); f.className = 'vp-figure' + (o.className ? ' ' + o.className : ''); if (o.id) f.id = o.id;
    Object.assign(f.style, { left: `${o.x ?? 0}px`, top: `${o.y ?? 0}px`, width: `${o.w ?? 600}px` });
    const im = document.createElement('img'); im.src = o.src; im.alt = o.alt || o.source;
    const cap = document.createElement('figcaption'); cap.className = 'vp-source'; cap.textContent = o.source;
    f.append(im, cap); parent.appendChild(f);
    return f;
  }
  // VP Sans (Noto Sans SC cut to this film's characters, 400 and 700) is embedded; await this before measuring text
  const fontsReady = Promise.all(['400', '700'].map(w => document.fonts.load(`${w} 30px "VP Sans"`, '字A'))).catch(e => console.warn('VP Sans 没加载上', e));
  window.VP = { timing: T, layout: T.layout, scene, figure, fontsReady };
})();
