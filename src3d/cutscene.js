// Data-driven cutscene player: letterbox, Ken Burns pan/zoom, crossfades, typewriter
// subtitles, optional voice-over, Enter/click = next, hold Esc = skip.
import { CUTSCENES } from './cutscenes.js';
import { loadVoice, startVoice, stopVoice, duckMusic, sfx } from './audio.js';
import { settings } from './store.js';

const HOLD_MS = 900;
const EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const KEN_BURNS = [
  ['scale(1.06) translate(-1.2%, 0.6%)', 'scale(1.16) translate(1.2%, -0.8%)'],
  ['scale(1.18) translate(1%, 0)', 'scale(1.06) translate(-0.8%, 0.5%)'],
  ['scale(1.05) translate(0, 1%)', 'scale(1.14) translate(0, -1%)'],
  ['scale(1.14) translate(-1%, -0.6%)', 'scale(1.05) translate(0.8%, 0.6%)'],
];

export function playCutscene(id, { onDone } = {}) {
  const shots = CUTSCENES[id] ?? [];
  const el = document.createElement('div');
  el.className = 'cutscene';
  el.innerHTML = `
    <div class="cs-stage"></div>
    <div class="cs-vignette"></div>
    <div class="cs-bar cs-top"></div>
    <div class="cs-bar cs-bottom"><div class="cs-sub"></div></div>
    <div class="cs-title"><div class="cs-title-main">BINARY <span>CORE</span></div><div class="cs-title-rule"></div></div>
    <div class="cs-progress"></div>
    <div class="cs-skip" title="Hold to skip">
      <svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="18"/><circle class="fg" cx="22" cy="22" r="18"/></svg>
      <span>HOLD <b>ESC</b> TO SKIP</span>
    </div>
    <div class="cs-hint">ENTER &nbsp;NEXT</div>
    <button class="cs-skip-btn" type="button">SKIP &nbsp;›</button>
    <div class="cs-fade"></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const stage = $('.cs-stage'), sub = $('.cs-sub'), ring = $('.cs-skip .fg'), prog = $('.cs-progress');
  prog.innerHTML = shots.map(() => '<i></i>').join('');
  const CIRC = 2 * Math.PI * 18;
  ring.style.strokeDasharray = `${CIRC}`;
  ring.style.strokeDashoffset = `${CIRC}`;

  const media = shots.map((s, i) => loadMedia(s, i)); // preload everything up front
  let index = -1, done = false, typing = null, autoTimer = 0, holdStart = 0, holdRaf = 0, token = 0;

  duckMusic(true);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(next, 450);

  async function show(i) {
    const my = ++token;
    clearTimeout(autoTimer);
    stopVoice();
    const shot = shots[i];
    [...prog.children].forEach((d, k) => d.classList.toggle('on', k <= i));
    const m = await media[i];
    if (done || my !== token) return;

    const layer = document.createElement('div');
    layer.className = 'cs-layer';
    layer.appendChild(m);
    stage.appendChild(layer);
    const [from, to] = KEN_BURNS[i % KEN_BURNS.length];
    const kbDur = (shot.duration ?? 5) * 1000 + 3000;
    if (settings.reducedMotion) m.style.transform = 'scale(1.06)';
    else m.animate([{ transform: from }, { transform: to }], { duration: kbDur, easing: 'linear', fill: 'forwards' });
    setTimeout(() => layer.classList.add('in'), 40); // timer, not rAF: works in throttled tabs too
    for (const old of [...stage.children].slice(0, -1)) {
      old.classList.remove('in');
      setTimeout(() => old.remove(), 1300);
    }

    el.classList.toggle('title-card', !!shot.title);
    el.classList.remove('title-in');
    typeText(shot.text ?? '', () => { if (shot.title) el.classList.add('title-in'); });

    const buf = await loadVoice(shot.voice);
    if (done || my !== token) return;
    const voiceDur = startVoice(buf);
    const wait = Math.max(shot.duration ?? 5, voiceDur ? voiceDur + 0.9 : 0) * 1000;
    autoTimer = setTimeout(next, wait);
  }

  function typeText(text, onEnd) {
    clearInterval(typing?.timer);
    sub.textContent = '';
    if (settings.reducedMotion || !text) { sub.textContent = text; typing = null; onEnd(); return; }
    let n = 0;
    typing = {
      onEnd,
      finish() { clearInterval(this.timer); sub.textContent = text; typing = null; onEnd(); },
      timer: setInterval(() => {
        n += 1;
        sub.textContent = text.slice(0, n);
        if (n >= text.length) typing.finish();
      }, 34),
    };
  }

  function next() {
    if (done) return;
    index += 1;
    if (index >= shots.length) finish();
    else show(index);
  }

  // Manual advance: first finish the typing, then move on.
  function advance() {
    if (done) return;
    if (typing) { typing.finish(); return; }
    sfx('ui_move', 0.4);
    next();
  }

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(autoTimer);
    clearInterval(typing?.timer);
    cancelAnimationFrame(holdRaf);
    stopVoice();
    duckMusic(false);
    el.classList.add('out');
    setTimeout(() => { el.remove(); onDone?.(); }, 750);
  }

  function holdBegin() {
    if (holdStart || done) return;
    holdStart = performance.now();
    el.classList.add('holding');
    const tick = () => {
      const f = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
      ring.style.strokeDashoffset = `${CIRC * (1 - f)}`;
      if (f >= 1) { sfx('ui_back', 0.5); finish(); return; }
      holdRaf = requestAnimationFrame(tick);
    };
    tick();
  }
  function holdEnd() {
    holdStart = 0;
    cancelAnimationFrame(holdRaf);
    el.classList.remove('holding');
    ring.style.strokeDashoffset = `${CIRC}`;
  }

  const skipBtn = $('.cs-skip');
  skipBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); holdBegin(); });
  skipBtn.addEventListener('pointerup', (e) => { e.stopPropagation(); holdEnd(); });
  skipBtn.addEventListener('pointerleave', holdEnd);
  const skipTap = $('.cs-skip-btn');
  skipTap.addEventListener('pointerdown', (e) => { e.stopPropagation(); sfx('ui_back', 0.5); finish(); });
  el.addEventListener('pointerdown', (e) => { if (!skipBtn.contains(e.target) && !skipTap.contains(e.target)) advance(); });

  return {
    key(ev, down) {
      if (ev.code === 'Escape') { if (down && !ev.repeat) holdBegin(); else if (!down) holdEnd(); return; }
      if (down && !ev.repeat && (ev.code === 'Enter' || ev.code === 'Space')) advance();
    },
    skip: finish,
  };
}

// ---------- media ----------

function loadMedia(shot, idx) {
  const m = /\.([a-z0-9]+)$/i.exec(shot.image ?? '');
  const base = m ? shot.image.slice(0, -m[0].length) : shot.image;
  const exts = m ? [m[1], ...EXTS.filter((e) => e !== m[1].toLowerCase())] : EXTS;
  return new Promise((resolve) => {
    if (!shot.image) { resolve(paintPlaceholder(shot, idx)); return; }
    let k = 0;
    const tryNext = () => {
      if (k >= exts.length) { resolve(paintPlaceholder(shot, idx)); return; }
      const img = new Image();
      img.className = 'cs-media';
      img.onload = () => resolve(img);
      img.onerror = () => { k += 1; tryNext(); };
      img.src = `${base}.${exts[k]}`;
    };
    tryNext();
  });
}

// ---------- placeholder art (until real cutscene images exist) ----------

const W = 1920, H = 1080;
const AMBER = [255, 169, 77], CYAN = [94, 231, 255], EMBER = [255, 122, 47];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function paintPlaceholder(shot, idx) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.className = 'cs-media';
  const g = c.getContext('2d');
  const r = rng(1234 + idx * 77);
  (ART[shot.art] ?? ART.core)(g, r);
  // film grain
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.035})`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
  return c;
}

function backdrop(g, inner, outer, cx = W / 2, cy = H / 2) {
  const grd = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.75);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
}
function stars(g, r, n, maxA = 0.8) {
  for (let i = 0; i < n; i++) {
    const s = r() < 0.06 ? 2.4 : r() * 1.4 + 0.4;
    g.fillStyle = `rgba(${200 + r() * 55},${210 + r() * 45},255,${r() * maxA})`;
    g.beginPath(); g.arc(r() * W, r() * H, s, 0, Math.PI * 2); g.fill();
  }
}
function glow(g, x, y, rad, col, a = 1) {
  g.globalCompositeOperation = 'lighter';
  const grd = g.createRadialGradient(x, y, 0, x, y, rad);
  grd.addColorStop(0, rgba(col, a)); grd.addColorStop(0.25, rgba(col, a * 0.45)); grd.addColorStop(1, rgba(col, 0));
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
}
function orb(g, x, y, rad, col) {
  glow(g, x, y, rad * 6, col, 0.55);
  const grd = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, rgba(col, 1)); grd.addColorStop(1, rgba(col.map((v) => v * 0.55), 1));
  g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
}

const ART = {
  ship(g, r) {
    backdrop(g, '#0d1426', '#020308', W * 0.7, H * 0.35);
    glow(g, W * 0.78, H * 0.22, 620, [90, 70, 180], 0.3);
    glow(g, W * 0.95, H * 0.1, 500, [255, 160, 90], 0.22); // distant star lighting the hull
    glow(g, W * 0.2, H * 0.8, 600, [30, 90, 140], 0.14);
    stars(g, r, 700);
    // hull silhouette drifting diagonally
    g.save(); g.translate(W * 0.5, H * 0.56); g.rotate(-0.16);
    const hull = g.createLinearGradient(0, -90, 0, 110);
    hull.addColorStop(0, '#4a5470'); hull.addColorStop(0.25, '#232a3a'); hull.addColorStop(1, '#0b0d12');
    g.fillStyle = hull;
    g.beginPath();
    g.moveTo(-780, 10); g.lineTo(-640, -70); g.lineTo(-120, -92); g.lineTo(80, -150); g.lineTo(300, -150);
    g.lineTo(420, -88); g.lineTo(720, -60); g.lineTo(820, 0); g.lineTo(720, 70); g.lineTo(300, 96);
    g.lineTo(80, 150); g.lineTo(-120, 96); g.lineTo(-640, 80); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,190,130,0.75)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-640, -70); g.lineTo(-120, -92); g.lineTo(80, -150); g.lineTo(300, -150); g.lineTo(420, -88); g.lineTo(720, -60); g.stroke();
    for (let i = 0; i < 46; i++) { // dim cabin lights
      g.fillStyle = r() < 0.25 ? 'rgba(94,231,255,0.5)' : 'rgba(120,140,170,0.25)';
      g.fillRect(-560 + i * 26, -30 + (i % 3) * 22, 6, 3);
    }
    for (const y of [-40, 0, 40]) { // dead engines
      g.fillStyle = '#05060a'; g.beginPath(); g.ellipse(-790, y, 18, 30, 0, 0, Math.PI * 2); g.fill();
      glow(g, -800, y, 60, EMBER, 0.12);
    }
    g.restore();
  },
  core(g, r) {
    backdrop(g, '#1b120c', '#030305');
    stars(g, r, 160, 0.35);
    const cx = W / 2, cy = H / 2;
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { // containment rings
      g.strokeStyle = `rgba(255,220,180,${0.16 - i * 0.03})`;
      g.beginPath(); g.ellipse(cx, cy, 260 + i * 110, 90 + i * 40, -0.25, 0, Math.PI * 2); g.stroke();
    }
    glow(g, cx, cy, 520, [255, 230, 190], 0.35);
    orb(g, cx - 95, cy + 10, 70, AMBER);
    orb(g, cx + 95, cy - 10, 70, CYAN);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { // arcs between them
      g.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.3})`; g.lineWidth = 1 + r() * 2;
      g.beginPath(); g.moveTo(cx - 40, cy);
      g.quadraticCurveTo(cx, cy + (r() - 0.5) * 120, cx + 40, cy); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  },
  fracture(g, r) {
    backdrop(g, '#160c0a', '#020203');
    stars(g, r, 140, 0.3);
    const cx = W / 2, cy = H / 2;
    glow(g, cx, cy, 700, [255, 255, 255], 0.22);
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 4;
    g.beginPath(); let x = cx + 40, y = -20; g.moveTo(x, y);
    while (y < H + 20) { x += (r() - 0.5) * 110; y += 40 + r() * 70; g.lineTo(x, y); }
    g.stroke();
    g.lineWidth = 16; g.strokeStyle = 'rgba(255,200,150,0.18)'; g.stroke();
    g.globalCompositeOperation = 'source-over';
    orb(g, cx - 330, cy + 40, 62, AMBER);
    orb(g, cx + 330, cy - 40, 62, CYAN);
    for (let i = 0; i < 70; i++) { // shards
      const a = r() * Math.PI * 2, d = 120 + r() * 520, s = 4 + r() * 16;
      const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.6;
      g.fillStyle = r() < 0.5 ? rgba(AMBER, 0.7) : rgba(CYAN, 0.7);
      g.beginPath(); g.moveTo(px, py - s); g.lineTo(px + s * 0.6, py + s * 0.4); g.lineTo(px - s * 0.5, py + s * 0.5); g.closePath(); g.fill();
    }
  },
  apart(g, r) {
    const left = g.createLinearGradient(0, 0, W, 0);
    left.addColorStop(0, '#1d0f06'); left.addColorStop(0.5, '#050507'); left.addColorStop(1, '#04121a');
    g.fillStyle = left; g.fillRect(0, 0, W, H);
    stars(g, r, 120, 0.3);
    const ly = H * 0.55;
    orb(g, W * 0.27, ly, 66, AMBER);
    for (let i = 0; i < 160; i++) { // Sol burning away: embers rising
      const px = W * 0.27 + (r() - 0.5) * 220, py = ly - r() * 520;
      g.fillStyle = rgba(r() < 0.5 ? AMBER : EMBER, (1 - (ly - py) / 520) * 0.8);
      g.fillRect(px, py, 3, 3);
    }
    orb(g, W * 0.73, ly, 66, CYAN);
    g.lineWidth = 2;
    for (let i = 0; i < 40; i++) { // Cryo boiling: vapour bubbles
      const px = W * 0.73 + (r() - 0.5) * 240, py = ly - 60 - r() * 460, s = 4 + r() * 18;
      g.strokeStyle = rgba(CYAN, (1 - (ly - py) / 520) * 0.6);
      g.beginPath(); g.arc(px, py, s, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W / 2 - 1, 0, 2, H);
  },
  crucible(g, r) {
    backdrop(g, '#24110a', '#030203', W / 2, H * 0.72);
    for (const sx of [-1, 1]) { // reactor walls
      g.fillStyle = '#08090c';
      g.beginPath(); g.moveTo(W / 2 + sx * 980, 0); g.lineTo(W / 2 + sx * 560, H * 0.45); g.lineTo(W / 2 + sx * 600, H); g.lineTo(W / 2 + sx * 1000, H); g.fill();
    }
    const cx = W / 2, cy = H * 0.74;
    glow(g, cx, cy, 760, EMBER, 0.5);
    g.fillStyle = '#120806'; g.beginPath(); g.ellipse(cx, cy, 380, 110, 0, 0, Math.PI * 2); g.fill();
    const pit = g.createRadialGradient(cx, cy, 10, cx, cy, 330);
    pit.addColorStop(0, '#fff1d0'); pit.addColorStop(0.3, '#ff9a3d'); pit.addColorStop(1, 'rgba(120,30,10,0)');
    g.fillStyle = pit; g.beginPath(); g.ellipse(cx, cy, 330, 90, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,170,90,0.85)'; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, 380, 110, 0, 0, Math.PI * 2); g.stroke();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { // heat shimmer
      g.strokeStyle = `rgba(255,150,80,${0.05 + r() * 0.06})`; g.lineWidth = 2;
      g.beginPath();
      for (let y = cy - 80; y > cy - 520; y -= 12) g.lineTo(cx - 240 + i * 60 + Math.sin(y * 0.03 + i) * 14, y);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  },
  title(g, r) {
    g.fillStyle = '#030305'; g.fillRect(0, 0, W, H);
    stars(g, r, 260, 0.45);
    const cy = H * 0.5;
    glow(g, W / 2, cy, 640, [255, 210, 160], 0.14);
    orb(g, W * 0.2, cy, 34, AMBER);
    orb(g, W * 0.8, cy, 34, CYAN);
    g.setLineDash([6, 14]); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W * 0.2 + 60, cy); g.lineTo(W * 0.8 - 60, cy); g.stroke(); g.setLineDash([]);
  },
};
