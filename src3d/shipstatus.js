// Holographic schematic of the starship Meridian powering up deck-by-deck as Crucibles relight.
import { settings } from './store.js';

let uid = 0;

export function subsystemText(count, total) {
  if (count <= 0) return 'REACTOR DARK · ALL SYSTEMS OFFLINE';
  if (count <= 2) return 'AUXILIARY LIFE SUPPORT RESTORED';
  if (count <= 5) return 'HULL POWER CONDUITS LINKING';
  if (count <= 8) return 'BRIDGE & NAVIGATION SYSTEMS ONLINE';
  if (count <= 11) return 'REACTOR SPINE SURGING · ENGINES PRIMING';
  if (count < total) return 'MAIN CORE APPROACH · THRUSTERS WARMING';
  return 'ALL DECKS ONLINE · MERIDIAN ENGINES IGNITED';
}

export function renderShipStatus(container, { total = 15, solved = new Set(), justLit = -1, compact = false, onIgnite = null } = {}) {
  const id = `ship${++uid}`;
  const count = solved.size;
  const pct = Math.round((count / total) * 100);
  const animateNew = justLit >= 0 && solved.has(justLit) && !settings.reducedMotion;
  const initCount = animateNew ? Math.max(0, count - 1) : count;
  const initPct = Math.round((initCount / total) * 100);

  const nodeX = (i) => 138 + (i * 348) / Math.max(1, total - 1);
  const cy = 95;

  const plumeMarkup = (x, y, len, halfH, main) => {
    if (len <= 1) {
      return `<ellipse class="ship-ember" cx="${x - 3}" cy="${y}" rx="4" ry="${halfH * 0.45}" fill="rgba(255,105,40,0.28)"/>`;
    }
    const tipX = x - len;
    const coreLen = len * 0.62;
    return `
      <g class="ship-plume" style="transform-origin:${x}px ${y}px">
        <path d="M ${x},${y - halfH} Q ${x - len * 0.45},${y - halfH * 0.65} ${tipX},${y} Q ${x - len * 0.45},${y + halfH * 0.65} ${x},${y + halfH} Z"
          fill="url(#${id}_plumeC)" opacity="${main ? 0.72 : 0.56}"/>
        <path d="M ${x},${y - halfH * 0.65} Q ${x - coreLen * 0.45},${y - halfH * 0.35} ${x - coreLen},${y} Q ${x - coreLen * 0.45},${y + halfH * 0.35} ${x},${y + halfH * 0.65} Z"
          fill="url(#${id}_plumeA)" opacity="${main ? 0.95 : 0.85}"/>
      </g>`;
  };

  const buildPlumes = (c) => {
    const p = c / total;
    const len = p <= 0 ? 0 : 18 + Math.pow(p, 0.85) * 76;
    const sideLen = len * 0.72;
    return `
      ${plumeMarkup(104, 66, sideLen, 6.5 + p * 3.5, false)}
      ${plumeMarkup(104, cy, len, 9 + p * 5, true)}
      ${plumeMarkup(104, 124, sideLen, 6.5 + p * 3.5, false)}`;
  };

  let conduits = '';
  let windows = '';
  let nodes = '';
  for (let i = 0; i < total; i++) {
    const x = nodeX(i);
    const isLit = solved.has(i) && !(animateNew && i === justLit);
    const clsLit = isLit ? ' lit' : '';
    if (i > 0) {
      const px = nodeX(i - 1);
      conduits += `
        <line class="ship-cond${clsLit}" data-deck="${i}" x1="${px + 5}" y1="68" x2="${x - 5}" y2="68"/>
        <line class="ship-cond${clsLit}" data-deck="${i}" x1="${px + 5}" y1="122" x2="${x - 5}" y2="122"/>`;
    }
    const winTone = i % 3 === 0 ? 'warm' : 'cyan';
    windows += `
      <rect class="ship-win ${winTone}${clsLit}" data-deck="${i}" x="${(x - 3.5).toFixed(1)}" y="56" width="7" height="3" rx="1"/>
      <rect class="ship-win ${winTone}${clsLit}" data-deck="${i}" x="${(x - 3.5).toFixed(1)}" y="131" width="7" height="3" rx="1"/>`;

    let extra = '';
    if (animateNew && i === justLit) {
      const rays = Array.from({ length: 8 }, (_, k) => {
        const a = (k * Math.PI) / 4;
        const c = Math.cos(a), s = Math.sin(a);
        const col = k % 2 === 0 ? '#ffd88a' : '#5ee7ff';
        return `<line class="ship-spark" x1="${(c * 6).toFixed(1)}" y1="${(s * 6).toFixed(1)}" x2="${(c * 11).toFixed(1)}" y2="${(s * 11).toFixed(1)}" stroke="${col}" style="--sx:${(c * 18).toFixed(1)}px;--sy:${(s * 18).toFixed(1)}px"/>`;
      }).join('');
      extra = `
        <g class="ship-lock">
          <path d="M -11,-5 L -11,-11 L -5,-11 M 5,-11 L 11,-11 L 11,-5 M -11,5 L -11,11 L -5,11 M 5,11 L 11,11 L 11,5"/>
        </g>
        ${rays}`;
    }

    nodes += `
      <g class="ship-node${clsLit}" data-deck="${i}" transform="translate(${x.toFixed(1)}, ${cy})">
        <circle class="ship-burst" r="8"/>
        <circle class="ship-burst2" r="8"/>
        <circle class="ship-halo" r="12"/>
        <circle class="ship-ring" r="7.2"/>
        <circle class="ship-core" r="4.1"/>
        ${extra}
      </g>`;
  }

  const targetX = justLit >= 0 ? nodeX(justLit) : nodeX(0);
  const pulseSvg = animateNew ? `
    <circle class="ship-surge-pulse aft" cx="${targetX.toFixed(1)}" cy="${cy}" r="5.5" opacity="0"/>
    <circle class="ship-surge-pulse bow" cx="${targetX.toFixed(1)}" cy="${cy}" r="4.5" opacity="0"/>` : '';

  const initPower = initCount / total;
  const bridgeOn = initPower >= 0.35;
  const hullStroke = initPower >= 0.6 ? '#5e7da6' : initPower > 0 ? '#404c66' : '#2a3142';
  const showBadge = justLit >= 0;

  container.innerHTML = `
    <div class="ship-status${compact ? ' compact' : ''}">
      <svg class="ship-svg" viewBox="0 10 640 170" role="img" aria-label="Starship Meridian restoration schematic: ${count} of ${total} decks online">
        <defs>
          <linearGradient id="${id}_hull" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#171b26"/>
            <stop offset="55%" stop-color="#252c3d"/>
            <stop offset="100%" stop-color="#1a202d"/>
          </linearGradient>
          <linearGradient id="${id}_spine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#0c0e14"/>
            <stop offset="100%" stop-color="#121621"/>
          </linearGradient>
          <linearGradient id="${id}_plumeC" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stop-color="#5ee7ff" stop-opacity="0.9"/>
            <stop offset="55%" stop-color="#3898d8" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#3898d8" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="${id}_plumeA" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stop-color="#fff4d4"/>
            <stop offset="35%" stop-color="#ffa94d"/>
            <stop offset="100%" stop-color="#ff5a1f" stop-opacity="0"/>
          </linearGradient>
          <radialGradient id="${id}_nodeGlow">
            <stop offset="0%" stop-color="#fff0c2" stop-opacity="0.95"/>
            <stop offset="45%" stop-color="#ff8a3d" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#ff8a3d" stop-opacity="0"/>
          </radialGradient>
          <filter id="${id}_glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        <g class="ship-wings" stroke="${hullStroke}" stroke-width="1.2" fill="#181d29">
          <polygon points="138,70 198,22 248,22 270,64"/>
          <polygon points="138,120 198,168 248,168 270,126"/>
          <rect x="190" y="17" width="22" height="5" rx="1.5" fill="#2b3346"/>
          <rect x="190" y="168" width="22" height="5" rx="1.5" fill="#2b3346"/>
        </g>

        <g fill="#161a24" stroke="#394258" stroke-width="1.2">
          <polygon points="104,58 122,61 122,71 104,74"/>
          <polygon points="98,84 122,87 122,103 98,106"/>
          <polygon points="104,116 122,119 122,129 104,132"/>
        </g>

        <g class="ship-plumes" filter="url(#${id}_glow)">${buildPlumes(initCount)}</g>

        <g stroke="${hullStroke}" stroke-width="1.25">
          <polygon points="122,52 468,52 486,62 486,74 122,74" fill="url(#${id}_hull)"/>
          <polygon points="122,116 486,116 486,128 468,138 122,138" fill="url(#${id}_hull)"/>
        </g>

        <polygon class="ship-hull-main" points="114,72 536,72 574,84 606,95 574,106 536,118 114,118"
          fill="url(#${id}_hull)" stroke="${hullStroke}" stroke-width="1.5"/>

        <rect x="124" y="83" width="376" height="24" rx="4" fill="url(#${id}_spine)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <line x1="134" y1="${cy}" x2="492" y2="${cy}" stroke="rgba(255,169,77,0.14)" stroke-width="1.5"/>

        <g>
          <polygon points="504,77 544,77 554,86 554,104 544,113 504,113" fill="#2a3245" stroke="${hullStroke}" stroke-width="1.2"/>
          <rect class="ship-visor${bridgeOn ? ' lit' : ''}" x="539" y="85" width="5" height="20" rx="1.5"/>
          <line x1="518" y1="81" x2="508" y2="68" stroke="#4c5873" stroke-width="1.2"/>
          <line x1="518" y1="109" x2="508" y2="122" stroke="#4c5873" stroke-width="1.2"/>
        </g>

        ${conduits}
        ${windows}
        ${pulseSvg}
        <g class="ship-nodes" style="--glow-url:url(#${id}_nodeGlow)">${nodes}</g>

        <g class="ship-reticle" visibility="hidden">
          <circle r="13" fill="none" stroke="#5ee7ff" stroke-width="1.4" stroke-dasharray="5 3"/>
          <line x1="0" y1="-17" x2="0" y2="-11" stroke="#5ee7ff" stroke-width="1.4"/>
          <line x1="0" y1="11" x2="0" y2="17" stroke="#5ee7ff" stroke-width="1.4"/>
        </g>
      </svg>

      <div class="ship-meta">
        <div class="ship-meta-row">
          <span class="ship-power">MERIDIAN POWER · <b class="ship-cnt">${count}</b> / ${total} DECKS ONLINE (<span class="ship-pct">${initPct}%</span>)${showBadge ? ` <span class="ship-badge${animateNew ? '' : ' show'}">+1 DECK ONLINE</span>` : ''}</span>
          <span class="ship-subsys">${subsystemText(count, total)}</span>
        </div>
        <div class="ship-bar"><div class="ship-bar-fill" style="width:${initPct}%"></div></div>
      </div>
    </div>`;

  const root = container.firstElementChild;
  const plumesEl = root.querySelector('.ship-plumes');
  const barFill = root.querySelector('.ship-bar-fill');
  const pctEl = root.querySelector('.ship-pct');
  const badgeEl = root.querySelector('.ship-badge');
  const visor = root.querySelector('.ship-visor');
  const reticle = root.querySelector('.ship-reticle');

  if (animateNew) {
    setTimeout(() => {
      if (!root.isConnected) return;
      onIgnite?.();
      root.querySelector('.ship-lock')?.remove();
      root.querySelectorAll(`[data-deck="${justLit}"]`).forEach((el) => {
        el.classList.add('lit');
        if (el.classList.contains('ship-node')) el.classList.add('igniting');
      });
      badgeEl?.classList.add('show');

      const aftPulse = root.querySelector('.ship-surge-pulse.aft');
      const bowPulse = root.querySelector('.ship-surge-pulse.bow');
      aftPulse?.animate?.(
        [{ opacity: 0, transform: 'translateX(0px)' }, { opacity: 1, offset: 0.15 }, { opacity: 0.9, offset: 0.8 }, { opacity: 0, transform: `translateX(${(102 - targetX).toFixed(1)}px)` }],
        { duration: 340, easing: 'cubic-bezier(.25,.8,.4,1)', fill: 'forwards' },
      );
      bowPulse?.animate?.(
        [{ opacity: 0, transform: 'translateX(0px)' }, { opacity: 0.9, offset: 0.18 }, { opacity: 0, transform: `translateX(${(542 - targetX).toFixed(1)}px)` }],
        { duration: 380, easing: 'cubic-bezier(.25,.8,.4,1)', fill: 'forwards' },
      );

      setTimeout(() => {
        if (!root.isConnected) return;
        plumesEl.innerHTML = buildPlumes(count);
        plumesEl.classList.add('surge');
        root.classList.add('hull-surge');
        setTimeout(() => root.classList.remove('hull-surge'), 500);
        if (count / total >= 0.35) visor.classList.add('lit');
        barFill.style.width = `${pct}%`;

        const t0 = performance.now();
        const roll = (now) => {
          if (!root.isConnected) return;
          const f = Math.min(1, (now - t0) / 450);
          pctEl.textContent = `${Math.round(initPct + (pct - initPct) * f)}%`;
          if (f < 1) requestAnimationFrame(roll);
        };
        requestAnimationFrame(roll);
      }, 200);
    }, 280);
  }

  return {
    setHighlight(deckIdx) {
      if (!reticle) return;
      if (deckIdx == null || deckIdx < 0 || deckIdx >= total) {
        reticle.setAttribute('visibility', 'hidden');
      } else {
        reticle.setAttribute('transform', `translate(${nodeX(deckIdx).toFixed(1)}, ${cy})`);
        reticle.setAttribute('visibility', 'visible');
      }
    },
  };
}
