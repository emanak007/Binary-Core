// Three.js scene pieces for Binary Core 3D: blocks, vents, crucible, elements, effects.
// Pure presentation: reads level/state, never changes rules.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const COL = { sol: 0xffa94d, cryo: 0x5ee7ff, alloy: 0xfff0c2, bg: 0x0d0f14 };

// Cell (x east, y south, z up) -> Three.js (x, up, z). Origin at the level's centre.
export function cellToWorld(level, x, y, z, out = new THREE.Vector3()) {
  return out.set(x - (level.w - 1) / 2, z, y - (level.d - 1) / 2);
}

// ---------- materials ----------

const TEX_FILES = { '#': 'warm', c: 'cold', h: 'hot', '=': 'grate', X: 'crucible', wall: 'wall' };

export function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const m = {
    '#': std({ color: 0x48505f, roughness: 0.78, metalness: 0.25 }),
    c: std({ color: 0x3a6f92, roughness: 0.35, metalness: 0.2, emissive: 0x1a7fb0, emissiveIntensity: 0.28 }),
    h: std({ color: 0x5a2616, roughness: 0.6, metalness: 0.3, emissive: 0xff5a1f, emissiveIntensity: 0.8 }),
    '=': std({ color: 0x6b7588, roughness: 0.45, metalness: 0.7 }),
    X: std({ color: 0x3a1e10, roughness: 0.7, metalness: 0.4 }),
    crate: std({ color: 0x4a505e, roughness: 0.6, metalness: 0.45 }),
    crateStripe: std({ color: 0xffb347, roughness: 0.5, emissive: 0xff8a2a, emissiveIntensity: 0.25 }),
    coldEdge: new THREE.LineBasicMaterial({ color: 0x8fe9ff, transparent: true, opacity: 0.85 }),
    hotEdge: new THREE.LineBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.7 }),
    crucibleGlow: new THREE.MeshBasicMaterial({ color: 0xff7a2f, toneMapped: false }),
    crucibleRing: std({ color: 0x5a2a12, emissive: 0xff8a3d, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.6 }),
  };
  // Faded copies for the cutaway (blocks above the elements).
  m.faded = {};
  for (const k of ['#', 'c', 'h', '=', 'X']) {
    const f = m[k].clone();
    f.transparent = true; f.opacity = 0.13; f.depthWrite = false;
    m.faded[k] = f;
  }
  // Optional painted textures from assets/tiles — missing files keep the plain material.
  const loader = new THREE.TextureLoader();
  for (const [k, name] of Object.entries(TEX_FILES)) {
    if (!m[k]) continue;
    const exts = ['png', 'jpg', 'jpeg'];
    const tryLoad = (i) => {
      if (i >= exts.length) return;
      loader.load(`assets/tiles/${name}.${exts[i]}`, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        for (const mat of [m[k], m.faded[k]]) { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; }
      }, undefined, () => tryLoad(i + 1));
    };
    tryLoad(0);
  }
  return m;
}

// ---------- level geometry ----------

const blockGeo = new RoundedBoxGeometry(0.96, 0.96, 0.96, 2, 0.07);
const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.97, 0.97, 0.97));
const barGeo = new THREE.BoxGeometry(0.9, 0.07, 0.09);
const frameGeoX = new THREE.BoxGeometry(0.96, 0.1, 0.1);
const frameGeoZ = new THREE.BoxGeometry(0.1, 0.1, 0.96);

function makeGrate(mat) {
  const g = new THREE.Group();
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(barGeo, mat);
    bar.position.set(0, 0.44, i * 0.13);
    g.add(bar);
  }
  for (const s of [-1, 1]) {
    const fx = new THREE.Mesh(frameGeoX, mat); fx.position.set(0, 0.44, s * 0.43); g.add(fx);
    const fz = new THREE.Mesh(frameGeoZ, mat); fz.position.set(s * 0.43, 0.44, 0); g.add(fz);
    // corner posts so the grate reads as a cage block, not a floating lid
    for (const t of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, 0.08), mat);
      post.position.set(s * 0.44, 0, t * 0.44);
      g.add(post);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function makeCrucible(m) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(blockGeo, m.X);
  base.castShadow = base.receiveShadow = true;
  g.add(base);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.04, 32), m.crucibleGlow);
  glow.position.y = 0.49;
  g.add(glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 12, 40), m.crucibleRing);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  g.add(ring);
  g.userData.glow = glow;
  return g;
}

export function makeCrate(m) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.84, 0.84, 2, 0.06), m.crate);
  box.castShadow = box.receiveShadow = true;
  g.add(box);
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.86), m.crateStripe);
    stripe.position.y = s * 0.3;
    g.add(stripe);
  }
  const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.1), m.crateStripe);
  x1.rotation.y = Math.PI / 4; x1.position.y = 0.43; g.add(x1);
  const x2 = x1.clone(); x2.rotation.y = -Math.PI / 4; g.add(x2);
  return g;
}

// Vent particle column. dirUp = true for hot (rising embers), false for cold (falling snow).
function makeVent(color, dirUp) {
  const N = 36;
  const pos = new Float32Array(N * 3);
  const seeds = [];
  for (let i = 0; i < N; i++) seeds.push({ x: (Math.random() - 0.5) * 0.7, z: (Math.random() - 0.5) * 0.7, o: Math.random(), s: 0.5 + Math.random() * 0.7 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color, size: dirUp ? 0.07 : 0.06, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const pts = new THREE.Points(geo, mat);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.48;
  const g = new THREE.Group();
  g.add(pts, ring);
  g.userData.update = (t) => {
    for (let i = 0; i < N; i++) {
      const sd = seeds[i];
      let f = (sd.o + t * 0.45 * sd.s) % 1;
      if (!dirUp) f = 1 - f;
      pos[i * 3] = sd.x + Math.sin(t * 2 + i) * 0.04;
      pos[i * 3 + 1] = f - 0.5;
      pos[i * 3 + 2] = sd.z + Math.cos(t * 1.7 + i) * 0.04;
    }
    geo.attributes.position.needsUpdate = true;
    ring.material.opacity = 0.25 + 0.15 * Math.sin(t * 3);
  };
  return g;
}

function makeStars(radius) {
  const N = 500;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = radius * (0.3 + Math.random());
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -3 - Math.random() * 14;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8a96b8, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }));
}

// ---------- thermal plates ----------
// Copper plates that remember heat. Each plate owns its material so it can show its own
// temperature; the visual temperature is a float that lerps toward the rules' value.

const PLATE_CHARS = { q: 0, p: 1, P: 2 };
const PLATE_LOOK = [ // per temperature: surface colour, glow colour, glow strength
  { color: new THREE.Color(0x9fd6ea), glow: new THREE.Color(0x5ee7ff), k: 1.1 },
  { color: new THREE.Color(0xe09a62), glow: new THREE.Color(0xffa766), k: 0.32 },
  { color: new THREE.Color(0xff8a4a), glow: new THREE.Color(0xff5a1f), k: 1.6 },
];
const plateSlabGeo = new RoundedBoxGeometry(0.9, 0.1, 0.9, 2, 0.03);
const plateRingGeo = new THREE.RingGeometry(0.3, 0.42, 36);
let plateTextures = null;

function makePlateTextures() {
  if (plateTextures) return plateTextures;
  const N = 256;
  const draw = (glow) => {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, N, N); }
    else {
      const grad = g.createLinearGradient(0, 0, N, N);
      grad.addColorStop(0, '#e6e6e6'); grad.addColorStop(0.5, '#c8c8c8'); grad.addColorStop(1, '#dadada');
      g.fillStyle = grad; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 900; i++) { // brushed-metal speckle
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
        g.fillRect(Math.random() * N, Math.random() * N, 1 + Math.random() * 6, 1);
      }
    }
    // Etched hex grid.
    const r = 22, hw = Math.sqrt(3) * r;
    g.strokeStyle = glow ? '#ffffff' : 'rgba(40,20,10,0.55)';
    g.lineWidth = glow ? 2.2 : 3;
    for (let row = -1; row < N / (r * 1.5) + 1; row++) {
      for (let col = -1; col < N / hw + 1; col++) {
        const cx = col * hw + (row % 2 ? hw / 2 : 0), cy = row * r * 1.5;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = Math.PI / 6 + (k * Math.PI) / 3;
          const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath(); g.stroke();
      }
    }
    // Rim and centre sigil so a plate reads as a "device", not a floor tile.
    g.lineWidth = glow ? 4 : 6;
    g.strokeRect(8, 8, N - 16, N - 16);
    g.beginPath(); g.arc(N / 2, N / 2, 34, 0, Math.PI * 2); g.stroke();
    if (glow) { g.fillStyle = '#fff'; g.beginPath(); g.arc(N / 2, N / 2, 10, 0, Math.PI * 2); g.fill(); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = glow ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  plateTextures = { map: draw(false), glow: draw(true) };
  return plateTextures;
}

function makePlate(m, temp) {
  const tex = makePlateTextures();
  const obj = new THREE.Group();
  const baseMat = m['#'].clone();
  baseMat.color.multiplyScalar(0.75);
  const base = new THREE.Mesh(blockGeo, baseMat);
  base.castShadow = base.receiveShadow = true;
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0xe09a62, metalness: 0.45, roughness: 0.38, map: tex.map,
    emissive: 0xffffff, emissiveMap: tex.glow, emissiveIntensity: 0.1,
  });
  const slab = new THREE.Mesh(plateSlabGeo, slabMat);
  slab.position.y = 0.47;
  slab.castShadow = slab.receiveShadow = true;
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(plateRingGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.53;
  ring.visible = false;
  obj.add(base, slab, ring);
  const h = { obj, slabMat, baseMat, ring, ringMat, t: temp, anim: null, pulse: 0, pulseColor: new THREE.Color(), faded: false };
  applyPlateLook(h);
  return h;
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function applyPlateLook(h) {
  const t = Math.max(0, Math.min(2, h.t));
  const i = Math.min(1, Math.floor(t)), f = t - i;
  const a = PLATE_LOOK[i], b = PLATE_LOOK[i + 1];
  h.slabMat.color.copy(_c1.copy(a.color).lerp(b.color, f));
  h.slabMat.emissive.copy(_c2.copy(a.glow).lerp(b.glow, f));
  h.slabMat.emissiveIntensity = a.k + (b.k - a.k) * f;
  h.slabMat.roughness = t < 1 ? 0.22 + 0.16 * t : 0.38;
}

// One shared point cloud for frost sparkles (cold plates) and rising embers (hot plates).
function makePlateSparkles(handles) {
  const PER = 6;
  const n = Math.max(1, handles.length * PER);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const seeds = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { seeds[i * 3] = Math.random() - 0.5; seeds[i * 3 + 1] = Math.random() - 0.5; seeds[i * 3 + 2] = Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  pts.frustumCulled = false;
  pts.visible = handles.length > 0;
  pts.userData.update = (time) => {
    for (let hi = 0; hi < handles.length; hi++) {
      const h = handles[hi];
      const cold = Math.max(0, 1 - h.t), hot = Math.max(0, h.t - 1);
      const fade = h.faded ? 0.15 : 1;
      const ox = h.obj.position.x, oy = h.obj.position.y + 0.53, oz = h.obj.position.z;
      for (let k = 0; k < PER; k++) {
        const i = hi * PER + k, sx = seeds[i * 3], sz = seeds[i * 3 + 1], so = seeds[i * 3 + 2];
        let y = oy, br = 0, r = 0, g = 0, b = 0;
        if (hot >= cold) {
          const f = (so + time * (0.35 + so * 0.3)) % 1; // ember rising and fading
          y = oy + f * 0.75;
          br = hot * (1 - f) * fade;
          r = 1; g = 0.45; b = 0.12;
        } else {
          const tw = Math.max(0, Math.sin(time * (2.2 + so * 2) + so * 40)); // frost twinkle
          y = oy + 0.02 + so * 0.06;
          br = cold * tw * tw * tw * tw * fade;
          r = 0.75; g = 0.95; b = 1;
        }
        pos[i * 3] = ox + sx * 0.8; pos[i * 3 + 1] = y; pos[i * 3 + 2] = oz + sz * 0.8;
        col[i * 3] = r * br; col[i * 3 + 1] = g * br; col[i * 3 + 2] = b * br;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };
  return pts;
}

// Builds every static cell of a level. Returns handles the game updates each frame.
export function buildLevel(level, m) {
  const group = new THREE.Group();
  const blocks = []; // { obj, z, kind, mats: [mesh...] }
  const vents = [];
  const hotMats = [];
  const crucibles = [];
  const plates = new Map(); // "x,y,z" -> plate handle
  const tmp = new THREE.Vector3();

  for (let z = 0; z < level.h; z++) for (let y = 0; y < level.d; y++) for (let x = 0; x < level.w; x++) {
    const ch = level.cells[z][y][x];
    cellToWorld(level, x, y, z, tmp);
    let obj = null;
    if (ch === '#' || ch === 'c' || ch === 'h') {
      obj = new THREE.Group();
      const mesh = new THREE.Mesh(blockGeo, m[ch]);
      mesh.castShadow = mesh.receiveShadow = true;
      obj.add(mesh);
      if (ch === 'c' || ch === 'h') obj.add(new THREE.LineSegments(edgeGeo, ch === 'c' ? m.coldEdge : m.hotEdge));
    } else if (ch in PLATE_CHARS) {
      const h = makePlate(m, PLATE_CHARS[ch]);
      plates.set(`${x},${y},${z}`, h);
      obj = h.obj;
      obj.userData.plate = h;
    } else if (ch === '=') {
      obj = makeGrate(m['=']);
    } else if (ch === 'X') {
      obj = makeCrucible(m);
      crucibles.push(obj);
    } else if (ch === '^' || ch === 'v') {
      const v = makeVent(ch === '^' ? 0xff8a3d : 0xaeeeff, ch === '^');
      v.position.copy(tmp).setY(z + 0.5);
      group.add(v);
      vents.push(v);
      continue;
    }
    if (!obj) continue;
    obj.position.copy(tmp).setY(z + 0.5);
    obj.userData.kind = ch;
    group.add(obj);
    blocks.push({ obj, z, kind: ch, faded: false, plate: obj.userData.plate ?? null });
  }

  // Crucible light: intensity follows the heat fraction.
  const cLight = new THREE.PointLight(0xff7a2f, 6, 6, 1.6);
  if (crucibles.length) {
    const c = new THREE.Vector3();
    for (const o of crucibles) c.add(o.position);
    c.divideScalar(crucibles.length);
    cLight.position.copy(c).setY(c.y + 1.1);
  }
  group.add(cLight);

  const span = Math.max(level.w, level.d);
  group.add(makeStars(span * 1.4));
  const holes = buildHoleRims(level, group);
  const plateList = [...plates.values()];
  const sparkles = makePlateSparkles(plateList);
  group.add(sparkles);
  let clock = 0; // seconds, from update(t)

  return {
    group, blocks,
    plates,
    // Snap every plate to the rules' temperatures (level load, undo, restart).
    setPlateTemps(temps) {
      for (const [key, h] of plates) {
        const v = temps?.[key];
        if (v === undefined) continue;
        h.t = v; h.anim = null; h.pulse = 0; h.ring.visible = false;
        applyPlateLook(h);
      }
    },
    // Animate one plate to a new temperature (~350ms) with a pulse ring.
    animatePlate(key, to) {
      const h = plates.get(key);
      if (!h) return null;
      h.anim = { from: h.t, to, start: clock, dur: 0.35 };
      h.pulse = 1;
      h.pulseColor.copy(PLATE_LOOK[Math.max(0, Math.min(2, to))].glow);
      return h;
    },
    update(t, heatFrac, state) {
      clock = t;
      for (const h of plateList) {
        if (h.anim) {
          const f = Math.min(1, (t - h.anim.start) / h.anim.dur);
          const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
          h.t = h.anim.from + (h.anim.to - h.anim.from) * e;
          if (f >= 1) { h.t = h.anim.to; h.anim = null; }
          applyPlateLook(h);
        } else if (h.t > 1.5) {
          h.slabMat.emissiveIntensity = PLATE_LOOK[2].k * (0.85 + 0.15 * Math.sin(t * 3 + h.obj.position.x)); // heat shimmer
        }
        if (h.pulse > 0) {
          h.pulse = Math.max(0, h.pulse - 1 / 30); // ~0.5s at 60fps
          const k = 1 - h.pulse;
          h.ring.visible = h.pulse > 0;
          h.ring.scale.setScalar(0.6 + 1.1 * k);
          h.ringMat.color.copy(h.pulseColor);
          h.ringMat.opacity = h.pulse * (h.faded ? 0.2 : 0.9);
        }
      }
      sparkles.userData.update(t);
      for (const v of vents) v.userData.update(t);
      holes.mat.opacity = 0.55 + 0.35 * Math.sin(t * 3.2);
      holes.hazeMat.opacity = 0.025 + 0.012 * Math.sin(t * 3.2);
      for (const h of holes.list) {
        // A crate resting in the hole turns it into floor: hide its hazard marking.
        h.group.visible = !state?.blocks.some((b) => b.x === h.x && b.y === h.y && b.z === h.z - 1);
      }
      m.h.emissiveIntensity = 0.38 + 0.16 * Math.sin(t * 2.2);
      const flick = 1 + 0.06 * Math.sin(t * 13) + 0.04 * Math.sin(t * 7.3);
      cLight.intensity = 3.2 * heatFrac * flick;
      m.crucibleGlow.color.setRGB(1, 0.3 + 0.2 * heatFrac, 0.08).multiplyScalar(0.2 + 0.75 * heatFrac);
      m.crucibleRing.emissiveIntensity = 0.15 + 0.7 * heatFrac;
    },
    // Fade blocks that hide the elements. shouldFade(block) decides per block.
    setCutaway(shouldFade) {
      for (const b of blocks) {
        const fade = shouldFade(b);
        if (fade === b.faded) continue;
        b.faded = fade;
        if (b.plate) { // plates own their materials: fade them in place
          b.plate.faded = fade;
          for (const mat of [b.plate.slabMat, b.plate.baseMat]) {
            mat.transparent = fade; mat.opacity = fade ? 0.13 : 1; mat.depthWrite = !fade; mat.needsUpdate = true;
          }
          b.obj.traverse((o) => { if (o.isMesh && o !== b.plate.ring) o.castShadow = !fade; });
          continue;
        }
        b.obj.traverse((o) => {
          if (o.isMesh) {
            const k = b.kind;
            if (m[k] && (o.material === m[k] || o.material === m.faded[k])) o.material = fade ? m.faded[k] : m[k];
            else { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = fade ? 0.13 : 1; }
            o.castShadow = !fade;
          } else if (o.isLineSegments) o.visible = !fade;
        });
      }
    },
  };
}

// Glowing hazard edges where walkable floor meets a drop into the void, plus a faint red
// haze over the opening, so lethal holes read clearly. (Drops to a lower floor are left plain:
// terrace steps are already readable and rims there were visual noise.)
const RIM_SOLID = new Set(['#', 'c', 'h', 'X', '=']);
const RIM_AIR = new Set(['.', '^', 'v']);
const rimGeoX = new THREE.BoxGeometry(0.94, 0.03, 0.06);
const rimGeoZ = new THREE.BoxGeometry(0.06, 0.03, 0.94);
const hazeGeo = new THREE.PlaneGeometry(0.96, 0.96);
function buildHoleRims(level, group) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < level.w && y < level.d;
  const cell = (x, y, z) => (z < 0 ? 'void' : level.cells[z][y][x]);
  const isAir = (ch) => ch === 'void' || RIM_AIR.has(ch);
  const lethalCol = (x, y, z) => { for (let zz = z; zz >= 0; zz--) if (!isAir(cell(x, y, zz))) return false; return true; };
  const holes = new Map();
  const tmp = new THREE.Vector3();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4d5e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0xff2a3d, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false,
    toneMapped: false, side: THREE.DoubleSide,
  });
  for (let z = 1; z < level.h; z++) for (let y = 0; y < level.d; y++) for (let x = 0; x < level.w; x++) {
    if (!RIM_SOLID.has(cell(x, y, z - 1)) || !RIM_AIR.has(cell(x, y, z))) continue; // walkable floor here
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny) || !isAir(cell(nx, ny, z)) || !lethalCol(nx, ny, z - 1)) continue;
      const key = `${nx},${ny},${z}`;
      if (!holes.has(key)) {
        const g = new THREE.Group();
        // Haze only for holes inside the level; on the outer ring of void it read as a pink floor.
        const interior = nx > 0 && ny > 0 && nx < level.w - 1 && ny < level.d - 1;
        if (interior) {
          const haze = new THREE.Mesh(hazeGeo, hazeMat);
          haze.rotation.x = -Math.PI / 2;
          cellToWorld(level, nx, ny, z, tmp);
          haze.position.set(tmp.x, z - 0.02, tmp.z);
          g.add(haze);
        }
        group.add(g);
        holes.set(key, { x: nx, y: ny, z, group: g });
      }
      cellToWorld(level, x, y, z, tmp);
      const strip = new THREE.Mesh(dx !== 0 ? rimGeoZ : rimGeoX, mat);
      strip.position.set(tmp.x + dx * 0.47, z + 0.0, tmp.z + dy * 0.47);
      holes.get(key).group.add(strip);
    }
  }
  return { list: [...holes.values()], mat, hazeMat };
}

// ---------- elements ----------

export function createElement(kind) {
  const color = COL[kind];
  const group = new THREE.Group();
  const emissive = (o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.1, ...o });

  // SOLID
  const solid = new THREE.Group();
  if (kind === 'sol') {
    const core = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.5, 3, 0.1), emissive());
    core.castShadow = true;
    solid.add(core);
  } else {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), emissive({ flatShading: true, roughness: 0.15 }));
    crystal.scale.set(0.85, 1.15, 0.85);
    crystal.castShadow = true;
    solid.add(crystal);
  }
  // FROZEN shell (Sol only, but harmless on Cryo)
  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(0.68, 0.68, 0.68, 2, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, emissive: 0x9fe8ff, emissiveIntensity: 0.25, depthWrite: false }),
  );
  const shellEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.69, 0.69, 0.69)), new THREE.LineBasicMaterial({ color: 0xeafaff, transparent: true, opacity: 0.9 }));
  const frozen = new THREE.Group();
  frozen.add(shell, shellEdges);

  // LIQUID: displaced icosphere
  const liqGeo = new THREE.IcosahedronGeometry(0.32, 4);
  const base = liqGeo.attributes.position.array.slice();
  const liquid = new THREE.Mesh(liqGeo, emissive({ roughness: 0.1, metalness: 0.2, emissiveIntensity: 0.5 }));
  liquid.castShadow = true;

  // GAS: translucent sphere + orbiting motes
  const gas = new THREE.Group();
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
  const ringGas = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  gas.add(cloud, ringGas);
  const motes = [];
  const moteGeo = new THREE.SphereGeometry(0.035, 8, 6);
  const moteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), toneMapped: false });
  for (let i = 0; i < 9; i++) { const mo = new THREE.Mesh(moteGeo, moteMat); gas.add(mo); motes.push(mo); }

  const body = new THREE.Group();
  body.add(solid, frozen, liquid, gas);
  group.add(body);

  const light = new THREE.PointLight(color, 1.6, 3.2, 1.8);
  light.position.y = 0.2;
  group.add(light);

  let st = 'solid';
  const pop = { v: 1 };
  const phase = kind === 'sol' ? 0 : 2.1;

  function setState(s) {
    st = s;
    solid.visible = s === 'solid' || s === 'frozen';
    frozen.visible = s === 'frozen';
    liquid.visible = s === 'liquid';
    gas.visible = s === 'gas';
    solid.children[0].material.emissiveIntensity = s === 'frozen' ? 0.15 : 0.55;
  }
  setState('solid');

  return {
    group, pop, light,
    get state() { return st; },
    setState,
    // massFrac 0..1 shrinks the element; t in seconds
    update(t, massFrac) {
      const s = (0.6 + 0.4 * massFrac) * pop.v;
      body.scale.setScalar(s);
      // rest height inside the cell (cell floor is y=0 of the group)
      const bob = Math.sin(t * 2.2 + phase) * 0.02;
      body.position.y = st === 'gas' ? 0.52 + Math.sin(t * 1.6 + phase) * 0.06 : st === 'liquid' ? 0.3 * s + bob : 0.27 * s + 0.02 + bob;
      if (solid.visible) solid.rotation.y = kind === 'cryo' ? t * 0.8 : Math.sin(t * 0.7) * 0.15;
      if (liquid.visible) {
        const p = liqGeo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
          const x = base[i], y = base[i + 1], z = base[i + 2];
          const r = 1 + 0.09 * Math.sin(x * 9 + t * 4.5 + phase) * Math.cos(z * 8 - t * 3.1) + 0.05 * Math.sin(y * 11 + t * 5.3);
          p[i] = x * r; p[i + 1] = y * r * 0.88; p[i + 2] = z * r;
        }
        liqGeo.attributes.position.needsUpdate = true;
        liqGeo.computeVertexNormals();
      }
      if (gas.visible) {
        const pulse = 1 + 0.08 * Math.sin(t * 4 + phase);
        cloud.scale.setScalar(pulse);
        ringGas.rotation.set(Math.PI / 2 + Math.sin(t) * 0.4, t * 0.9, 0);
        motes.forEach((mo, i) => {
          const a = t * 1.7 + (i / motes.length) * Math.PI * 2;
          const r = 0.22 + 0.12 * Math.sin(t * 3 + i);
          mo.position.set(Math.cos(a) * r, Math.sin(t * 2.3 + i * 1.7) * 0.2, Math.sin(a) * r);
        });
      }
      light.intensity = (st === 'gas' ? 1.1 : 1.6) * (0.6 + 0.4 * massFrac);
    },
  };
}

// ---------- effects ----------

export function createTether() {
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff4e0, toneMapped: false, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.visible = false;
  const pts = Array.from({ length: 9 }, () => new THREE.Vector3());
  return {
    mesh,
    update(a, b, on, t) {
      mesh.visible = on;
      if (!on) return;
      const dir = new THREE.Vector3().subVectors(b, a);
      const perpA = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      pts.forEach((p, i) => {
        const f = i / (pts.length - 1);
        const j = i === 0 || i === pts.length - 1 ? 0 : 1;
        p.copy(a).addScaledVector(dir, f)
          .addScaledVector(perpA, j * (Math.random() - 0.5) * 0.09)
          .addScaledVector(up, j * ((Math.random() - 0.5) * 0.09 + Math.sin(f * Math.PI) * 0.08));
      });
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 5, false);
      mat.opacity = 0.65 + 0.3 * Math.sin(t * 10);
    },
  };
}

// Pooled additive particle bursts.
export function createBursts(max = 600) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  points.frustumCulled = false;
  let next = 0;
  const c = new THREE.Color();
  for (let i = 0; i < max; i++) pos[i * 3 + 1] = -999;
  return {
    points,
    burst(at, color, n = 18, speed = 1.6) {
      c.set(color);
      for (let k = 0; k < n; k++) {
        const i = next; next = (next + 1) % max;
        pos.set([at.x, at.y, at.z], i * 3);
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        const s = speed * (0.4 + Math.random() * 0.8);
        vel.set([Math.sin(ph) * Math.cos(th) * s, Math.abs(Math.cos(ph)) * s * 0.9 + 0.3, Math.sin(ph) * Math.sin(th) * s], i * 3);
        col.set([c.r, c.g, c.b], i * 3);
        life[i] = 0.5 + Math.random() * 0.5;
      }
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) { pos[i * 3 + 1] = -999; continue; }
        vel[i * 3 + 1] -= 2.2 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const fade = Math.min(1, life[i] * 2);
        col[i * 3] *= 0.985 + 0.015 * fade; col[i * 3 + 1] *= 0.985 + 0.015 * fade; col[i * 3 + 2] *= 0.985 + 0.015 * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

export function createAlloy() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 3, 0.12),
    new THREE.MeshStandardMaterial({ color: COL.alloy, emissive: 0xffd27a, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0.6 })));
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: COL.cryo, toneMapped: false }));
  inner.position.y = 0.36;
  g.add(inner);
  const light = new THREE.PointLight(0xffd27a, 6, 6, 1.5);
  light.position.y = 0.6;
  g.add(light);
  g.visible = false;
  return g;
}
