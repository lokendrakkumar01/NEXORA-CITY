import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

RectAreaLightUniformsLib.init();

(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const ui = {
    health: $('#healthBar'), healthValue: $('#healthValue'), stamina: $('#staminaBar'), staminaValue: $('#staminaValue'),
    distance: $('#distance'), objective: $('#objectiveText'), progress: $('#progressBar'), interaction: $('#interaction'),
    interactionLabel: $('#interactionLabel'), toast: $('#toast'), toastText: $('#toast strong'), vehicleHud: $('#vehicleHud'),
    speed: $('#speedValue'), gear: $('#gearValue'), vehicleName: $('#vehicleName'), pause: $('#pauseOverlay'),
    pauseMission: $('#pauseMission'), loading: $('#loadingScreen'), loadingBar: $('#loadingBar'), loadingStatus: $('#loadingStatus'),
    clock: $('#clock'), weatherDisplay: $('#weatherDisplay'), quality: $('#qualityToggle'), ammo: $('#ammoValue'), reserve: $('#reserveValue'),
    wanted: $('#wanted'), damage: $('#damageFlash'), hitMarker: $('#hitMarker'), reticle: $('#reticle'), sniperScope: $('#sniperScope'),
    weaponTitle: $('#weaponTitle'), weaponType: $('#weaponType'), weaponCaliber: $('#weaponCaliber'), weaponDot: $('#weaponDot'),
    wepSlots: $$('.wep-slot'),
  };

  // ASSET PIPELINE & GLTF LOADER (WITH GUARANTEED PROCEDURAL PBR FALLBACK)
  const loadingManager = new THREE.LoadingManager();
  loadingManager.onProgress = (url, loaded, total) => {
    if (ui.loadingBar) ui.loadingBar.style.width = `${Math.round((loaded / Math.max(1, total)) * 100)}%`;
  };
  const gltfLoader = new GLTFLoader(loadingManager);
  const activeMixers = [];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090f19);
  scene.fog = new THREE.FogExp2(0x101a24, 0.0077);
  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 600);
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

  // LIGHTING SETUP
  const hemiSky = new THREE.HemisphereLight(0x7ab4d8, 0x1a1f2e, 0.9);
  scene.add(hemiSky);
  const warmFill = new THREE.HemisphereLight(0xffb347, 0x2a1a0a, 0.35);
  scene.add(warmFill);

  const sunMoon = new THREE.DirectionalLight(0xd0e8ff, 2.8);
  sunMoon.position.set(-54, 68, 28); sunMoon.castShadow = true;
  sunMoon.shadow.mapSize.set(2048, 2048);
  sunMoon.shadow.camera.left = -70; sunMoon.shadow.camera.right = 70; sunMoon.shadow.camera.top = 95; sunMoon.shadow.camera.bottom = -95;
  sunMoon.shadow.bias = -0.00015; sunMoon.shadow.normalBias = 0.03; sunMoon.shadow.radius = 8;
  scene.add(sunMoon);

  // Lightning burst light
  const lightningLight = new THREE.DirectionalLight(0xffffff, 0);
  lightningLight.position.set(0, 100, 0);
  scene.add(lightningLight);

  const neonSpill = new THREE.RectAreaLight(0xffaa44, 6, 12, 5);
  neonSpill.position.set(83, 6, -10); neonSpill.lookAt(120, 0, -10); scene.add(neonSpill);

  const deepFill = new THREE.PointLight(0x5566ff, 8, 90);
  deepFill.position.set(145, 2, -40); scene.add(deepFill);

  const playerRimLight = new THREE.PointLight(0x88aaff, 3, 5);
  scene.add(playerRimLight);

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

  // SKY DOME
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 2; skyCanvas.height = 256;
  const skyCtx = skyCanvas.getContext('2d');
  const skyGradient = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGradient.addColorStop(0, '#07101c'); skyGradient.addColorStop(0.47, '#172433'); skyGradient.addColorStop(0.8, '#28343a'); skyGradient.addColorStop(1, '#34373a');
  skyCtx.fillStyle = skyGradient; skyCtx.fillRect(0, 0, 2, 256);
  const skyTexture = new THREE.CanvasTexture(skyCanvas); skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, color: 0x8796a4 });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 24), skyMaterial);
  sky.rotation.x = Math.PI; scene.add(sky);

  // GROUND, HIGHWAY & SIDEWALKS
  const groundMat = mat(0x293332, 0.98);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 300), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(120, -0.08, 0); ground.receiveShadow = true; scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadW, 270), shared.road); road.rotation.x = -Math.PI / 2; road.position.set(120, 0, 0); road.receiveShadow = true; scene.add(road);
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(260, 18), shared.road); crossRoad.rotation.x = -Math.PI / 2; crossRoad.position.set(120, 0.015, -3); crossRoad.receiveShadow = true; scene.add(crossRoad);

  // Wet puddles on road
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

  // Reflector puddles
  const puddleMat = new THREE.MeshPhysicalMaterial({ color: 0x31404a, metalness: 0.72, roughness: 0.14, transparent: true, opacity: 0.65, clearcoat: 1 });
  for (let i = 0; i < 24; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(1, 18), puddleMat); p.rotation.x = -Math.PI / 2; p.position.set(91 + Math.sin(i * 18.2) * 38, 0.024 + i * 0.0001, -125 + (i * 17.3) % 260); p.scale.set(0.5 + (i % 4) * 0.3, 0.38 + (i % 5) * 0.12, 1); p.receiveShadow = true; scene.add(p);
  }

  // BUILDINGS & SOLID WALL COLLISION DATA
  const buildings = [];
  const windowMats = [shared.windowLit, shared.windowWarm];
  const neonColors = [0x00ffcc, 0xff3366, 0x6644ff, 0xffaa00, 0x00aaff];

  function makeSignTexture(title, subtitle, hue) {
    return makeTexture((c, w, h) => {
      c.fillStyle = '#081117'; c.fillRect(0, 0, w, h);
      c.strokeStyle = `hsl(${hue} 90% 65%)`; c.lineWidth = 6; c.strokeRect(7, 7, w - 14, h - 14);
      c.shadowColor = `hsl(${hue} 100% 60%)`; c.shadowBlur = 32;
      c.fillStyle = `hsl(${hue} 92% 76%)`; c.font = '800 62px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(title, w / 2, h * 0.46);
      c.shadowBlur = 12; c.font = '500 19px monospace'; c.fillText(subtitle, w / 2, h * 0.78);
    });
  }

  function buildBuilding(x, z, w, d, h, seed, style = 0, label = '') {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const palettes = [0x29383e, 0x30333b, 0x3b3734, 0x26373a, 0x3b4142];
    const facade = mat(palettes[style % palettes.length], 0.67, 0.22);
    const tower = addBox(g, facade, 0, h / 2, 0, w, h, d);
    tower.receiveShadow = true;
    addBox(g, mat(0x182329, 0.62, 0.45), 0, h + 0.25, 0, w + 0.7, 0.5, d + 0.7);
    addBox(g, mat(0x4a5351, 0.7, 0.38), 0, 0.18, 0, w + 0.5, 0.35, d + 0.5, false);

    const ledColor = neonColors[seed % neonColors.length];
    const ledMat = new THREE.MeshStandardMaterial({ emissive: ledColor, emissiveIntensity: 2.8, color: ledColor, roughness: 0.2 });
    addBox(g, ledMat, 0, 0.36, 0, w + 0.55, 0.09, d + 0.55, false);

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

  // REALISTIC RESIDENTIAL VILLA (HOUSE WITH PORCH, GARAGE, ROOF & CHIMNEY)
  function buildResidentialVilla(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const wallMat = mat(0xd8c8b4, 0.82, 0.05); // warm stucco
    const woodTrim = mat(0x3a2c24, 0.78, 0.1);
    const shingleMat = mat(0x283138, 0.65, 0.25);
    const windowGlass = new THREE.MeshPhysicalMaterial({ color: 0xffe2aa, emissive: 0xffaa44, emissiveIntensity: 0.8, roughness: 0.1, clearcoat: 1 });
    const porchDeckMat = mat(0x523d2e, 0.9, 0.05);

    // Foundation
    addBox(g, mat(0x45484c, 0.95), 0, 0.3, 0, 15, 0.6, 13);

    // Ground Floor Body
    addBox(g, wallMat, 0, 2.4, 0, 14.2, 3.6, 12.2);

    // Garage Wing (Left)
    addBox(g, mat(0x2a3239, 0.5), -4.5, 1.8, 6.15, 3.8, 2.8, 0.2); // garage roll door
    for (let i = 0; i < 5; i++) {
      addBox(g, mat(0x1a2128, 0.6), -4.5, 0.7 + i * 0.55, 6.2, 3.6, 0.04, 0.05, false); // panel lines
    }

    // Front Porch (Right)
    addBox(g, porchDeckMat, 2.5, 0.35, 6.8, 6.4, 0.25, 3.2); // porch floor
    for (let s = 1; s <= 3; s++) {
      addBox(g, porchDeckMat, 2.5, 0.35 - s * 0.1, 8.4 + s * 0.3, 2.4, 0.12, 0.35); // steps
    }
    // Porch Columns & Roof
    addBox(g, woodTrim, -0.4, 1.8, 8.2, 0.22, 2.7, 0.22);
    addBox(g, woodTrim, 5.4, 1.8, 8.2, 0.22, 2.7, 0.22);
    addBox(g, shingleMat, 2.5, 3.3, 7.0, 6.8, 0.4, 3.8); // porch roof
    const porchLight = new THREE.PointLight(0xffb555, 8, 10); porchLight.position.set(2.5, 2.9, 6.6); g.add(porchLight);

    // Front Door & Hardware
    addBox(g, mat(0x452518, 0.6), 2.5, 1.7, 6.15, 1.3, 2.6, 0.1);
    addBox(g, mat(0xd4af37, 0.2, 0.9), 3.0, 1.6, 6.22, 0.08, 0.08, 0.08, false); // brass knob

    // Bay Windows & Second Floor Windows
    addBox(g, windowGlass, 2.5, 5.0, 6.15, 2.4, 1.6, 0.15, false);
    addBox(g, windowGlass, -3.8, 5.0, 6.15, 2.2, 1.6, 0.15, false);
    addBox(g, windowGlass, 4.2, 2.0, 6.15, 1.8, 1.5, 0.15, false);

    // Second Floor Walls
    addBox(g, wallMat, 0, 5.2, 0, 13.8, 2.8, 11.8);

    // Pitched Gable Roof with Overhang
    const roof = addMesh(g, new THREE.ConeGeometry(9.6, 3.2, 4), shingleMat, 0, 8.1, 0, 1.1, 1, 1.3);
    roof.rotation.y = Math.PI / 4; roof.castShadow = true;

    // Brick Chimney
    addBox(g, mat(0x733226, 0.9), 4.2, 7.8, -2.4, 1.1, 3.4, 1.1);

    // Driveway to street
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 9), mat(0x383e42, 0.95));
    drive.rotation.x = -Math.PI / 2; drive.position.set(-4.5, 0.02, 11.5); drive.receiveShadow = true; g.add(drive);

    // Perimeter Privacy Fence
    const fenceMat = mat(0x5c4a3b, 0.9);
    addBox(g, fenceMat, 0, 0.9, -6.6, 17, 1.8, 0.15); // back fence
    addBox(g, fenceMat, -8.4, 0.9, 0, 0.15, 1.8, 13.5); // left fence
    addBox(g, fenceMat, 8.4, 0.9, 0, 0.15, 1.8, 13.5);  // right fence

    buildings.push({ x, z, w: 17, d: 15, h: 9.5, group: g, isVilla: true });
  }

  // BUILD THE CITY DISTRICT
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

  // BUILD THE FIRST MILESTONE RESIDENTIAL HOUSE
  buildResidentialVilla(60, 48);
  // SECOND VILLA
  buildResidentialVilla(60, 95);

  // POLICE STATION BUILDING
  function buildPoliceStation(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const wallMat = mat(0xccd4d9, 0.78, 0.06);
    const blueTrim = mat(0x1a3660, 0.6, 0.15);
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x8ab8d4, roughness: 0.12, metalness: 0.3, clearcoat: 1 });
    // Main building body
    addBox(g, wallMat, 0, 4, 0, 24, 8, 16);
    addBox(g, blueTrim, 0, 0.3, 0, 25, 0.6, 17);
    addBox(g, blueTrim, 0, 8.3, 0, 25, 0.6, 17);
    // Blue stripe
    addBox(g, blueTrim, 0, 4.0, 8.08, 24, 1.8, 0.1, false);
    // Windows
    for (let i = -3; i <= 3; i++) {
      addBox(g, glassMat, i * 3.2, 4.5, 8.1, 2.0, 2.4, 0.08, false);
      addBox(g, glassMat, i * 3.2, 4.5, -8.1, 2.0, 2.4, 0.08, false);
    }
    // "POLICE" sign
    const signTex = makeTexture((c, w, h) => {
      c.fillStyle = '#0d1e36'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#4a8ef0'; c.lineWidth = 5; c.strokeRect(5, 5, w-10, h-10);
      c.fillStyle = '#ffffff'; c.shadowColor = '#4a8ef0'; c.shadowBlur = 24;
      c.font = '800 72px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('POLICE', w/2, h*0.45);
      c.font = '500 20px monospace'; c.fillText('AFTERLIGHT PD  ·  DISTRICT 4', w/2, h*0.78);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), new THREE.MeshBasicMaterial({ map: signTex, transparent: false, side: THREE.DoubleSide, toneMapped: false }));
    sign.position.set(0, 7, 8.2); g.add(sign);
    // Entrance steps
    for (let s = 0; s < 4; s++) addBox(g, mat(0xb5bdc4, 0.9), 0, s*0.22+0.1, 9.2+s*0.35, 7, 0.22, 0.6, false);
    // Door
    addBox(g, mat(0x101828, 0.3, 0.3), 0, 1.9, 8.1, 2.4, 3.2, 0.1, false);
    // Parking lot - police cars parked
    const parked = makeCar(0x1d3046, true); parked.root.position.set(-6, 0, z < 0 ? -13 : 13); parked.root.rotation.y = Math.PI/2; scene.add(parked.root);
    const parkedSiren = mat(0x4d9dff, 0.25, 0.1, { emissive: 0x1764ed, emissiveIntensity: 2 });
    addBox(parked.root, mat(0x1a2a40, 0.5), 0, 1.94, 0.05, 0.94, 0.12, 0.33, false);
    addBox(parked.root, parkedSiren, 0, 2.08, 0.05, 0.4, 0.18, 0.3, false);
    // Blue lights
    const blueLight = new THREE.PointLight(0x4488ff, 8, 14); blueLight.position.set(x, 5, z); scene.add(blueLight);
    buildings.push({ x, z, w: 24, d: 16, h: 8.6, group: g });
  }
  buildPoliceStation(185, -55);

  // VEHICLE GARAGE MARKER
  const garageMarker = new THREE.Group(); garageMarker.position.set(140, 0, 68); scene.add(garageMarker);
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0033ff, emissiveIntensity: 2.5 });
  const garageRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 8, 48), garageMat); garageRing.rotation.x = Math.PI / 2; garageRing.position.y = 0.18; garageMarker.add(garageRing);
  const garageBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.65, 10, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x2255ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })); garageBeam.position.y = 5; garageMarker.add(garageBeam);
  const garageLight = new THREE.PointLight(0x0066ff, 12, 16); garageLight.position.y = 4; garageMarker.add(garageLight);
  const garageLabelTex = makeTexture((c, w, h) => { c.fillStyle = '#001033'; c.fillRect(0, 0, w, h); c.fillStyle = '#4499ff'; c.font = '800 56px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#4499ff'; c.shadowBlur = 20; c.fillText('GARAGE', w/2, h*0.45); c.font = '400 20px monospace'; c.fillText('PRESS E TO BROWSE VEHICLES', w/2, h*0.78); }, 400, 128);
  const garageSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: garageLabelTex, transparent: true, depthWrite: false })); garageSprite.position.y = 11; garageSprite.scale.set(5, 1.6, 1); garageMarker.add(garageSprite);

  // ELEVATED SKYBRIDGE CONNECTING SKYSCRAPERS ACROSS STREET
  const skybridge = new THREE.Group(); skybridge.position.set(120, 18, 23); scene.add(skybridge);
  addBox(skybridge, mat(0x1a242f, 0.7, 0.4), 0, 0, 0, 78, 3.8, 5.2);
  const bridgeGlass = new THREE.MeshPhysicalMaterial({ color: 0x44ddff, emissive: 0x1188aa, emissiveIntensity: 0.8, transparent: true, opacity: 0.65, roughness: 0.1 });
  for (const side of [-1, 1]) {
    addMesh(skybridge, new THREE.PlaneGeometry(74, 2.4), bridgeGlass, 0, 0.2, side * 2.65, 1, 1, 1, false, false);
  }

  // SOLID AABB COLLISION RESOLUTION
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

  // STREET FURNITURE
  const lampMetal = mat(0x303a3d, 0.48, 0.62);
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0xffdfab, emissive: 0xffb862, emissiveIntensity: 4.2, roughness: 0.3 });
  const lampLights = [];
  for (const side of [-1, 1]) for (let z = -118; z <= 124; z += 30) {
    const x = 120 + side * 16.4;
    addBox(scene, lampMetal, x, 3.1, z, 0.14, 6.2, 0.14, false);
    const arm = addBox(scene, lampMetal, x - side * 0.6, 6.0, z, 1.35, 0.1, 0.12, false); arm.rotation.z = side * -0.08;
    addMesh(scene, new THREE.SphereGeometry(0.16, 8, 6), lampGlow, x - side * 1.14, 5.78, z, 1, 0.6, 1, false, false);
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

  // OBJECTIVE MARKER & DATA CASE
  const goal = new THREE.Group(); goal.position.set(95, 0, -10); scene.add(goal);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd195, emissive: 0xff992b, emissiveIntensity: 3.5, metalness: 0.5, roughness: 0.28 });
  const goalRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.07, 8, 48), ringMat); goalRing.rotation.x = Math.PI / 2; goalRing.position.y = 0.18; goal.add(goalRing);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.55, 8, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb665, transparent: true, opacity: 0.19, side: THREE.DoubleSide, depthWrite: false })); beam.position.y = 4; goal.add(beam);
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), ringMat); marker.position.y = 8; goal.add(marker);
  const goalLight = new THREE.PointLight(0xffa954, 15, 18); goalLight.position.y = 5; goal.add(goalLight);
  const dataCase = new THREE.Group(); dataCase.position.set(95, 0, -11.8); scene.add(dataCase);
  addBox(dataCase, new THREE.MeshPhysicalMaterial({ color: 0x252e36, metalness: 0.76, roughness: 0.26, clearcoat: 1 }), 0, 0.42, 0, 0.82, 0.55, 0.58);
  addBox(dataCase, mat(0xd6b36f, 0.28, 0.65, { emissive: 0x63400f, emissiveIntensity: 0.45 }), 0, 0.72, 0, 0.36, 0.08, 0.06, false);
  addBox(dataCase, ringMat, 0, 0.43, -0.3, 0.18, 0.18, 0.035, false);

  // VEHICLE 1: VELA GT COUPE (CAR)
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
    const underglow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.8), new THREE.MeshBasicMaterial({ color: 0x0044ff, transparent: true, opacity: 0.18, depthWrite: false }));
    underglow.rotation.x = -Math.PI / 2; underglow.position.y = 0.05; root.add(underglow);

    // Front Headlight Spotlights projecting onto asphalt
    const headSpot = new THREE.SpotLight(0xf0f8ff, 12, 45, Math.PI / 6, 0.4, 1.5);
    headSpot.position.set(0, 0.9, -2.2); headSpot.target.position.set(0, 0, -20);
    root.add(headSpot); root.add(headSpot.target);

    if (trafficCar) root.scale.setScalar(0.82);
    return { root, wheelPivots, tailMat: myTailMat, type: 'car' };
  }

  const carModel = makeCar(0xb93f39); carModel.speed = 0; scene.add(carModel.root); carModel.root.position.set(122, 0, 63);

  // VEHICLE 2: NEXUS-900 SUPERBIKE (MOTORCYCLE)
  function makeMotorcycle() {
    const root = new THREE.Group();
    const frameMat = mat(0x12171c, 0.5, 0.5);
    const paintMat = new THREE.MeshPhysicalMaterial({ color: 0x00ffcc, roughness: 0.15, metalness: 0.7, clearcoat: 1 });
    const chromeMat = mat(0xd0d8dc, 0.2, 0.95);
    const seatMat = mat(0x1c1917, 0.85);

    // Frame & Gas Tank
    addBox(root, frameMat, 0, 0.65, 0, 0.45, 0.5, 1.8);
    addBox(root, paintMat, 0, 0.95, -0.25, 0.5, 0.4, 0.9); // sculpted tank
    addBox(root, seatMat, 0, 0.88, 0.45, 0.38, 0.15, 0.7); // leather seat
    addBox(root, chromeMat, 0.22, 0.45, 0.4, 0.12, 0.12, 1.1, false); // exhaust pipe

    // Front Forks & Handlebars
    const forks = addBox(root, chromeMat, 0, 0.85, -0.9, 0.5, 0.8, 0.12, false);
    forks.rotation.x = -0.35;
    addBox(root, frameMat, 0, 1.12, -0.95, 0.85, 0.08, 0.08, false); // handlebars

    // Front & Rear Wheels
    const bikeTire = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16); bikeTire.rotateZ(Math.PI / 2);
    const wheels = [];
    for (const z of [-1.15, 1.05]) {
      const w = addMesh(root, bikeTire, shared.rubber, 0, 0.38, z, 1, 1, 1, true, false);
      addMesh(w, new THREE.CylinderGeometry(0.2, 0.2, 0.24, 10), chromeMat, 0, 0, 0).rotation.z = Math.PI / 2;
      wheels.push(w);
    }

    // Headlight & Taillight
    addBox(root, headMat, 0, 0.92, -1.05, 0.3, 0.2, 0.12, false);
    const bikeHeadSpot = new THREE.SpotLight(0xe5ffff, 10, 38, Math.PI / 7, 0.3, 1.5);
    bikeHeadSpot.position.set(0, 0.92, -1.1); bikeHeadSpot.target.position.set(0, 0, -18);
    root.add(bikeHeadSpot); root.add(bikeHeadSpot.target);
    const myTailMat = tailMat.clone();
    addBox(root, myTailMat, 0, 0.92, 0.95, 0.25, 0.12, 0.08, false);

    return { root, wheels, tailMat: myTailMat, type: 'bike', speed: 0 };
  }

  
  const bikeModel = makeMotorcycle(); scene.add(bikeModel.root); bikeModel.root.position.set(78, 0, 48);

  // VEHICLE 3: TITAN-X SUV
  function makeSUV(color = 0x2d3f52) {
    const root = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.14, metalness: 0.68, clearcoat: 0.9, clearcoatRoughness: 0.1 });
    addBox(root, paint, 0, 0.9, 0, 2.5, 0.65, 5.2);
    addBox(root, paint, 0, 1.3, -0.5, 2.38, 0.55, 3.8);
    addBox(root, shared.glass, 0, 1.75, 0.3, 2.1, 0.75, 2.3);
    addBox(root, paint, 0, 2.2, 0.3, 1.95, 0.14, 2.1);
    addBox(root, mat(0x1a2228, 0.4, 0.5), 0, 1.0, 1.4, 2.3, 0.52, 1.5);
    addBox(root, mat(0x272e33, 0.5, 0.6), 0, 0.42, -2.56, 2.1, 0.26, 0.2, false);
    const myTailMat = tailMat.clone();
    const myHeadMat = headMat.clone();
    const suvTireGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 18); suvTireGeo.rotateZ(Math.PI / 2);
    const suvRimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.38, 12); suvRimGeo.rotateZ(Math.PI / 2);
    const wheelPivots = [];
    for (const x of [-1.28, 1.28]) for (const z of [-1.65, 1.7]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.5, z); root.add(pivot); wheelPivots.push(pivot);
      addMesh(pivot, suvTireGeo, shared.rubber, 0, 0, 0); addMesh(pivot, suvRimGeo, mat(0x9faeb1, 0.25, 0.86), 0, 0, 0);
    }
    for (const side of [-1, 1]) {
      addBox(root, myHeadMat, side * 0.82, 1.0, -2.6, 0.5, 0.18, 0.08, false);
      addBox(root, myTailMat, side * 0.82, 1.0, 2.6, 0.45, 0.18, 0.07, false);
    }
    const suvSpot = new THREE.SpotLight(0xf0f8ff, 14, 50, Math.PI / 6, 0.4, 1.5);
    suvSpot.position.set(0, 1.0, -2.6); suvSpot.target.position.set(0, 0, -22);
    root.add(suvSpot); root.add(suvSpot.target);
    return { root, wheelPivots, tailMat: myTailMat, type: 'suv', speed: 0 };
  }
  const suvModel = makeSUV(0x2d3f52); scene.add(suvModel.root); suvModel.root.position.set(135, 0, 68);

  // VEHICLE 4: HAULER TRUCK
  function makeTruck(color = 0x4a3225) {
    const root = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.55, clearcoat: 0.5 });
    const chromeMat = mat(0xb0b8bc, 0.22, 0.95);
    // Cab
    addBox(root, paint, 0, 1.3, -2.2, 2.6, 2.0, 2.8);
    addBox(root, shared.glass, 0, 2.1, -3.4, 2.4, 0.9, 0.18, false);
    addBox(root, mat(0x0d1318, 0.5, 0.4), 0, 1.0, -3.6, 2.5, 0.6, 0.18, false);
    // Cargo bed
    addBox(root, paint, 0, 0.8, 1.6, 2.6, 0.5, 5.6);
    addBox(root, mat(0x3a2e28, 0.9), 0, 1.4, 1.6, 2.5, 1.0, 5.4, true);
    addBox(root, paint, -1.26, 1.0, 1.6, 0.14, 1.1, 5.2);
    addBox(root, paint, 1.26, 1.0, 1.6, 0.14, 1.1, 5.2);
    addBox(root, paint, 0, 1.0, 4.4, 2.6, 1.1, 0.16);
    // Exhaust stacks
    addMesh(root, new THREE.CylinderGeometry(0.09, 0.09, 2.5, 8), chromeMat, 1.1, 2.4, -1.0, 1, 1, 1, false, false);
    // Wheels (6-wheel config: front pair + 2 rear pairs)
    const truckTireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.38, 18); truckTireGeo.rotateZ(Math.PI / 2);
    const truckRimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.4, 12); truckRimGeo.rotateZ(Math.PI / 2);
    const wheelPivots = [];
    const wheelPositions = [[-1.35,-2.2],[-1.35,1.1],[-1.35,2.6],[1.35,-2.2],[1.35,1.1],[1.35,2.6]];
    for (const [x, z] of wheelPositions) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.55, z); root.add(pivot); wheelPivots.push(pivot);
      addMesh(pivot, truckTireGeo, shared.rubber, 0, 0, 0); addMesh(pivot, truckRimGeo, mat(0x888e92, 0.3, 0.8), 0, 0, 0);
    }
    const myTailMat = tailMat.clone();
    addBox(root, headMat, 0, 1.3, -3.62, 2.2, 0.28, 0.08, false);
    addBox(root, myTailMat, 0, 1.0, 4.44, 2.3, 0.22, 0.07, false);
    return { root, wheelPivots, tailMat: myTailMat, type: 'truck', speed: 0 };
  }
  const truckModel = makeTruck(0x4a3225); scene.add(truckModel.root); truckModel.root.position.set(165, 0, -38);

  // 5 COMPLETE WEAPON CLASSES (WITH ACCURATE STATS & 3D MODELS)
  const WEAPONS = [
    {
      id: 'pistol', name: 'NOVA-9', type: 'SIDEARM', caliber: '9MM',
      magSize: 15, reserve: 75, ammo: 15, cooldown: 0.20, auto: false, damage: 36,
      spread: 0.012, pellets: 1, color: 0xffd07a, dotColor: '#ffd86a', soundFreq: 240, soundDecay: 0.08,
      casingColor: 0xd4a94a, recoil: 0.035,
    },
    {
      id: 'smg', name: 'APEX-45', type: 'SMG', caliber: '.45 ACP',
      magSize: 32, reserve: 128, ammo: 32, cooldown: 0.085, auto: true, damage: 22,
      spread: 0.035, pellets: 1, color: 0x62ecdf, dotColor: '#62ecdf', soundFreq: 350, soundDecay: 0.05,
      casingColor: 0xd4a94a, recoil: 0.022,
    },
    {
      id: 'assault', name: 'VALKYRIE-7', type: 'ASSAULT', caliber: '5.56MM',
      magSize: 30, reserve: 120, ammo: 30, cooldown: 0.135, auto: true, damage: 44,
      spread: 0.018, pellets: 1, color: 0xffea78, dotColor: '#ffea78', soundFreq: 210, soundDecay: 0.09,
      casingColor: 0xd4a94a, recoil: 0.045,
    },
    {
      id: 'shotgun', name: 'VULCAN-12', type: 'SHOTGUN', caliber: '12-GAUGE',
      magSize: 8, reserve: 40, ammo: 8, cooldown: 0.68, auto: false, damage: 16,
      spread: 0.12, pellets: 8, color: 0xff6633, dotColor: '#ff6633', soundFreq: 110, soundDecay: 0.16,
      casingColor: 0xdd2233, recoil: 0.095,
    },
    {
      id: 'sniper', name: 'PHANTOM-50', type: 'SNIPER', caliber: '.50 CAL',
      magSize: 5, reserve: 25, ammo: 5, cooldown: 0.95, auto: false, damage: 110,
      spread: 0.003, pellets: 1, color: 0xd475ff, dotColor: '#d475ff', soundFreq: 165, soundDecay: 0.22,
      casingColor: 0xcaa03c, recoil: 0.12,
    }
  ];

  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x3a454d, metalness: 0.88, roughness: 0.22 });
  const gunDark = mat(0x181c20, 0.65, 0.4);
  const gunAccent = new THREE.MeshStandardMaterial({ color: 0x62ecdf, emissive: 0x42d6c9, emissiveIntensity: 1.4, roughness: 0.25 });
  const goldAccent = new THREE.MeshStandardMaterial({ color: 0xdec186, emissive: 0x80561d, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 });

  function createWeaponModel(wepIndex) {
    const root = new THREE.Group();
    const flashMat = new THREE.MeshBasicMaterial({ color: WEAPONS[wepIndex].color, toneMapped: false });
    let muzzle = new THREE.Vector3(0, 0.02, -0.7);

    if (wepIndex === 0) { // 1: PISTOL (NOVA-9)
      addBox(root, gunMetal, 0, 0.03, -0.16, 0.14, 0.13, 0.42, false);
      addMesh(root, new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), gunMetal, 0, 0.03, -0.48, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addBox(root, goldAccent, 0, -0.12, -0.09, 0.11, 0.24, 0.14, false).rotation.x = -0.2;
      addBox(root, gunAccent, 0, -0.02, -0.32, 0.06, 0.04, 0.14, false); // laser sight
      muzzle = new THREE.Vector3(0, 0.03, -0.66);
    } else if (wepIndex === 1) { // 2: SMG (APEX-45)
      addBox(root, gunDark, 0, 0.04, -0.22, 0.16, 0.16, 0.54, false);
      addBox(root, gunMetal, 0, 0.04, -0.52, 0.12, 0.12, 0.32, false);
      addBox(root, gunAccent, 0, 0.12, -0.22, 0.05, 0.08, 0.14, false);
      addBox(root, gunMetal, 0, -0.24, -0.28, 0.1, 0.32, 0.13, false).rotation.x = 0.18;
      addBox(root, gunDark, 0, -0.12, -0.06, 0.11, 0.22, 0.13, false).rotation.x = -0.2;
      addBox(root, gunMetal, 0, 0.02, 0.14, 0.07, 0.09, 0.28, false);
      muzzle = new THREE.Vector3(0, 0.04, -0.74);
    } else if (wepIndex === 2) { // 3: ASSAULT RIFLE (VALKYRIE-7)
      addBox(root, gunDark, 0, 0.05, -0.25, 0.16, 0.18, 0.68, false);
      addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.48, 8), gunMetal, 0, 0.05, -0.68, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addBox(root, gunAccent, 0, 0.15, -0.25, 0.06, 0.08, 0.22, false); // Holo sight
      addBox(root, gunMetal, 0, -0.24, -0.18, 0.1, 0.35, 0.16, false).rotation.x = 0.2; // Curved banana mag
      addBox(root, mat(0x242e36, 0.6), 0, -0.02, 0.24, 0.14, 0.24, 0.42, false); // Stock
      muzzle = new THREE.Vector3(0, 0.05, -0.96);
    } else if (wepIndex === 3) { // 4: SHOTGUN (VULCAN-12)
      addBox(root, gunDark, 0, 0.04, -0.2, 0.18, 0.2, 0.6, false);
      addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), gunMetal, -0.04, 0.07, -0.56, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addMesh(root, new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), gunMetal, 0.04, 0.07, -0.56, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addBox(root, mat(0x5a3424, 0.65), 0, -0.02, -0.46, 0.16, 0.11, 0.28, false);
      addBox(root, mat(0x1a2128, 0.7), 0, -0.03, 0.22, 0.13, 0.24, 0.38, false);
      addBox(root, new THREE.MeshStandardMaterial({ color: 0xdd2233 }), 0.1, 0.04, -0.15, 0.05, 0.09, 0.2, false);
      muzzle = new THREE.Vector3(0, 0.07, -0.88);
    } else { // 5: SNIPER (PHANTOM-50)
      addBox(root, gunDark, 0, 0.05, -0.25, 0.17, 0.18, 0.78, false);
      addMesh(root, new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8), gunMetal, 0, 0.05, -0.82, 1, 1, 1, false, false).rotation.x = -Math.PI / 2;
      addBox(root, gunMetal, 0, 0.18, -0.28, 0.11, 0.12, 0.44, false); // Long Sniper Scope
      addBox(root, gunAccent, 0, 0.18, -0.52, 0.09, 0.09, 0.04, false); // Scope lens
      addBox(root, gunMetal, 0, -0.24, -0.22, 0.11, 0.28, 0.16, false); // Straight mag
      addBox(root, gunDark, 0, 0.01, 0.28, 0.13, 0.26, 0.48, false);
      addBox(root, gunAccent, 0, 0.05, -1.26, 0.1, 0.08, 0.14, false); // Heavy muzzle brake
      muzzle = new THREE.Vector3(0, 0.05, -1.35);
    }

    const flash = addMesh(root, new THREE.IcosahedronGeometry(0.18, 0), flashMat, muzzle.x, muzzle.y, muzzle.z, 1, 1, 1, false, false);
    flash.visible = false;
    return { root, flash, muzzle, flashTime: 0, cooldown: 0 };
  }

  // ARTICULATED PLAYABLE CHARACTER (CYBERPUNK LOKI)
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
      addBox(bob, hairMat, 0, 1.93, 0.02, 0.33, 0.12, 0.36, true);
      addBox(bob, hairMat, 0, 1.88, -0.15, 0.28, 0.08, 0.1, false);
      addBox(bob, mat(0x141210, 0.9), 0, 1.83, 0.02, 0.36, 0.12, 0.32, false);

      addBox(bob, mat(0x0e1318, 0.8), 0, 1.75, -0.11, 0.36, 0.08, 0.14, false);
      addBox(bob, lokiVisor, 0, 1.75, -0.185, 0.32, 0.055, 0.04, false);
      addBox(bob, lokiAccent, 0.18, 1.74, 0, 0.04, 0.06, 0.04, false);

      addBox(bob, mat(0x0e151c, 0.7), 0, 1.15, 0, 0.46, 0.65, 0.3);
      addBox(bob, lokiJacket, -0.17, 1.15, 0.02, 0.2, 0.68, 0.34);
      addBox(bob, lokiJacket, 0.17, 1.15, 0.02, 0.2, 0.68, 0.34);
      addBox(bob, lokiAccent, -0.06, 1.15, 0.18, 0.02, 0.66, 0.02, false);
      addBox(bob, lokiAccent, 0.06, 1.15, 0.18, 0.02, 0.66, 0.02, false);
      addBox(bob, lokiJacket, 0, 1.54, -0.08, 0.38, 0.18, 0.18, false);

      addBox(bob, mat(0x161a20, 0.6), 0, 1.25, 0.17, 0.44, 0.06, 0.03, false);
      addBox(bob, lokiAccent, 0, 1.25, 0.19, 0.08, 0.08, 0.03, false);

      addBox(bob, mat(0x1a2430, 0.4, 0.4), 0, 1.26, 0.22, 0.34, 0.46, 0.18);
      addBox(bob, lokiAccent, 0, 1.26, 0.32, 0.12, 0.22, 0.03, false);
      addBox(bob, mat(0x0b1016, 0.8), -0.14, 1.52, 0.24, 0.02, 0.18, 0.02, false);
    } else if (faction === 'rival') {
      addBox(bob, rivalMask, 0, 1.76, 0.02, 0.38, 0.32, 0.38);
      addBox(bob, rivalVisor, 0, 1.76, -0.19, 0.32, 0.07, 0.04, false);
      addBox(bob, rivalJacket, 0, 1.15, 0, 0.52, 0.68, 0.36);
      addBox(bob, mat(0x15181c, 0.6), 0, 1.25, 0.18, 0.44, 0.14, 0.08, false);
    } else {
      const civPalette = [0xb46a62, 0x647ebe, 0xd2a252, 0x789887, 0x8d78a6];
      addBox(bob, mat(civPalette[seed % civPalette.length], 0.7, 0.05), 0, 1.15, 0, 0.48, 0.68, 0.32);
      addBox(bob, hairMat, 0, 1.88, 0, 0.36, 0.18, 0.34);
    }

    const legs = [], arms = [];
    const myLegMat = isPlayer ? cargoPants : faction === 'rival' ? cargoPants : mat([0x28333d, 0x272329, 0x353d43, 0x453832][seed % 4], 0.78);
    for (const side of [-1, 1]) {
      const leg = addMesh(bob, limbGeo, myLegMat, side * 0.14, 0.57, 0, 0.72, 0.9, 0.78);
      legs.push(leg);
      if (isPlayer) {
        addBox(bob, mat(0x12171e, 0.7), side * 0.22, 0.62, 0, 0.08, 0.16, 0.15, false);
        addBox(bob, mat(0x28323a, 0.4, 0.6), side * 0.14, 0.52, -0.11, 0.15, 0.13, 0.05, false);
      }
      addBox(bob, bootMat, side * 0.14, 0.12, -0.06, 0.22, 0.16, 0.38, true);
      if (isPlayer) addBox(bob, lokiAccent, side * 0.14, 0.035, -0.06, 0.2, 0.035, 0.36, false);

      const armMat = isPlayer ? lokiJacket : faction === 'rival' ? rivalJacket : myLegMat;
      const arm = addMesh(bob, limbGeo, armMat, side * 0.33, 1.11, 0, 0.68, 0.82, 0.7);
      arms.push(arm);
      if (isPlayer && side === -1) addBox(bob, lokiAccent, -0.33, 0.88, -0.06, 0.09, 0.04, 0.06, false);
    }

    let weapon = null;
    let weaponModels = null;
    let activeWeaponMesh = null;

    if (isPlayer) {
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
      const wep = createWeaponModel(seed % 2);
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

  const player = makePerson(true); scene.add(player.root); player.root.position.set(117.5, 0, 68);

  // NPCS & RIVALS
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

  // NPC DIALOGUE PHRASES
  const npcPhrases = [
    "Keep moving, courier!", "You seen the Nox crew?", "Afterlight never sleeps.",
    "My augments itch in the rain...", "Watch your six out there.", "NEXORA owns this block.",
    "The data market is open.", "Street laws only here.", "You hear those sirens?",
    "New face in the district.", "Stay sharp, the grid is watching.", "Rain wipes the blood clean."
  ];
  const npcDialogues = new Map(); // ped -> { div, timer }

  const traffic = [];
  for (let i = 0; i < 6; i++) {
    const colors = [0x287f80, 0x4d5ca3, 0xad7642, 0x943d4d, 0x80908d, 0x504476];
    const model = makeCar(colors[i], true); model.root.position.set(i % 2 ? 125 : 115, 0, -145 + i * 49); model.root.rotation.y = i % 2 ? 0 : Math.PI; scene.add(model.root);
    traffic.push({ ...model, lane: i % 2 ? 125 : 115, speed: i % 2 ? -4.6 - (i % 3) : 4.7 + (i % 3), direction: i % 2 ? 1 : -1, hitCooldown: 0 });
  }

  // WEAPON PICKUP SPAWNS
  const weaponPickups = [];
  const pickupDefs = [
    { wepIndex: 3, ammoGrant: 16, x: 103, z: -20 },   // Shotgun near market
    { wepIndex: 2, ammoGrant: 30, x: 136, z: 25 },     // Assault rifle
    { wepIndex: 4, ammoGrant: 10, x: 92, z: 55 },      // Sniper near villa
    { wepIndex: 1, ammoGrant: 64, x: 148, z: -55 },    // SMG
  ];
  pickupDefs.forEach((def) => {
    const g = new THREE.Group(); g.position.set(def.x, 0.42, def.z); scene.add(g);
    const glowMat = new THREE.MeshStandardMaterial({ color: WEAPONS[def.wepIndex].color, emissive: WEAPONS[def.wepIndex].color, emissiveIntensity: 2.5, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0x0a1520, emissive: 0x1a3045, emissiveIntensity: 1.5 }));
    base.rotation.x = 0; g.add(base);
    const icon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.22), glowMat); icon.position.y = 0.25; g.add(icon);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), glowMat); barrel.rotation.z = Math.PI / 2; barrel.position.y = 0.25; g.add(barrel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 32), glowMat); ring.rotation.x = Math.PI / 2; g.add(ring);
    const light = new THREE.PointLight(WEAPONS[def.wepIndex].color, 6, 5); light.position.y = 0.5; g.add(light);
    weaponPickups.push({ ...def, group: g, ring, light, collected: false });
  });

  // Cross-street traffic (along X axis)
  const crossTraffic = [];
  for (let i = 0; i < 3; i++) {
    const colors = [0x2d6e54, 0x5c3d7a, 0xa83c2e];
    const ct = makeCar(colors[i], true); ct.root.position.set(55 + i * 48, 0, -3); ct.root.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2; scene.add(ct.root);
    crossTraffic.push({ ...ct, speed: i % 2 ? 4.2 + i * 0.4 : -(4.5 + i * 0.3), lane: -3, hitCooldown: 0 });
  }

  const policeCar = makeCar(0x1d3046, true); policeCar.speed = 0; policeCar.root.position.set(120, 0, -155); policeCar.root.visible = false; scene.add(policeCar.root);
  const sirenRed = mat(0xff4b58, 0.25, 0.1, { emissive: 0xe01830, emissiveIntensity: 4 });
  const sirenBlue = mat(0x4d9dff, 0.25, 0.1, { emissive: 0x1764ed, emissiveIntensity: 4 });
  addBox(policeCar.root, shared.dark, 0, 1.94, 0.05, 0.94, 0.12, 0.33, false);
  const redSiren = addMesh(policeCar.root, new THREE.BoxGeometry(0.37, 0.18, 0.3), sirenRed, -0.24, 2.08, 0.05, 1, 1, 1, false, false);
  const blueSiren = addMesh(policeCar.root, new THREE.BoxGeometry(0.37, 0.18, 0.3), sirenBlue, 0.24, 2.08, 0.05, 1, 1, 1, false, false);

  // WEATHER PARTICLES & THUNDER
  const rainCount = 2400, rainPositions = new Float32Array(rainCount * 6);
  let rainWindX = 0.04, rainWindZ = 0.02;
  for (let i = 0; i < rainCount; i++) {
    const x = (Math.random() - 0.5) * 200, z = (Math.random() - 0.5) * 190, y = Math.random() * 38 + 2;
    const n = i * 6;
    rainPositions[n] = x; rainPositions[n + 1] = y; rainPositions[n + 2] = z;
    rainPositions[n + 3] = x - 0.12 - rainWindX * 2; rainPositions[n + 4] = y - 0.9; rainPositions[n + 5] = z - rainWindZ * 2;
  }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa1ccde, transparent: true, opacity: 0.38 })); scene.add(rain);

  const rainSplashParticles = [];
  const splashGeo = new THREE.CircleGeometry(0.08, 6); splashGeo.rotateX(-Math.PI / 2);
  const splashMat = new THREE.MeshBasicMaterial({ color: 0x88bbcc, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 60; i++) {
    const splash = new THREE.Mesh(splashGeo, splashMat.clone());
    splash.position.set(104 + Math.random() * 32, 0.012, -130 + Math.random() * 260);
    splash.userData = { life: Math.random() * 0.4, maxLife: 0.4 + Math.random() * 0.3 };
    scene.add(splash); rainSplashParticles.push(splash);
  }

  // STATE MANAGEMENT
  const state = {
    health: 100, stamina: 100, inCar: false, inBike: false, paused: false, complete: false, sprint: false, hop: 0,
    time: 0, toast: 0, nearCar: false, nearBike: false, nearShop: false, nearVilla: false, highQuality: true,
    yaw: 0, cameraPitch: 0.29, isAiming: false, mouseDown: false, isFiring: false, lastMouseX: 0, lastMouseY: 0,
    hitInvuln: 0, currentWeaponIndex: 0, reload: 0, fireCooldown: 0, wanted: 0, wantedDecay: 0,
    robberyStarted: false, robberyProgress: 0, robberyComplete: false, policeActive: false, policeDelay: 0,
    money: 2400, ownedVilla: false, nearGarage: false, inGarage: false,
    weaponWheelOpen: false, weaponWheelHovered: 0,
    nearInterior: false, insideMarket: false,
    npcDialogTimer: 0, pickupFlash: 0,
    kills: 0, escapeComplete: false, nextThunder: 15 + Math.random() * 20, thunderFlash: 0
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
    const casingMat = new THREE.MeshStandardMaterial({ color: casingColor, metalness: 0.85, roughness: 0.2 });
    const casing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), casingMat);
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

    // Update scope display if switching away from sniper while aiming
    if (ui.sniperScope) {
      ui.sniperScope.classList.toggle('show', state.isAiming && wep.id === 'sniper');
    }

    if (audioCtx) {
      try {
        const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        g.gain.setValueAtTime(0.04, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
        osc.connect(g); g.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.06);
      } catch {}
    }
  }

  function reloadWeapon() {
    const wep = WEAPONS[state.currentWeaponIndex];
    if (state.inCar || state.inBike || state.reload > 0 || wep.ammo === wep.magSize || wep.reserve <= 0) return;
    state.reload = 1.15; showToast(`RELOADING  ·  ${wep.name}`);
  }

  function fireWeapon() {
    if (state.paused || state.inCar || state.inBike || !player.weapon || state.reload > 0 || state.fireCooldown > 0) return;
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
      const spreadX = (Math.random() - 0.5) * (state.isAiming ? wep.spread * 0.4 : wep.spread);
      const spreadY = (Math.random() - 0.5) * (state.isAiming ? wep.spread * 0.4 : wep.spread);
      shotRay.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

      const hits = shotRay.intersectObjects([...occluders, ...rivalMeshes], false);
      const first = hits[0];
      const endpoint = first ? first.point.clone() : shotRay.ray.origin.clone().addScaledVector(shotRay.ray.direction, 80);

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
        gain.gain.setValueAtTime(wep.id === 'shotgun' ? 0.09 : 0.045, now);
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
      state.health = 60; state.inCar = false; state.inBike = false; player.root.visible = true;
      ui.vehicleHud.classList.remove('show');
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
      state.inCar = false; ui.vehicleHud.classList.remove('show'); player.root.visible = true;
      const car = carModel.root.position;
      player.root.position.set(car.x + Math.cos(carModel.root.rotation.y) * 2.6, 0, car.z + Math.sin(carModel.root.rotation.y) * 2.6);
      player.root.rotation.y = carModel.root.rotation.y;
      resolveBuildingCollision(player.root.position, 0.7);
      showToast('ON FOOT  ·  VELA GT PARKED');
    } else if (state.inBike) {
      state.inBike = false; ui.vehicleHud.classList.remove('show'); player.root.visible = true;
      const b = bikeModel.root.position;
      player.root.position.set(b.x + Math.cos(bikeModel.root.rotation.y) * 1.5, 0, b.z + Math.sin(bikeModel.root.rotation.y) * 1.5);
      player.root.rotation.y = bikeModel.root.rotation.y;
      resolveBuildingCollision(player.root.position, 0.7);
      showToast('ON FOOT  ·  NEXUS BIKE PARKED');
    } else if (state.nearCar) {
      const nearSUV3 = player.root.position.distanceTo(suvModel.root.position) < 8;
      const nearTruck3 = player.root.position.distanceTo(truckModel.root.position) < 8;
      state.inCar = true; player.root.visible = false; ui.vehicleHud.classList.add('show');
      if (nearSUV3 && player.root.position.distanceTo(carModel.root.position) > 8) {
        ui.vehicleName.innerHTML = 'TITAN <b>X</b><small>TACTICAL SUV</small>'; showToast('TITAN-X  ·  READY TO DRIVE');
      } else if (nearTruck3 && player.root.position.distanceTo(carModel.root.position) > 8) {
        ui.vehicleName.innerHTML = 'HAULER <b>PRO</b><small>CARGO TRUCK</small>'; showToast('HAULER  ·  READY TO DRIVE');
      } else {
        ui.vehicleName.innerHTML = 'VELA <b>GT</b><small>HYBRID COUPE</small>'; showToast('VELA GT  ·  READY TO DRIVE');
      }
    } else if (state.nearBike) {
      state.inBike = true; player.root.visible = false; ui.vehicleHud.classList.add('show');
      ui.vehicleName.innerHTML = 'NEXUS <b>900</b><small>STREETFIGHTER SUPERBIKE</small>'; showToast('NEXUS 900  ·  THROTTLE READY');
    } else if (state.nearGarage) {
      openGarageUI();
    } else if (state.nearVilla) {
      if (state.ownedVilla) {
        showToast('YOUR VILLA  ·  AFTERLIGHT SUBURB  ·  SAFE HOUSE ACTIVE');
      } else if (state.money >= 15000) {
        state.money -= 15000; state.ownedVilla = true;
        showToast('VILLA PURCHASED  ·  SAFE HOUSE UNLOCKED  ·  ¢ ' + state.money.toLocaleString());
        try { localStorage.setItem('nexora_villa', '1'); localStorage.setItem('nexora_money', String(state.money)); } catch {}
      } else {
        showToast('INSUFFICIENT FUNDS  ·  NEED ¢ 15,000  ·  YOU HAVE ¢ ' + state.money.toLocaleString());
      }
    } else if (state.nearShop && !state.robberyStarted) {
      state.robberyStarted = true; state.wanted = 3; state.policeDelay = 6; state.robberyProgress = 0;
      ui.objective.textContent = 'Take the data key — hold the shop';
      rivals.forEach((rival) => { rival.active = true; rival.root.visible = true; });
      for (const ped of peds) {
        const run = ped.root.position.clone().sub(targetPosition); run.y = 0;
        if (run.lengthSq() > 0.01) ped.direction.copy(run.normalize()); ped.speed = 2.2 + Math.random();
      }
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
    sunMoon.shadow.mapSize.set(state.highQuality ? 2048 : 1024, state.highQuality ? 2048 : 1024);
    bloom.strength = state.highQuality ? 0.85 : 0.42;
    renderer.shadowMap.needsUpdate = true;
    ui.quality.textContent = state.highQuality ? 'ULTRA' : 'BALANCED';
    ui.quality.classList.toggle('balanced', !state.highQuality);
  }
  ui.quality.addEventListener('click', toggleQuality);

  // UPDATE LOOP (PLAYER, VEHICLES, BIKE, COLLISION)
  function updatePlayer(dt) {
    const forward = (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') || held.has('arrowdown') ? 1 : 0);
    const right = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
    const sprinting = held.has('shift') && state.stamina > 0.5 && !state.inCar && !state.inBike && forward > 0;
    state.sprint = sprinting;
    state.stamina = sprinting ? Math.max(0, state.stamina - 22 * dt) : Math.min(100, state.stamina + 13 * dt);

    if (state.inCar) {
      const car = carModel.root;
      carModel.speed = (carModel.speed || 0) + forward * 16 * dt;
      carModel.speed *= Math.exp(-(forward === 0 ? 0.9 : 0.18) * dt);
      carModel.speed = THREE.MathUtils.clamp(carModel.speed, -8, 28);
      if (held.has(' ')) carModel.speed *= Math.exp(-4.2 * dt);
      car.rotation.y += right * dt * Math.min(1.6, Math.abs(carModel.speed) * 0.11) * Math.sign(carModel.speed || 1);
      const dir = new THREE.Vector3(Math.sin(car.rotation.y), 0, -Math.cos(car.rotation.y));
      car.position.addScaledVector(dir, carModel.speed * dt);

      const oldCarX = car.position.x, oldCarZ = car.position.z;
      resolveBuildingCollision(car.position, 1.6);
      resolveBuildingCollision(car.position, 1.6);
      if (Math.hypot(car.position.x - oldCarX, car.position.z - oldCarZ) > 0.02) {
        carModel.speed *= 0.45; sparksAt(car.position, 0xffd580);
      }

      car.position.x = THREE.MathUtils.clamp(car.position.x, 65, 185);
      car.position.z = THREE.MathUtils.clamp(car.position.z, -158, 158);

      carModel.wheelPivots.forEach((w, i) => { w.rotation.x += carModel.speed * dt * 1.6; if (i < 2) w.rotation.y = -right * 0.26; });
      ui.speed.textContent = String(Math.round(Math.abs(carModel.speed) * 3.6)).padStart(3, '0');
      ui.gear.textContent = carModel.speed > 0.4 ? 'D' : carModel.speed < -0.4 ? 'R' : 'P';
      if (carModel.tailMat) carModel.tailMat.emissiveIntensity = carModel.speed < -0.5 ? 6.0 : 3.2;

    } else if (state.inBike) {
      const bike = bikeModel.root;
      bikeModel.speed = (bikeModel.speed || 0) + forward * 20 * dt;
      bikeModel.speed *= Math.exp(-(forward === 0 ? 1.0 : 0.15) * dt);
      bikeModel.speed = THREE.MathUtils.clamp(bikeModel.speed, -6, 32);
      if (held.has(' ')) bikeModel.speed *= Math.exp(-5.0 * dt);

      bike.rotation.y += right * dt * Math.min(2.1, Math.abs(bikeModel.speed) * 0.14) * Math.sign(bikeModel.speed || 1);
      // Dynamic motorcycle leaning physics
      const targetRoll = -right * Math.min(0.38, Math.abs(bikeModel.speed) * 0.016);
      bike.rotation.z = THREE.MathUtils.damp(bike.rotation.z, targetRoll, 8, dt);

      const bDir = new THREE.Vector3(Math.sin(bike.rotation.y), 0, -Math.cos(bike.rotation.y));
      bike.position.addScaledVector(bDir, bikeModel.speed * dt);

      const oldBX = bike.position.x, oldBZ = bike.position.z;
      resolveBuildingCollision(bike.position, 1.1);
      resolveBuildingCollision(bike.position, 1.1);
      if (Math.hypot(bike.position.x - oldBX, bike.position.z - oldBZ) > 0.02) {
        bikeModel.speed *= 0.4; sparksAt(bike.position, 0xffd580);
      }

      bike.position.x = THREE.MathUtils.clamp(bike.position.x, 65, 185);
      bike.position.z = THREE.MathUtils.clamp(bike.position.z, -158, 158);

      bikeModel.wheels.forEach((w) => { w.rotation.x += bikeModel.speed * dt * 2.2; });
      ui.speed.textContent = String(Math.round(Math.abs(bikeModel.speed) * 3.6)).padStart(3, '0');
      ui.gear.textContent = bikeModel.speed > 0.4 ? 'D' : bikeModel.speed < -0.4 ? 'R' : 'P';

    } else {
      const direction = movementVector(forward, right);
      const movingVec = direction.lengthSq() > 0.01;
      if (movingVec) {
        direction.normalize();
        const speed = sprinting ? 9.2 : 5.3;
        player.root.position.addScaledVector(direction, speed * dt);

        resolveBuildingCollision(player.root.position, 0.65);
        resolveBuildingCollision(player.root.position, 0.65);

        player.root.position.x = THREE.MathUtils.clamp(player.root.position.x, 50, 215);
        player.root.position.z = THREE.MathUtils.clamp(player.root.position.z, -158, 158);
        player.direction.copy(direction);

        const targetRot = Math.atan2(direction.x, -direction.z);
        player.root.rotation.y = THREE.MathUtils.damp(player.root.rotation.y, targetRot, 13, dt);
      }

      const moving = forward !== 0 || right !== 0;
      const gait = moving ? (sprinting ? 13.5 : 8.5) : 2.2;
      player.walkPhase += dt * gait;
      player.legs.forEach((leg, i) => {
        leg.rotation.x = moving ? Math.sin(player.walkPhase + i * Math.PI) * 0.55 : Math.sin(player.walkPhase + i * Math.PI) * 0.035;
      });
      player.arms.forEach((arm, i) => {
        const recoil = (i === 1 && player.recoilOffset > 0) ? player.recoilOffset * 4 : 0;
        arm.rotation.x = moving ? Math.sin(player.walkPhase + i * Math.PI + Math.PI) * 0.42 - recoil : -recoil;
      });

      if (player.recoilOffset > 0) player.recoilOffset = Math.max(0, player.recoilOffset - dt * 0.4);
      if (state.hop > 0) { state.hop = Math.max(0, state.hop - dt); player.bob.position.y = 0.03 + Math.sin((state.hop / 0.48) * Math.PI) * 0.85; }
      else player.bob.position.y = 0.03 + (moving ? Math.abs(Math.sin(player.walkPhase * 2)) * 0.045 : 0);
    }

    const actor = state.inCar ? carModel.root : state.inBike ? bikeModel.root : player.root;
    state.nearCar = !state.inCar && !state.inBike && player.root.position.distanceTo(carModel.root.position) < 8;
    const nearSuv = !state.inCar && !state.inBike && player.root.position.distanceTo(suvModel.root.position) < 8;
    const nearTruck = !state.inCar && !state.inBike && player.root.position.distanceTo(truckModel.root.position) < 8;
    if (!state.nearCar && nearSuv) state.nearCar = true;
    if (!state.nearCar && nearTruck) state.nearCar = true;
    state.nearBike = !state.inCar && !state.inBike && player.root.position.distanceTo(bikeModel.root.position) < 6;
    state.nearShop = !state.inCar && !state.inBike && !state.robberyStarted && player.root.position.distanceTo(targetPosition) < 5.8;
    state.nearVilla = !state.inCar && !state.inBike && player.root.position.distanceTo(new THREE.Vector3(62.5, 0, 56.4)) < 4.2;

    const showPrompt = state.nearCar || state.nearBike || state.inCar || state.inBike || state.nearShop || state.nearVilla || state.nearGarage;
    ui.interaction.classList.toggle('show', showPrompt);
    const nearSUV2 = !state.inCar && !state.inBike && player.root.position.distanceTo(suvModel.root.position) < 8;
    const nearTruck2 = !state.inCar && !state.inBike && player.root.position.distanceTo(truckModel.root.position) < 8;
    ui.interactionLabel.textContent = state.inCar ? 'EXIT VEHICLE' : state.inBike ? 'EXIT NEXUS BIKE' :
                                      state.nearCar && player.root.position.distanceTo(carModel.root.position) < 8 ? 'DRIVE VELA GT' :
                                      nearSUV2 ? 'DRIVE TITAN-X SUV' :
                                      nearTruck2 ? 'DRIVE HAULER TRUCK' :
                                      state.nearBike ? 'RIDE NEXUS BIKE' :
                                      state.nearGarage ? 'OPEN GARAGE  [E]' :
                                      state.nearVilla ? (state.ownedVilla ? 'YOUR PROPERTY  ·  VILLA' : `BUY VILLA  ·  ¢ 15,000`) :
                                      'START THE STORE HEIST';

    // NPC Dialogue update
    for (const [ped, dlg] of npcDialogues) {
      dlg.timer -= dt;
      if (dlg.timer <= 0) {
        dlg.div.remove(); npcDialogues.delete(ped);
      } else {
        const screenPos = ped.root.position.clone().add(new THREE.Vector3(0, 2.8, 0));
        screenPos.project(camera);
        const sx = (screenPos.x * 0.5 + 0.5) * innerWidth;
        const sy = (-screenPos.y * 0.5 + 0.5) * innerHeight;
        dlg.div.style.left = sx + 'px'; dlg.div.style.top = sy + 'px';
        dlg.div.style.opacity = Math.min(1, dlg.timer * 2);
      }
    }
    // Pedestrians
    for (const ped of peds) {
      const toPlayer = ped.root.position.distanceTo(player.root.position);
      if (!state.inCar && !state.inBike && toPlayer < 3.5 && !npcDialogues.has(ped) && Math.random() < 0.004) {
        const phrase = npcPhrases[Math.floor(Math.random() * npcPhrases.length)];
        const div = document.createElement('div');
        div.className = 'npc-bubble'; div.textContent = phrase;
        document.getElementById('shell').appendChild(div);
        npcDialogues.set(ped, { div, timer: 3.5 });
      }
      if (!state.inCar && !state.inBike && toPlayer < 3.2) {
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

    // Weapon pickup animations + collection
    for (const pu of weaponPickups) {
      if (pu.collected) continue;
      pu.group.rotation.y += dt * 1.6;
      pu.group.position.y = 0.42 + Math.sin(state.time * 2.2 + pu.x) * 0.12;
      pu.ring.material.emissiveIntensity = 1.8 + Math.sin(state.time * 4) * 1.0;
      pu.light.intensity = 5 + Math.sin(state.time * 5 + pu.z) * 2;
      const dist = player.root.position.distanceTo(pu.group.position);
      if (!state.inCar && !state.inBike && dist < 2.2) {
        pu.collected = true; pu.group.visible = false;
        const wep = WEAPONS[pu.wepIndex];
        wep.reserve = Math.min(wep.reserve + pu.ammoGrant, wep.magSize * 8);
        if (state.currentWeaponIndex === pu.wepIndex && ui.reserve) ui.reserve.textContent = String(wep.reserve);
        showToast('PICKUP  ·  ' + wep.name + '  +' + pu.ammoGrant + ' AMMO');
      }
    }
    // Garage marker pulse
    garageRing.scale.setScalar(1 + Math.sin(state.time * 2.8) * 0.07);
    garageMarker.rotation.y += dt * 0.6;
    state.nearGarage = !state.inCar && !state.inBike && player.root.position.distanceTo(garageMarker.position) < 5.5;

    // Traffic
    for (const t of traffic) {
      t.root.position.z += t.speed * dt;
      if (t.root.position.z < -170) t.root.position.z = 170;
      if (t.root.position.z > 170) t.root.position.z = -170;
      t.wheelPivots.forEach((w) => { w.rotation.x += t.speed * dt * 1.6; });
      const hitDist = t.root.position.distanceTo(actor.position);
      if (hitDist < (state.inCar ? 2.9 : 1.8) && state.hitInvuln <= 0) {
        state.hitInvuln = 0; applyDamage(state.inCar ? 8 : 20);
        if (!state.inCar && !state.inBike) player.root.position.addScaledVector(player.direction, -2.5);
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
    if (state.robberyComplete && !state.escapeComplete && (state.inCar || state.inBike) && dist < 11) {
      state.escapeComplete = true; state.complete = true; state.wanted = 0; state.policeActive = false; policeCar.root.visible = false;
      rivals.forEach((rival) => { rival.active = false; rival.root.visible = false; });
      ui.objective.textContent = 'NEXORA CITY — YOU GOT OUT'; ui.pauseMission.textContent = 'COMPLETE'; ui.progress.style.width = '100%'; showToast('CLEAN GETAWAY  ·  ¢ 2,400 EARNED');
    }

    ui.health.style.width = `${state.health}%`; ui.healthValue.textContent = `${Math.round(state.health)}%`;
    ui.stamina.style.width = `${state.stamina}%`; ui.staminaValue.textContent = `${Math.round(state.stamina)}%`;

    // DAY / NIGHT & LIGHTING DYNAMICS
    const hourFloat = (21.8 + state.time / 72) % 24;
    const hour = Math.floor(hourFloat), min = Math.floor((hourFloat - hour) * 60);
    ui.clock.textContent = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const daylight = THREE.MathUtils.smoothstep(Math.sin((hourFloat - 6) * Math.PI / 12), 0, 1);
    sunMoon.intensity = 2.8 - daylight * 1.8;
    sunMoon.color.set(0x9bbef2).lerp(new THREE.Color(0xffd1a0), daylight * 0.7);
    warmFill.intensity = 0.35 + daylight * 1.15;
    scene.fog.density = 0.006 + (Math.sin(state.time * (Math.PI * 2 / 40)) * 0.5 + 0.5) * 0.005;
    scene.fog.color.set(0x111b26).lerp(new THREE.Color(0x81909a), daylight * 0.45);
    skyMaterial.color.set(0x7f91a6).lerp(new THREE.Color(0xffffff), daylight * 0.7);
    shared.windowLit.emissiveIntensity = 0.5 * (1 - daylight * 0.8);
    shared.windowWarm.emissiveIntensity = 0.42 * (1 - daylight * 0.75);

    // THUNDER & LIGHTNING STORMS
    if (state.time > state.nextThunder) {
      state.thunderFlash = 0.12;
      state.nextThunder = state.time + 20 + Math.random() * 35;
      lightningLight.intensity = 8.5;
      if (audioCtx) {
        try {
          const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
          osc.type = 'sawtooth'; osc.frequency.setValueAtTime(45, audioCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 1.2);
          g.gain.setValueAtTime(0.12, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);
          osc.connect(g); g.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 1.5);
        } catch {}
      }
    }
    if (state.thunderFlash > 0) {
      state.thunderFlash -= dt;
      if (state.thunderFlash <= 0) lightningLight.intensity = 0;
    }

    const activeWep = WEAPONS[state.currentWeaponIndex];
    ui.ammo.textContent = String(activeWep.ammo); ui.reserve.textContent = String(activeWep.reserve);
    ui.wanted.classList.toggle('show', state.wanted > 0);
    ui.wanted.querySelector('b').textContent = `${'★'.repeat(state.wanted)}${'☆'.repeat(5 - state.wanted)}`;
    if (state.toast > 0 && (state.toast -= dt) <= 0) ui.toast.classList.remove('show');
  }

  // COMBAT & ENEMY AI
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

    if (state.isFiring && !state.paused && !state.inCar && !state.inBike && wep.auto && state.fireCooldown <= 0) {
      fireWeapon();
    }

    if (player.weapon) {
      player.weapon.flashTime = Math.max(0, player.weapon.flashTime - dt);
      player.weapon.flash.visible = player.weapon.flashTime > 0;
      if (player.weapon.flash.visible) player.weapon.flash.scale.setScalar(0.7 + Math.random() * 0.75);
    }
    for (const rival of rivals) if (rival.weapon) {
      rival.weapon.flashTime = Math.max(0, rival.weapon.flashTime - dt);
      rival.weapon.flash.visible = rival.weapon.flashTime > 0;
    }

    for (let i = tracerEffects.length - 1; i >= 0; i--) {
      const effect = tracerEffects[i]; effect.life -= dt;
      effect.object.material.opacity = Math.max(0, effect.life / effect.max);
      if (effect.life <= 0) { scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); tracerEffects.splice(i, 1); }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const effect = particles[i]; effect.life -= dt; effect.object.position.addScaledVector(effect.velocity, dt); effect.velocity.y -= 7 * dt;
      effect.object.scale.multiplyScalar(Math.max(0.15, 1 - dt * 2.8));
      if (effect.life <= 0) { scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); particles.splice(i, 1); }
    }

    if (!state.robberyStarted || state.escapeComplete) return;
    const actor = state.inCar ? carModel.root : state.inBike ? bikeModel.root : player.root;

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
    const actor = state.inCar ? carModel.root : state.inBike ? bikeModel.root : player.root;
    const baseDist = state.inCar ? 10.5 : state.inBike ? 9.2 : state.isAiming ? 4.2 : 8.2;
    const horizontalDistance = baseDist * Math.cos(state.cameraPitch);
    const followHeight = baseDist * Math.sin(state.cameraPitch) + (state.isAiming ? 0.9 : 1.25);
    const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);

    cameraDesired.set(actor.position.x + sin * horizontalDistance, actor.position.y + followHeight, actor.position.z + cos * horizontalDistance);
    camera.position.lerp(cameraDesired, 1 - Math.exp(-dt * (state.isAiming ? 8.5 : 4.5)));
    cameraLookTarget.set(actor.position.x, actor.position.y + (state.inCar ? 1.1 : state.isAiming ? 1.4 : 1.25), actor.position.z);
    cameraLook.lerp(cameraLookTarget, 1 - Math.exp(-dt * 6.5)); camera.lookAt(cameraLook);
    playerRimLight.position.copy(player.root.position).add(new THREE.Vector3(-1.5, 2.5, 1.5));
  }

  function drawMinimap() {
    const c = $('#minimap'), g = c.getContext('2d'), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h); g.fillStyle = '#0a151d'; g.fillRect(0, 0, w, h);
    const scaleX = w / WORLD.w, scaleZ = h / WORLD.d;
    g.fillStyle = '#2b373c'; g.fillRect((120 - WORLD.roadW / 2) * scaleX, 0, WORLD.roadW * scaleX, h);
    g.fillRect(0, (WORLD.d / 2 - 12) * scaleZ, w, 18 * scaleZ);
    for (const b of buildings) {
      g.fillStyle = b.isVilla ? '#556a73' : '#3b4b51';
      g.fillRect((b.x - b.w / 2) * scaleX, (b.z + WORLD.d / 2 - b.d / 2) * scaleZ, b.w * scaleX, b.d * scaleZ);
    }
    // Garage on minimap
    g.fillStyle = '#3366ff'; g.shadowColor = '#3366ff'; g.shadowBlur = 7;
    g.beginPath(); g.arc(140 * scaleX, (68 + WORLD.d / 2) * scaleZ, 3, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    // Weapon pickups on minimap
    for (const pu of weaponPickups) if (!pu.collected) {
      g.fillStyle = '#ffcc00'; g.beginPath(); g.arc(pu.x * scaleX, (pu.z + WORLD.d / 2) * scaleZ, 2, 0, Math.PI * 2); g.fill();
    }
    if (state.ownedVilla) {
      g.fillStyle = '#44ff88'; g.shadowColor = '#44ff88'; g.shadowBlur = 5;
      g.beginPath(); g.arc(60 * scaleX, (48 + WORLD.d / 2) * scaleZ, 3, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    }
    g.fillStyle = '#ffb565'; g.shadowColor = '#ffb565'; g.shadowBlur = 9;
    g.beginPath(); g.arc(targetPosition.x * scaleX, (targetPosition.z + WORLD.d / 2) * scaleZ, 3.3, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    for (const rival of rivals) if (rival.active) { g.fillStyle = '#ff6871'; g.beginPath(); g.arc(rival.root.position.x * scaleX, (rival.root.position.z + WORLD.d / 2) * scaleZ, 2.4, 0, Math.PI * 2); g.fill(); }
    if (state.policeActive) { g.fillStyle = '#61aaff'; g.beginPath(); g.arc(policeCar.root.position.x * scaleX, (policeCar.root.position.z + WORLD.d / 2) * scaleZ, 3, 0, Math.PI * 2); g.fill(); }
    const actor = state.inCar ? carModel.root.position : state.inBike ? bikeModel.root.position : player.root.position;
    g.save(); g.translate(actor.x * scaleX, (actor.z + WORLD.d / 2) * scaleZ); g.rotate(-state.yaw);
    g.fillStyle = '#62ecdf'; g.shadowColor = '#62ecdf'; g.shadowBlur = 11; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(0, 2); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore(); g.shadowBlur = 0;
  }

  // ANIMATION & TICK
  // GARAGE UI
  function openGarageUI() {
    const existing = document.getElementById('garageModal');
    if (existing) { existing.remove(); return; }
    const modal = document.createElement('div'); modal.id = 'garageModal'; modal.className = 'garage-modal';
    modal.innerHTML = `
      <div class="garage-inner">
        <div class="garage-title">◈  VEHICLE GARAGE</div>
        <div class="garage-grid">
          <div class="garage-card" data-v="car">
            <div class="g-name">VELA GT</div><div class="g-type">HYBRID COUPE</div>
            <div class="g-stat">TOP: 220 KM/H</div><div class="g-btn">SPAWN</div>
          </div>
          <div class="garage-card" data-v="bike">
            <div class="g-name">NEXUS 900</div><div class="g-type">STREETFIGHTER</div>
            <div class="g-stat">TOP: 260 KM/H</div><div class="g-btn">SPAWN</div>
          </div>
          <div class="garage-card" data-v="suv">
            <div class="g-name">TITAN-X</div><div class="g-type">TACTICAL SUV</div>
            <div class="g-stat">TOP: 180 KM/H</div><div class="g-btn">SPAWN</div>
          </div>
          <div class="garage-card" data-v="truck">
            <div class="g-name">HAULER</div><div class="g-type">CARGO TRUCK</div>
            <div class="g-stat">TOP: 140 KM/H</div><div class="g-btn">SPAWN</div>
          </div>
        </div>
        <div class="garage-close">[ESC] CLOSE</div>
      </div>`;
    document.getElementById('shell').appendChild(modal);
    modal.querySelectorAll('.garage-card').forEach((card) => {
      card.addEventListener('click', () => {
        const v = card.getAttribute('data-v');
        const spawnPos = new THREE.Vector3(140, 0, 68);
        if (v === 'car') { carModel.root.position.copy(spawnPos); showToast('VELA GT  ·  SPAWNED AT GARAGE'); }
        else if (v === 'bike') { bikeModel.root.position.copy(spawnPos); showToast('NEXUS 900  ·  SPAWNED AT GARAGE'); }
        else if (v === 'suv') { suvModel.root.position.copy(spawnPos); showToast('TITAN-X  ·  SPAWNED AT GARAGE'); }
        else if (v === 'truck') { truckModel.root.position.copy(spawnPos); showToast('HAULER  ·  SPAWNED AT GARAGE'); }
        modal.remove();
      });
    });
    document.addEventListener('keydown', function escClose(e) {
      if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escClose); }
    });
  }

  // Load saved progress
  try {
    if (localStorage.getItem('nexora_villa') === '1') state.ownedVilla = true;
    const savedMoney = localStorage.getItem('nexora_money');
    if (savedMoney) state.money = parseInt(savedMoney, 10);
  } catch {}

  let mapTimer = 0;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.04);
    if (!state.paused) {
      state.time += dt; updatePlayer(dt); updateCombat(dt); updateCamera(dt);
      for (let i = 0; i < activeMixers.length; i++) activeMixers[i].update(dt);

      goalRing.scale.setScalar(1 + Math.sin(state.time * 3.2) * 0.08); marker.rotation.y += dt * 0.8; beam.material.opacity = 0.13 + (Math.sin(state.time * 2.1) + 1) * 0.055;

      const rainPos = rainGeo.attributes.position;
      for (let i = 0; i < rainCount; i++) {
        const n = i * 6;
        rainPos.array[n] += rainWindX * dt * 60; rainPos.array[n + 2] += rainWindZ * dt * 60;
        rainPos.array[n + 3] += rainWindX * dt * 60; rainPos.array[n + 5] += rainWindZ * dt * 60;
        if (rainPos.array[n] > 100) { rainPos.array[n] -= 200; rainPos.array[n + 3] -= 200; }
        if (rainPos.array[n + 2] > 95) { rainPos.array[n + 2] -= 190; rainPos.array[n + 5] -= 190; }
      }
      rainGeo.attributes.position.needsUpdate = true;
      rain.position.z = (rain.position.z + dt * 8) % 12;

      for (const splash of rainSplashParticles) {
        splash.userData.life += dt;
        if (splash.userData.life >= splash.userData.maxLife) {
          splash.userData.life = 0; splash.userData.maxLife = 0.4 + Math.random() * 0.3;
          splash.position.set(104 + Math.random() * 32, 0.012, -130 + Math.random() * 260);
          splash.scale.setScalar(1);
        } else {
          const t = splash.userData.life / splash.userData.maxLife;
          splash.scale.setScalar(1 + t * 2.5); splash.material.opacity = (1 - t) * 0.5;
        }
      }

      mapTimer += dt; if (mapTimer > 0.15) { drawMinimap(); mapTimer = 0; }
    }
    composer.render();
  }

  // INPUTS
  function onKeyDown(e) {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(key)) e.preventDefault();
    if (key === 'escape') { setPause(!state.paused); return; }
    if (key === 'tab' && !e.repeat) { openWW(); return; }
    if ((key === 'e' || key === 'f') && !e.repeat) { doInteract(); return; }
    if (key === 'r' && !e.repeat) { reloadWeapon(); return; }
    if (key === '1') { switchWeapon(0); return; }
    if (key === '2') { switchWeapon(1); return; }
    if (key === '3') { switchWeapon(2); return; }
    if (key === '4') { switchWeapon(3); return; }
    if (key === '5') { switchWeapon(4); return; }
    if (key === 'q' && !e.repeat) { switchWeapon((state.currentWeaponIndex + 1) % WEAPONS.length); return; }
    if (key === ' ' && !e.repeat && !state.inCar && !state.inBike) { state.hop = 0.48; player.bob.position.y = 0.03; }
    held.add(key);
  }
  function onKeyUp(e) { if (e.key.toLowerCase() === 'tab') { e.preventDefault(); if (state.weaponWheelOpen) closeWW(); return; } held.delete(e.key.toLowerCase()); }
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', () => { held.clear(); state.isFiring = false; state.isAiming = false; });

  const canvas = $('#world');
  canvas.addEventListener('pointerdown', (e) => {
    wakeAudio(); canvas.setPointerCapture(e.pointerId);
    if (e.button === 0) {
      state.isFiring = true; fireWeapon(); return;
    }
    if (e.button === 2) {
      state.mouseDown = true; state.isAiming = true;
      state.lastMouseX = e.clientX; state.lastMouseY = e.clientY;
      const curWep = WEAPONS[state.currentWeaponIndex];
      if (curWep.id === 'sniper' && ui.sniperScope) ui.sniperScope.classList.add('show');
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.button === 0) state.isFiring = false;
    if (e.button === 2) {
      state.mouseDown = false; state.isAiming = false;
      if (ui.sniperScope) ui.sniperScope.classList.remove('show');
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.mouseDown || state.paused) return;
    const dx = e.clientX - state.lastMouseX, dy = e.clientY - state.lastMouseY;
    state.lastMouseX = e.clientX; state.lastMouseY = e.clientY;
    const sens = state.isAiming ? 0.0022 : 0.0045;
    state.yaw -= dx * sens; state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch + dy * (sens * 0.35), 0.16, 0.55);
  });
  canvas.addEventListener('wheel', (e) => {
    camera.fov = THREE.MathUtils.clamp(camera.fov + Math.sign(e.deltaY) * 1.2, 40, 68);
    camera.updateProjectionMatrix();
  }, { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  ui.wepSlots.forEach((slot) => {
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(slot.getAttribute('data-wep') || '0', 10);
      switchWeapon(idx);
    });
  });

  // ── WEAPON WHEEL (Tab hold) ──
  const wwEl = document.getElementById('weaponWheel');
  const wwCenter = wwEl.querySelector('.ww-center');
  const wepIcons = ['🔫','⚡','⚔️','💥','🎯'];
  const wepAngles = [270, 342, 54, 126, 198]; // degrees for 5 slots evenly-ish around circle
  const radius = 110;
  const wwSlots = WEAPONS.map((wep, i) => {
    const slot = document.createElement('div'); slot.className = 'ww-slot' + (i === 0 ? ' active' : '');
    slot.innerHTML = `<span class="ww-key">${i+1}</span><span class="ww-wname">${wep.name}</span><span class="ww-wtype">${wep.type}</span>`;
    const angleRad = (wepAngles[i] - 90) * Math.PI / 180;
    const tx = Math.cos(angleRad) * radius - 45;
    const ty = Math.sin(angleRad) * radius - 30;
    slot.style.transform = `translate(${tx}px, ${ty}px)`;
    slot.style.borderTopColor = wep.dotColor;
    slot.addEventListener('mouseenter', () => { state.weaponWheelHovered = i; updateWWHighlight(); });
    slot.addEventListener('click', () => { switchWeapon(i); closeWW(); });
    wwCenter.appendChild(slot); return slot;
  });
  function updateWWHighlight() {
    wwSlots.forEach((s, i) => {
      s.classList.toggle('active', i === state.currentWeaponIndex);
      s.classList.toggle('hovered', i === state.weaponWheelHovered);
    });
    const hub = document.getElementById('wwHub');
    if (hub) hub.textContent = WEAPONS[state.weaponWheelHovered].name;
  }
  function openWW() {
    if (state.paused) return;
    state.weaponWheelOpen = true; wwEl.classList.add('show');
    state.weaponWheelHovered = state.currentWeaponIndex;
    updateWWHighlight();
  }
  function closeWW() {
    state.weaponWheelOpen = false; wwEl.classList.remove('show');
    if (state.weaponWheelHovered !== state.currentWeaponIndex) switchWeapon(state.weaponWheelHovered);
  }

  $('#resumeButton').addEventListener('click', () => setPause(false));

  let audioCtx, engineOsc, engineGain, engineFilter;
  function wakeAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    try {
      audioCtx = new AudioContext(); engineOsc = audioCtx.createOscillator(); engineGain = audioCtx.createGain(); engineFilter = audioCtx.createBiquadFilter();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 46; engineFilter.type = 'lowpass'; engineFilter.frequency.value = 115; engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(audioCtx.destination); engineOsc.start();
      const mix = () => {
        if (!audioCtx) return;
        const spd = state.inCar ? Math.abs(carModel.speed || 0) : state.inBike ? Math.abs(bikeModel.speed || 0) * 1.3 : 0;
        engineOsc.frequency.setTargetAtTime(45 + spd * 3.4, audioCtx.currentTime, 0.15);
        engineGain.gain.setTargetAtTime((state.inCar || state.inBike) ? 0.024 + spd * 0.0016 : 0, audioCtx.currentTime, 0.15);
        requestAnimationFrame(mix);
      };
      mix();
    } catch {}
  }
  addEventListener('keydown', wakeAudio, { once: true }); canvas.addEventListener('pointerdown', wakeAudio, { once: true });

  drawMinimap();
  camera.position.set(120, 5, 76); camera.lookAt(120, 1, 68);
  ui.toastText.textContent = 'AFTERLIGHT DISTRICT  ·  LIVE'; ui.toast.classList.add('show'); state.toast = 3.4;
  composer.render();
  animate();
  setTimeout(() => { ui.loading.classList.add('hidden'); }, 700);
})();
