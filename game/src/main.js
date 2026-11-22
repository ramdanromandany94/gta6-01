// VICE SUNSET — Solmar Bay. Orkestrator: renderer, kamera third-person,
// state (menu/playing/paused/wasted), masuk-keluar mobil, combat, misi,
// save/load, dan mode screenshot deterministik (?shot=cover|foot|chase|mission).
import * as THREE from 'three';
import { CFG, CAR_COLORS } from './config.js';
import { mulberry32, pick, range } from './rng.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { City } from './city.js';
import { Player } from './character.js';
import { buildCarMesh, Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // null | cover | foot | chase | mission
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const rng = mulberry32(SEED);

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 8, 30);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const city = new City(scene, rng);
const input = new Input(canvas);
input.shotMode = !!SHOT;
const audio = new AudioSys();
const effects = new Effects(scene);
const traffic = new Traffic(scene, city, rng);
const police = new Police(scene, city, rng, audio);
const missions = new Missions(scene, city, rng);
const hud = new HUD(city);
const player = new Player(scene, city);

const clock = new THREE.Clock();
let state = 'menu'; // menu | playing | paused | wasted
let camYawOffset = 0;
let camHeading = Math.PI;
let fireCooldown = 0;
let reloadTimer = 0;
let ramCooldown = 0;
let hitCooldown = 0;
let saveTimer = 0;
let framesRendered = 0;
let shotReadyTimer = 0;
const raycaster = new THREE.Raycaster();
const parkedCars = [];
let targetCar = null;
let autopilot = false;

// ---- Save / load ----
function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.money === 'number') player.money = s.money;
    if (typeof s.completed === 'number') missions.completed = Math.min(3, s.completed);
  } catch { /* save rusak -> mulai baru */ }
}
function saveGame() {
  try {
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({
      money: player.money,
      completed: missions.completed,
    }));
  } catch { /* storage penuh/diblokir -> abaikan */ }
}
loadSave();

// ---- Mobil milik player (parkir di dekat spawn) ----
function spawnOwnCar() {
  const mesh = buildCarMesh(0x2980b9);
  scene.add(mesh);
  const car = new Car(mesh, 4, 26, Math.PI / 2);
  car.isOwn = true;
  parkedCars.push(car);
  return car;
}
spawnOwnCar();

function spawnTargetCar() {
  const p = city.randomRoadPos(rng);
  const mesh = buildCarMesh(0xc0392b);
  scene.add(mesh);
  const car = new Car(mesh, p.x, p.z, rng() * Math.PI * 2);
  car.isTarget = true;
  targetCar = car;
  return car;
}

// ---- Masuk / keluar mobil ----
function nearestEnterableCar() {
  let best = null, bd = 4.5;
  const check = (c) => {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bd) { bd = d; best = c; }
  };
  for (const c of traffic.cars) if (!c.dead) check(c);
  for (const c of parkedCars) if (!c.dead) check(c);
  for (const c of police.cars) if (!c.dead) check(c);
  if (targetCar && !targetCar.dead) check(targetCar);
  return best;
}

function enterCar(car) {
  if (car.isTraffic) {
    traffic.cars.splice(traffic.cars.indexOf(car), 1);
    police.addCrime(1);
    hud.toast('Mobil dicuri! Polisi mengejarmu (+1 ★)');
  } else if (car.isPolice) {
    police.cars.splice(police.cars.indexOf(car), 1);
    police.addCrime(2);
    hud.toast('Kau mencuri mobil polisi! (+2 ★)');
  } else if (car.isTarget) {
    hud.toast('Itu mobil target — jangan dicuri, hentikan dia!');
    return;
  }
  player.inCar = car;
  player.mesh.visible = false;
  camHeading = car.heading;
  audio.click();
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  const f = car.forward();
  // Turun di sisi kiri mobil.
  player.x = car.x - f.z * 2.2;
  player.z = car.z + f.x * 2.2;
  player.heading = car.heading;
  player.inCar = null;
  player.mesh.visible = true;
  player.yaw = car.heading + Math.PI;
  player.syncMesh();
  if (!parkedCars.includes(car)) parkedCars.push(car);
  audio.click();
}

// ---- Combat ----
function shootables() {
  const list = [];
  for (const c of traffic.cars) if (!c.dead) list.push(c.mesh);
  for (const c of police.cars) if (!c.dead) list.push(c.mesh);
  for (const p of traffic.peds) if (!p.dead) list.push(p.mesh);
  if (targetCar && !targetCar.dead) list.push(targetCar.mesh);
  return list;
}

function shoot() {
  if (fireCooldown > 0 || reloadTimer > 0 || player.ammo <= 0) return;
  fireCooldown = 0.18;
  player.ammo -= 1;
  audio.shot();
  // Muzzle flash di ujung pistol.
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  effects.muzzle(player.x + fx * 0.9, 1.35, player.z + fz * 0.9);
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = 90;
  const hits = raycaster.intersectObjects(shootables(), true);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && !obj.userData.owner) obj = obj.parent;
  // Owner dicari lewat parent chain; kalau tidak ada, pakai pemetaan posisi.
  const hit = hits[0];
  const target = findOwner(hit.object);
  if (!target) return;
  effects.burst(hit.point.x, hit.point.y, hit.point.z, 0xffd23e, 6, 3, 1.5);
  if (target.kind === 'car') {
    const dead = target.ref.damage(34);
    if (dead) {
      effects.burst(target.ref.x, 1, target.ref.z, 0xff6a00, 24, 6, 5);
      audio.crash();
      if (target.ref.isPolice) police.addCrime(1);
      if (target.ref.isTarget) hud.toast('Mobil target hancur!');
    }
  } else if (target.kind === 'ped') {
    killPed(target.ref);
  }
}

function findOwner(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.owner) return o.userData.owner;
    o = o.parent;
  }
  return null;
}

// Tandai owner di group mobil/pejalan kaki (dipanggil sekali setelah spawn).
function tagOwners() {
  for (const c of traffic.cars) c.mesh.userData.owner = { kind: 'car', ref: c };
  for (const c of police.cars) c.mesh.userData.owner = { kind: 'car', ref: c };
  for (const p of traffic.peds) p.mesh.userData.owner = { kind: 'ped', ref: p };
  if (targetCar) targetCar.mesh.userData.owner = { kind: 'car', ref: targetCar };
  for (const c of parkedCars) c.mesh.userData.owner = { kind: 'car', ref: c };
}

function killPed(ped) {
  if (ped.dead) return;
  ped.dead = true;
  ped.mesh.rotation.x = -Math.PI / 2;
  ped.mesh.position.y = 0.25;
  police.addCrime(1);
  effects.burst(ped.x, 1, ped.z, 0xc0392b, 10, 3, 2);
}

function punch() {
  audio.punch();
  const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
  // Pejalan kaki di depan.
  const ped = traffic.nearestPed(player.x + fx * 1.4, player.z + fz * 1.4, 1.6);
  if (ped) { killPed(ped); hud.toast('Kau memukul pejalan kaki! (+1 ★)'); return; }
  const car = traffic.nearestCar(player.x + fx * 1.6, player.z + fz * 1.6, 2.2);
  if (car) {
    car.damage(10);
    effects.burst(car.x, 1, car.z, 0xaaaaaa, 5, 2, 1);
  }
}

// ---- Wasted / respawn ----
function wasted() {
  state = 'wasted';
  audio.wasted();
  audio.setEngine(0, false);
  player.money = Math.max(0, player.money - 50);
  document.getElementById('wasted-screen').style.display = 'flex';
  saveGame();
}

function respawn() {
  player.health = CFG.PLAYER_HEALTH;
  player.x = 0; player.z = 20;
  player.yaw = Math.PI;
  if (player.inCar) { player.inCar = null; player.mesh.visible = true; }
  player.syncMesh();
  police.clear();
  document.getElementById('wasted-screen').style.display = 'none';
  state = 'playing';
  hud.toast('Kau bangkit lagi di Solmar Bay.');
}

// ---- Kamera third-person ----
function updateCamera(dt) {
  let targetPos, lookAt;
  if (player.inCar) {
    const car = player.inCar;
    const { dx } = input.consumeMouse();
    camYawOffset += dx * 0.002;
    camYawOffset *= Math.max(0, 1 - dt * 1.2);
    // Kamera mengejar heading mobil dengan smoothing.
    let dh = car.heading - camHeading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    camHeading += dh * Math.min(1, dt * 3.2);
    const h = camHeading + camYawOffset;
    const bx = -Math.sin(h), bz = -Math.cos(h);
    const dist = 10.5, height = 3.8;
    targetPos = new THREE.Vector3(car.x + bx * dist, height, car.z + bz * dist);
    lookAt = new THREE.Vector3(car.x - bx * 4, 1.4, car.z - bz * 4);
  } else {
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const dist = 7.5, height = 3.1;
    targetPos = new THREE.Vector3(player.x - fx * dist, height, player.z - fz * dist);
    lookAt = new THREE.Vector3(player.x + fx * 2.5, 1.5, player.z + fz * 2.5);
  }
  // Jangan biarkan kamera masuk gedung: naikkan kalau terhalang.
  const hit = city.collideBuildings(targetPos.x, targetPos.z, 1);
  if (hit) targetPos.y = Math.max(targetPos.y, hit.h + 2);
  camera.position.lerp(targetPos, Math.min(1, dt * 8));
  camera.lookAt(lookAt);
}

// ---- Mode screenshot deterministik ----
function setupShot() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('start-screen').style.display = 'none';
  state = 'playing';
  if (SHOT === 'cover') {
    const car = parkedCars[0];
    enterCar(car);
    car.x = -140; car.z = 3.5; car.heading = Math.PI / 2; car.speed = 18;
    car.syncMesh();
    autopilot = true;
    hud.toast('');
  } else if (SHOT === 'foot') {
    // Jalan kaki di jalan z=0 menghadap barat (sunset), kamera di belakang.
    player.x = -2; player.z = 0; player.yaw = Math.PI / 2;
    player.syncMesh();
    // Pejalan kaki ramai di sekitar.
    for (let i = 0; i < 6; i++) {
      const p = traffic.peds[i];
      if (p) { p.x = -14 + i * 5; p.z = (i % 2 === 0 ? -1 : 1) * (5 + (i % 3)); }
    }
    missions.say('Rico: "Yo, Kai! Paket ini harus sampai ke dermaga sebelum gelap."', 30);
  } else if (SHOT === 'chase') {
    const car = parkedCars[0];
    enterCar(car);
    car.x = -60; car.z = 3.5; car.heading = Math.PI / 2; car.speed = 22;
    car.syncMesh();
    police.addCrime(3);
    autopilot = true;
  } else if (SHOT === 'mission') {
    missions.completed = 0;
    missions.startMission(0, missionCtx());
    const car = parkedCars[0];
    enterCar(car);
    // Di jalan z=58 (jalur 61.5), menghadap timur ke arah marker pickup (29,65).
    car.x = -30; car.z = 61.5; car.heading = Math.PI / 2; car.speed = 0;
    car.syncMesh();
    autopilot = false;
    player.yaw = Math.PI / 2;
  }
  tagOwners();
}

function missionCtx() {
  return {
    spawnTargetCar,
    police,
    audio,
    player,
    playerPos: player,
    onMissionComplete: (id, reward) => {
      hud.toast(`Misi ${id} selesai! +$${reward}`);
      saveGame();
    },
  };
}

// ---- Loop utama ----
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  framesRendered++;

  if (state === 'playing') {
    // Input sekali-tekan.
    if (input.pressed('KeyM')) {
      if (!missions.active && missions.completed < 3) {
        missions.startMission(missions.completed, missionCtx());
      } else if (missions.active) {
        hud.toast('Misi sedang berjalan: ' + missions.currentLabel());
      } else {
        hud.toast('Semua misi selesai!');
      }
    }
    if (input.pressed('KeyP') || input.pressed('Escape')) pauseGame();
    if (input.pressed('Digit1')) { player.weapon = 'fist'; player.syncMesh(); }
    if (input.pressed('Digit2')) { player.weapon = 'pistol'; player.syncMesh(); }
    if (input.pressed('KeyR') && player.weapon === 'pistol' && reloadTimer <= 0) {
      reloadTimer = 0.8; audio.click();
    }
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) player.ammo = 12;
    }
    if (fireCooldown > 0) fireCooldown -= dt;
    if (ramCooldown > 0) ramCooldown -= dt;
    if (hitCooldown > 0) hitCooldown -= dt;

    if (player.inCar) {
      const car = player.inCar;
      const ax = input.axis();
      let throttle = 0, steer = 0;
      if (autopilot) {
        // Shot mode: jalan lurus di jalurnya.
        throttle = 1;
        const laneZ = 3.5;
        steer = Math.max(-0.4, Math.min(0.4, (laneZ - car.z) * 0.05));
        if (car.x > 150) { car.heading = -Math.PI / 2; car.x = 150; }
      } else {
        throttle = ax.y;
        steer = -ax.x;
      }
      const handbrake = input.down('Space');
      car.drive(dt, throttle, steer, handbrake, city);
      audio.setEngine(Math.abs(car.speed) / CFG.CAR_MAX_SPEED, true);
      if (input.pressed('KeyE')) exitCar();
      // Jejak ban saat skid.
      if (car.skidding) {
        const f = car.forward();
        effects.skid(car.x - f.x * 1.4 - f.z * 0.9, car.z - f.z * 1.4 + f.x * 0.9, car.heading);
        effects.skid(car.x - f.x * 1.4 + f.z * 0.9, car.z - f.z * 1.4 - f.x * 0.9, car.heading);
      }
      // Tabrak pejalan kaki.
      for (const ped of traffic.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.1 && Math.abs(car.speed) > 5) {
          killPed(ped);
          audio.crash();
          effects.burst(ped.x, 1, ped.z, 0x888888, 8, 3, 2);
        }
      }
      // Tabrak mobil traffic.
      for (const other of traffic.cars) {
        if (other.dead) continue;
        if (Math.hypot(other.x - car.x, other.z - car.z) < 3.4) {
          other.damage(12);
          car.damage(4);
          car.speed *= 0.6;
          audio.crash();
          effects.burst(other.x, 1, other.z, 0xaaaaaa, 8, 3, 2);
        }
      }
      // Tabrak mobil target (misi 2).
      if (targetCar && !targetCar.dead && hitCooldown <= 0) {
        if (Math.hypot(targetCar.x - car.x, targetCar.z - car.z) < 3.6) {
          targetCar.damage(20);
          car.speed *= 0.7;
          hitCooldown = 0.4;
          audio.crash();
        }
      }
      // Mobil hancur -> keluar paksa.
      if (car.dead) {
        effects.burst(car.x, 1, car.z, 0xff6a00, 30, 7, 6);
        audio.crash();
        exitCar();
        player.damage(20);
      }
    } else {
      player.update(dt, input, police.wanted);
      audio.setEngine(0, false);
      if (input.pressed('KeyE')) {
        const car = nearestEnterableCar();
        if (car) enterCar(car);
      }
      if (input.pressed('KeyF')) punch();
      if (input.consumeClick() && player.weapon === 'pistol') shoot();
      // Polisi menabrak player jalan kaki.
      if (ramCooldown <= 0) {
        for (const pc of police.cars) {
          if (Math.hypot(pc.x - player.x, pc.z - player.z) < 2.6) {
            if (player.damage(12)) { wasted(); break; }
            ramCooldown = 0.9;
            audio.crash();
            break;
          }
        }
      }
    }

    // Traffic & pejalan kaki.
    traffic.update(dt, player.inCar, player);
    // Polisi mengejar.
    police.update(dt, player, player.inCar, (pc) => {
      if (ramCooldown > 0) return;
      ramCooldown = 0.9;
      audio.crash();
      if (player.inCar) {
        player.inCar.damage(6);
        if (player.damage(3)) wasted();
        effects.burst(pc.x, 1, pc.z, 0xaaaaaa, 8, 3, 2);
      }
    });
    // Mobil target kabur (misi 2).
    if (targetCar && !targetCar.dead && missions.active?.def.id === 2) {
      const dx = targetCar.x - player.x, dz = targetCar.z - player.z;
      const away = Math.atan2(dx, dz);
      let dh = away - targetCar.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      targetCar.heading += Math.max(-1.8 * dt, Math.min(1.8 * dt, dh));
      targetCar.speed += (19 - targetCar.speed) * Math.min(1, dt);
      const f = targetCar.forward();
      const nx = targetCar.x + f.x * targetCar.speed * dt;
      const nz = targetCar.z + f.z * targetCar.speed * dt;
      if (city.collideBuildings(nx, nz, 1.6)) {
        targetCar.heading += Math.PI / 2;
      } else {
        targetCar.x = nx; targetCar.z = nz;
      }
      targetCar.syncMesh();
    }
    // Misi.
    missions.update(dt, missionCtx());
    tagOwners();
    effects.update(dt);
    audio.update(dt);

    // HUD.
    const marker = missions.active?.target;
    hud.update(dt, {
      health: player.health,
      money: player.money,
      wanted: police.wanted,
      objective: missions.currentLabel(),
      dialog: missions.dialog,
      dialogTimer: missions.dialogTimer,
      speedKmh: player.inCar ? Math.abs(player.inCar.speed) * 3.6 : 0,
      inCar: !!player.inCar,
      weapon: player.weapon,
      ammo: player.ammo,
      player,
      cars: traffic.cars.filter((c) => !c.dead),
      polices: police.cars,
      peds: traffic.peds,
      marker: marker && !marker.isTarget ? marker : (marker || null),
    });

    // Autosave berkala.
    saveTimer += dt;
    if (saveTimer > 15) { saveTimer = 0; saveGame(); }

    // Shot mode: tandai siap setelah beberapa frame.
    if (SHOT && framesRendered > 45) {
      window.__shotReady = true;
    }
    updateCamera(dt);
  }

  renderer.render(scene, camera);
}

// ---- UI: start / pause / wasted ----
document.getElementById('start-btn').addEventListener('click', () => {
  audio.ensure();
  audio.click();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  state = 'playing';
  canvas.requestPointerLock?.();
  if (!missions.active && missions.completed < 3) {
    missions.say('Rico: "Tekan M untuk mulai misi pertamamu, Kai."', 6);
  }
});
document.getElementById('resume-btn').addEventListener('click', () => {
  document.getElementById('pause-screen').style.display = 'none';
  state = 'playing';
  canvas.requestPointerLock?.();
});
document.getElementById('respawn-btn').addEventListener('click', respawn);

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  document.getElementById('pause-screen').style.display = 'flex';
  document.exitPointerLock?.();
  audio.setEngine(0, false);
  audio.setSiren(false);
  saveGame();
}
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing' && !SHOT) pauseGame();
});

// ---- Boot ----
document.getElementById('loading').style.display = 'none';
if (SHOT) {
  setupShot();
} else {
  document.getElementById('start-screen').style.display = 'flex';
}
tagOwners();
animate();

// Handle untuk play-test headless.
window.__VICE = {
  get state() { return state; },
  player, police, missions, traffic, city,
  enterCar, exitCar, shoot, punch, wasted, respawn,
  get targetCar() { return targetCar; },
  spawnTargetCar,
  saveGame,
};
