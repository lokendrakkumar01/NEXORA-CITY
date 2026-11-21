import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const ui = {
    health: $('#healthBar'), healthValue: $('#healthValue'), stamina: $('#staminaBar'), staminaValue: $('#staminaValue'),
    distance: $('#distance'), objective: $('#objectiveText'), progress: $('#progressBar'), interaction: $('#interaction'),
    toast: $('#toast'), toastText: $('#toast strong'), vehicleHud: $('#vehicleHud'), speed: $('#speedValue'), gear: $('#gearValue'),
    pause: $('#pauseOverlay'), pauseMission: $('#pauseMission'), loading: $('#loadingScreen'), clock: $('#clock'), quality: $('#qualityToggle'),
    ammo: $('#ammoValue'), reserve: $('#reserveValue'), wanted: $('#wanted'), damage: $('#damageFlash'), hitMarker: $('#hitMarker'),
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090f19);
  scene.fog = new THREE.FogExp2(0x101a24, 0.0077);
  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 560);
  const renderer = new THREE.WebGLRenderer({ canvas: $('#world'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.48, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const WORLD = { w: 240, d: 180, roadX: 120, roadW: 37 };
  const clock = new THREE.Timer();
  const shared = {
    box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 16, 12),
    window: new THREE.PlaneGeometry(1.25, 1.65),
    road: new THREE.MeshStandardMaterial({ color: 0x20272b, roughness: 0.84, metalness: 0.12 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x43494a, roughness: 0.93 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x192c38, roughness: 0.19, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.56, metalness: 0.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x090c10, roughness: 0.92 }),
    windowLit: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x429d94, emissiveIntensity: 0.5, roughness: 0.28 }),
    windowWarm: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xb2804d, emissiveIntensity: 0.42, roughness: 0.3 }),
  };

  scene.add(new THREE.HemisphereLight(0x9bc4df, 0x14151b, 1.45));
  const moon = new THREE.DirectionalLight(0xc0d8ff, 2.0);
  moon.position.set(-54, 68, 28); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -62; moon.shadow.camera.right = 62; moon.shadow.camera.top = 86; moon.shadow.camera.bottom = -86;
  moon.shadow.bias = -0.00015; moon.shadow.normalBias = 0.03; moon.shadow.radius = 5;
  scene.add(moon);
  const warmFill = new THREE.DirectionalLight(0xffb87a, 0.65); warmFill.position.set(40, 18, -60); scene.add(warmFill);

  function mat(color, roughness = 0.7, metalness = 0.05, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); }
  function addMesh(parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, cast = true, receive = true) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = cast; m.receiveShadow = receive; parent.add(m); return m;
  }
  function addBox(parent, material, x, y, z, sx, sy, sz, cast = true) { return addMesh(parent, shared.box, material, x, y, z, sx, sy, sz, cast); }
  function makeTexture(draw, width = 512, height = 256) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); return tex;
  }

  // Procedural night sky: no third-party scene or copyrighted city assets.
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 2; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGradient = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGradient.addColorStop(0, '#07101c'); skyGradient.addColorStop(0.47, '#172433'); skyGradient.addColorStop(0.8, '#28343a'); skyGradient.addColorStop(1, '#34373a');
  skyCtx.fillStyle = skyGradient; skyCtx.fillRect(0, 0, 2, 256);
  const skyTexture = new THREE.CanvasTexture(skyCanvas); skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, color: 0x8796a4 });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 24), skyMaterial);
  sky.rotation.x = Math.PI; scene.add(sky);

  // Ground and streets.
  const groundMat = mat(0x293332, 0.98);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 300), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(120, -0.08, 0); ground.receiveShadow = true; scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadW, 270), shared.road); road.rotation.x = -Math.PI / 2; road.position.set(120, 0, 0); road.receiveShadow = true; scene.add(road);
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(260, 18), shared.road); crossRoad.rotation.x = -Math.PI / 2; crossRoad.position.set(120, 0.015, -3); crossRoad.receiveShadow = true; scene.add(crossRoad);
  const walkMat = mat(0x626362, 0.96), curbMat = mat(0x9aa09a, 0.86);
  for (const side of [-1, 1]) {
    const x = 120 + side * 22;
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(5, 260), walkMat); walk.rotation.x = -Math.PI / 2; walk.position.set(x, 0.045, 0); walk.receiveShadow = true; scene.add(walk);
    addBox(scene, curbMat, 120 + side * 18.9, 0.17, 0, 0.28, 0.28, 266, false);
  }
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xd9d5bf, roughness: 0.8, emissive: 0x26271f, emissiveIntensity: 0.12 });
  for (const x of [120, 120 - 4.5, 120 + 4.5]) {
    for (let z = -128; z <= 132; z += x === 120 ? 11 : 42) {
      addBox(scene, paintMat, x, 0.035, z, x === 120 ? 0.17 : 0.12, 0.025, x === 120 ? 4.8 : 17, false);
    }
  }
  for (const z of [-3, 62]) {
    for (let i = -8; i <= 8; i++) addBox(scene, paintMat, 120 + i * 2.05, 0.04, z, 1.12, 0.025, 0.34, false);
  }
  // Puddles reflect luminous facades after the evening rain.
  const puddleMat = new THREE.MeshPhysicalMaterial({ color: 0x31404a, metalness: 0.72, roughness: 0.14, transparent: true, opacity: 0.65, clearcoat: 1 });
  for (let i = 0; i < 24; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1, 18), puddleMat); p.rotation.x = -Math.PI / 2; p.position.set(91 + Math.sin(i * 18.2) * 38, 0.024 + i * 0.0001, -125 + (i * 17.3) % 260); p.scale.set(0.5 + (i % 4) * 0.3, 0.38 + (i % 5) * 0.12, 1); p.receiveShadow = true; scene.add(p);
  }

  function makeSignTexture(title, subtitle, hue) {
    return makeTexture((c, w, h) => {
      c.fillStyle = '#081117'; c.fillRect(0, 0, w, h);
      c.strokeStyle = `hsl(${hue} 90% 65%)`; c.lineWidth = 6; c.strokeRect(7, 7, w - 14, h - 14);
      c.shadowColor = `hsl(${hue} 100% 60%)`; c.shadowBlur = 32;
      c.fillStyle = `hsl(${hue} 92% 76%)`; c.font = '800 62px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(title, w / 2, h * 0.46);
      c.shadowBlur = 12; c.font = '500 19px monospace'; c.fillText(subtitle, w / 2, h * 0.78);
    });
  }
  const buildings = [];
  const windowMats = [shared.windowLit, shared.windowWarm];
  function buildBuilding(x, z, w, d, h, seed, style = 0, label = '') {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const palettes = [0x29383e, 0x30333b, 0x3b3734, 0x26373a, 0x3b4142];
    const facade = mat(palettes[style % palettes.length], 0.67, 0.22);
    const tower = addBox(g, facade, 0, h / 2, 0, w, h, d);
    tower.receiveShadow = true;
    addBox(g, mat(0x182329, 0.62, 0.45), 0, h + 0.25, 0, w + 0.7, 0.5, d + 0.7);
    addBox(g, mat(0x4a5351, 0.7, 0.38), 0, 0.18, 0, w + 0.5, 0.35, d + 0.5, false);
    // Roof apparatus and mechanical boxes give the skyline a recognizable silhouette.
    const roofMat = mat(0x1e292e, 0.75, 0.4);
    for (let i = 0; i < 3; i++) addBox(g, roofMat, -w * 0.28 + i * w * 0.26, h + 1 + (i % 2) * 0.45, -d * 0.16, w * 0.14, 1.8 + (i % 2), d * 0.25, false);
    for (const edge of [-1, 1]) addBox(g, mat(0x617174, 0.38, 0.72), edge * (w / 2 - 0.3), h / 2, 0, 0.22, h - 1.5, d - 1, false);

    const faceX = x + (x < 120 ? w / 2 + 0.025 : -w / 2 - 0.025);
    const faceRot = x < 120 ? Math.PI / 2 : -Math.PI / 2;
    const columns = Math.max(3, Math.floor(d / 2.6));
    const rows = Math.max(3, Math.floor((h - 4) / 3));
    const count = columns * rows;
    const windows = new THREE.InstancedMesh(shared.window, windowMats[0], count);
    const matrix = new THREE.Object3D(); const color = new THREE.Color();
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
      matrix.position.set(faceX - x, 2.6 + r * ((h - 4) / rows), -d / 2 + (c + 0.5) * (d / columns));
      matrix.rotation.set(0, faceRot, 0); matrix.scale.set(1, 1, 1); matrix.updateMatrix(); windows.setMatrixAt(n, matrix.matrix);
      const lit = Math.sin((seed + c * 27 + r * 13) * 73.13) > 0.06;
      color.set(lit ? (Math.sin(seed * 8 + c * 4 + r) > 0.15 ? 0xa9d9d8 : 0xffc987) : 0x29343a);
      windows.setColorAt(n, color); n++;
    }
    windows.position.set(0, 0, 0); windows.receiveShadow = true; g.add(windows);
    // Service doors, awnings and original district signage.
    if (label) {
      const signTex = makeSignTexture(label, label === 'NEON MARKET' ? 'OPEN ALL NIGHT · FRESH FOOD' : 'AFTERLIGHT / DISTRICT', label === 'NEON MARKET' ? 34 : 180);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: false, side: THREE.DoubleSide, toneMapped: false });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(label === 'NEON MARKET' ? 9 : 11, label === 'NEON MARKET' ? 2.8 : 2.4), signMat);
      sign.position.set(faceX - x + (x < 120 ? 0.2 : -0.2), 4.7, 0); sign.rotation.y = faceRot; g.add(sign);
      const door = mat(0x141e25, 0.23, 0.25); addBox(g, door, 0, 1.4, 0, w * 0.28, 2.7, d * 0.28, false);
      if (label === 'NEON MARKET') {
        addBox(g, mat(0x246b64, 0.52, 0.22, { emissive: 0x0a332f, emissiveIntensity: 0.6 }), 0, 3, 0, w * 0.86, 0.38, d * 0.4, false);
      }
    }
    buildings.push({ x, z, w, d, h, group: g });
  }

  // Two compact blocks form a dense first playable district with a visual skyline behind them.
  const leftRows = [-107, -76, -43, -10, 23, 58, 91, 120];
  for (let i = 0; i < leftRows.length; i++) {
    const z = leftRows[i];
    const height = [28, 36, 24, 42, 22, 31, 20, 34][i];
    buildBuilding(83 + (i % 2) * 1.8, z, 21 + (i % 3) * 3, 24 + (i % 2) * 5, height, 21 + i, i % 5, i === 3 ? 'NEON MARKET' : i === 6 ? 'NEXORA' : '');
    buildBuilding(158 - (i % 2) * 1.8, z - 4, 22 + (i % 2) * 4, 23 + (i % 3) * 3, [30, 21, 39, 25, 35, 19, 42, 27][i], 41 + i, (i + 2) % 5, i === 4 ? 'NEXORA' : '');
  }
  // Skyline blocks dissolve into the atmospheric horizon.
  for (let i = 0; i < 13; i++) {
    const side = i % 2 ? -1 : 1, z = -140 + i * 22;
    buildBuilding(120 + side * (52 + (i % 4) * 9), z, 23 + (i % 3) * 6, 25 + (i % 4) * 4, 34 + (i % 6) * 8, 88 + i, i % 5, i === 5 ? 'NEXORA' : '');
  }

  // Street furniture and leafy pocket park.
  const lampMetal = mat(0x303a3d, 0.48, 0.62);
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0xffdfab, emissive: 0xffb862, emissiveIntensity: 4.2, roughness: 0.3 });
  const lampLights = [];
  for (const side of [-1, 1]) for (let z = -118; z <= 124; z += 30) {
    const x = 120 + side * 16.4;
    addBox(scene, lampMetal, x, 3.1, z, 0.14, 6.2, 0.14, false);
    const arm = addBox(scene, lampMetal, x - side * 0.6, 6.0, z, 1.35, 0.1, 0.12, false); arm.rotation.z = side * -0.08;
    const bulb = addMesh(scene, new THREE.SphereGeometry(0.16, 8, 6), lampGlow, x - side * 1.14, 5.78, z, 1, 0.6, 1, false, false);
    bulb.material = lampGlow;
    if (Math.abs(z) < 85 && lampLights.length < 8) {
      const light = new THREE.PointLight(0xffbf76, 14, 16, 2); light.position.set(x - side * 0.8, 5.5, z); scene.add(light); lampLights.push(light);
    }
  }
  const treeTrunk = mat(0x58483a, 0.92), leafMats = [mat(0x1e5748, 0.9), mat(0x236653, 0.92), mat(0x347561, 0.9)];
  function tree(x, z, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); scene.add(g);
    addMesh(g, new THREE.CylinderGeometry(0.18, 0.24, 2.4, 7), treeTrunk, 0, 1.2, 0, 1, 1, 1, true, false);
    for (let i = 0; i < 4; i++) {
      const crown = addMesh(g, new THREE.IcosahedronGeometry(1, 1), leafMats[i % leafMats.length], (i % 2) * 0.55 - 0.25, 2.6 + (i % 3) * 0.58, (i % 3) * 0.35 - 0.3, 1.3 - (i % 2) * 0.12, 1.05, 1.2, true, false);
      crown.rotation.set(i * 0.5, i * 0.7, i * 0.3);
    }
  }
  for (let i = 0; i < 9; i++) { tree(185 + (i % 3) * 8, 37 + Math.floor(i / 3) * 8, 0.75 + (i % 2) * 0.17); }
  const park = new THREE.Mesh(new THREE.PlaneGeometry(29, 32), mat(0x183b31, 0.98)); park.rotation.x = -Math.PI / 2; park.position.set(194, 0.03, 45); scene.add(park);
  const benchMat = mat(0x8a664b, 0.77, 0.12);
  for (let i = 0; i < 3; i++) { const z = 37 + i * 9; addBox(scene, benchMat, 192, 0.63, z, 2.4, 0.15, 0.55, false); addBox(scene, benchMat, 192, 1.05, z + 0.25, 2.4, 0.7, 0.15, false); }

  // Signals and route marker.
  const signalRed = new THREE.MeshStandardMaterial({ color: 0xff6b69, emissive: 0xa52b2b, emissiveIntensity: 2.2 });
  const signalGreen = new THREE.MeshStandardMaterial({ color: 0x63efd2, emissive: 0x148e75, emissiveIntensity: 2.2 });
  for (const x of [101, 139]) {
    for (const z of [-4, 8]) {
      addBox(scene, lampMetal, x, 4.2, z, 0.18, 8.4, 0.18, false);
      addBox(scene, shared.dark, x, 7.8, z - 0.12, 0.72, 1.9, 0.56, false);
      addMesh(scene, new THREE.SphereGeometry(0.19, 8, 6), signalRed, x, 8.32, z - 0.41, 1, 1, 0.42, false, false);
      addMesh(scene, new THREE.SphereGeometry(0.15, 8, 6), signalGreen, x, 7.38, z - 0.41, 1, 1, 0.42, false, false);
    }
  }
  const goal = new THREE.Group(); goal.position.set(95, 0, -10); scene.add(goal);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd195, emissive: 0xff992b, emissiveIntensity: 3.5, metalness: 0.5, roughness: 0.28 });
  const goalRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.07, 8, 48), ringMat); goalRing.rotation.x = Math.PI / 2; goalRing.position.y = 0.18; goal.add(goalRing);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.55, 8, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb665, transparent: true, opacity: 0.19, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 4; goal.add(beam);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), ringMat); marker.position.y = 8; goal.add(marker);
  const goalLight = new THREE.PointLight(0xffa954, 15, 18); goalLight.position.y = 5; goal.add(goalLight);
  const dataCase = new THREE.Group(); dataCase.position.set(95, 0, -11.8); scene.add(dataCase);
  const caseBody = new THREE.MeshPhysicalMaterial({ color: 0x252e36, metalness: 0.76, roughness: 0.26, clearcoat: 1 });
  const caseTrim = mat(0xd6b36f, 0.28, 0.65, { emissive: 0x63400f, emissiveIntensity: 0.45 });
  addBox(dataCase, caseBody, 0, 0.42, 0, 0.82, 0.55, 0.58);
  addBox(dataCase, caseTrim, 0, 0.72, 0, 0.36, 0.08, 0.06, false);
  addBox(dataCase, ringMat, 0, 0.43, -0.3, 0.18, 0.18, 0.035, false);

  // Original procedural sports coupe with visible glass, lamps, wheels, reflections and damage glow.
  const tireGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 18); tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12); rimGeo.rotateZ(Math.PI / 2);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe5ffff, emissive: 0xb8fff1, emissiveIntensity: 3.4, roughness: 0.18 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff5860, emissive: 0xff1728, emissiveIntensity: 3.2, roughness: 0.2 });
  function makeCar(color = 0xb63837, trafficCar = false) {
    const root = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.24, metalness: 0.58, clearcoat: 1, clearcoatRoughness: 0.13 });
    addBox(root, paint, 0, 0.77, 0, 2.05, 0.55, 4.35);
    addBox(root, paint, 0, 1.1, -1.25, 1.93, 0.3, 1.5);
    addBox(root, shared.glass, 0, 1.45, 0.06, 1.57, 0.7, 1.95);
    addBox(root, paint, 0, 1.81, 0.08, 1.48, 0.12, 1.78);
    addBox(root, mat(0x141a20, 0.4, 0.4), 0, 0.88, 1.22, 1.94, 0.46, 1.28);
    addBox(root, mat(0x272e33, 0.48, 0.58), 0, 0.37, -2.14, 1.82, 0.22, 0.2, false);
    const wheelPivots = [];
    for (const x of [-1.05, 1.05]) for (const z of [-1.35, 1.4]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.42, z); root.add(pivot); wheelPivots.push(pivot);
      addMesh(pivot, tireGeo, shared.rubber, 0, 0, 0, 1, 1, 1, true, false);
      addMesh(pivot, rimGeo, mat(0x9faeb1, 0.25, 0.86), 0, 0, 0, 1, 1, 1, true, false);
    }
    for (const side of [-1, 1]) {
      addBox(root, headMat, side * 0.66, 0.88, -2.18, 0.48, 0.14, 0.08, false);
      addBox(root, tailMat, side * 0.69, 0.91, 2.17, 0.4, 0.15, 0.07, false);
      const mirror = addBox(root, paint, side * 1.12, 1.28, -0.56, 0.25, 0.12, 0.32, false); mirror.rotation.z = side * -0.2;
    }
    const plate = addBox(root, mat(0xd4ded9, 0.35, 0.25), 0, 0.77, 2.2, 0.58, 0.18, 0.035, false);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x03070c, transparent: true, opacity: 0.5, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; shadow.scale.set(1.7, 2.8, 1); root.add(shadow);
    if (trafficCar) root.scale.setScalar(0.82);
    return { root, wheelPivots, shadow };
  }
  const carModel = makeCar(0xb93f39); carModel.speed = 0; scene.add(carModel.root); carModel.root.position.set(122, 0, 63); carModel.root.rotation.y = 0;

  // Human-scale procedural courier and pedestrians.
  const skinMat = mat(0xb98b72, 0.62), jacketMat = mat(0x45bfb3, 0.52, 0.15), pantsMat = mat(0x202833, 0.71), shoeMat = mat(0x11171b, 0.75), bagMat = mat(0x8c543e, 0.67);
  const limbGeo = new THREE.CapsuleGeometry(0.105, 0.48, 3, 8);
  const rivalJacket = mat(0x642a36, 0.59, 0.22), rivalMask = mat(0x15191f, 0.65, 0.12);
  const pistolMetal = new THREE.MeshStandardMaterial({ color: 0x55656a, metalness: 0.82, roughness: 0.24 });
  const pistolAccent = new THREE.MeshStandardMaterial({ color: 0xdec186, emissive: 0x80561d, emissiveIntensity: 0.55, metalness: 0.55, roughness: 0.3 });
  function makeSidearm(accent = pistolAccent) {
    const root = new THREE.Group();
    addBox(root, pistolMetal, 0, 0.02, -0.16, 0.15, 0.14, 0.43, false);
    addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8), pistolMetal, 0, 0.02, -0.49, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
    addBox(root, accent, 0, -0.13, -0.1, 0.12, 0.26, 0.15, false).rotation.x = -0.22;
    addBox(root, mat(0x22292d, 0.75), 0, -0.18, -0.13, 0.14, 0.08, 0.2, false);
    const flash = addMesh(root, new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: 0xffd378, toneMapped: false }), 0, 0.02, -0.65, 1, 1, 1, false, false);
    flash.visible = false;
    return { root, flash, muzzle: new THREE.Vector3(0, 0.02, -0.72), flashTime: 0, cooldown: 0 };
  }

  function makePerson(isPlayer = false, seed = 1, faction = 'civilian') {
    const root = new THREE.Group();
    const bob = new THREE.Group(); bob.position.y = 0.03; root.add(bob);
    const bodyMat = isPlayer ? jacketMat : faction === 'rival' ? rivalJacket : mat([0xb46a62, 0x647ebe, 0xd2a252, 0x789887, 0x8d78a6][seed % 5], 0.7, 0.05);
    const legMat = isPlayer ? pantsMat : faction === 'rival' ? pantsMat : mat([0x28333d, 0x272329, 0x353d43, 0x453832][seed % 4], 0.78);
    addMesh(bob, new THREE.CapsuleGeometry(0.3, 0.43, 5, 10), bodyMat, 0, 1.12, 0, 0.85, 1.18, 0.62);
    const head = addMesh(bob, new THREE.SphereGeometry(0.205, 12, 10), skinMat, 0, 1.76, 0, 0.86, 1.06, 0.9);
    addMesh(bob, new THREE.SphereGeometry(0.215, 10, 8), mat(0x26252a, 0.8), 0, 1.84, -0.015, 0.95, 0.54, 0.94);
    const legs = [], arms = [];
    for (const side of [-1, 1]) {
      const leg = addMesh(bob, limbGeo, legMat, side * 0.14, 0.57, 0, 0.72, 0.9, 0.78); leg.position.y = 0.57; leg.position.x = side * 0.14; legs.push(leg);
      const shoe = addBox(bob, shoeMat, side * 0.14, 0.12, -0.08, 0.23, 0.16, 0.4, true); shoe.userData.side = side;
      const arm = addMesh(bob, limbGeo, isPlayer ? bodyMat : legMat, side * 0.34, 1.11, 0, 0.68, 0.82, 0.7); arms.push(arm);
    }
    let weapon = null;
    if (isPlayer || faction === 'rival') {
      weapon = makeSidearm(isPlayer ? pistolAccent : pistolMetal);
      weapon.root.position.set(0.3, 1.06, -0.2); bob.add(weapon.root);
      addBox(bob, faction === 'rival' ? rivalMask : mat(0x273137), 0, 1.59, -0.19, 0.3, 0.12, 0.12, false);
    }
    if (isPlayer) {
      addBox(bob, bagMat, 0.34, 1.14, 0.18, 0.28, 0.44, 0.32, false);
      addBox(bob, mat(0xb6f4dd, 0.38, 0.1, { emissive: 0x4fdcc6, emissiveIntensity: 0.9 }), 0, 1.38, 0.315, 0.29, 0.11, 0.035, false);
    }
    if (faction === 'rival') {
      addBox(bob, pistolAccent, -0.23, 1.27, 0.02, 0.12, 0.34, 0.45, false);
      addBox(bob, mat(0x22272d, 0.48), 0.29, 1.31, 0.08, 0.1, 0.32, 0.42, false);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.54, 20), new THREE.MeshBasicMaterial({ color: 0x05080a, transparent: true, opacity: 0.35, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
    return { root, bob, legs, arms, shadow, weapon, isPlayer, faction, walkPhase: Math.random() * Math.PI * 2, speed: 0, direction: new THREE.Vector3(0, 0, -1) };
  }
  const player = makePerson(true); scene.add(player.root); player.root.position.set(117.5, 0, 68); player.root.rotation.y = 0;
  const npcPalette = [0xf4c28e, 0xc6d7d3, 0xdda0a2, 0xaabaff, 0xe2d6c1];
  const peds = [];
  for (let i = 0; i < 15; i++) {
    const ped = makePerson(false, i + 11); ped.root.position.set(i % 2 ? 99 + (i % 3) * 2 : 141 - (i % 3) * 2, 0, -116 + i * 16.1); ped.speed = 0.5 + (i % 5) * 0.13;
    ped.direction.set(Math.sin(i * 12.7) * 0.3, 0, Math.cos(i * 9.4) > 0 ? 1 : -1).normalize(); ped.root.rotation.y = Math.atan2(ped.direction.x, -ped.direction.z); ped.color = npcPalette[i % npcPalette.length]; scene.add(ped.root); peds.push(ped);
  }

  // The original Nox crew are present in the scene but only turn hostile after the store alarm.
  const rivals = [];
  const rivalSpawns = [[101, -5], [107, 9], [139, -3], [145, 13]];
  const rivalNames = ['RAE', 'KADO', 'VEX', 'SABLE'];
  rivalSpawns.forEach(([x, z], i) => {
    const enemy = makePerson(false, i + 27, 'rival'); enemy.root.position.set(x, 0, z); enemy.root.visible = false;
    enemy.health = 100; enemy.active = false; enemy.fireTimer = 1.1 + i * 0.55; enemy.stagger = 0; enemy.speed = 1.1 + i * 0.12;
    enemy.name = rivalNames[i];
    const nameTexture = makeTexture((c, w, h) => { c.fillStyle = '#131a20d9'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff9291'; c.font = '700 42px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(enemy.name, w / 2, h / 2); }, 180, 72);
    const namePlate = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture, transparent: true, depthWrite: false })); namePlate.position.set(0, 2.55, 0); namePlate.scale.set(1.8, 0.72, 1); enemy.root.add(namePlate);
    enemy.healthBar = new THREE.Group(); enemy.healthBar.position.set(0, 2.95, 0); enemy.healthBar.visible = false; enemy.root.add(enemy.healthBar);
    const barBack = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x111820, transparent: true, opacity: 0.9, depthWrite: false })); barBack.scale.set(1.4, 0.13, 1); enemy.healthBar.add(barBack);
    enemy.healthFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff6670, depthWrite: false })); enemy.healthFill.position.z = 0.015; enemy.healthFill.scale.set(1.25, 0.07, 1); enemy.healthBar.add(enemy.healthFill);
    enemy.root.traverse((object) => { if (object.isMesh) object.userData.combatant = enemy; });
    scene.add(enemy.root); rivals.push(enemy);
  });

  const traffic = [];
  for (let i = 0; i < 6; i++) {
    const colors = [0x287f80, 0x4d5ca3, 0xad7642, 0x943d4d, 0x80908d, 0x504476];
    const model = makeCar(colors[i], true); model.root.position.set(i % 2 ? 125 : 115, 0, -145 + i * 49); model.root.rotation.y = i % 2 ? 0 : Math.PI; scene.add(model.root);
    traffic.push({ ...model, lane: i % 2 ? 125 : 115, speed: i % 2 ? -4.6 - (i % 3) : 4.7 + (i % 3), direction: i % 2 ? 1 : -1, hitCooldown: 0 });
  }
  const policeCar = makeCar(0x1d3046, true); policeCar.speed = 0; policeCar.root.position.set(120, 0, -155); policeCar.root.visible = false; scene.add(policeCar.root);
  const sirenRed = mat(0xff4b58, 0.25, 0.1, { emissive: 0xe01830, emissiveIntensity: 4 });
  const sirenBlue = mat(0x4d9dff, 0.25, 0.1, { emissive: 0x1764ed, emissiveIntensity: 4 });
  addBox(policeCar.root, shared.dark, 0, 1.94, 0.05, 0.94, 0.12, 0.33, false);
  const redSiren = addMesh(policeCar.root, new THREE.BoxGeometry(0.37, 0.18, 0.3), sirenRed, -0.24, 2.08, 0.05, 1, 1, 1, false, false);
  const blueSiren = addMesh(policeCar.root, new THREE.BoxGeometry(0.37, 0.18, 0.3), sirenBlue, 0.24, 2.08, 0.05, 1, 1, 1, false, false);

  // Ambient rain uses one draw call; the wet district catches neon reflections.
  const rainCount = 580, rainPositions = new Float32Array(rainCount * 6);
  for (let i = 0; i < rainCount; i++) {
    const x = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 190, y = Math.random() * 38 + 2;
    const n = i * 6; rainPositions[n] = x; rainPositions[n + 1] = y; rainPositions[n + 2] = z; rainPositions[n + 3] = x - 0.12; rainPositions[n + 4] = y - 0.9; rainPositions[n + 5] = z;
  }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa1ccde, transparent: true, opacity: 0.28 })); scene.add(rain);

  // A sparse background skyline silhouettes the horizon beyond the playable blocks.
  const starsGeo = new THREE.BufferGeometry(); const stars = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) { const n = i * 3; stars[n] = (Math.random() - 0.5) * 280; stars[n + 1] = 34 + Math.random() * 100; stars[n + 2] = (Math.random() - 0.5) * 240; }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starField = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xa8c6db, size: 0.16, transparent: true, opacity: 0.58, sizeAttenuation: true })); scene.add(starField);

  const state = {
    health: 100, stamina: 100, inCar: false, paused: false, complete: false, sprint: false, hop: 0, time: 0, toast: 0,
    nearCar: false, nearShop: false, highQuality: true, yaw: 0, cameraPitch: 0.29, mouseDown: false, lastMouseX: 0, lastMouseY: 0,
    hitInvuln: 0, ammo: 12, reserve: 60, reload: 0, fireCooldown: 0, wanted: 0, wantedDecay: 0,
    robberyStarted: false, robberyProgress: 0, robberyComplete: false, policeActive: false, kills: 0, escapeComplete: false,
  };
  const held = new Set();
  const tracerEffects = [], particles = [];
  const occluders = [];
  for (const building of buildings) {
    const facadeMesh = building.group.children.find((child) => child.isMesh && child.geometry === shared.box);
    if (facadeMesh) occluders.push(facadeMesh);
  }
  const rivalMeshes = [];
  for (const rival of rivals) rival.root.traverse((object) => { if (object.isMesh) rivalMeshes.push(object); });
  const shotRay = new THREE.Raycaster();
  const targetPosition = new THREE.Vector3(95, 0, -10);
  let lastInteraction = 0;
  function showToast(text) { ui.toastText.textContent = text; ui.toast.classList.add('show'); state.toast = 3.2; }

  function showHitMarker() { ui.hitMarker.classList.remove('show'); void ui.hitMarker.offsetWidth; ui.hitMarker.classList.add('show'); }
  function showDamage() { ui.damage.classList.remove('show'); void ui.damage.offsetWidth; ui.damage.classList.add('show'); }
  function addTracer(start, end, color = 0xffca72) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.94, depthWrite: false, toneMapped: false });
    const line = new THREE.Line(geometry, material); line.frustumCulled = false; scene.add(line); tracerEffects.push({ object: line, life: 0.105, max: 0.105 });
  }
  function sparksAt(point, color = 0xffd586) {
    const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    for (let i = 0; i < 7; i++) {
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.055 + Math.random() * 0.045, 0), material);
      spark.position.copy(point); scene.add(spark);
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 4);
      particles.push({ object: spark, velocity, life: 0.32 + Math.random() * 0.23, max: 0.55 });
    }
  }
  function muzzleFlash(weapon) { if (!weapon) return; weapon.flash.visible = true; weapon.flashTime = 0.075; }
  function reloadWeapon() {
    if (state.inCar || state.reload > 0 || state.ammo === 12 || state.reserve <= 0) return;
    state.reload = 1.15; showToast('RELOADING  ·  NOVA-9');
  }
  function fireWeapon() {
    if (state.paused || state.inCar || !player.weapon || state.reload > 0 || state.fireCooldown > 0) return;
    if (state.ammo <= 0) { reloadWeapon(); return; }
    state.ammo--; state.fireCooldown = 0.23; ui.ammo.textContent = String(state.ammo);
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    shotRay.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = shotRay.intersectObjects([...occluders, ...rivalMeshes], false);
    const first = hits[0]; const endpoint = first ? first.point.clone() : shotRay.ray.origin.clone().addScaledVector(shotRay.ray.direction, 75);
    const muzzle = player.weapon.root.localToWorld(player.weapon.muzzle.clone());
    addTracer(muzzle, endpoint, 0xffd07a); muzzleFlash(player.weapon);
    if (first?.object.userData.combatant) {
      const rival = first.object.userData.combatant;
      rival.health -= 36; rival.stagger = 0.3; rival.healthBar.visible = true;
      rival.healthFill.scale.x = Math.max(0.02, 1.25 * rival.health / 100); rival.healthFill.position.x = -(1.25 - rival.healthFill.scale.x) / 2;
      state.wanted = Math.max(state.wanted, 1); state.wantedDecay = 0;
      showHitMarker(); sparksAt(endpoint, 0xffb65f);
      if (rival.health <= 0 && rival.active) {
        rival.active = false; rival.root.visible = false; state.kills++;
        showToast(state.kills === rivals.length ? 'NOX CREW BROKEN  ·  ROUTE CLEAR' : `NOX CREW DOWN  ·  ${rivals.length - state.kills} REMAIN`);
      }
    } else if (first) sparksAt(endpoint, 0xc5d2d0);
    if (audioCtx) {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(190, audioCtx.currentTime); osc.frequency.exponentialRampToValueAtTime(54, audioCtx.currentTime + 0.075);
      gain.gain.setValueAtTime(0.045, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.085); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.09);
    }
  }

  function applyDamage(amount, message) {
    if (state.hitInvuln > 0 || state.escapeComplete) return;
    state.health = Math.max(0, state.health - amount); state.hitInvuln = 0.72; showDamage();
    if (message) showToast(message);
    if (state.health <= 0) {
      state.health = 60; state.inCar = false; player.root.visible = true; ui.vehicleHud.classList.remove('show');
      player.root.position.set(117.5, 0, 68); player.root.rotation.y = 0; state.hitInvuln = 3.5;
      showToast('CREW MEDIC  ·  BACK ON YOUR FEET');
    }
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    bloom.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);

  function movementVector(forward, right) {
    const f = new THREE.Vector3(Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const r = new THREE.Vector3(Math.cos(state.yaw), 0, Math.sin(state.yaw));
    return f.multiplyScalar(forward).add(r.multiplyScalar(right));
  }
  function doInteract() {
    const now = performance.now(); if (now - lastInteraction < 350) return; lastInteraction = now;
    if (state.inCar) {
      state.inCar = false; ui.vehicleHud.classList.remove('show');
      player.root.visible = true;
      const car = carModel.root.position;
      player.root.position.set(car.x + Math.cos(carModel.root.rotation.y) * 2.6, 0, car.z + Math.sin(carModel.root.rotation.y) * 2.6);
      player.root.rotation.y = carModel.root.rotation.y;
      showToast('ON FOOT  ·  PACKAGE SECURED');
    } else if (state.nearCar) {
      state.inCar = true; player.root.visible = false; ui.vehicleHud.classList.add('show'); showToast('VELA GT  ·  READY TO DRIVE');
    } else if (state.nearShop && !state.robberyStarted) {
      state.robberyStarted = true; state.wanted = 3; state.policeDelay = 6; state.robberyProgress = 0;
      ui.objective.textContent = 'Take the data key — hold the shop';
      rivals.forEach((rival) => { rival.active = true; rival.root.visible = true; });
      for (const ped of peds) { const run = ped.root.position.clone().sub(targetPosition); run.y = 0; if (run.lengthSq() > 0.01) ped.direction.copy(run.normalize()); ped.speed = 2.2 + Math.random(); }
      showToast('ALARM TRIPPED  ·  NOX CREW INBOUND');
    }
  }
  function setPause(value) { state.paused = value; ui.pause.classList.toggle('show', value); if (document.pointerLockElement) document.exitPointerLock(); }
  function toggleQuality() {
    state.highQuality = !state.highQuality;
    const ratio = Math.min(devicePixelRatio || 1, state.highQuality ? 1.7 : 1);
    renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(ratio); composer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = state.highQuality;
    moon.shadow.mapSize.set(state.highQuality ? 2048 : 1024, state.highQuality ? 2048 : 1024);
    bloom.strength = state.highQuality ? 0.42 : 0.24;
    renderer.shadowMap.needsUpdate = true;
    ui.quality.textContent = state.highQuality ? 'ULTRA' : 'BALANCED';
    ui.quality.classList.toggle('balanced', !state.highQuality);
  }
  ui.quality.addEventListener('click', toggleQuality);

  function updatePlayer(dt) {
    const forward = (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') || held.has('arrowdown') ? 1 : 0);
    const right = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
    const sprinting = held.has('shift') && state.stamina > 0.5 && !state.inCar && forward > 0;
    state.sprint = sprinting;
    state.stamina = sprinting ? Math.max(0, state.stamina - 22 * dt) : Math.min(100, state.stamina + 13 * dt);
    if (state.inCar) {
      const car = carModel.root;
      const throttle = forward;
      const steering = right;
      carModel.speed = (carModel.speed || 0) + throttle * 16 * dt;
      carModel.speed *= Math.exp(-(throttle === 0 ? 0.9 : 0.18) * dt);
      carModel.speed = THREE.MathUtils.clamp(carModel.speed, -8, 28);
      if (held.has(' ')) carModel.speed *= Math.exp(-4.2 * dt);
      car.rotation.y += steering * dt * Math.min(1.6, Math.abs(carModel.speed) * 0.11) * Math.sign(carModel.speed || 1);
      const dir = new THREE.Vector3(Math.sin(car.rotation.y), 0, -Math.cos(car.rotation.y));
      car.position.addScaledVector(dir, carModel.speed * dt);
      car.position.x = THREE.MathUtils.clamp(car.position.x, 100.2, 139.8);
      car.position.z = THREE.MathUtils.clamp(car.position.z, -158, 158);
      carModel.wheelPivots.forEach((w, i) => { w.rotation.x += carModel.speed * dt * 1.6; if (i < 2) w.rotation.y = -steering * 0.26; });
      ui.speed.textContent = String(Math.round(Math.abs(carModel.speed) * 3.6)).padStart(3, '0');
      ui.gear.textContent = carModel.speed > 0.4 ? 'D' : carModel.speed < -0.4 ? 'R' : 'P';
    } else {
      const direction = movementVector(forward, right);
      const movingVec = direction.lengthSq() > 0.01;
      if (movingVec) {
        direction.normalize();
        const speed = sprinting ? 9.2 : 5.3;
        player.root.position.addScaledVector(direction, speed * dt);
        player.root.position.x = THREE.MathUtils.clamp(player.root.position.x, 81, 213);
        player.root.position.z = THREE.MathUtils.clamp(player.root.position.z, -158, 158);
        player.direction.copy(direction);
        const targetRot = Math.atan2(direction.x, -direction.z);
        player.root.rotation.y = THREE.MathUtils.damp(player.root.rotation.y, targetRot, 13, dt);
      }
      const moving = forward !== 0 || right !== 0;
      const gait = moving ? (sprinting ? 13.5 : 8.5) : 2.2;
      player.walkPhase += dt * gait;
      player.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(player.walkPhase + i * Math.PI) * 0.55 : Math.sin(player.walkPhase + i * Math.PI) * 0.035; });
      player.arms.forEach((arm, i) => { arm.rotation.x = moving ? Math.sin(player.walkPhase + i * Math.PI + Math.PI) * 0.42 : 0.02; });
      if (state.hop > 0) { state.hop = Math.max(0, state.hop - dt); player.bob.position.y = 0.03 + Math.sin((state.hop / 0.48) * Math.PI) * 0.85; }
      else player.bob.position.y = 0.03 + (moving ? Math.abs(Math.sin(player.walkPhase * 2)) * 0.045 : 0);
    }
    const actor = state.inCar ? carModel.root : player.root;
    state.nearCar = !state.inCar && player.root.position.distanceTo(carModel.root.position) < 8;
    state.nearShop = !state.inCar && !state.robberyStarted && player.root.position.distanceTo(targetPosition) < 5.8;
    ui.interaction.classList.toggle('show', state.nearCar || state.inCar || state.nearShop);
    ui.interaction.querySelector('span:last-child').textContent = state.inCar ? 'EXIT VEHICLE' : state.nearCar ? 'ENTER VELA GT' : 'START THE STORE HEIST';

    // Pedestrians wander along the sidewalks and react to a close approach.
    for (const ped of peds) {
      const toPlayer = ped.root.position.distanceTo(player.root.position);
      if (!state.inCar && toPlayer < 3.2) {
        const away = ped.root.position.clone().sub(player.root.position); away.y = 0; away.normalize(); ped.direction.lerp(away, Math.min(1, dt * 2.5)).normalize();
      } else if (Math.random() < 0.003) {
        ped.direction.x += (Math.random() - 0.5) * 0.55; ped.direction.z += (Math.random() - 0.5) * 0.3; ped.direction.normalize();
      }
      ped.root.position.addScaledVector(ped.direction, ped.speed * dt);
      if (ped.root.position.x < 96 || ped.root.position.x > 145) ped.direction.x *= -1;
      if (ped.root.position.z < -150 || ped.root.position.z > 150) ped.direction.z *= -1;
      ped.root.position.x = THREE.MathUtils.clamp(ped.root.position.x, 95, 145); ped.root.position.z = THREE.MathUtils.clamp(ped.root.position.z, -151, 151);
      ped.walkPhase += dt * 6;
      ped.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(ped.walkPhase + i * Math.PI) * 0.19; });
      ped.arms.forEach((arm, i) => { arm.rotation.x = Math.sin(ped.walkPhase + i * Math.PI + Math.PI) * 0.14; });
      if (ped.direction.lengthSq() > 0.01) ped.root.rotation.y = THREE.MathUtils.damp(ped.root.rotation.y, Math.atan2(ped.direction.x, -ped.direction.z), 3, dt);
    }

    // Traffic follows its lane; close collisions injure Loki and push traffic onward.
    for (const t of traffic) {
      t.root.position.z += t.speed * dt;
      if (t.root.position.z < -170) t.root.position.z = 170;
      if (t.root.position.z > 170) t.root.position.z = -170;
      t.wheelPivots.forEach((w) => { w.rotation.x += t.speed * dt * 1.6; });
      const hitDist = t.root.position.distanceTo(actor.position);
      if (hitDist < (state.inCar ? 2.9 : 1.8) && state.hitInvuln <= 0) {
        state.hitInvuln = 0; applyDamage(state.inCar ? 8 : 20);
        if (!state.inCar) player.root.position.addScaledVector(player.direction, -2.5);
        showToast(state.inCar ? 'COLLISION  ·  DRIVE CAREFULLY' : 'WATCH THE TRAFFIC!');
      }
    }
    state.hitInvuln = Math.max(0, state.hitInvuln - dt);

    if (state.robberyStarted && !state.robberyComplete) {
      state.robberyProgress = Math.min(1, state.robberyProgress + dt / 6.5);
      ui.objective.textContent = state.robberyProgress < 1 ? 'Secure the data key — survive the ambush' : 'Get to the East Gate';
      ui.progress.style.width = `${Math.round(state.robberyProgress * 100)}%`;
      if (state.robberyProgress >= 1) {
        state.robberyComplete = true; dataCase.visible = false; targetPosition.set(120, 0, 140); goal.position.copy(targetPosition);
        $('#intelValue').textContent = '02/03'; showToast('DATA KEY SECURED  ·  GET TO THE EAST GATE');
      }
    }
    const dist = actor.position.distanceTo(targetPosition);
    ui.distance.textContent = `${Math.round(dist)} m`;
    if (!state.robberyStarted) ui.progress.style.width = `${Math.max(4, Math.min(100, (1 - dist / 100) * 100))}%`;
    if (state.robberyComplete) ui.progress.style.width = `${Math.max(4, Math.min(100, (1 - dist / 190) * 100))}%`;
    if (state.robberyComplete && !state.escapeComplete && state.inCar && dist < 11) {
      state.escapeComplete = true; state.complete = true; state.wanted = 0; state.policeActive = false; policeCar.root.visible = false;
      rivals.forEach((rival) => { rival.active = false; rival.root.visible = false; });
      ui.objective.textContent = 'NEXORA CITY — YOU GOT OUT'; ui.pauseMission.textContent = 'COMPLETE'; ui.progress.style.width = '100%'; showToast('CLEAN GETAWAY  ·  ¢ 2,400 EARNED');
    }
    ui.health.style.width = `${state.health}%`; ui.healthValue.textContent = `${Math.round(state.health)}%`;
    ui.stamina.style.width = `${state.stamina}%`; ui.staminaValue.textContent = `${Math.round(state.stamina)}%`;
    const hourFloat = (21.8 + state.time / 72) % 24;
    const hour = Math.floor(hourFloat), min = Math.floor((hourFloat - hour) * 60);
    ui.clock.textContent = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const daylight = THREE.MathUtils.smoothstep(Math.sin((hourFloat - 6) * Math.PI / 12), 0, 1);
    moon.intensity = 1.55 - daylight * 1.25;
    moon.color.set(0x9bbef2).lerp(new THREE.Color(0xffd1a0), daylight * 0.7);
    warmFill.intensity = 0.36 + daylight * 1.15;
    scene.fog.color.set(0x111b26).lerp(new THREE.Color(0x81909a), daylight * 0.45);
    skyMaterial.color.set(0x7f91a6).lerp(new THREE.Color(0xffffff), daylight * 0.7);
    shared.windowLit.emissiveIntensity = 0.5 * (1 - daylight * 0.8);
    shared.windowWarm.emissiveIntensity = 0.42 * (1 - daylight * 0.75);
    ui.ammo.textContent = String(state.ammo); ui.reserve.textContent = String(state.reserve);
    ui.wanted.classList.toggle('show', state.wanted > 0);
    ui.wanted.querySelector('b').textContent = `${'★'.repeat(state.wanted)}${'☆'.repeat(5 - state.wanted)}`;
    if (state.toast > 0 && (state.toast -= dt) <= 0) ui.toast.classList.remove('show');
  }

  function updateCombat(dt) {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    if (state.reload > 0 && (state.reload -= dt) <= 0) {
      const loaded = Math.min(12 - state.ammo, state.reserve); state.ammo += loaded; state.reserve -= loaded; showToast('NOVA-9 READY');
    }
    const weapons = [player.weapon, ...rivals.map((rival) => rival.weapon)];
    for (const weapon of weapons) if (weapon) {
      weapon.flashTime = Math.max(0, weapon.flashTime - dt); weapon.flash.visible = weapon.flashTime > 0;
      if (weapon.flash.visible) { const pulse = 0.7 + Math.random() * 0.75; weapon.flash.scale.setScalar(pulse); }
    }
    for (let i = tracerEffects.length - 1; i >= 0; i--) {
      const effect = tracerEffects[i]; effect.life -= dt; effect.object.material.opacity = Math.max(0, effect.life / effect.max);
      if (effect.life <= 0) { scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); tracerEffects.splice(i, 1); }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const effect = particles[i]; effect.life -= dt; effect.object.position.addScaledVector(effect.velocity, dt); effect.velocity.y -= 7 * dt;
      effect.object.scale.multiplyScalar(Math.max(0.15, 1 - dt * 2.8));
      if (effect.life <= 0) { scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); particles.splice(i, 1); }
    }
    if (!state.robberyStarted || state.escapeComplete) return;
    const actor = state.inCar ? carModel.root : player.root;
    for (const rival of rivals) {
      if (!rival.active) continue;
      const towardPlayer = actor.position.clone().sub(rival.root.position); towardPlayer.y = 0;
      const distance = towardPlayer.length(); if (distance < 0.01) continue;
      towardPlayer.normalize(); rival.root.rotation.y = THREE.MathUtils.damp(rival.root.rotation.y, Math.atan2(towardPlayer.x, -towardPlayer.z), 6, dt);
      if (distance > 8.5) {
        rival.root.position.addScaledVector(towardPlayer, rival.speed * dt);
        rival.walkPhase += dt * 8;
        rival.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(rival.walkPhase + i * Math.PI) * 0.24; });
      }
      rival.fireTimer -= dt;
      if (distance < 30 && rival.fireTimer <= 0) {
        rival.fireTimer = 1.55 + Math.random() * 1.25; muzzleFlash(rival.weapon);
        const muzzle = rival.weapon.root.localToWorld(rival.weapon.muzzle.clone());
        const endpoint = actor.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.1, 1.2 + (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 2.1));
        addTracer(muzzle, endpoint, 0xff565c);
        const accuracy = distance < 14 ? 0.48 : distance < 23 ? 0.29 : 0.12;
        if (Math.random() < accuracy) applyDamage(state.inCar ? 7 : 9, 'NOX CREW  ·  TAKE COVER');
      }
    }
    if (state.policeDelay > 0 && (state.policeDelay -= dt) <= 0) {
      state.policeActive = true; policeCar.root.visible = true; showToast('DISPATCH  ·  PATROL UNIT RESPONDING');
    }
    if (state.policeActive && state.wanted > 0) {
      const chase = actor.position.clone().sub(policeCar.root.position); chase.y = 0;
      const distance = chase.length(); if (distance > 0.1) {
        chase.normalize(); policeCar.root.rotation.y = Math.atan2(chase.x, -chase.z);
        policeCar.root.position.addScaledVector(chase, 10.5 * dt);
        policeCar.root.position.x = THREE.MathUtils.clamp(policeCar.root.position.x, 100, 140);
        policeCar.root.position.z = THREE.MathUtils.clamp(policeCar.root.position.z, -164, 164);
        policeCar.wheelPivots.forEach((wheel) => { wheel.rotation.x += 10.5 * dt * 1.5; });
      }
      const flashOn = Math.sin(state.time * 13) > 0;
      redSiren.material.emissiveIntensity = flashOn ? 5.5 : 0.35;
      blueSiren.material.emissiveIntensity = flashOn ? 0.35 : 5.5;
      if (distance < 5 && state.hitInvuln <= 0) applyDamage(state.inCar ? 9 : 12, 'PATROL UNIT  ·  BREAK CONTACT');
      if (state.robberyComplete && distance > 52) {
        state.wantedDecay += dt;
        if (state.wantedDecay > 13) {
          state.wanted = Math.max(0, state.wanted - 1); state.wantedDecay = 0;
          if (state.wanted === 0) { state.policeActive = false; policeCar.root.visible = false; showToast('SEARCH CALLED OFF  ·  HEAT LOST'); }
          else showToast('YOU LOST A STAR  ·  KEEP MOVING');
        }
      } else state.wantedDecay = 0;
    }
  }

  const cameraDesired = new THREE.Vector3(); const cameraLook = new THREE.Vector3(); const cameraLookTarget = new THREE.Vector3();
  function updateCamera(dt) {
    const actor = state.inCar ? carModel.root : player.root;
    const followDistance = state.inCar ? 10.5 : 8.2;
    const horizontalDistance = followDistance * Math.cos(state.cameraPitch);
    const followHeight = followDistance * Math.sin(state.cameraPitch) + 1.25;
    const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
    cameraDesired.set(actor.position.x + sin * horizontalDistance, actor.position.y + followHeight, actor.position.z + cos * horizontalDistance);
    camera.position.lerp(cameraDesired, 1 - Math.exp(-dt * 4.2));
    cameraLookTarget.set(actor.position.x, actor.position.y + (state.inCar ? 1.1 : 1.25), actor.position.z);
    cameraLook.lerp(cameraLookTarget, 1 - Math.exp(-dt * 6.5)); camera.lookAt(cameraLook);
  }

  function drawMinimap() {
    const c = $('#minimap'), g = c.getContext('2d'), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h); g.fillStyle = '#0a151d'; g.fillRect(0, 0, w, h);
    const scaleX = w / WORLD.w, scaleZ = h / WORLD.d;
    g.fillStyle = '#2b373c'; g.fillRect((120 - WORLD.roadW / 2) * scaleX, 0, WORLD.roadW * scaleX, h);
    g.fillRect(0, (WORLD.d / 2 - 12) * scaleZ, w, 18 * scaleZ);
    for (const b of buildings) { g.fillStyle = '#3b4b51'; g.fillRect((b.x - b.w / 2) * scaleX, (b.z + WORLD.d / 2 - b.d / 2) * scaleZ, b.w * scaleX, b.d * scaleZ); }
    g.fillStyle = '#ffb565'; g.shadowColor = '#ffb565'; g.shadowBlur = 9;
    g.beginPath(); g.arc(targetPosition.x * scaleX, (targetPosition.z + WORLD.d / 2) * scaleZ, 3.3, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    for (const rival of rivals) if (rival.active) { g.fillStyle = '#ff6871'; g.beginPath(); g.arc(rival.root.position.x * scaleX, (rival.root.position.z + WORLD.d / 2) * scaleZ, 2.4, 0, Math.PI * 2); g.fill(); }
    if (state.policeActive) { g.fillStyle = '#61aaff'; g.beginPath(); g.arc(policeCar.root.position.x * scaleX, (policeCar.root.position.z + WORLD.d / 2) * scaleZ, 3, 0, Math.PI * 2); g.fill(); }
    const actor = state.inCar ? carModel.root.position : player.root.position;
    g.save(); g.translate(actor.x * scaleX, (actor.z + WORLD.d / 2) * scaleZ); g.rotate(-state.yaw);
    g.fillStyle = '#62ecdf'; g.shadowColor = '#62ecdf'; g.shadowBlur = 11; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(0, 2); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore(); g.shadowBlur = 0;
  }

  let mapTimer = 0;
  function animate() {
    requestAnimationFrame(animate);
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.04);
    if (!state.paused) {
      state.time += dt; updatePlayer(dt); updateCombat(dt); updateCamera(dt);
      goalRing.scale.setScalar(1 + Math.sin(state.time * 3.2) * 0.08); marker.rotation.y += dt * 0.8; beam.material.opacity = 0.13 + (Math.sin(state.time * 2.1) + 1) * 0.055;
      rain.position.z = (rain.position.z + dt * 8) % 12;
      mapTimer += dt; if (mapTimer > 0.15) { drawMinimap(); mapTimer = 0; }
    }
    composer.render();
  }

  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
    if (key === 'escape') { setPause(!state.paused); return; }
    if ((key === 'e' || key === 'f') && !e.repeat) { doInteract(); return; }
    if (key === 'r' && !e.repeat) { reloadWeapon(); return; }
    if (key === ' ' && !e.repeat && !state.inCar) { state.hop = 0.48; player.bob.position.y = 0.03; }
    held.add(key);
  }
  function onKeyUp(e) { held.delete(e.key.toLowerCase()); }
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', () => held.clear());
  const canvas = $('#world');
  canvas.addEventListener('pointerdown', (e) => {
    wakeAudio(); canvas.setPointerCapture(e.pointerId);
    if (e.button === 0) { fireWeapon(); return; }
    if (e.button === 2) { state.mouseDown = true; state.lastMouseX = e.clientX; state.lastMouseY = e.clientY; }
  });
  canvas.addEventListener('pointerup', () => { state.mouseDown = false; });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.mouseDown || state.paused) return;
    const dx = e.clientX - state.lastMouseX, dy = e.clientY - state.lastMouseY;
    state.lastMouseX = e.clientX; state.lastMouseY = e.clientY;
    state.yaw -= dx * 0.0045; state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch + dy * 0.0015, 0.16, 0.55);
  });
  canvas.addEventListener('wheel', (e) => { camera.fov = THREE.MathUtils.clamp(camera.fov + Math.sign(e.deltaY) * 1.2, 43, 68); camera.updateProjectionMatrix(); }, { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  $('#resumeButton').addEventListener('click', () => setPause(false));

  // Lightweight procedural engine tone; audio starts only after the player touches a control.
  let audioCtx, engineOsc, engineGain, engineFilter;
  function wakeAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    try {
      audioCtx = new AudioContext(); engineOsc = audioCtx.createOscillator(); engineGain = audioCtx.createGain(); engineFilter = audioCtx.createBiquadFilter();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 46; engineFilter.type = 'lowpass'; engineFilter.frequency.value = 115; engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(audioCtx.destination); engineOsc.start();
      const mix = () => { if (!audioCtx) return; engineOsc.frequency.setTargetAtTime(45 + Math.abs(carModel.speed || 0) * 3.2, audioCtx.currentTime, 0.15); engineGain.gain.setTargetAtTime(state.inCar ? 0.022 + Math.abs(carModel.speed || 0) * 0.0015 : 0, audioCtx.currentTime, 0.15); requestAnimationFrame(mix); }; mix();
    } catch { /* Sound is optional when the browser disables audio. */ }
  }
  addEventListener('keydown', wakeAudio, { once: true }); canvas.addEventListener('pointerdown', wakeAudio, { once: true });

  drawMinimap();
  camera.position.set(120, 5, 76); camera.lookAt(120, 1, 68);
  ui.toastText.textContent = 'AFTERLIGHT DISTRICT  ·  LIVE'; ui.toast.classList.add('show'); state.toast = 3.4;
  composer.render();
  animate();
  setTimeout(() => { ui.loading.classList.add('hidden'); }, 700);
})();
