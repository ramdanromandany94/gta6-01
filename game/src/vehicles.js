// Mobil prosedural (kotak + kabin + roda) + fisika mengemudi arcade.
// Dipakai untuk mobil player, traffic, dan polisi (warna/lampu beda).
import * as THREE from 'three';
import { CFG } from './config.js';

export function buildCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.25);
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.0), bodyMat);
  hood.position.set(0, 0.92, 1.55);
  g.add(hood);
  // Lampu depan/belakang.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), headMat);
    h.position.set(s * 0.62, 0.62, 2.22);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), tailMat);
    t.position.set(s * 0.62, 0.62, -2.22);
    g.add(t);
  }
  // Roda.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  if (opts.police) {
    // Lightbar polisi merah-biru + tulisan sederhana via kotak putih.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.45, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.3, 1.5, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.3, 1.5, -0.25);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  g.traverse((o) => { o.castShadow = false; });
  return g;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading; // radian, 0 = ke -Z? pakai sin/cos konsisten
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.dead = false;
    this.skidding = false;
    this.syncMesh();
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const wob = this.speed * 0.06;
    for (const w of this.mesh.userData.wheels || []) w.rotation.x += wob;
  }

  // Fisika arcade: gas, rem, belok makin sulit di kecepatan tinggi.
  drive(dt, throttle, steerInput, handbrake, city) {
    const maxF = throttle > 0 ? CFG.CAR_MAX_SPEED : CFG.CAR_REVERSE_MAX;
    if (throttle !== 0) {
      this.speed += throttle * CFG.CAR_ACCEL * dt;
      if (this.speed > maxF) this.speed = maxF;
      if (this.speed < -CFG.CAR_REVERSE_MAX) this.speed = -CFG.CAR_REVERSE_MAX;
    } else {
      // Gesekan.
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 14 * dt);
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    if (throttle < 0 && this.speed > 0.5) {
      this.speed -= CFG.CAR_BRAKE * dt; // rem
    }
    if (handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 40 * dt);
    const steerTarget = steerInput * CFG.CAR_TURN * Math.min(1, Math.abs(this.speed) / 8 + 0.25);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    this.heading += this.steer * dt * Math.sign(this.speed || 1) * (this.speed >= 0 ? 1 : -1);
    const f = this.forward();
    const nx = this.x + f.x * this.speed * dt;
    const nz = this.z + f.z * this.speed * dt;
    // Tabrakan gedung: geser kembali & kurangi kecepatan.
    const hit = city.collideBuildings(nx, nz, 1.6);
    if (hit) {
      const pushX = nx - hit.x, pushZ = nz - hit.z;
      if (Math.abs(pushX) / (hit.hw + 1.6) > Math.abs(pushZ) / (hit.hd + 1.6)) {
        this.x = hit.x + Math.sign(pushX) * (hit.hw + 1.7);
      } else {
        this.z = hit.z + Math.sign(pushZ) * (hit.hd + 1.7);
      }
      if (Math.abs(this.speed) > 8) this.health -= 4;
      this.speed *= 0.35;
    } else {
      const c = city.clampToCity(nx, nz, 8);
      this.x = c.x; this.z = c.z;
    }
    this.skidding = handbrake && Math.abs(this.speed) > 8;
    this.syncMesh();
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
    return this.dead;
  }
}
