// Misi + cerita: 3 misi berurutan dengan objektif, dialog, dan progres.
// Marker 3D (silinder cahaya + panah melayang) menandai tujuan; progres
// disimpan ke localStorage oleh main.js.
import * as THREE from 'three';
import { CFG, MISSION_DEFS } from './config.js';

export class Missions {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.completed = 0; // misi selesai (0-3)
    this.active = null; // {def, stepIdx, target, chaseCar}
    this.dialog = '';
    this.dialogTimer = 0;
    this.marker = this.makeMarker();
    this.marker.visible = false;
    this.arrow = this.makeArrow();
    this.arrow.visible = false;
    // Lokasi penting (ditentukan dari kota).
    this.spots = {
      pickup: { x: 29, z: 65 }, // trotoar di pinggir jalan z=58 (gang Merak)
      dropoff: { x: 0, z: CFG.GRID * CFG.PITCH + 26 }, // dermaga selatan
      hideout: { x: 0, z: -CFG.GRID * CFG.PITCH - 26 }, // utara
    };
  }

  makeMarker() {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 9, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    cyl.position.y = 4.5;
    g.add(cyl);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    this.scene.add(g);
    return g;
  }

  makeArrow() {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.8, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    cone.rotation.x = Math.PI; // ujung ke bawah
    this.scene.add(cone);
    return cone;
  }

  say(text, seconds = 5) {
    this.dialog = text;
    this.dialogTimer = seconds;
  }

  startMission(idx, ctx) {
    const def = MISSION_DEFS[idx];
    this.active = { def, stepIdx: 0, chaseCar: null };
    this.say(def.intro, 6);
    this.setupStep(ctx);
  }

  setupStep(ctx) {
    const step = this.active.def.steps[this.active.stepIdx];
    if (!step) { this.finishMission(ctx); return; }
    if (step.type === 'goto') {
      this.active.target = { ...this.spots[step.at] };
    } else if (step.type === 'chase') {
      // Target: mobil yang kabur di jalan, dikejar sampai hancur/berhenti.
      const car = ctx.spawnTargetCar();
      this.active.chaseCar = car;
      this.active.target = car;
    } else if (step.type === 'escape') {
      this.active.target = { ...this.spots[step.at] };
      ctx.police.addCrime(3); // langsung 3 bintang
      this.say('Polisi mengejarmu! Kabur ke tempat persembunyian!', 5);
    }
    this.updateMarker();
  }

  updateMarker() {
    const t = this.active?.target;
    if (!t) { this.marker.visible = false; this.arrow.visible = false; return; }
    this.marker.visible = true;
    this.arrow.visible = true;
    this.marker.position.set(t.x, 0, t.z);
    this.arrow.position.set(t.x, 8 + Math.sin(performance.now() / 300) * 0.5, t.z);
  }

  currentLabel() {
    if (!this.active) {
      if (this.completed >= MISSION_DEFS.length) return 'Semua misi selesai! Solmar Bay milikmu.';
      return 'Tekan M untuk memulai misi berikutnya';
    }
    return this.active.def.steps[this.active.stepIdx].label;
  }

  update(dt, ctx) {
    if (this.dialogTimer > 0) this.dialogTimer -= dt;
    if (!this.active) return;
    const step = this.active.def.steps[this.active.stepIdx];
    const p = ctx.playerPos;
    if (step.type === 'goto' || step.type === 'escape') {
      const t = this.active.target;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      this.updateMarker();
      if (d < 5) {
        if (step.type === 'escape') {
          ctx.police.clear();
          this.advance(ctx);
        } else if (this.active.stepIdx === 0 && this.active.def.id === 1) {
          ctx.audio.pickup();
          this.say('Paket diambil. Sekarang antar ke Dermaga Selatan!', 4);
          this.advance(ctx);
        } else {
          this.advance(ctx);
        }
      }
    } else if (step.type === 'chase') {
      const car = this.active.chaseCar;
      if (!car) return;
      this.active.target = car;
      this.updateMarker();
      if (car.dead || car.speed < 0.5 && car.health <= 20) {
        this.say('Target dihentikan!', 3);
        this.advance(ctx);
      }
    }
  }

  advance(ctx) {
    this.active.stepIdx += 1;
    if (this.active.stepIdx >= this.active.def.steps.length) {
      this.finishMission(ctx);
    } else {
      this.setupStep(ctx);
    }
  }

  finishMission(ctx) {
    const def = this.active.def;
    const reward = CFG.MISSION_REWARDS[def.id - 1];
    ctx.player.money += reward;
    this.completed = def.id;
    this.say(def.outro + ` (+$${reward})`, 6);
    ctx.audio.missionDone();
    ctx.onMissionComplete?.(def.id, reward);
    this.active = null;
    this.marker.visible = false;
    this.arrow.visible = false;
  }
}
