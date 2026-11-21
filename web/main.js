import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

RectAreaLightUniformsLib.init();

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const ui = {
    health: $('#healthBar'), healthValue: $('#healthValue'), stamina: $('#staminaBar'), staminaValue: $('#staminaValue'),
    distance: $('#distance'), objective: $('#objectiveText'), progress: $('#progressBar'), interaction: $('#interaction'),
    toast: $('#toast'), toastText: $('#toast strong'), vehicleHud: $('#vehicleHud'), speed: $('#speedValue'), gear: $('#gearValue'),
    pause: $('#pauseOverlay'), pauseMission: $('#pauseMission'), loading: $('#loadingScreen'), clock: $('#clock'), quality: $('#qualityToggle'),
    ammo: $('#ammoValue'), reserve: $('#reserveValue'), wanted: $('#wanted'), damage: $('#damageFlash'), hitMarker: $('#hitMarker'),
    weaponTitle: $('#weaponTitle'), weaponType: $('#weaponType'), weaponCaliber: $('#weaponCaliber'), weaponDot: $('#weaponDot'),
    wepSlots: $$('.wep-slot'),
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090f19);
  scene.fog = new THREE.FogExp2(0x101a24, 0.0077);
  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 560);
  const renderer = new THREE.WebGLRenderer({ canvas: $('#world'), antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2.0));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ssaoPass = new SSAOPass(scene, camera, innerWidth, innerHeight);
  ssaoPass.kernelRadius = 16;
  ssaoPass.minDistance = 0.005;
  ssaoPass.maxDistance = 0.1;
  composer.addPass(ssaoPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.75);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms['resolution'].value.set(1 / innerWidth, 1 / innerHeight);
  composer.addPass(fxaaPass);

  const WORLD = { w: 240, d: 180, roadX: 120, roadW: 37 };
  const clock = new THREE.Clock();
  const shared = {
    box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 16, 12),
    window: new THREE.PlaneGeometry(1.25, 1.65),
    road: new THREE.MeshStandardMaterial({ color: 0x1a2024, roughness: 0.35, metalness: 0.55, envMapIntensity: 1.2 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x43494a, roughness: 0.93 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x192c38, roughness: 0.19, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.56, metalness: 0.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x090c10, roughness: 0.92 }),
    windowLit: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x429d94, emissiveIntensity: 0.5, roughness: 0.28, envMapIntensity: 0.9 }),
    windowWarm: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xb2804d, emissiveIntensity: 0.42, roughness: 0.3, envMapIntensity: 0.9 }),
  };

  // Cinematic dual-ambient lighting
  scene.add(new THREE.HemisphereLight(0x7ab4d8, 0x1a1f2e, 0.9));
  const warmFill = new THREE.HemisphereLight(0xffb347, 0x2a1a0a, 0.35);
  scene.add(warmFill);

  const moon = new THREE.DirectionalLight(0xd0e8ff, 2.8);
  moon.position.set(-54, 68, 28); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -62; moon.shadow.camera.right = 62; moon.shadow.camera.top = 86; moon.shadow.camera.bottom = -86;
  moon.shadow.bias = -0.00015; moon.shadow.normalBias = 0.03; moon.shadow.radius = 8;
  scene.add(moon);

  // RectAreaLight for neon street spill
  const neonSpill = new THREE.RectAreaLight(0xffaa44, 6, 12, 5);
  neonSpill.position.set(83, 6, -10);
  neonSpill.lookAt(120, 0, -10);
  scene.add(neonSpill);

  // Deep atmosphere backfill
  const deepFill = new THREE.PointLight(0x5566ff, 8, 90);
  deepFill.position.set(145, 2, -40);
  scene.add(deepFill);

  // Player dynamic rim light
  const playerRimLight = new THREE.PointLight(0x88aaff, 3, 5);
  scene.add(playerRimLight);

  // Volumetric sky atmosphere sphere
  const atmosphereDome = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x0a1520, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false })
  );
  scene.add(atmosphereDome);

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

  // Procedural night sky
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 2; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGradient = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGradient.addColorStop(0, '#07101c'); skyGradient.addColorStop(0.47, '#172433'); skyGradient.addColorStop(0.8, '#28343a'); skyGradient.addColorStop(1, '#34373a');
  skyCtx.fillStyle = skyGradient; skyCtx.fillRect(0, 0, 2, 256);
  const skyTexture = new THREE.CanvasTexture(skyCanvas); skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, color: 0x8796a4 });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 24), skyMaterial);
  sky.rotation.x = Math.PI; scene.add(sky);

  // Ground and streets
  const groundMat = mat(0x293332, 0.98);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 300), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(120, -0.08, 0); ground.receiveShadow = true; scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadW, 270), shared.road); road.rotation.x = -Math.PI / 2; road.position.set(120, 0, 0); road.receiveShadow = true; scene.add(road);
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(260, 18), shared.road); crossRoad.rotation.x = -Math.PI / 2; crossRoad.position.set(120, 0.015, -3); crossRoad.receiveShadow = true; scene.add(crossRoad);

  // Wet road puddle layer
  const mainPuddleLayer = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.roadW, 270),
    new THREE.MeshPhysicalMaterial({ color: 0x2a3d4a, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1 })
  );
  mainPuddleLayer.rotation.x = -Math.PI / 2; mainPuddleLayer.position.set(120, 0.005, 0); mainPuddleLayer.receiveShadow = true; scene.add(mainPuddleLayer);

  const walkMat = mat(0x626362, 0.96), curbMat = mat(0x9aa09a, 0.86);
  for (const side of [-1, 1]) {
    const x = 120 + side * 22;
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(5, 260), walkMat); walk.rotation.x = -Math.PI / 2; walk.position.set(x, 0.045, 0); walk.receiveShadow = true; scene.add(walk);
    addBox(scene, curbMat, 120 + side * 18.9, 0.17, 0, 0.28, 0.28, 266, false);
  }
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xd9d5bf, roughness: 0.8, emissive: 0x44332a, emissiveIntensity: 0.2 });
  for (const x of [120, 120 - 4.5, 120 + 4.5]) {
    for (let z = -128; z <= 132; z += x === 120 ? 11 : 42) {
      addBox(scene, paintMat, x, 0.035, z, x === 120 ? 0.17 : 0.12, 0.025, x === 120 ? 4.8 : 17, false);
    }
  }
  for (const z of [-3, 62]) {
    for (let i = -8; i <= 8; i++) addBox(scene, paintMat, 120 + i * 2.05, 0.04, z, 1.12, 0.025, 0.34, false);
  }

  // Puddles reflect luminous facades
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

  // BUILDINGS & SOLID WALL COLLISION DATA
  const buildings = [];
  const windowMats = [shared.windowLit, shared.windowWarm];
  const neonColors = [0x00ffcc, 0xff3366, 0x6644ff, 0xffaa00, 0x00aaff];

  function buildBuilding(x, z, w, d, h, seed, style = 0, label = '') {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const palettes = [0x29383e, 0x30333b, 0x3b3734, 0x26373a, 0x3b4142];
    const facade = mat(palettes[style % palettes.length], 0.67, 0.22);
    const tower = addBox(g, facade, 0, h / 2, 0, w, h, d);
    tower.receiveShadow = true;
    addBox(g, mat(0x182329, 0.62, 0.45), 0, h + 0.25, 0, w + 0.7, 0.5, d + 0.7);
    addBox(g, mat(0x4a5351, 0.7, 0.38), 0, 0.18, 0, w + 0.5, 0.35, d + 0.5, false);

    // Neon LED strip around base of building
    const ledColor = neonColors[seed % neonColors.length];
    const ledMat = new THREE.MeshStandardMaterial({ emissive: ledColor, emissiveIntensity: 2.8, color: ledColor, roughness: 0.2 });
    addBox(g, ledMat, 0, 0.36, 0, w + 0.55, 0.09, d + 0.55, false);

    // Roof apparatus clusters and AC units
    const roofMat = mat(0x1e292e, 0.75, 0.4);
    for (let i = 0; i < 3; i++) addBox(g, roofMat, -w * 0.28 + i * w * 0.26, h + 1 + (i % 2) * 0.45, -d * 0.16, w * 0.14, 1.8 + (i % 2), d * 0.25, false);
    for (let i = 0; i < 2; i++) {
      addBox(g, mat(0x2d373c, 0.6, 0.6), w * 0.22, h + 0.6 + i * 0.4, d * 0.18 * (i ? -1 : 1), 1.2, 0.9, 1.4, false);
    }
    for (const edge of [-1, 1]) addBox(g, mat(0x617174, 0.38, 0.72), edge * (w / 2 - 0.3), h / 2, 0, 0.22, h - 1.5, d - 1, false);

    const faceX = x + (x < 120 ? w / 2 + 0.025 : -w / 2 - 0.025);
    const faceRot = x < 120 ? Math.PI / 2 : -Math.PI / 2;
    const columns = Math.max(4, Math.floor(d / 2.0));
    const rows = Math.max(5, Math.floor((h - 3) / 2.5));
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

    // Signage
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

  // Street blocks
  const leftRows = [-107, -76, -43, -10, 23, 58, 91, 120];
  for (let i = 0; i < leftRows.length; i++) {
    const z = leftRows[i];
    const height = [28, 36, 24, 42, 22, 31, 20, 34][i];
    buildBuilding(83 + (i % 2) * 1.8, z, 21 + (i % 3) * 3, 24 + (i % 2) * 5, height, 21 + i, i % 5, i === 3 ? 'NEON MARKET' : i === 6 ? 'NEXORA' : '');
    buildBuilding(158 - (i % 2) * 1.8, z - 4, 22 + (i % 2) * 4, 23 + (i % 3) * 3, [30, 21, 39, 25, 35, 19, 42, 27][i], 41 + i, (i + 2) % 5, i === 4 ? 'NEXORA' : '');
  }
  for (let i = 0; i < 13; i++) {
    const side = i % 2 ? -1 : 1, z = -140 + i * 22;
    buildBuilding(120 + side * (52 + (i % 4) * 9), z, 23 + (i % 3) * 6, 25 + (i % 4) * 4, 34 + (i % 6) * 8, 88 + i, i % 5, i === 5 ? 'NEXORA' : '');
  }

  // AABB SOLID BUILDING COLLISION RESOLVER
  function resolveBuildingCollision(pos, radius = 0.6) {
    let hit = false;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const hw = b.w * 0.5 + radius;
      const hd = b.d * 0.5 + radius;
      const dx = pos.x - b.x;
      const dz = pos.z - b.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        hit = true;
        const ox = hw - Math.abs(dx);
        const oz = hd - Math.abs(dz);
        if (ox < oz) {
          pos.x += (dx >= 0 ? 1 : -1) * ox;
        } else {
          pos.z += (dz >= 0 ? 1 : -1) * oz;
        }
      }
    }
    return hit;
  }

  // Street furniture and park
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

  // Signals and objective marker
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

  // VEHICLE SYSTEM
  const tireGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.32, 18); tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12); rimGeo.rotateZ(Math.PI / 2);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe5ffff, emissive: 0xb8fff1, emissiveIntensity: 3.4, roughness: 0.18 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff5860, emissive: 0xff1728, emissiveIntensity: 3.2, roughness: 0.2 });

  function makeCar(color = 0xb63837, trafficCar = false) {
    const root = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0.72, clearcoat: 1.0, clearcoatRoughness: 0.08, reflectivity: 1.0 });
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
    const myTailMat = tailMat.clone();
    for (const side of [-1, 1]) {
      addBox(root, headMat, side * 0.66, 0.88, -2.18, 0.48, 0.14, 0.08, false);
      addBox(root, myTailMat, side * 0.69, 0.91, 2.17, 0.4, 0.15, 0.07, false);
      const mirror = addBox(root, paint, side * 1.12, 1.28, -0.56, 0.25, 0.12, 0.32, false); mirror.rotation.z = side * -0.2;
    }
    addBox(root, mat(0xd4ded9, 0.35, 0.25), 0, 0.77, 2.2, 0.58, 0.18, 0.035, false);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x03070c, transparent: true, opacity: 0.5, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; shadow.scale.set(1.7, 2.8, 1); root.add(shadow);

    const underglow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.8), new THREE.MeshBasicMaterial({ color: 0x0044ff, transparent: true, opacity: 0.18, depthWrite: false }));
    underglow.rotation.x = -Math.PI / 2; underglow.position.y = 0.05; root.add(underglow);
    const fogLamp = new THREE.PointLight(0xfff0cc, 6, 10);
    fogLamp.position.set(0, 0.88, -2.4); root.add(fogLamp);
    if (trafficCar) root.scale.setScalar(0.82);
    return { root, wheelPivots, shadow, tailMat: myTailMat };
  }

  const carModel = makeCar(0xb93f39); carModel.speed = 0; scene.add(carModel.root); carModel.root.position.set(122, 0, 63); carModel.root.rotation.y = 0;

  // MULTIPLE WEAPONS SYSTEM DEFINITION
  const WEAPONS = [
    {
      id: 'pistol',
      name: 'NOVA-9',
      type: 'SIDEARM',
      caliber: '9MM',
      magSize: 12,
      reserve: 60,
      ammo: 12,
      cooldown: 0.22,
      auto: false,
      damage: 38,
      spread: 0.015,
      pellets: 1,
      color: 0xffd07a,
      dotColor: '#ffd86a',
      soundFreq: 220,
      soundDecay: 0.08,
      casingColor: 0xd4a94a,
      recoil: 0.04,
    },
    {
      id: 'smg',
      name: 'APEX-45',
      type: 'SMG',
      caliber: '.45 ACP',
      magSize: 32,
      reserve: 128,
      ammo: 32,
      cooldown: 0.09,
      auto: true,
      damage: 22,
      spread: 0.038,
      pellets: 1,
      color: 0x62ecdf,
      dotColor: '#62ecdf',
      soundFreq: 340,
      soundDecay: 0.05,
      casingColor: 0xd4a94a,
      recoil: 0.025,
    },
    {
      id: 'shotgun',
      name: 'VULCAN-12',
      type: 'SHOTGUN',
      caliber: '12-GAUGE',
      magSize: 6,
      reserve: 36,
      ammo: 6,
      cooldown: 0.65,
      auto: false,
      damage: 18,
      spread: 0.11,
      pellets: 6,
      color: 0xff7b43,
      dotColor: '#ff7b43',
      soundFreq: 120,
      soundDecay: 0.16,
      casingColor: 0xdd2233,
      recoil: 0.09,
    },
    {
      id: 'rifle',
      name: 'SPECTRE-X',
      type: 'HEAVY RIFLE',
      caliber: '7.62MM',
      magSize: 20,
      reserve: 80,
      ammo: 20,
      cooldown: 0.28,
      auto: false,
      damage: 64,
      spread: 0.006,
      pellets: 1,
      color: 0xd475ff,
      dotColor: '#d475ff',
      soundFreq: 175,
      soundDecay: 0.12,
      casingColor: 0xcaa03c,
      recoil: 0.06,
    }
  ];

  // 3D WEAPONS GENERATOR
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x3a454d, metalness: 0.88, roughness: 0.22 });
  const gunDark = mat(0x181c20, 0.65, 0.4);
  const gunAccent = new THREE.MeshStandardMaterial({ color: 0x62ecdf, emissive: 0x42d6c9, emissiveIntensity: 1.4, roughness: 0.25 });
  const goldAccent = new THREE.MeshStandardMaterial({ color: 0xdec186, emissive: 0x80561d, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 });

  function createWeaponModel(wepIndex) {
    const root = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({ color: WEAPONS[wepIndex].color, toneMapped: false });
    let muzzle = new THREE.Vector3(0, 0.02, -0.7);

    if (wepIndex === 0) { // NOVA-9 PISTOL
      addBox(root, gunMetal, 0, 0.03, -0.16, 0.14, 0.13, 0.42, false);
      addMesh(root, new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), gunMetal, 0, 0.03, -0.48, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addBox(root, goldAccent, 0, -0.12, -0.09, 0.11, 0.24, 0.14, false).rotation.x = -0.2;
      addBox(root, gunAccent, 0, -0.02, -0.32, 0.06, 0.04, 0.14, false);
      muzzle = new THREE.Vector3(0, 0.03, -0.66);
    } else if (wepIndex === 1) { // APEX-45 SMG
      addBox(root, gunDark, 0, 0.04, -0.22, 0.16, 0.16, 0.54, false);
      addBox(root, gunMetal, 0, 0.04, -0.52, 0.12, 0.12, 0.32, false);
      addBox(root, gunAccent, 0, 0.12, -0.22, 0.05, 0.08, 0.14, false); // holo sight
      addBox(root, gunMetal, 0, -0.24, -0.28, 0.1, 0.32, 0.13, false).rotation.x = 0.18; // curved mag
      addBox(root, gunDark, 0, -0.12, -0.06, 0.11, 0.22, 0.13, false).rotation.x = -0.2;
      addBox(root, gunMetal, 0, 0.02, 0.14, 0.07, 0.09, 0.28, false); // wire stock
      muzzle = new THREE.Vector3(0, 0.04, -0.74);
    } else if (wepIndex === 2) { // VULCAN-12 SHOTGUN
      addBox(root, gunDark, 0, 0.04, -0.2, 0.18, 0.2, 0.6, false);
      addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), gunMetal, -0.04, 0.07, -0.56, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), gunMetal, 0.04, 0.07, -0.56, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addBox(root, mat(0x5a3424, 0.65), 0, -0.02, -0.46, 0.16, 0.11, 0.28, false); // pump
      addBox(root, mat(0x1a2128, 0.7), 0, -0.03, 0.22, 0.13, 0.24, 0.38, false); // stock
      addBox(root, new THREE.MeshStandardMaterial({ color: 0xdd2233 }), 0.1, 0.04, -0.15, 0.05, 0.09, 0.2, false); // red shells
      muzzle = new THREE.Vector3(0, 0.07, -0.88);
    } else { // SPECTRE-X HEAVY RIFLE
      addBox(root, gunDark, 0, 0.05, -0.22, 0.17, 0.18, 0.62, false);
      addMesh(root, new THREE.CylinderGeometry(0.04, 0.04, 0.64, 8), gunMetal, 0, 0.05, -0.66, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addBox(root, gunMetal, 0, 0.16, -0.24, 0.09, 0.1, 0.36, false); // scope
      addBox(root, gunAccent, 0, 0.16, -0.44, 0.07, 0.07, 0.04, false); // scope lens
      addBox(root, gunMetal, 0, -0.22, -0.26, 0.1, 0.28, 0.15, false); // mag
      addBox(root, gunDark, 0, 0.01, 0.24, 0.12, 0.26, 0.44, false); // stock
      addBox(root, gunAccent, 0, 0.05, -0.96, 0.09, 0.07, 0.12, false); // muzzle brake
      muzzle = new THREE.Vector3(0, 0.05, -1.04);
    }

    const flash = addMesh(root, new THREE.IcosahedronGeometry(0.16, 0), flashMat, muzzle.x, muzzle.y, muzzle.z, 1, 1, 1, false, false);
    flash.visible = false;
    return { root, flash, muzzle, flashTime: 0, cooldown: 0 };
  }

  // HUMAN PROCEDURAL CHARACTER MODEL GENERATOR (AAA CYBERPUNK LOKI)
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a584, roughness: 0.6, metalness: 0.02, envMapIntensity: 0.4 });
  const hairMat = mat(0x1a1816, 0.9, 0.05);
  const lokiJacket = mat(0x182532, 0.48, 0.28);
  const lokiAccent = new THREE.MeshStandardMaterial({ color: 0x62ecdf, emissive: 0x38d4c6, emissiveIntensity: 1.6, roughness: 0.25 });
  const lokiVisor = new THREE.MeshPhysicalMaterial({ color: 0x051a24, emissive: 0x00ffee, emissiveIntensity: 2.2, roughness: 0.08, metalness: 0.8, clearcoat: 1 });
  const cargoPants = mat(0x1c242c, 0.75, 0.12);
  const bootMat = mat(0x10151a, 0.75, 0.3);
  const limbGeo = new THREE.CapsuleGeometry(0.105, 0.48, 3, 8);
  const rivalJacket = mat(0x5e1e2c, 0.55, 0.24);
  const rivalMask = mat(0x11161b, 0.7, 0.12);
  const rivalVisor = new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff1738, emissiveIntensity: 2.5 });

  function makePerson(isPlayer = false, seed = 1, faction = 'civilian') {
    const root = new THREE.Group();
    const bob = new THREE.Group(); bob.position.y = 0.03; root.add(bob);

    // Head
    const head = addMesh(bob, new THREE.SphereGeometry(0.18, 14, 12), skinMat, 0, 1.76, 0, 0.9, 1.05, 0.95);

    if (isPlayer) {
      // LOKI CYBERPUNK STYLING
      // Undercut hairstyle
      addBox(bob, hairMat, 0, 1.93, 0.02, 0.33, 0.12, 0.36, true);
      addBox(bob, hairMat, 0, 1.88, -0.15, 0.28, 0.08, 0.1, false);
      addBox(bob, mat(0x141210, 0.9), 0, 1.83, 0.02, 0.36, 0.12, 0.32, false);

      // Glowing Cyber Visor
      addBox(bob, mat(0x0e1318, 0.8), 0, 1.75, -0.11, 0.36, 0.08, 0.14, false);
      addBox(bob, lokiVisor, 0, 1.75, -0.185, 0.32, 0.055, 0.04, false);
      addBox(bob, lokiAccent, 0.18, 1.74, 0, 0.04, 0.06, 0.04, false); // Comms earpiece

      // Bomber Techwear Jacket & Collar
      addBox(bob, mat(0x0e151c, 0.7), 0, 1.15, 0, 0.46, 0.65, 0.3); // inner shirt
      addBox(bob, lokiJacket, -0.17, 1.15, 0.02, 0.2, 0.68, 0.34); // left chest
      addBox(bob, lokiJacket, 0.17, 1.15, 0.02, 0.2, 0.68, 0.34);  // right chest
      addBox(bob, lokiAccent, -0.06, 1.15, 0.18, 0.02, 0.66, 0.02, false); // cyan zipper line
      addBox(bob, lokiAccent, 0.06, 1.15, 0.18, 0.02, 0.66, 0.02, false);
      addBox(bob, lokiJacket, 0, 1.54, -0.08, 0.38, 0.18, 0.18, false); // high collar

      // Tactical chest straps
      addBox(bob, mat(0x161a20, 0.6), 0, 1.25, 0.17, 0.44, 0.06, 0.03, false);
      addBox(bob, lokiAccent, 0, 1.25, 0.19, 0.08, 0.08, 0.03, false); // harness core

      // Courier Hard-shell Tech Backpack
      addBox(bob, mat(0x1a2430, 0.4, 0.4), 0, 1.26, 0.22, 0.34, 0.46, 0.18);
      addBox(bob, lokiAccent, 0, 1.26, 0.32, 0.12, 0.22, 0.03, false); // data battery indicator
      addBox(bob, mat(0x0b1016, 0.8), -0.14, 1.52, 0.24, 0.02, 0.18, 0.02, false); // comm antenna
    } else if (faction === 'rival') {
      // NOX CREW RIVAL STYLING
      addBox(bob, rivalMask, 0, 1.76, 0.02, 0.38, 0.32, 0.38);
      addBox(bob, rivalVisor, 0, 1.76, -0.19, 0.32, 0.07, 0.04, false); // crimson visor slit
      addBox(bob, rivalJacket, 0, 1.15, 0, 0.52, 0.68, 0.36);
      addBox(bob, mat(0x15181c, 0.6), 0, 1.25, 0.18, 0.44, 0.14, 0.08, false); // ammo rig
    } else {
      // CIVILIAN STYLING
      const civPalette = [0xb46a62, 0x647ebe, 0xd2a252, 0x789887, 0x8d78a6];
      const civMat = mat(civPalette[seed % civPalette.length], 0.7, 0.05);
      addBox(bob, civMat, 0, 1.15, 0, 0.48, 0.68, 0.32);
      addBox(bob, hairMat, 0, 1.88, 0, 0.36, 0.18, 0.34); // hair/cap
    }

    // Legs and Arms
    const legs = [], arms = [];
    const myLegMat = isPlayer ? cargoPants : faction === 'rival' ? cargoPants : mat([0x28333d, 0x272329, 0x353d43, 0x453832][seed % 4], 0.78);
    for (const side of [-1, 1]) {
      const leg = addMesh(bob, limbGeo, myLegMat, side * 0.14, 0.57, 0, 0.72, 0.9, 0.78);
      legs.push(leg);

      // Thigh pouches on cargo pants
      if (isPlayer) {
        addBox(bob, mat(0x12171e, 0.7), side * 0.22, 0.62, 0, 0.08, 0.16, 0.15, false);
        // Knee armor plate
        addBox(bob, mat(0x28323a, 0.4, 0.6), side * 0.14, 0.52, -0.11, 0.15, 0.13, 0.05, false);
      }

      // Boots with glowing cyan sole
      const shoe = addBox(bob, bootMat, side * 0.14, 0.12, -0.06, 0.22, 0.16, 0.38, true);
      if (isPlayer) {
        addBox(bob, lokiAccent, side * 0.14, 0.035, -0.06, 0.2, 0.035, 0.36, false); // sole LED
      }

      // Arms
      const armMat = isPlayer ? lokiJacket : faction === 'rival' ? rivalJacket : myLegMat;
      const arm = addMesh(bob, limbGeo, armMat, side * 0.33, 1.11, 0, 0.68, 0.82, 0.7);
      arms.push(arm);

      // Cyber watch display on left wrist
      if (isPlayer && side === -1) {
        addBox(bob, lokiAccent, -0.33, 0.88, -0.06, 0.09, 0.04, 0.06, false);
      }
    }

    // WEAPONS MOUNT
    let weapon = null;
    let weaponModels = null;
    let activeWeaponMesh = null;

    if (isPlayer) {
      // Player carries all 4 selectable weapons
      weaponModels = WEAPONS.map((_, i) => {
        const wep = createWeaponModel(i);
        wep.root.position.set(0.32, 1.05, -0.2);
        wep.root.visible = (i === 0);
        bob.add(wep.root);
        return wep;
      });
      activeWeaponMesh = weaponModels[0];
      weapon = weaponModels[0];
    } else if (faction === 'rival') {
      const wep = createWeaponModel(seed % 2); // pistol or smg
      wep.root.position.set(0.3, 1.05, -0.2);
      bob.add(wep.root);
      weapon = wep;
    }

    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.54, 20), new THREE.MeshBasicMaterial({ color: 0x05080a, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);

    return {
      root, bob, legs, arms, shadow, weapon, weaponModels, activeWeaponMesh,
      isPlayer, faction, walkPhase: Math.random() * Math.PI * 2, speed: 0,
      direction: new THREE.Vector3(0, 0, -1), recoilOffset: 0
    };
  }

  const player = makePerson(true); scene.add(player.root); player.root.position.set(117.5, 0, 68); player.root.rotation.y = 0;

  // CIVILIANS & RIVALS
  const npcPalette = [0xf4c28e, 0xc6d7d3, 0xdda0a2, 0xaabaff, 0xe2d6c1];
  const peds = [];
  for (let i = 0; i < 15; i++) {
    const ped = makePerson(false, i + 11);
    ped.root.position.set(i % 2 ? 99 + (i % 3) * 2 : 141 - (i % 3) * 2, 0, -116 + i * 16.1);
    ped.speed = 0.5 + (i % 5) * 0.13;
    ped.direction.set(Math.sin(i * 12.7) * 0.3, 0, Math.cos(i * 9.4) > 0 ? 1 : -1).normalize();
    ped.root.rotation.y = Math.atan2(ped.direction.x, -ped.direction.z);
    ped.color = npcPalette[i % npcPalette.length]; scene.add(ped.root); peds.push(ped);
  }

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

  // DYNAMIC RAIN WITH WIND
  const rainCount = 2400, rainPositions = new Float32Array(rainCount * 6);
  const rainWindX = 0.04, rainWindZ = 0.02;
  for (let i = 0; i < rainCount; i++) {
    const x = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 190, y = Math.random() * 38 + 2;
    const n = i * 6;
    rainPositions[n] = x; rainPositions[n + 1] = y; rainPositions[n + 2] = z;
    rainPositions[n + 3] = x - 0.12 - rainWindX * 2; rainPositions[n + 4] = y - 0.9; rainPositions[n + 5] = z - rainWindZ * 2;
  }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa1ccde, transparent: true, opacity: 0.38 })); scene.add(rain);

  const rainSplashParticles = [];
  const splashGeo = new THREE.CircleGeometry(0.08, 6);
  splashGeo.rotateX(-Math.PI / 2);
  const splashMat = new THREE.MeshBasicMaterial({ color: 0x88bbcc, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 60; i++) {
    const splash = new THREE.Mesh(splashGeo, splashMat.clone());
    splash.position.set(104 + Math.random() * 32, 0.012, -130 + Math.random() * 260);
    splash.userData = { life: Math.random() * 0.4, maxLife: 0.4 + Math.random() * 0.3 };
    scene.add(splash);
    rainSplashParticles.push(splash);
  }

  // Horizon stars
  const starsGeo = new THREE.BufferGeometry(); const stars = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) { const n = i * 3; stars[n] = (Math.random() - 0.5) * 280; stars[n + 1] = 34 + Math.random() * 100; stars[n + 2] = (Math.random() - 0.5) * 240; }
  starsGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starField = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xa8c6db, size: 0.16, transparent: true, opacity: 0.58, sizeAttenuation: true })); scene.add(starField);

  // GAMEPLAY STATE
  const state = {
    health: 100, stamina: 100, inCar: false, paused: false, complete: false, sprint: false, hop: 0, time: 0, toast: 0,
    nearCar: false, nearShop: false, highQuality: true, yaw: 0, cameraPitch: 0.29, mouseDown: false, isFiring: false,
    lastMouseX: 0, lastMouseY: 0, hitInvuln: 0, currentWeaponIndex: 0, reload: 0, fireCooldown: 0, wanted: 0, wantedDecay: 0,
    robberyStarted: false, robberyProgress: 0, robberyComplete: false, policeActive: false, policeDelay: 0, kills: 0, escapeComplete: false,
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
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.98, depthWrite: false, toneMapped: false });
    const line = new THREE.Line(geometry, material); line.frustumCulled = false; scene.add(line); tracerEffects.push({ object: line, life: 0.105, max: 0.105 });
  }

  function sparksAt(point, color = 0xffd580) {
    const sparkColors = [0xffd580, 0x44ffee];
    for (let i = 0; i < 14; i++) {
      const sparkColor = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      const material = new THREE.MeshBasicMaterial({ color: sparkColor, toneMapped: false });
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.055 + Math.random() * 0.045, 0), material);
      spark.position.copy(point); scene.add(spark);
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 4);
      particles.push({ object: spark, velocity, life: 0.32 + Math.random() * 0.23, max: 0.55 });
    }
  }

  function ejectShellCasing(originPos, casingColor = 0xd4a94a) {
    const brassMat = new THREE.MeshStandardMaterial({ color: casingColor, metalness: 0.85, roughness: 0.2 });
    const casing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), brassMat);
    casing.position.copy(originPos).add(new THREE.Vector3(0.3, 1.1, -0.2));
    scene.add(casing);
    const velocity = new THREE.Vector3(0.8 + Math.random() * 0.5, 2.5 + Math.random(), (Math.random() - 0.5) * 0.5);
    particles.push({ object: casing, velocity, life: 1.1 + Math.random() * 0.4, max: 1.5 });
  }

  function muzzleFlash(weapon) {
    if (!weapon) return;
    weapon.flash.visible = true; weapon.flashTime = 0.075;
  }

  function switchWeapon(index) {
    if (index < 0 || index >= WEAPONS.length) return;
    state.currentWeaponIndex = index;
    const wep = WEAPONS[index];
    if (player.weaponModels) {
      player.weaponModels.forEach((m, i) => { if (m) m.root.visible = (i === index); });
      player.activeWeaponMesh = player.weaponModels[index];
      player.weapon = player.weaponModels[index];
    }
    if (ui.weaponTitle) ui.weaponTitle.textContent = wep.name;
    if (ui.weaponType) ui.weaponType.textContent = wep.type;
    if (ui.weaponCaliber) ui.weaponCaliber.textContent = wep.caliber;
    if (ui.weaponDot) ui.weaponDot.style.background = wep.dotColor;
    if (ui.ammo) ui.ammo.textContent = String(wep.ammo);
    if (ui.reserve) ui.reserve.textContent = String(wep.reserve);
    ui.wepSlots.forEach((slot, i) => {
      slot.classList.toggle('active', i === index);
    });
    showToast(`EQUIPPED  ·  ${wep.name} ${wep.type}`);
    if (audioCtx) {
      try {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        g.gain.setValueAtTime(0.04, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.06);
      } catch {}
    }
  }

  function reloadWeapon() {
    const wep = WEAPONS[state.currentWeaponIndex];
    if (state.inCar || state.reload > 0 || wep.ammo === wep.magSize || wep.reserve <= 0) return;
    state.reload = 1.15; showToast(`RELOADING  ·  ${wep.name}`);
  }

  function fireWeapon() {
    if (state.paused || state.inCar || !player.weapon || state.reload > 0 || state.fireCooldown > 0) return;
    const wep = WEAPONS[state.currentWeaponIndex];
    if (wep.ammo <= 0) { reloadWeapon(); return; }

    wep.ammo--;
    state.fireCooldown = wep.cooldown;
    if (ui.ammo) ui.ammo.textContent = String(wep.ammo);

    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    muzzleFlash(player.weapon);
    ejectShellCasing(player.root.position, wep.casingColor);
    player.recoilOffset = wep.recoil;

    const muzzle = player.weapon.root.localToWorld(player.weapon.muzzle.clone());

    for (let p = 0; p < wep.pellets; p++) {
      const spreadX = (Math.random() - 0.5) * wep.spread;
      const spreadY = (Math.random() - 0.5) * wep.spread;
      shotRay.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

      const hits = shotRay.intersectObjects([...occluders, ...rivalMeshes], false);
      const first = hits[0];
      const endpoint = first ? first.point.clone() : shotRay.ray.origin.clone().addScaledVector(shotRay.ray.direction, 75);

      addTracer(muzzle, endpoint, wep.color);

      if (first?.object.userData.combatant) {
        const rival = first.object.userData.combatant;
        rival.health -= wep.damage; rival.stagger = 0.3; rival.healthBar.visible = true;
        rival.healthFill.scale.x = Math.max(0.02, 1.25 * rival.health / 100);
        rival.healthFill.position.x = -(1.25 - rival.healthFill.scale.x) / 2;
        state.wanted = Math.max(state.wanted, 1); state.wantedDecay = 0;
        showHitMarker(); sparksAt(endpoint, 0xffb65f);

        if (rival.health <= 0 && rival.active) {
          rival.active = false; rival.root.visible = false; state.kills++;
          showToast(state.kills === rivals.length ? 'NOX CREW BROKEN  ·  ROUTE CLEAR' : `NOX CREW DOWN  ·  ${rivals.length - state.kills} REMAIN`);
        }
      } else if (first) {
        sparksAt(endpoint, 0xc5d2d0);
      }
    }

    if (audioCtx) {
      try {
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        const now = audioCtx.currentTime;
        osc.type = wep.id === 'shotgun' ? 'sawtooth' : wep.id === 'smg' ? 'square' : 'sawtooth';
        osc.frequency.setValueAtTime(wep.soundFreq, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + wep.soundDecay);
        gain.gain.setValueAtTime(wep.id === 'shotgun' ? 0.08 : 0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + wep.soundDecay);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(now + wep.soundDecay + 0.01);
      } catch {}
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
    fxaaPass.material.uniforms['resolution'].value.set(1 / innerWidth, 1 / innerHeight);
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
      resolveBuildingCollision(player.root.position, 0.7);
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
    const ratio = Math.min(devicePixelRatio || 1, state.highQuality ? 2.0 : 1);
    renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = state.highQuality;
    moon.shadow.mapSize.set(state.highQuality ? 2048 : 1024, state.highQuality ? 2048 : 1024);
    bloom.strength = state.highQuality ? 0.85 : 0.42;
    renderer.shadowMap.needsUpdate = true;
    ui.quality.textContent = state.highQuality ? 'ULTRA' : 'BALANCED';
    ui.quality.classList.toggle('balanced', !state.highQuality);
  }
  ui.quality.addEventListener('click', toggleQuality);

  // PLAYER & VEHICLE UPDATE (WITH SOLID WALL COLLISION)
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

      // SOLID BUILDING COLLISION FOR CAR
      const oldCarX = car.position.x, oldCarZ = car.position.z;
      resolveBuildingCollision(car.position, 1.6);
      resolveBuildingCollision(car.position, 1.6);
      if (Math.hypot(car.position.x - oldCarX, car.position.z - oldCarZ) > 0.02) {
        carModel.speed *= 0.45;
        sparksAt(car.position, 0xffd580);
      }

      car.position.x = THREE.MathUtils.clamp(car.position.x, 70, 175);
      car.position.z = THREE.MathUtils.clamp(car.position.z, -158, 158);

      carModel.wheelPivots.forEach((w, i) => { w.rotation.x += carModel.speed * dt * 1.6; if (i < 2) w.rotation.y = -steering * 0.26; });
      ui.speed.textContent = String(Math.round(Math.abs(carModel.speed) * 3.6)).padStart(3, '0');
      ui.gear.textContent = carModel.speed > 0.4 ? 'D' : carModel.speed < -0.4 ? 'R' : 'P';

      if (carModel.tailMat) {
        carModel.tailMat.emissiveIntensity = carModel.speed < -0.5 ? 6.0 : 3.2;
      }
    } else {
      const direction = movementVector(forward, right);
      const movingVec = direction.lengthSq() > 0.01;
      if (movingVec) {
        direction.normalize();
        const speed = sprinting ? 9.2 : 5.3;
        player.root.position.addScaledVector(direction, speed * dt);

        // SOLID BUILDING COLLISION FOR ON-FOOT PLAYER (PREVENTS WALKING INTO HOUSES)
        resolveBuildingCollision(player.root.position, 0.65);
        resolveBuildingCollision(player.root.position, 0.65);

        player.root.position.x = THREE.MathUtils.clamp(player.root.position.x, 65, 215);
        player.root.position.z = THREE.MathUtils.clamp(player.root.position.z, -158, 158);
        player.direction.copy(direction);
        const targetRot = Math.atan2(direction.x, -direction.z);
        player.root.rotation.y = THREE.MathUtils.damp(player.root.rotation.y, targetRot, 13, dt);
      }

      const moving = forward !== 0 || right !== 0;
      const gait = moving ? (sprinting ? 13.5 : 8.5) : 2.2;
      player.walkPhase += dt * gait;
      player.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(player.walkPhase + i * Math.PI) * 0.55 : Math.sin(player.walkPhase + i * Math.PI) * 0.035; });
      player.arms.forEach((arm, i) => {
        const recoil = (i === 1 && player.recoilOffset > 0) ? player.recoilOffset * 4 : 0;
        arm.rotation.x = moving ? Math.sin(player.walkPhase + i * Math.PI + Math.PI) * 0.42 - recoil : -recoil;
      });

      // Recoil recovery
      if (player.recoilOffset > 0) {
        player.recoilOffset = Math.max(0, player.recoilOffset - dt * 0.4);
      }

      if (state.hop > 0) { state.hop = Math.max(0, state.hop - dt); player.bob.position.y = 0.03 + Math.sin((state.hop / 0.48) * Math.PI) * 0.85; }
      else player.bob.position.y = 0.03 + (moving ? Math.abs(Math.sin(player.walkPhase * 2)) * 0.045 : 0);
    }

    const actor = state.inCar ? carModel.root : player.root;
    state.nearCar = !state.inCar && player.root.position.distanceTo(carModel.root.position) < 8;
    state.nearShop = !state.inCar && !state.robberyStarted && player.root.position.distanceTo(targetPosition) < 5.8;
    ui.interaction.classList.toggle('show', state.nearCar || state.inCar || state.nearShop);
    ui.interaction.querySelector('span:last-child').textContent = state.inCar ? 'EXIT VEHICLE' : state.nearCar ? 'ENTER VELA GT' : 'START THE STORE HEIST';

    // Pedestrians wander & avoid buildings
    for (const ped of peds) {
      const toPlayer = ped.root.position.distanceTo(player.root.position);
      if (!state.inCar && toPlayer < 3.2) {
        const away = ped.root.position.clone().sub(player.root.position); away.y = 0; away.normalize(); ped.direction.lerp(away, Math.min(1, dt * 2.5)).normalize();
      } else if (Math.random() < 0.003) {
        ped.direction.x += (Math.random() - 0.5) * 0.55; ped.direction.z += (Math.random() - 0.5) * 0.3; ped.direction.normalize();
      }
      ped.root.position.addScaledVector(ped.direction, ped.speed * dt);
      resolveBuildingCollision(ped.root.position, 0.55);

      if (ped.root.position.x < 96 || ped.root.position.x > 145) ped.direction.x *= -1;
      if (ped.root.position.z < -150 || ped.root.position.z > 150) ped.direction.z *= -1;
      ped.root.position.x = THREE.MathUtils.clamp(ped.root.position.x, 95, 145); ped.root.position.z = THREE.MathUtils.clamp(ped.root.position.z, -151, 151);
      ped.walkPhase += dt * 6;
      ped.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(ped.walkPhase + i * Math.PI) * 0.19; });
      ped.arms.forEach((arm, i) => { arm.rotation.x = Math.sin(ped.walkPhase + i * Math.PI + Math.PI) * 0.14; });
      if (ped.direction.lengthSq() > 0.01) ped.root.rotation.y = THREE.MathUtils.damp(ped.root.rotation.y, Math.atan2(ped.direction.x, -ped.direction.z), 3, dt);
    }

    // Traffic follows lane
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
    moon.intensity = 2.8 - daylight * 2.0;
    moon.color.set(0x9bbef2).lerp(new THREE.Color(0xffd1a0), daylight * 0.7);
    warmFill.intensity = 0.35 + daylight * 1.15;
    scene.fog.density = 0.006 + (Math.sin(state.time * (Math.PI * 2 / 40)) * 0.5 + 0.5) * 0.005;
    scene.fog.color.set(0x111b26).lerp(new THREE.Color(0x81909a), daylight * 0.45);
    skyMaterial.color.set(0x7f91a6).lerp(new THREE.Color(0xffffff), daylight * 0.7);
    shared.windowLit.emissiveIntensity = 0.5 * (1 - daylight * 0.8);
    shared.windowWarm.emissiveIntensity = 0.42 * (1 - daylight * 0.75);

    const activeWep = WEAPONS[state.currentWeaponIndex];
    ui.ammo.textContent = String(activeWep.ammo); ui.reserve.textContent = String(activeWep.reserve);
    ui.wanted.classList.toggle('show', state.wanted > 0);
    ui.wanted.querySelector('b').textContent = `${'★'.repeat(state.wanted)}${'☆'.repeat(5 - state.wanted)}`;
    if (state.toast > 0 && (state.toast -= dt) <= 0) ui.toast.classList.remove('show');
  }

  // COMBAT & SHOOTING UPDATE
  function updateCombat(dt) {
    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    const wep = WEAPONS[state.currentWeaponIndex];

    if (state.reload > 0 && (state.reload -= dt) <= 0) {
      const needed = wep.magSize - wep.ammo;
      const loaded = Math.min(needed, wep.reserve);
      wep.ammo += loaded; wep.reserve -= loaded;
      if (ui.ammo) ui.ammo.textContent = String(wep.ammo);
      if (ui.reserve) ui.reserve.textContent = String(wep.reserve);
      showToast(`${wep.name} READY`);
    }

    // CONTINUOUS FIRING (AUTO WEAPONS)
    if (state.isFiring && !state.paused && !state.inCar && wep.auto && state.fireCooldown <= 0) {
      fireWeapon();
    }

    // Flash decay for active weapon and enemies
    if (player.weapon) {
      player.weapon.flashTime = Math.max(0, player.weapon.flashTime - dt);
      player.weapon.flash.visible = player.weapon.flashTime > 0;
      if (player.weapon.flash.visible) {
        player.weapon.flash.scale.setScalar(0.7 + Math.random() * 0.75);
      }
    }
    for (const rival of rivals) if (rival.weapon) {
      rival.weapon.flashTime = Math.max(0, rival.weapon.flashTime - dt);
      rival.weapon.flash.visible = rival.weapon.flashTime > 0;
    }

    // Tracers decay
    for (let i = tracerEffects.length - 1; i >= 0; i--) {
      const effect = tracerEffects[i]; effect.life -= dt;
      effect.object.material.opacity = Math.max(0, effect.life / effect.max);
      if (effect.life <= 0) { scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); tracerEffects.splice(i, 1); }
    }

    // Particles decay
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
        resolveBuildingCollision(rival.root.position, 0.55);
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

  // CAMERA & MINIMAP
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
    playerRimLight.position.copy(player.root.position).add(new THREE.Vector3(-1.5, 2.5, 1.5));
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

  // ANIMATION LOOP
  let mapTimer = 0;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.04);
    if (!state.paused) {
      state.time += dt; updatePlayer(dt); updateCombat(dt); updateCamera(dt);
      goalRing.scale.setScalar(1 + Math.sin(state.time * 3.2) * 0.08); marker.rotation.y += dt * 0.8; beam.material.opacity = 0.13 + (Math.sin(state.time * 2.1) + 1) * 0.055;

      const rainPos = rainGeo.attributes.position;
      for (let i = 0; i < rainCount; i++) {
        const n = i * 6;
        rainPos.array[n] += rainWindX * dt * 60;
        rainPos.array[n + 2] += rainWindZ * dt * 60;
        rainPos.array[n + 3] += rainWindX * dt * 60;
        rainPos.array[n + 5] += rainWindZ * dt * 60;
        if (rainPos.array[n] > 100) { rainPos.array[n] -= 200; rainPos.array[n + 3] -= 200; }
        if (rainPos.array[n + 2] > 95) { rainPos.array[n + 2] -= 190; rainPos.array[n + 5] -= 190; }
      }
      rainPos.needsUpdate = true;
      rain.position.z = (rain.position.z + dt * 8) % 12;

      for (const splash of rainSplashParticles) {
        splash.userData.life += dt;
        if (splash.userData.life >= splash.userData.maxLife) {
          splash.userData.life = 0;
          splash.userData.maxLife = 0.4 + Math.random() * 0.3;
          splash.position.set(104 + Math.random() * 32, 0.012, -130 + Math.random() * 260);
          splash.scale.setScalar(1);
        } else {
          const t = splash.userData.life / splash.userData.maxLife;
          splash.scale.setScalar(1 + t * 2.5);
          splash.material.opacity = (1 - t) * 0.5;
        }
      }

      mapTimer += dt; if (mapTimer > 0.15) { drawMinimap(); mapTimer = 0; }
    }
    composer.render();
  }

  // INPUT & CONTROLS
  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
    if (key === 'escape') { setPause(!state.paused); return; }
    if ((key === 'e' || key === 'f') && !e.repeat) { doInteract(); return; }
    if (key === 'r' && !e.repeat) { reloadWeapon(); return; }
    if (key === '1') { switchWeapon(0); return; }
    if (key === '2') { switchWeapon(1); return; }
    if (key === '3') { switchWeapon(2); return; }
    if (key === '4') { switchWeapon(3); return; }
    if (key === 'q' && !e.repeat) { switchWeapon((state.currentWeaponIndex + 1) % WEAPONS.length); return; }
    if (key === ' ' && !e.repeat && !state.inCar) { state.hop = 0.48; player.bob.position.y = 0.03; }
    held.add(key);
  }
  function onKeyUp(e) { held.delete(e.key.toLowerCase()); }
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', () => { held.clear(); state.isFiring = false; });

  const canvas = $('#world');
  canvas.addEventListener('pointerdown', (e) => {
    wakeAudio(); canvas.setPointerCapture(e.pointerId);
    if (e.button === 0) {
      state.isFiring = true;
      fireWeapon();
      return;
    }
    if (e.button === 2) { state.mouseDown = true; state.lastMouseX = e.clientX; state.lastMouseY = e.clientY; }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.button === 0) state.isFiring = false;
    if (e.button === 2) state.mouseDown = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.mouseDown || state.paused) return;
    const dx = e.clientX - state.lastMouseX, dy = e.clientY - state.lastMouseY;
    state.lastMouseX = e.clientX; state.lastMouseY = e.clientY;
    state.yaw -= dx * 0.0045; state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch + dy * 0.0015, 0.16, 0.55);
  });
  canvas.addEventListener('wheel', (e) => {
    camera.fov = THREE.MathUtils.clamp(camera.fov + Math.sign(e.deltaY) * 1.2, 43, 68);
    camera.updateProjectionMatrix();
  }, { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Weapon slot buttons click
  ui.wepSlots.forEach((slot) => {
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(slot.getAttribute('data-wep') || '0', 10);
      switchWeapon(idx);
    });
  });

  $('#resumeButton').addEventListener('click', () => setPause(false));

  // SYNTH AUDIO SYSTEM
  let audioCtx, engineOsc, engineGain, engineFilter;
  function wakeAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    try {
      audioCtx = new AudioContext(); engineOsc = audioCtx.createOscillator(); engineGain = audioCtx.createGain(); engineFilter = audioCtx.createBiquadFilter();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 46; engineFilter.type = 'lowpass'; engineFilter.frequency.value = 115; engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(audioCtx.destination); engineOsc.start();
      const mix = () => { if (!audioCtx) return; engineOsc.frequency.setTargetAtTime(45 + Math.abs(carModel.speed || 0) * 3.2, audioCtx.currentTime, 0.15); engineGain.gain.setTargetAtTime(state.inCar ? 0.022 + Math.abs(carModel.speed || 0) * 0.0015 : 0, audioCtx.currentTime, 0.15); requestAnimationFrame(mix); }; mix();
    } catch { /* Audio optional */ }
  }
  addEventListener('keydown', wakeAudio, { once: true }); canvas.addEventListener('pointerdown', wakeAudio, { once: true });

  drawMinimap();
  camera.position.set(120, 5, 76); camera.lookAt(120, 1, 68);
  ui.toastText.textContent = 'AFTERLIGHT DISTRICT  ·  LIVE'; ui.toast.classList.add('show'); state.toast = 3.4;
  composer.render();
  animate();
  setTimeout(() => { ui.loading.classList.add('hidden'); }, 700);
})();
