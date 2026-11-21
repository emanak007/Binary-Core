// Real-time 3D cinematic intro cutscene for Binary Core.
// Shares the main WebGLRenderer / EffectComposer (swapped via game.js setCutscene3D).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COL } from './visuals.js';
import { settings } from './store.js';

const FRACTURE_AT = 1.72;
const END_FUSE_AT = 1.8;
const LAUNCH_AT = 2.1;

export function createCutscene3D({ mobile = false, onFlash = null } = {}) {
  const disposables = [];
  const track = (x) => { disposables.push(x); return x; };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x03050a, 0.011);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 240);
  camera.position.set(0, 1, 9);

  // ---------- procedural textures ----------

  function makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.68)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return track(tex);
  }

  function makeNebulaTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const blobs = [
      [128, 128, 118, 0.42], [92, 108, 78, 0.32], [164, 146, 74, 0.28], [134, 88, 66, 0.22],
    ];
    for (const [x, y, r, a] of blobs) {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${a})`);
      grd.addColorStop(0.5, `rgba(255,255,255,${a * 0.35})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return track(tex);
  }

  function makeHullTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#384154';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 64; i += 2) {
      g.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
      g.fillRect(0, i * 4, 256, 4);
    }
    g.strokeStyle = 'rgba(14, 18, 28, 0.72)';
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    for (let y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    g.fillStyle = 'rgba(210, 224, 255, 0.28)';
    for (let x = 6; x < 256; x += 64) for (let y = 6; y < 256; y += 32) {
      g.fillRect(x, y, 2, 2); g.fillRect(x + 50, y, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    return track(tex);
  }

  const glowTex = makeGlowTexture();
  const nebulaTex = makeNebulaTexture();
  const hullTex = makeHullTexture();

  // ---------- reusable helpers ----------

  function makeHeroSol({ lightIntensity = 5, haloScale = 3.1 } = {}) {
    const group = new THREE.Group();
    const coreMat = track(new THREE.MeshStandardMaterial({
      color: 0xffd082, emissive: 0xff8a2b, emissiveIntensity: 1.45, roughness: 0.2, metalness: 0.25,
    }));
    const core = new THREE.Mesh(track(new RoundedBoxGeometry(0.48, 0.48, 0.48, 4, 0.14)), coreMat);
    const auraMat = track(new THREE.MeshBasicMaterial({
      color: 0xffa84c, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const aura = new THREE.Mesh(track(new THREE.SphereGeometry(0.44, 24, 18)), auraMat);
    const haloMat = track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff9a3d, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(haloScale);
    const light = new THREE.PointLight(0xffa448, lightIntensity, 16, 1.4);
    group.add(core, aura, halo, light);
    return { group, core, coreMat, aura, auraMat, halo, haloMat, light };
  }

  function makeHeroCryo({ lightIntensity = 5, haloScale = 3.1 } = {}) {
    const group = new THREE.Group();
    const coreMat = track(new THREE.MeshStandardMaterial({
      color: 0x9ef6ff, emissive: 0x2fd3ff, emissiveIntensity: 1.4, flatShading: true, roughness: 0.1, metalness: 0.25,
    }));
    const crystal = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.42, 0)), coreMat);
    crystal.scale.set(0.86, 1.2, 0.86);
    const heartMat = track(new THREE.MeshBasicMaterial({ color: 0xecffff, toneMapped: false }));
    const heart = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.2, 0)), heartMat);
    heart.scale.set(0.86, 1.2, 0.86);
    const shellGeo = track(new THREE.OctahedronGeometry(0.52, 0));
    const edgeMat = track(new THREE.LineBasicMaterial({
      color: 0xbef8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(shellGeo)), edgeMat);
    edges.scale.set(0.86, 1.2, 0.86);
    const haloMat = track(new THREE.SpriteMaterial({
      map: glowTex, color: 0x5ee7ff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(haloScale);
    const light = new THREE.PointLight(0x5ee7ff, lightIntensity, 16, 1.4);
    group.add(crystal, heart, edges, halo, light);
    return { group, crystal, coreMat, edges, edgeMat, halo, haloMat, light };
  }

  function makePlasmaArc(color, strands = 3, segments = 18) {
    const group = new THREE.Group();
    const lines = [];
    for (let s = 0; s < strands; s++) {
      const pos = new Float32Array(segments * 3);
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = track(new THREE.LineBasicMaterial({
        color: s === 0 ? 0xffffff : color,
        transparent: true,
        opacity: s === 0 ? 0.9 : 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      const line = new THREE.Line(geo, mat);
      group.add(line);
      lines.push({ line, geo, pos, mat, phase: s * 2.17 });
    }
    const tmp = new THREE.Vector3(), perp1 = new THREE.Vector3(), perp2 = new THREE.Vector3(), dir = new THREE.Vector3();
    function update(a, b, time, amp = 0.18, opacityScale = 1) {
      dir.subVectors(b, a);
      const len = dir.length() || 1;
      dir.divideScalar(len);
      perp1.set(-dir.z, 0.25, dir.x).normalize();
      perp2.crossVectors(dir, perp1).normalize();
      for (let s = 0; s < lines.length; s++) {
        const l = lines[s];
        l.mat.opacity = (s === 0 ? 0.92 : 0.48) * opacityScale;
        for (let i = 0; i < segments; i++) {
          const f = i / (segments - 1);
          const env = Math.sin(f * Math.PI);
          const w1 = (Math.sin(f * 13 + time * 11 + l.phase) * 0.6 + Math.sin(f * 29 - time * 19 + s) * 0.4) * amp * env;
          const w2 = (Math.cos(f * 17 - time * 13 + l.phase) * 0.6 + Math.cos(f * 31 + time * 17) * 0.4) * amp * env;
          tmp.copy(a).lerp(b, f).addScaledVector(perp1, w1).addScaledVector(perp2, w2);
          l.pos[i * 3] = tmp.x; l.pos[i * 3 + 1] = tmp.y; l.pos[i * 3 + 2] = tmp.z;
        }
        l.geo.attributes.position.needsUpdate = true;
      }
    }
    return { group, update };
  }

  // ---------- persistent cosmic backdrop ----------

  const backdrop = new THREE.Group();
  scene.add(backdrop);
  backdrop.add(new THREE.HemisphereLight(0x7c97d4, 0x16121c, 0.95));
  backdrop.add(new THREE.AmbientLight(0x28324a, 0.6));

  {
    const N = mobile ? 900 : 1600;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const palette = [new THREE.Color(0xb8dcff), new THREE.Color(0xf4f7ff), new THREE.Color(0xffe1b8), new THREE.Color(0x88d8ff)];
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = 45 + Math.random() * 95;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const c = palette[i % palette.length];
      const b = 0.45 + Math.random() * 0.55;
      col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(geo, track(new THREE.PointsMaterial({
      size: 0.85, map: glowTex, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    backdrop.add(stars);
  }

  const nebulae = [
    [-26, 14, -72, 68, 0x203b7a, 0.26],
    [24, -10, -68, 62, 0x124d66, 0.24],
    [-10, -18, -82, 74, 0x4b2236, 0.2],
    [32, 22, -88, 70, 0x3b2a66, 0.22],
    [0, 10, -95, 86, 0x162d54, 0.2],
    [-34, -8, -58, 52, 0x143d52, 0.2],
  ];
  for (const [x, y, z, s, color, opacity] of nebulae) {
    const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: nebulaTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    sp.position.set(x, y, z);
    sp.scale.set(s * 1.4, s, 1);
    backdrop.add(sp);
  }

  // Foreground cosmic dust motes
  const dust = (() => {
    const N = mobile ? 110 : 220;
    const pos = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 26;
      const y = (Math.random() - 0.5) * 16;
      const z = (Math.random() - 0.5) * 20;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      seeds.push({ x, y, z, ph: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.4 });
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, track(new THREE.PointsMaterial({
      size: 0.14, map: glowTex, color: 0xcfe4ff, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    backdrop.add(pts);
    return { geo, pos, seeds };
  })();

  // Reusable sculpted starship Meridian (shared by intro shipShot and ending launchShot)
  function makeMeridianShip({ withPlumes = false } = {}) {
    const ship = new THREE.Group();

    const armorMat = track(new THREE.MeshStandardMaterial({
      color: 0x525d73, map: hullTex, metalness: 0.72, roughness: 0.34,
    }));
    const darkMat = track(new THREE.MeshStandardMaterial({
      color: 0x222836, metalness: 0.65, roughness: 0.45,
    }));
    const trimMat = track(new THREE.MeshStandardMaterial({
      color: 0x6f7d99, metalness: 0.8, roughness: 0.24,
    }));
    const winCyan = track(new THREE.MeshBasicMaterial({ color: 0x66e6ff, toneMapped: false }));
    const winWarm = track(new THREE.MeshBasicMaterial({ color: 0xffb35c, toneMapped: false }));
    const engineMat = track(new THREE.MeshStandardMaterial({
      color: 0x26120b, emissive: 0xff6224, emissiveIntensity: 0.6, roughness: 0.4,
    }));

    // Main armored spine hull (prow toward +X, engines toward -X)
    const spine = new THREE.Mesh(track(new RoundedBoxGeometry(9.6, 1.35, 2.2, 3, 0.14)), armorMat);
    ship.add(spine);

    // Tapered forward prow & nose wedge
    const prow = new THREE.Mesh(track(new RoundedBoxGeometry(3.4, 0.95, 1.5, 3, 0.16)), armorMat);
    prow.position.set(5.6, -0.05, 0);
    const nose = new THREE.Mesh(track(new THREE.ConeGeometry(0.72, 2.2, 6)), trimMat);
    nose.rotation.z = -Math.PI / 2;
    nose.scale.set(0.65, 1, 1.15);
    nose.position.set(7.7, -0.08, 0);
    ship.add(prow, nose);

    // Outrigger armor pontoons & swept stabilizer fins
    for (const s of [-1, 1]) {
      const pod = new THREE.Mesh(track(new RoundedBoxGeometry(6.8, 0.92, 1.05, 3, 0.1)), darkMat);
      pod.position.set(-0.6, -0.1, s * 1.48);
      ship.add(pod);

      const wing = new THREE.Mesh(track(new RoundedBoxGeometry(3.8, 0.18, 2.2, 2, 0.04)), armorMat);
      wing.position.set(-2.2, -0.12, s * 2.55);
      wing.rotation.y = s * -0.35;
      ship.add(wing);

      const finTip = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.72, 0.28)), trimMat);
      finTip.position.set(-3.3, 0.15, s * 3.55);
      ship.add(finTip);

      for (let i = 0; i < 8; i++) {
        const w = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.06, 0.04)), i % 3 === 0 ? winWarm : winCyan);
        w.position.set(-2.8 + i * 0.78, 0.16, s * 2.02);
        ship.add(w);
      }
    }

    // Dorsal command bridge tower & antenna masts
    const bridge = new THREE.Mesh(track(new RoundedBoxGeometry(2.3, 0.85, 1.25, 3, 0.1)), trimMat);
    bridge.position.set(1.3, 0.92, 0);
    const bridgeVisor = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.16, 0.95)), winCyan);
    bridgeVisor.position.set(2.44, 1.0, 0);
    const mast1 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.025, 0.045, 1.15, 8)), trimMat);
    mast1.position.set(0.7, 1.75, 0.22);
    const mast2 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.03, 0.75, 8)), trimMat);
    mast2.position.set(1.2, 1.55, -0.25);
    ship.add(bridge, bridgeVisor, mast1, mast2);

    // Dorsal reactor spine vents (individual materials so ending launch lights them sequentially)
    const ventMats = [];
    for (let i = 0; i < 5; i++) {
      const vm = track(new THREE.MeshStandardMaterial({
        color: 0x33160d, emissive: 0xff7029, emissiveIntensity: 0.35, roughness: 0.45,
      }));
      const vent = new THREE.Mesh(track(new RoundedBoxGeometry(0.72, 0.18, 0.65, 2, 0.04)), vm);
      vent.position.set(-3.6 + i * 0.95, 0.7, 0);
      ship.add(vent);
      ventMats.push(vm);
    }

    // 3 Aft engine bells + glow sprites (+ optional thruster exhaust cones)
    const engineGlows = [];
    const plumes = [];
    let plumeLight = null;
    const coneGeo = withPlumes ? track(new THREE.ConeGeometry(1, 1, 18, 1, true)) : null;
    if (coneGeo) coneGeo.translate(0, 0.5, 0);
    const outerMat = withPlumes ? track(new THREE.MeshBasicMaterial({
      color: 0x5ee7ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    })) : null;
    const innerMat = withPlumes ? track(new THREE.MeshBasicMaterial({
      color: 0xffe4b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    })) : null;

    const specs = [[0, 0, 0.62], [-0.15, -1.25, 0.48], [-0.15, 1.25, 0.48]];
    for (const [ey, ez, er] of specs) {
      const bell = new THREE.Mesh(track(new THREE.CylinderGeometry(er * 0.72, er, 1.2, 16)), darkMat);
      bell.rotation.z = Math.PI / 2;
      bell.position.set(-5.15, ey, ez);
      const core = new THREE.Mesh(track(new THREE.CylinderGeometry(er * 0.56, er * 0.56, 0.12, 16)), engineMat);
      core.rotation.z = Math.PI / 2;
      core.position.set(-5.7, ey, ez);
      const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({
        map: glowTex, color: 0xff6b2b, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })));
      sp.position.set(-5.85, ey, ez);
      sp.scale.setScalar(er * 3.6);
      ship.add(bell, core, sp);
      engineGlows.push(sp);

      if (withPlumes) {
        const pg = new THREE.Group();
        pg.position.set(-5.72, ey, ez);
        pg.rotation.z = Math.PI / 2;
        const outer = new THREE.Mesh(coneGeo, outerMat);
        outer.scale.set(er * 1.08, 1, er * 1.08);
        const inner = new THREE.Mesh(coneGeo, innerMat);
        inner.scale.set(er * 0.68, 0.66, er * 0.68);
        pg.add(outer, inner);
        ship.add(pg);
        plumes.push({ pg, er });
      }
    }
    if (withPlumes) {
      plumeLight = new THREE.PointLight(0xff9c48, 0, 20, 1.4);
      plumeLight.position.set(-6.5, 0, 0);
      ship.add(plumeLight);
    }

    return { ship, winCyan, winWarm, engineMat, ventMats, engineGlows, plumes, outerMat, innerMat, plumeLight };
  }

  // ==========================================================
  // SHOT 1: ship — Starship Meridian drifting in the dark
  // ==========================================================
  const shipShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const keySun = new THREE.DirectionalLight(0xffd09a, 3.4);
    keySun.position.set(14, 9, -8);
    const fillLight = new THREE.DirectionalLight(0x4da8e0, 1.3);
    fillLight.position.set(-10, -6, 10);
    g.add(keySun, fillLight);

    const starFlare = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffe4bd, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    starFlare.position.set(12.5, 4.8, -20);
    starFlare.scale.setScalar(11.5);
    const starStreak = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffcf94, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    starStreak.position.copy(starFlare.position);
    starStreak.scale.set(26, 0.75, 1);
    g.add(starFlare, starStreak);

    const { ship, engineMat, ventMats, engineGlows } = makeMeridianShip({ withPlumes: false });
    g.add(ship);

    return {
      group: g,
      update(shotT, _dt, t) {
        const p = Math.min(1, shotT / shotDur);
        ship.rotation.set(0.18 + Math.sin(t * 0.4) * 0.02, -0.42 + p * 0.06, -0.14 + Math.sin(t * 0.3) * 0.015);
        ship.position.set(0.2 - p * 0.5, Math.sin(t * 0.55) * 0.14, 0);
        const fade = Math.max(0.08, 1 - p * 0.85);
        const sputter = 0.75 + 0.25 * Math.sin(t * 17) * Math.sin(t * 5.3);
        engineMat.emissiveIntensity = 0.52 * fade * sputter;
        for (const vm of ventMats) vm.emissiveIntensity = 0.16 * fade;
        for (const sp of engineGlows) sp.material.opacity = 0.42 * fade * sputter;

        camera.position.set(9.8 - p * 2.8, 2.6 - p * 0.45, 11.8 - p * 2.2);
        camera.lookAt(0.2, 0.15, 0);
      },
    };
  })();

  // ==========================================================
  // SHOT 2: core — Binary Core beating in harmony
  // ==========================================================
  const coreShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const rim = new THREE.DirectionalLight(0x9ab8ff, 1.6);
    rim.position.set(-6, 8, 6);
    g.add(rim);

    // Octagonal chamber ribs framing the deep background (wide silhouette, no busy laser lines)
    const pillarMat = track(new THREE.MeshStandardMaterial({ color: 0x22293a, metalness: 0.72, roughness: 0.38 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (Math.sin(a) > 0.2) continue;
      const pil = new THREE.Mesh(track(new RoundedBoxGeometry(1.15, 14, 1.15, 2, 0.1)), pillarMat);
      pil.position.set(Math.cos(a) * 11.4, 0, Math.sin(a) * 11.4);
      pil.rotation.y = -a;
      g.add(pil);
    }

    // 4 Nested 3D Gyroscope Gimbal Rings
    const ringDarkMat = track(new THREE.MeshStandardMaterial({ color: 0x394154, metalness: 0.82, roughness: 0.25 }));
    const gimbals = [
      { r: 2.35, t: 0.06, c: 0xffa94d, rot: [0.4, 0.2, 0.1], spd: [0.35, 0.6, 0.2] },
      { r: 3.05, t: 0.07, c: 0x5ee7ff, rot: [-0.5, 0.7, 0.3], spd: [-0.28, 0.45, -0.3] },
      { r: 3.85, t: 0.08, c: 0xffcf94, rot: [0.9, -0.3, 0.6], spd: [0.22, -0.35, 0.25] },
      { r: 4.75, t: 0.09, c: 0x70d8ff, rot: [0.2, 0.8, -0.5], spd: [-0.15, 0.25, -0.18] },
    ].map((cfg) => {
      const rg = new THREE.Group();
      rg.rotation.set(...cfg.rot);
      const body = new THREE.Mesh(track(new THREE.TorusGeometry(cfg.r, cfg.t, 14, 72)), ringDarkMat);
      const inlay = new THREE.Mesh(track(new THREE.TorusGeometry(cfg.r, cfg.t * 0.38, 10, 72)),
        track(new THREE.MeshBasicMaterial({ color: cfg.c, transparent: true, opacity: 0.72, toneMapped: false })));
      rg.add(body, inlay);
      g.add(rg);
      return { rg, cfg };
    });

    // Shared center fusion pulse + Sol & Cryo + plasma arcs
    const centerGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xfff0d4, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    centerGlow.scale.setScalar(2.6);
    g.add(centerGlow);

    const sol = makeHeroSol({ lightIntensity: 5.5 });
    const cryo = makeHeroCryo({ lightIntensity: 5.5 });
    const arc1 = makePlasmaArc(0xffe0b2, 3, 20);
    const arc2 = makePlasmaArc(0x88f0ff, 2, 20);
    g.add(sol.group, cryo.group, arc1.group, arc2.group);

    // Spiraling orbiting particles
    const N = mobile ? 100 : 200;
    const pPos = new Float32Array(N * 3), pCol = new Float32Array(N * 3);
    const pData = [];
    for (let i = 0; i < N; i++) {
      const isSol = i % 2 === 0;
      const c = new THREE.Color(isSol ? COL.sol : COL.cryo);
      pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
      pData.push({ r: 0.8 + Math.random() * 2.1, a0: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.1, y: (Math.random() - 0.5) * 1.4, tilt: (Math.random() - 0.5) * 0.6 });
    }
    const pGeo = track(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    g.add(new THREE.Points(pGeo, track(new THREE.PointsMaterial({
      size: 0.13, map: glowTex, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))));

    return {
      group: g,
      update(shotT, _dt, t) {
        const p = Math.min(1, shotT / shotDur);
        const orbitA = shotT * 1.25;
        const r = 1.2 + Math.sin(t * 2) * 0.08;
        sol.group.position.set(Math.cos(orbitA) * r, Math.sin(orbitA * 0.7) * 0.32, Math.sin(orbitA) * r);
        cryo.group.position.set(-sol.group.position.x, -sol.group.position.y, -sol.group.position.z);
        sol.core.rotation.set(t * 0.5, t * 0.8, 0);
        cryo.crystal.rotation.set(0, -t * 0.9, t * 0.3);
        cryo.edges.rotation.copy(cryo.crystal.rotation);

        const beat = 1 + 0.14 * Math.sin(t * 3.6);
        centerGlow.scale.setScalar(2.4 * beat);
        arc1.update(sol.group.position, cryo.group.position, t, 0.26, 1);
        arc2.update(cryo.group.position, sol.group.position, t + 1.4, 0.2, 0.8);

        for (const { rg, cfg } of gimbals) {
          rg.rotation.x = cfg.rot[0] + shotT * cfg.spd[0];
          rg.rotation.y = cfg.rot[1] + shotT * cfg.spd[1];
          rg.rotation.z = cfg.rot[2] + shotT * cfg.spd[2];
        }
        for (let i = 0; i < N; i++) {
          const d = pData[i];
          const a = d.a0 + shotT * d.sp;
          pPos[i * 3] = Math.cos(a) * d.r;
          pPos[i * 3 + 1] = d.y * Math.cos(a * 0.5) + Math.sin(a) * d.tilt;
          pPos[i * 3 + 2] = Math.sin(a) * d.r;
        }
        pGeo.attributes.position.needsUpdate = true;

        camera.position.set(2.4 - p * 4.2, 1.3 - p * 0.5, 8.6 - p * 2.2);
        camera.lookAt(0, 0, 0);
      },
    };
  })();

  // ==========================================================
  // SHOT 3: fracture — Core overloads and blasts them apart
  // ==========================================================
  const fractureShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const rim = new THREE.DirectionalLight(0xffdfb0, 2.0);
    rim.position.set(4, 7, 8);
    g.add(rim);

    const sol = makeHeroSol({ lightIntensity: 6 });
    const cryo = makeHeroCryo({ lightIntensity: 6 });
    const arc = makePlasmaArc(0xffffff, 3, 20);
    g.add(sol.group, cryo.group, arc.group);

    // Gimbal rings that shatter/tilt on impact
    const ringMat = track(new THREE.MeshStandardMaterial({ color: 0x3b4358, metalness: 0.8, roughness: 0.28 }));
    const ringGlowMat = track(new THREE.MeshBasicMaterial({ color: 0xffc680, transparent: true, opacity: 0.75, toneMapped: false }));
    const gimbals = [
      { r: 2.3, baseRot: [0.35, 0.2, 0.1], blow: [-0.9, 0.6, -0.5] },
      { r: 3.1, baseRot: [-0.45, 0.6, 0.25], blow: [0.8, -0.7, 0.4] },
      { r: 4.0, baseRot: [0.8, -0.3, 0.5], blow: [-0.5, -0.4, 0.8] },
    ].map((cfg) => {
      const rg = new THREE.Group();
      const body = new THREE.Mesh(track(new THREE.TorusGeometry(cfg.r, 0.065, 12, 64)), ringMat);
      const inlay = new THREE.Mesh(track(new THREE.TorusGeometry(cfg.r, 0.025, 8, 64)), ringGlowMat);
      rg.add(body, inlay);
      g.add(rg);
      return { rg, cfg };
    });

    // Central core spike + expanding shockwave ring
    const burstSprite = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xfff8e6, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    g.add(burstSprite);

    const shockMat = track(new THREE.MeshBasicMaterial({
      color: 0xffe8c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const shockwave = new THREE.Mesh(track(new THREE.TorusGeometry(0.95, 0.012, 12, 72)), shockMat);
    const shockGlowMat = track(new THREE.MeshBasicMaterial({
      color: 0xffa852, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const shockGlow = new THREE.Mesh(track(new THREE.TorusGeometry(0.95, 0.032, 12, 72)), shockGlowMat);
    shockwave.add(shockGlow);
    g.add(shockwave);

    // Jagged 3D lightning rift down the center
    const riftSegs = 22;
    const riftBolts = Array.from({ length: 3 }, (_, k) => {
      const pos = new Float32Array(riftSegs * 3);
      let x = (k - 1) * 0.22;
      for (let i = 0; i < riftSegs; i++) {
        const f = i / (riftSegs - 1);
        const y = 7.5 - f * 15;
        if (i > 0 && i < riftSegs - 1) x += (Math.sin(i * 4.7 + k * 2.1) * 0.65);
        pos[i * 3] = x * (k === 0 ? 1 : 0.7);
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = Math.cos(i * 3.1 + k) * 0.4;
      }
      const geo = track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = track(new THREE.LineBasicMaterial({
        color: k === 1 ? 0xffffff : k === 0 ? 0xffb85c : 0x70ecff,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      const line = new THREE.Line(geo, mat);
      g.add(line);
      return { line, mat };
    });

    // 3D crystal/ember debris shards blasting out in slow-mo
    const shardCount = mobile ? 60 : 120;
    const shardGeoA = track(new THREE.OctahedronGeometry(0.14, 0));
    const shardGeoB = track(new THREE.TetrahedronGeometry(0.15, 0));
    const shards = [];
    for (let i = 0; i < shardCount; i++) {
      const col = i % 3 === 0 ? 0xffa94d : i % 3 === 1 ? 0x5ee7ff : 0xfff0c8;
      const mat = track(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, toneMapped: false }));
      const mesh = new THREE.Mesh(i % 2 === 0 ? shardGeoA : shardGeoB, mat);
      const a = (i / shardCount) * Math.PI * 2 + Math.sin(i * 7.3) * 0.4;
      const elev = (Math.sin(i * 3.9) * 0.85);
      const speed = 1.8 + ((i * 37) % 100) / 100 * 3.8;
      mesh.scale.set(0.5 + (i % 5) * 0.25, 1.3, 0.5);
      g.add(mesh);
      shards.push({
        mesh, mat,
        vx: Math.cos(a) * Math.cos(elev) * speed,
        vy: Math.sin(elev) * speed * 0.85,
        vz: Math.sin(a) * Math.cos(elev) * speed * 0.55,
        rx: (i % 7 - 3) * 0.9, ry: (i % 5 - 2) * 1.1,
      });
    }

    let triggered = false;
    let shakeAmt = 0;

    return {
      group: g,
      reset(startTime) {
        triggered = startTime >= FRACTURE_AT;
        shakeAmt = 0;
      },
      update(shotT, dt) {
        if (shotT < FRACTURE_AT) {
          const build = shotT / FRACTURE_AT;
          const spin = shotT * (2.2 + build * 7.5);
          const rad = 1.1 - build * 0.72;
          const jitter = build * build * 0.09;
          sol.group.position.set(Math.cos(spin) * rad + Math.sin(shotT * 43) * jitter, Math.sin(spin * 0.8) * 0.25, Math.sin(spin) * rad);
          cryo.group.position.set(-sol.group.position.x, -sol.group.position.y, -sol.group.position.z);
          arc.group.visible = true;
          arc.update(sol.group.position, cryo.group.position, shotT * 3, 0.22 + build * 0.25, 1);

          burstSprite.scale.setScalar(2.0 + build * 3.8);
          burstSprite.material.opacity = 0.65 + build * 0.35;
          shockwave.visible = false;
          for (const rb of riftBolts) rb.mat.opacity = 0;
          for (const s of shards) { s.mesh.visible = false; }
          ringGlowMat.opacity = 0.8;
          for (const { rg, cfg } of gimbals) {
            rg.position.set(0, 0, 0);
            rg.rotation.set(
              cfg.baseRot[0] + shotT * 1.4 + Math.sin(shotT * 35) * jitter,
              cfg.baseRot[1] + shotT * 1.8,
              cfg.baseRot[2] + Math.cos(shotT * 29) * jitter,
            );
          }
          camera.position.set(Math.sin(shotT * 40) * jitter * 0.5, 0.35 - build * 0.15, 6.4 - build * 1.3);
          camera.lookAt(0, 0, 0);
          return;
        }

        const after = shotT - FRACTURE_AT;
        if (!triggered) {
          triggered = true;
          shakeAmt = settings.shake && !settings.reducedMotion ? 0.38 : 0;
          onFlash?.('fracture');
        }
        shakeAmt = Math.max(0, shakeAmt - dt * 0.55);

        // Violent initial separation decelerating into zero-G drift
        const sep = 1 - Math.exp(-after * 2.4);
        const xOff = 0.45 + sep * 3.15 + after * 0.24;
        const yOff = sep * 0.42;
        sol.group.position.set(-xOff, -yOff, sep * 0.3);
        cryo.group.position.set(xOff, yOff, -sep * 0.2);
        sol.core.rotation.set(after * 0.6, after * 0.9, after * 0.4);
        cryo.crystal.rotation.set(-after * 0.4, after * 0.7, after * 0.5);
        cryo.edges.rotation.copy(cryo.crystal.rotation);
        arc.group.visible = false;

        // Expanding central flash & crisp 3D plasma shockwave torus
        const shockProg = Math.min(1, after / 1.45);
        burstSprite.scale.setScalar(5.5 * Math.exp(-after * 2.2) + 0.6);
        burstSprite.material.opacity = Math.max(0, 1 - after * 0.85);
        shockwave.visible = shockProg < 1;
        shockwave.scale.setScalar(0.3 + shockProg * 7.2);
        shockMat.opacity = Math.max(0, (1 - shockProg) * 0.8);
        shockGlowMat.opacity = Math.max(0, (1 - shockProg) * 0.22);

        // Crackling vertical rift fading after the split
        const riftAlpha = Math.max(0, 1 - after / 1.65) * (0.75 + 0.25 * Math.sin(after * 38));
        for (const rb of riftBolts) rb.mat.opacity = riftAlpha;

        // Gimbal rings knocked askew and powering down
        ringGlowMat.opacity = Math.max(0.08, 0.75 * Math.exp(-after * 1.6));
        for (const { rg, cfg } of gimbals) {
          rg.position.set(cfg.blow[0] * sep * 0.65, cfg.blow[1] * sep * 0.65, cfg.blow[2] * sep * 0.5);
          rg.rotation.set(
            cfg.baseRot[0] + FRACTURE_AT * 1.4 + cfg.blow[0] * sep * 0.7 + after * 0.08,
            cfg.baseRot[1] + FRACTURE_AT * 1.8 + cfg.blow[1] * sep * 0.7,
            cfg.baseRot[2] + cfg.blow[2] * sep * 0.7,
          );
        }

        // Slow-mo tumbling shards
        const dScale = (1 - Math.exp(-after * 2.5)) * 1.4 + after * 0.22;
        const shardAlpha = Math.max(0, 1 - Math.max(0, after - 1.2) / 2.6);
        for (const s of shards) {
          s.mesh.visible = shardAlpha > 0.02;
          s.mesh.position.set(s.vx * dScale, s.vy * dScale, s.vz * dScale);
          s.mesh.rotation.set(s.rx * after, s.ry * after, s.rx * 0.5 * after);
          s.mat.opacity = shardAlpha * 0.9;
        }

        const sx = Math.sin(after * 55) * shakeAmt;
        const sy = Math.cos(after * 47) * shakeAmt;
        camera.position.set(sx, 0.2 + sy, 5.1 + sep * 4.2 + after * 0.25);
        camera.lookAt(0, 0, 0);
      },
    };
  })();

  // ==========================================================
  // SHOT 4: apart — Sol burns away (left), Cryo boils (right)
  // ==========================================================
  const apartShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const beamMat = track(new THREE.MeshStandardMaterial({ color: 0x1a1e2a, metalness: 0.7, roughness: 0.5 }));
    for (const [bx, by, bz, rz] of [[-3.4, -1.6, -1.2, 0.14], [3.5, -1.7, -1.5, -0.18], [0, -2.5, -3.5, 0.02]]) {
      const b = new THREE.Mesh(track(new THREE.BoxGeometry(4.5, 0.35, 0.6)), beamMat);
      b.position.set(bx, by, bz);
      b.rotation.z = rz;
      g.add(b);
    }

    const sol = makeHeroSol({ lightIntensity: 4.5, haloScale: 2.9 });
    const cryo = makeHeroCryo({ lightIntensity: 4.5, haloScale: 2.9 });
    const tether = makePlasmaArc(0xfff0d4, 2, 22);
    g.add(sol.group, cryo.group, tether.group);

    // Rising embers from Sol
    const eN = mobile ? 100 : 200;
    const ePos = new Float32Array(eN * 3), eCol = new Float32Array(eN * 3);
    const eSeeds = Array.from({ length: eN }, () => ({
      ox: (Math.random() - 0.5) * 0.85, oz: (Math.random() - 0.5) * 0.85,
      o: Math.random(), sp: 0.28 + Math.random() * 0.45,
    }));
    const eGeo = track(new THREE.BufferGeometry());
    eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
    g.add(new THREE.Points(eGeo, track(new THREE.PointsMaterial({
      size: 0.12, map: glowTex, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))));

    // Rising vapour puffs & boiling rings from Cryo
    const vN = mobile ? 90 : 170;
    const vPos = new Float32Array(vN * 3), vCol = new Float32Array(vN * 3);
    const vSeeds = Array.from({ length: vN }, () => ({
      ox: (Math.random() - 0.5) * 0.95, oz: (Math.random() - 0.5) * 0.95,
      o: Math.random(), sp: 0.3 + Math.random() * 0.45,
    }));
    const vGeo = track(new THREE.BufferGeometry());
    vGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
    vGeo.setAttribute('color', new THREE.BufferAttribute(vCol, 3));
    g.add(new THREE.Points(vGeo, track(new THREE.PointsMaterial({
      size: 0.16, map: glowTex, vertexColors: true, transparent: true, opacity: 0.78,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))));

    const vRings = Array.from({ length: 6 }, (_, i) => {
      const rm = track(new THREE.MeshBasicMaterial({
        color: 0x70eeff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      }));
      const mesh = new THREE.Mesh(track(new THREE.RingGeometry(0.28, 0.34, 32)), rm);
      mesh.rotation.x = Math.PI / 2;
      g.add(mesh);
      return { mesh, rm, o: i / 6 };
    });

    return {
      group: g,
      update(shotT, _dt, t) {
        const p = Math.min(1, shotT / shotDur);
        const sep = 2.35 + p * 0.8;
        const shrink = 1 - p * 0.28;
        sol.group.position.set(-sep, -0.25 + Math.sin(t * 1.4) * 0.1, 0);
        sol.group.scale.setScalar(shrink);
        sol.core.rotation.set(t * 0.3, t * 0.5, 0);

        cryo.group.position.set(sep, -0.15 + Math.cos(t * 1.6) * 0.1, 0);
        cryo.group.scale.setScalar(shrink);
        cryo.crystal.rotation.set(Math.sin(t * 9) * 0.05, -t * 0.6, Math.cos(t * 11) * 0.05);
        cryo.edges.rotation.copy(cryo.crystal.rotation);

        // Flickering, failing tether trying to bridge the chasm
        const snapPulse = Math.max(0, Math.sin(t * 3.1) * 0.7 + Math.sin(t * 13) * 0.3);
        const tetherAlpha = (1 - p * 0.65) * snapPulse;
        tether.group.visible = tetherAlpha > 0.12;
        if (tether.group.visible) tether.update(sol.group.position, cryo.group.position, t, 0.35, tetherAlpha * 0.55);

        // Rising amber embers from Sol
        for (let i = 0; i < eN; i++) {
          const sd = eSeeds[i];
          const f = (sd.o + t * sd.sp) % 1;
          const fade = (1 - f) * (0.65 + 0.35 * (1 - p));
          ePos[i * 3] = sol.group.position.x + sd.ox * (1 + f * 1.4) + Math.sin(t * 2.5 + i) * 0.12;
          ePos[i * 3 + 1] = sol.group.position.y + f * 3.8;
          ePos[i * 3 + 2] = sd.oz + Math.cos(t * 2 + i) * 0.1;
          eCol[i * 3] = 1 * fade; eCol[i * 3 + 1] = (0.65 - f * 0.35) * fade; eCol[i * 3 + 2] = 0.22 * fade;
        }
        eGeo.attributes.position.needsUpdate = true;
        eGeo.attributes.color.needsUpdate = true;

        // Rising cyan steam/vapour from Cryo
        for (let i = 0; i < vN; i++) {
          const sd = vSeeds[i];
          const f = (sd.o + t * sd.sp) % 1;
          const fade = Math.sin(f * Math.PI) * (1 - f * 0.4);
          vPos[i * 3] = cryo.group.position.x + sd.ox * (1 + f * 1.8) + Math.cos(t * 2.2 + i) * 0.16;
          vPos[i * 3 + 1] = cryo.group.position.y + f * 3.9;
          vPos[i * 3 + 2] = sd.oz + Math.sin(t * 1.8 + i) * 0.14;
          vCol[i * 3] = 0.38 * fade; vCol[i * 3 + 1] = 0.92 * fade; vCol[i * 3 + 2] = 1.0 * fade;
        }
        vGeo.attributes.position.needsUpdate = true;
        vGeo.attributes.color.needsUpdate = true;

        for (const r of vRings) {
          const f = (r.o + t * 0.36) % 1;
          r.mesh.position.set(cryo.group.position.x + Math.sin(t * 2 + r.o * 6) * 0.1, cryo.group.position.y + 0.3 + f * 3.1, 0);
          r.mesh.scale.setScalar(0.55 + f * 2.1);
          r.rm.opacity = (1 - f) * 0.38;
        }

        camera.position.set(0, 0.35 + p * 0.35, 7.6 + p * 2.1);
        camera.lookAt(0, 0.25, 0);
      },
    };
  })();

  // ==========================================================
  // SHOT 5: crucible — Cooling chain along the reactor spine
  // ==========================================================
  const crucibleShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const overhead = new THREE.DirectionalLight(0x96b8ec, 2.2);
    overhead.position.set(-4, 10, 8);
    g.add(overhead);

    const archMat = track(new THREE.MeshStandardMaterial({ color: 0x343c4e, map: hullTex, metalness: 0.72, roughness: 0.36 }));
    const deckMat = track(new THREE.MeshStandardMaterial({ color: 0x202531, map: hullTex, metalness: 0.55, roughness: 0.5 }));
    const conduitMat = track(new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.45, toneMapped: false }));
    const socketMat = track(new THREE.MeshStandardMaterial({ color: 0x2e180e, metalness: 0.5, roughness: 0.45 }));

    // Catwalk spine floor
    const floor = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 0.4, 48)), deckMat);
    floor.position.set(0, -0.35, -18);
    g.add(floor);

    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.08, 46)), conduitMat);
      rail.position.set(sx * 2.35, -0.1, -18);
      g.add(rail);
    }

    // 8 Industrial Reactor Bulkhead Arches
    for (let i = 0; i < 8; i++) {
      const az = 2 - i * 6;
      for (const sx of [-1, 1]) {
        const col = new THREE.Mesh(track(new RoundedBoxGeometry(0.75, 6.2, 0.75, 2, 0.08)), archMat);
        col.position.set(sx * 4.4, 2.2, az);
        const strut = new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 0.45, 0.45)), archMat);
        strut.position.set(sx * 3.4, 4.9, az);
        strut.rotation.z = sx * 0.48;
        g.add(col, strut);
      }
      const beam = new THREE.Mesh(track(new RoundedBoxGeometry(6.6, 0.55, 0.65, 2, 0.06)), archMat);
      beam.position.set(0, 5.4, az);
      g.add(beam);
    }

    // 7 Sequential Crucible Sockets receding into the reactor spine
    const crucibles = [];
    const baseGeo = track(new RoundedBoxGeometry(2.4, 0.45, 2.4, 2, 0.08));
    const coreGeo = track(new THREE.CylinderGeometry(0.84, 0.72, 0.12, 32));
    const ringGeo = track(new THREE.TorusGeometry(0.95, 0.1, 12, 48));

    for (let i = 0; i < 7; i++) {
      const cz = -i * 6;
      const cg = new THREE.Group();
      cg.position.set(0, -0.08, cz);
      const base = new THREE.Mesh(baseGeo, socketMat);
      const diskMat = track(new THREE.MeshBasicMaterial({ color: 0xff9a44, toneMapped: false }));
      const disk = new THREE.Mesh(coreGeo, diskMat);
      disk.position.y = 0.22;
      const ringMat = track(new THREE.MeshStandardMaterial({
        color: 0x5c2b14, emissive: 0xff7a2f, emissiveIntensity: 1.3, roughness: 0.35, metalness: 0.6,
      }));
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.25;
      const haloMat = track(new THREE.SpriteMaterial({
        map: glowTex, color: 0xff7f32, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      const halo = new THREE.Sprite(haloMat);
      halo.position.y = 0.4;
      halo.scale.set(3.8, 1.9, 1);
      cg.add(base, disk, ring, halo);
      let light = null;
      if (i < 3) {
        light = new THREE.PointLight(0xff7d34, 4.5, 11, 1.5);
        light.position.set(0, 1.4, cz);
        g.add(light);
      }
      g.add(cg);
      crucibles.push({ idx: i, diskMat, ringMat, haloMat, light });
    }

    // Rising heat embers along the spine
    const spN = mobile ? 100 : 190;
    const spPos = new Float32Array(spN * 3);
    const spSeeds = Array.from({ length: spN }, () => ({
      x: (Math.random() - 0.5) * 2.2, z: -Math.random() * 34, o: Math.random(), sp: 0.2 + Math.random() * 0.35,
    }));
    const spGeo = track(new THREE.BufferGeometry());
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    g.add(new THREE.Points(spGeo, track(new THREE.PointsMaterial({
      size: 0.11, map: glowTex, color: 0xff9e4a, transparent: true, opacity: 0.72,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))));

    return {
      group: g,
      update(shotT, _dt, t) {
        const p = Math.min(1, shotT / shotDur);
        // Near crucibles visibly cool down while the deepest core glows warmly
        for (const c of crucibles) {
          const depthKeep = c.idx / 6;
          const cool = Math.max(0.28, 1 - p * (0.72 - depthKeep * 0.48));
          const flick = 0.92 + 0.08 * Math.sin(t * 7 + c.idx * 1.9);
          const br = cool * flick;
          c.diskMat.color.setRGB(1.0 * br, (0.55 * cool + 0.12) * br, 0.18 * cool * br);
          c.ringMat.emissiveIntensity = 1.35 * br;
          c.haloMat.opacity = 0.65 * br;
          if (c.light) c.light.intensity = 4.6 * br;
        }
        conduitMat.opacity = 0.45 * Math.max(0.35, 1 - p * 0.6);

        for (let i = 0; i < spN; i++) {
          const sd = spSeeds[i];
          const f = (sd.o + t * sd.sp) % 1;
          spPos[i * 3] = sd.x + Math.sin(t * 2 + i) * 0.15;
          spPos[i * 3 + 1] = f * 4.5;
          spPos[i * 3 + 2] = sd.z;
        }
        spGeo.attributes.position.needsUpdate = true;

        camera.position.set(1.1 - p * 1.4, 2.35 + p * 0.65, 7.2 - p * 5.8);
        camera.lookAt(0, 0.7, -22);
      },
    };
  })();

  // ==========================================================
  // SHOT 6: title — Converging toward the waiting Crucible
  // ==========================================================
  const titleShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const rim = new THREE.DirectionalLight(0xa0bce8, 1.3);
    rim.position.set(0, 8, 6);
    g.add(rim);

    // Waiting Crucible altar in the lower third so top/center stays open for the BINARY CORE title card
    const altar = new THREE.Group();
    altar.position.set(0, -1.75, 0);
    const altarBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.7, 2.1, 0.42, 32)),
      track(new THREE.MeshStandardMaterial({ color: 0x241812, metalness: 0.65, roughness: 0.4 })),
    );
    const altarRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(1.35, 0.08, 12, 48)),
      track(new THREE.MeshStandardMaterial({ color: 0x5c2d16, emissive: 0xff8a3d, emissiveIntensity: 1.0, roughness: 0.35, metalness: 0.6 })),
    );
    altarRing.rotation.x = Math.PI / 2;
    altarRing.position.y = 0.22;
    const altarDisk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.18, 1.18, 0.06, 32)),
      track(new THREE.MeshBasicMaterial({ color: 0xff8a38, transparent: true, opacity: 0.78, toneMapped: false })),
    );
    altarDisk.position.y = 0.2;
    const altarLight = new THREE.PointLight(0xff8638, 4.2, 12, 1.5);
    altarLight.position.y = 1.2;
    altar.add(altarBase, altarRing, altarDisk, altarLight);
    g.add(altar);

    const ripples = Array.from({ length: 3 }, (_, i) => {
      const rm = track(new THREE.MeshBasicMaterial({
        color: 0xffc680, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
      }));
      const mesh = new THREE.Mesh(track(new THREE.RingGeometry(1.15, 1.24, 48)), rm);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(0, -1.52, 0);
      g.add(mesh);
      return { mesh, rm, o: i / 3 };
    });

    const sol = makeHeroSol({ lightIntensity: 4.5, haloScale: 2.7 });
    const cryo = makeHeroCryo({ lightIntensity: 4.5, haloScale: 2.7 });
    const guideLine = makePlasmaArc(0xffe6c0, 1, 20);
    g.add(sol.group, cryo.group, guideLine.group);

    // Trailing motes behind Sol & Cryo
    const tN = mobile ? 48 : 90;
    const tPos = new Float32Array(tN * 3), tCol = new Float32Array(tN * 3);
    const tGeo = track(new THREE.BufferGeometry());
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    g.add(new THREE.Points(tGeo, track(new THREE.PointsMaterial({
      size: 0.14, map: glowTex, vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))));

    return {
      group: g,
      update(shotT, _dt, t) {
        const p = Math.min(1, shotT / shotDur);
        const ease = 1 - Math.pow(1 - p, 2.2);
        const x = 4.9 - ease * 2.55;
        const y = -0.65 - Math.sin(ease * Math.PI * 0.5) * 0.18 + Math.sin(t * 1.8) * 0.08;
        sol.group.position.set(-x, y, 0.2);
        cryo.group.position.set(x, y, 0.2);
        sol.core.rotation.set(t * 0.4, t * 0.7, 0);
        cryo.crystal.rotation.set(0, -t * 0.8, 0.2);
        cryo.edges.rotation.copy(cryo.crystal.rotation);

        guideLine.update(sol.group.position, cryo.group.position, t, 0.08, 0.22 + ease * 0.28);

        for (const r of ripples) {
          const f = (r.o + t * 0.28) % 1;
          r.mesh.scale.setScalar(1 + f * 2.4);
          r.rm.opacity = (1 - f) * 0.35;
        }

        const half = tN / 2;
        for (let i = 0; i < half; i++) {
          const f = i / half;
          const fade = (1 - f) * 0.85;
          const sx = -x - f * 2.4;
          const cx = x + f * 2.4;
          const sy = y + Math.sin(f * 5 - t * 3) * 0.12;
          const cy = y + Math.cos(f * 5 - t * 3) * 0.12;
          tPos[i * 3] = sx; tPos[i * 3 + 1] = sy; tPos[i * 3 + 2] = 0.2 + Math.sin(f * 7 + t) * 0.1;
          tCol[i * 3] = 1 * fade; tCol[i * 3 + 1] = 0.65 * fade; tCol[i * 3 + 2] = 0.28 * fade;

          const j = half + i;
          tPos[j * 3] = cx; tPos[j * 3 + 1] = cy; tPos[j * 3 + 2] = 0.2 + Math.cos(f * 7 + t) * 0.1;
          tCol[j * 3] = 0.35 * fade; tCol[j * 3 + 1] = 0.9 * fade; tCol[j * 3 + 2] = 1 * fade;
        }
        tGeo.attributes.position.needsUpdate = true;
        tGeo.attributes.color.needsUpdate = true;

        camera.position.set(0, 0.55 - ease * 0.45, 10.2 - ease * 1.7);
        camera.lookAt(0, 0.15, 0);
      },
    };
  })();

  // ==========================================================
  // ENDING SHOT 1: end_fuse — Sol and Cryo permanently fuse into the Binary Alloy Core
  // ==========================================================
  const endFuseShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const rim = new THREE.DirectionalLight(0xffe0b8, 2.2);
    rim.position.set(5, 8, 7);
    g.add(rim);

    const pillarMat = track(new THREE.MeshStandardMaterial({ color: 0x22293a, metalness: 0.72, roughness: 0.38 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      if (Math.sin(a) > 0.2) continue;
      const pil = new THREE.Mesh(track(new RoundedBoxGeometry(1.15, 14, 1.15, 2, 0.1)), pillarMat);
      pil.position.set(Math.cos(a) * 11.4, 0, Math.sin(a) * 11.4);
      pil.rotation.y = -a;
      g.add(pil);
    }

    const ringDarkMat = track(new THREE.MeshStandardMaterial({ color: 0x3b4458, metalness: 0.82, roughness: 0.24 }));
    const gimbals = [
      { r: 2.6, t: 0.06, c: 0xffa94d, rot: [1.15, 0.25, 0.2], spd: [0.22, 0.55, 0.18] },
      { r: 3.35, t: 0.07, c: 0x5ee7ff, rot: [-1.1, 0.55, -0.3], spd: [-0.2, 0.45, -0.25] },
      { r: 4.15, t: 0.08, c: 0xffcf94, rot: [0.85, -0.3, 0.55], spd: [0.25, -0.38, 0.28] },
      { r: 5.05, t: 0.09, c: 0x70d8ff, rot: [0.2, 0.8, -0.45], spd: [-0.18, 0.28, -0.2] },
    ].map((cfg) => {
      const rg = new THREE.Group();
      const body = new THREE.Mesh(track(new THREE.TorusGeometry(cfg.r, cfg.t, 14, 72)), ringDarkMat);
      const inlay = new THREE.Mesh(track(new THREE.TorusGeometry(cfg.r, cfg.t * 0.38, 10, 72)),
        track(new THREE.MeshBasicMaterial({ color: cfg.c, transparent: true, opacity: 0.78, toneMapped: false })));
      rg.add(body, inlay);
      g.add(rg);
      return { rg, cfg };
    });

    const sol = makeHeroSol({ lightIntensity: 5.5 });
    const cryo = makeHeroCryo({ lightIntensity: 5.5 });
    const arc1 = makePlasmaArc(0xffe0b2, 3, 20);
    const arc2 = makePlasmaArc(0x88f0ff, 2, 20);
    g.add(sol.group, cryo.group, arc1.group, arc2.group);

    // Monumental Binary Alloy Core
    const alloyGroup = new THREE.Group();
    const alloyOuter = new THREE.Mesh(
      track(new RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.22)),
      track(new THREE.MeshStandardMaterial({ color: 0xffdc96, emissive: 0xffa83d, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.55 })),
    );
    const alloyInner = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.5, 0)),
      track(new THREE.MeshBasicMaterial({ color: 0x6ef0ff, transparent: true, opacity: 0.88, toneMapped: false })),
    );
    const alloyAura = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.94, 24, 18)),
      track(new THREE.MeshBasicMaterial({ color: 0xffc668, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    );
    const alloyRingA = new THREE.Mesh(
      track(new THREE.TorusGeometry(1.18, 0.024, 10, 64)),
      track(new THREE.MeshBasicMaterial({ color: 0xffb85c, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    );
    const alloyRingC = new THREE.Mesh(
      track(new THREE.TorusGeometry(1.42, 0.02, 10, 64)),
      track(new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    );
    const alloyHalo = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffd288, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    alloyHalo.scale.setScalar(4.0);
    const alloyLight = new THREE.PointLight(0xffcf7a, 4.8, 22, 1.4);
    alloyGroup.add(alloyOuter, alloyInner, alloyAura, alloyRingA, alloyRingC, alloyHalo, alloyLight);
    alloyGroup.visible = false;
    g.add(alloyGroup);

    const shockAMat = track(new THREE.MeshBasicMaterial({
      color: 0xffcf78, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const shockA = new THREE.Mesh(track(new THREE.TorusGeometry(0.75, 0.02, 12, 64)), shockAMat);
    shockA.rotation.x = Math.PI / 2 - 0.3;
    const shockCMat = track(new THREE.MeshBasicMaterial({
      color: 0x6ef0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    const shockC = new THREE.Mesh(track(new THREE.TorusGeometry(0.75, 0.016, 12, 64)), shockCMat);
    shockC.rotation.set(0.45, 0.6, 0.3);
    g.add(shockA, shockC);

    const pN = mobile ? 110 : 220;
    const pPos = new Float32Array(pN * 3), pCol = new Float32Array(pN * 3);
    const pData = Array.from({ length: pN }, (_, i) => {
      const c = new THREE.Color(i % 3 === 0 ? COL.sol : i % 3 === 1 ? COL.cryo : COL.alloy);
      pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
      return { a0: Math.random() * 6.28, r: 0.9 + Math.random() * 2.8, y: (Math.random() - 0.5) * 2.2, sp: 0.6 + Math.random() * 1.1 };
    });
    const pGeo = track(new THREE.BufferGeometry());
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    g.add(new THREE.Points(pGeo, track(new THREE.PointsMaterial({
      size: 0.13, map: glowTex, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))));

    let triggered = false;

    return {
      group: g,
      reset(startTime) {
        triggered = startTime >= END_FUSE_AT;
      },
      update(shotT, _dt, t) {
        const pre = shotT < END_FUSE_AT;
        if (pre) {
          const f = shotT / END_FUSE_AT;
          const e = f * f;
          const rad = 2.9 * (1 - e * 0.95);
          const ang = shotT * (1.8 + e * 6.5);
          sol.group.visible = cryo.group.visible = arc1.group.visible = arc2.group.visible = true;
          alloyGroup.visible = shockA.visible = shockC.visible = false;
          sol.group.position.set(Math.cos(ang) * rad, Math.sin(ang * 0.7) * 0.35 * (1 - f), Math.sin(ang) * rad);
          cryo.group.position.set(-sol.group.position.x, -sol.group.position.y, -sol.group.position.z);
          sol.core.rotation.set(t * 0.7, t * 1.1, 0);
          cryo.crystal.rotation.set(0, -t * 1.1, 0.3);
          cryo.edges.rotation.copy(cryo.crystal.rotation);
          arc1.update(sol.group.position, cryo.group.position, t * 1.4, 0.25 + f * 0.15, 1);
          arc2.update(cryo.group.position, sol.group.position, t * 1.4 + 1.2, 0.2, 0.85);

          for (const { rg, cfg } of gimbals) {
            rg.rotation.set(cfg.rot[0] + shotT * cfg.spd[0] * (1 + f), cfg.rot[1] + shotT * cfg.spd[1] * (1 + f), cfg.rot[2] + shotT * cfg.spd[2]);
          }
          for (let i = 0; i < pN; i++) {
            const d = pData[i];
            const a = d.a0 + shotT * d.sp * (1 + f * 2);
            const r = d.r * (1 - e * 0.65);
            pPos[i * 3] = Math.cos(a) * r;
            pPos[i * 3 + 1] = d.y * (1 - e * 0.5) * Math.cos(a * 0.4);
            pPos[i * 3 + 2] = Math.sin(a) * r;
          }
          pGeo.attributes.position.needsUpdate = true;

          camera.position.set(1.2 * (1 - f), 0.7 - f * 0.35, 8.4 - f * 2.4);
          camera.lookAt(0, 0, 0);
          return;
        }

        const after = shotT - END_FUSE_AT;
        if (!triggered) {
          triggered = true;
          onFlash?.('fuse');
        }
        sol.group.visible = cryo.group.visible = arc1.group.visible = arc2.group.visible = false;
        alloyGroup.visible = true;

        // Elastic pop settle for the fused Binary Alloy Core
        const pf = Math.min(1, after / 0.9);
        const popScale = pf >= 1 ? 1 : 2 ** (-9 * pf) * Math.sin((pf * 9 - 0.75) * (2 * Math.PI / 3)) + 1;
        alloyGroup.scale.setScalar(Math.max(0.05, popScale));
        alloyOuter.rotation.set(t * 0.35, t * 0.65, 0);
        alloyInner.rotation.set(-t * 0.5, -t * 0.9, t * 0.2);
        alloyRingA.rotation.set(0.6 + t * 1.1, t * 0.4, 0.3);
        alloyRingC.rotation.set(-0.5 - t * 0.85, 0.4 - t * 0.6, -0.2);
        alloyAura.scale.setScalar(1 + 0.08 * Math.sin(t * 3.8));

        const sf = Math.min(1, after / 1.35);
        shockA.visible = shockC.visible = sf < 1;
        shockA.scale.setScalar(0.4 + (1 - (1 - sf) ** 2.2) * 7.2);
        shockAMat.opacity = Math.max(0, (1 - sf) * 0.9);
        shockC.scale.setScalar(0.3 + (1 - (1 - sf) ** 2.0) * 6.2);
        shockCMat.opacity = Math.max(0, (1 - sf) * 0.82);

        for (const { rg, cfg } of gimbals) {
          rg.rotation.set(cfg.rot[0] + shotT * cfg.spd[0] * 0.65, cfg.rot[1] + shotT * cfg.spd[1] * 0.65, cfg.rot[2] + shotT * cfg.spd[2] * 0.65);
        }
        const haloExp = 0.5 + (1 - Math.exp(-after * 1.5)) * 1.25;
        for (let i = 0; i < pN; i++) {
          const d = pData[i];
          const a = d.a0 + shotT * d.sp * 0.65;
          const r = d.r * haloExp;
          pPos[i * 3] = Math.cos(a) * r;
          pPos[i * 3 + 1] = d.y * haloExp * 0.6 * Math.sin(a * 0.5);
          pPos[i * 3 + 2] = Math.sin(a) * r;
        }
        pGeo.attributes.position.needsUpdate = true;

        const pull = Math.min(1, after / 3.8);
        camera.position.set(-pull * 1.6, 0.35 + pull * 0.45, 6.0 + pull * 2.8);
        camera.lookAt(0, 0, 0);
      },
    };
  })();

  // ==========================================================
  // ENDING SHOT 2: end_launch — Meridian wakes, ignites, and launches into space
  // ==========================================================
  const endLaunchShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const keySun = new THREE.DirectionalLight(0xffd6a6, 3.6);
    keySun.position.set(14, 10, 6);
    const fillLight = new THREE.DirectionalLight(0x5ec6ff, 1.5);
    fillLight.position.set(-12, -5, 10);
    g.add(keySun, fillLight);

    const starFlare = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffe4bd, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    starFlare.position.set(17, 5.4, -32);
    starFlare.scale.setScalar(7.5);
    const starStreak = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffcf94, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    starStreak.position.copy(starFlare.position);
    starStreak.scale.set(20, 0.55, 1);
    g.add(starFlare, starStreak);

    const { ship, engineMat, ventMats, engineGlows, plumes, outerMat, innerMat, plumeLight } = makeMeridianShip({ withPlumes: true });
    outerMat.color.setHex(0x3ad6ff);
    innerMat.color.setHex(0xffb44d);
    ship.rotation.set(0.14, 0.34, 0.14);
    g.add(ship);

    const forward = new THREE.Vector3(1, 0, 0).applyEuler(ship.rotation).normalize();
    const basePos = new THREE.Vector3(-1.4, -0.25, 0.7);
    const shipPos = new THREE.Vector3();

    // Exhaust spark stream behind the 3 engine bells
    const spN = mobile ? 110 : 220;
    const spPos = new Float32Array(spN * 3), spCol = new Float32Array(spN * 3);
    const spSeeds = Array.from({ length: spN }, (_, i) => {
      const c = new THREE.Color(i % 2 === 0 ? 0xffae52 : 0x6eeeff);
      spCol[i * 3] = c.r; spCol[i * 3 + 1] = c.g; spCol[i * 3 + 2] = c.b;
      return { o: Math.random(), sp: 0.65 + Math.random() * 0.9, spread: (Math.random() - 0.5) * 0.9, vSpread: (Math.random() - 0.5) * 0.7, nozzle: i % 3 };
    });
    const spGeo = track(new THREE.BufferGeometry());
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
    const spMat = track(new THREE.PointsMaterial({
      size: 0.13, map: glowTex, vertexColors: true, transparent: true, opacity: 0.68,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    g.add(new THREE.Points(spGeo, spMat));

    const nozzleOffsets = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.15, -1.25), new THREE.Vector3(0, -0.15, 1.25)]
      .map((v) => v.applyEuler(ship.rotation));

    let launched = false;

    return {
      group: g,
      reset(startTime) {
        launched = startTime >= LAUNCH_AT;
      },
      update(shotT, _dt, t) {
        const warm = Math.min(1, shotT / LAUNCH_AT);
        const after = Math.max(0, shotT - LAUNCH_AT);
        if (after > 0 && !launched) {
          launched = true;
          onFlash?.('launch');
        }

        // Sequential ignition of the 5 dorsal reactor spine vents (aft to bow)
        for (let i = 0; i < ventMats.length; i++) {
          const lit = Math.max(0, Math.min(1, (shotT - i * 0.3) / 0.45));
          ventMats[i].emissiveIntensity = 0.12 + lit * 1.15;
        }

        const thrust = after > 0 ? 1 + Math.min(1.4, after * 0.75) : 0.15 + warm * 0.85;
        const flick = 0.88 + 0.12 * Math.sin(t * 28) * Math.cos(t * 17);
        engineMat.emissiveIntensity = 0.4 + thrust * 0.75;
        outerMat.opacity = (after > 0 ? 0.34 : 0.12 + warm * 0.2) * flick;
        innerMat.opacity = (after > 0 ? 0.68 : 0.2 + warm * 0.45) * flick;
        plumeLight.intensity = (after > 0 ? 3.2 : 0.6 + warm * 2.2) * flick;

        const lenScale = after > 0 ? (2.2 + Math.min(2.6, after * 1.1)) * flick : (0.3 + warm * 1.45) * flick;
        for (const { pg, er } of plumes) pg.scale.set(er * (0.9 + thrust * 0.14), lenScale, er * (0.9 + thrust * 0.14));
        for (const sp of engineGlows) sp.material.opacity = Math.min(0.45, 0.2 + thrust * 0.22);

        const travel = after > 0 ? Math.pow(after, 2.05) * 2.25 : 0;
        const rumble = after > 0 ? 0 : warm * 0.025 * Math.sin(t * 42);
        shipPos.copy(basePos).addScaledVector(forward, travel);
        shipPos.y += Math.sin(t * 1.2) * 0.08 * (1 - Math.min(1, after)) + rumble;
        ship.position.copy(shipPos);

        // Exhaust spark stream flowing backward along -forward
        const streamLen = after > 0 ? 11 : 2.5 + warm * 4.5;
        spMat.opacity = after > 0 ? 0.68 : 0.2 + warm * 0.42;
        for (let i = 0; i < spN; i++) {
          const sd = spSeeds[i];
          const f = (sd.o + shotT * sd.sp * (after > 0 ? 1.8 : 0.9)) % 1;
          const noz = nozzleOffsets[sd.nozzle];
          const dist = 5.8 + f * streamLen;
          spPos[i * 3] = shipPos.x + noz.x - forward.x * dist + sd.spread * f * 1.5;
          spPos[i * 3 + 1] = shipPos.y + noz.y - forward.y * dist + sd.vSpread * f * 1.4;
          spPos[i * 3 + 2] = shipPos.z + noz.z - forward.z * dist + sd.spread * 0.7 * f;
        }
        spGeo.attributes.position.needsUpdate = true;

        const trackF = Math.min(1, after / 3.8);
        camera.position.set(-5.2 - trackF * 1.4, 2.5 + trackF * 0.6, 12.6 + trackF * 2.2);
        camera.lookAt(shipPos.x * 0.52 + 0.8, shipPos.y * 0.55 + 0.2, shipPos.z * 0.55 - 0.3);
      },
    };
  })();

  // ==========================================================
  // ENDING SHOT 3: end_title — Distant Meridian trail & BINARY CORE title
  // ==========================================================
  const endTitleShot = (() => {
    const g = new THREE.Group();
    scene.add(g);

    const beacon = new THREE.Group();
    const bAmber = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffb35c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    bAmber.scale.setScalar(2.4);
    const bCyan = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0x6eeeff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    bCyan.position.set(-0.35, -0.1, 0);
    bCyan.scale.setScalar(1.65);
    const bStreak = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffe6bd, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    bStreak.rotation.z = 0.28;
    bStreak.scale.set(5.5, 0.25, 1);
    beacon.add(bAmber, bCyan, bStreak);
    g.add(beacon);

    // Sweeping luminous stardust wake across the lower/diagonal sky (keeps center open for BINARY CORE)
    const rN = mobile ? 80 : 160;
    const rPos = new Float32Array(rN * 3), rCol = new Float32Array(rN * 3);
    const rGeo = track(new THREE.BufferGeometry());
    rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    rGeo.setAttribute('color', new THREE.BufferAttribute(rCol, 3));
    g.add(new THREE.Points(rGeo, track(new THREE.PointsMaterial({
      size: 0.16, map: glowTex, vertexColors: true, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }))));

    return {
      group: g,
      update(shotT, _dt, t) {
        const p = Math.min(1, shotT / shotDur);
        const bx = 4.6 + p * 5.2;
        const by = 1.65 + p * 1.45;
        const bz = -10.5 - p * 8.5;
        beacon.position.set(bx, by, bz);
        beacon.scale.setScalar(1 - p * 0.42);

        for (let i = 0; i < rN; i++) {
          const f = i / rN;
          const fade = Math.sin(f * Math.PI) * 0.85;
          rPos[i * 3] = -8.2 + f * (bx + 8.2);
          rPos[i * 3 + 1] = -2.4 + Math.pow(f, 1.35) * (by + 2.4) + Math.sin(f * 8 - t * 1.5) * 0.1;
          rPos[i * 3 + 2] = 2.0 + f * (bz - 2.0) + Math.cos(f * 6 + t) * 0.15;
          rCol[i * 3] = (0.35 + f * 0.65) * fade;
          rCol[i * 3 + 1] = (0.85 - f * 0.18) * fade;
          rCol[i * 3 + 2] = (1.0 - f * 0.55) * fade;
        }
        rGeo.attributes.position.needsUpdate = true;
        rGeo.attributes.color.needsUpdate = true;

        camera.position.set(0, 0.15, 10.0 - p * 1.2);
        camera.lookAt(0, 0.15, 0);
      },
    };
  })();

  const SHOTS = {
    ship: shipShot, core: coreShot, fracture: fractureShot, apart: apartShot, crucible: crucibleShot, title: titleShot,
    end_fuse: endFuseShot, end_launch: endLaunchShot, end_title: endTitleShot,
  };
  let activeKey = null;
  let shotT = 0;
  let shotDur = 6;
  let frozen = false;

  function setShot(art, { startTime = 0, freeze = false, duration = 6 } = {}) {
    activeKey = SHOTS[art] ? art : 'core';
    for (const [k, s] of Object.entries(SHOTS)) s.group.visible = k === activeKey;
    shotT = startTime;
    shotDur = Math.max(2, duration);
    frozen = freeze;
    SHOTS[activeKey].reset?.(startTime);
    update(0, startTime);
  }

  function update(dt, t) {
    const stepDt = frozen ? 0 : dt * (settings.reducedMotion ? 0.55 : 1);
    shotT += stepDt;
    const animTime = frozen ? shotT : t;
    backdrop.rotation.y = animTime * 0.008;
    for (let i = 0; i < dust.seeds.length; i++) {
      const sd = dust.seeds[i];
      dust.pos[i * 3] = sd.x + Math.sin(animTime * sd.sp + sd.ph) * 0.4;
      dust.pos[i * 3 + 1] = sd.y + Math.cos(animTime * sd.sp * 0.8 + sd.ph) * 0.3;
    }
    dust.geo.attributes.position.needsUpdate = true;
    SHOTS[activeKey]?.update(shotT, stepDt, animTime);
  }

  function resize(w, h) {
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function dispose() {
    for (const d of disposables) d.dispose?.();
  }

  setShot('ship');
  return { scene, camera, setShot, resize, update, dispose };
}
