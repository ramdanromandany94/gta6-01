// Karakter pejalan kaki prosedural (kotak-kotak) + kontrol third-person.
// Dipakai untuk player dan pejalan kaki AI (warna baju beda).
import * as THREE from 'three';
import { CFG } from './config.js';

export function buildPersonMesh(shirt, pants, skin = 0xc98a5e) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skinMat);
  head.position.y = 1.74;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), hairMat);
  hair.position.y = 1.94;
  g.add(hair);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.16), shirtMat);
  armL.position.set(-0.42, 1.2, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.22), pantsMat);
  legL.position.set(-0.16, 0.42, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  // Pistol di tangan kanan (disembunyikan kalau tidak bersenjata).
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 }));
  gun.position.set(0.42, 0.92, 0.18);
  gun.visible = false;
  g.add(gun);

  g.userData = { torso, head, armL, armR, legL, legR, gun };
  return g;
}

export class Player {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.mesh = buildPersonMesh(0x2e86c1, 0x2c3e50);
    this.scene.add(this.mesh);
    this.x = 0; this.z = 20;
    this.heading = Math.PI; // menghadap -Z? disesuaikan kamera
    this.yaw = 0; // arah kamera
    this.health = CFG.PLAYER_HEALTH;
    this.money = 120;
    this.weapon = 'fist'; // 'fist' | 'pistol'
    this.ammo = 12;
    this.inCar = null;
    this.walkPhase = 0;
    this.moving = false;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.userData.gun.visible = this.weapon === 'pistol' && !this.inCar;
  }

  update(dt, input, wanted) {
    if (this.inCar) return; // mobil yang menggerakkan player
    const { dx, dy } = input.consumeMouse();
    this.yaw -= dx * 0.0032;
    const ax = input.axis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
    // Gerak relatif terhadap arah kamera (yaw).
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (ax.x !== 0 || ax.y !== 0) {
      // Kamera di belakang player: maju = arah yaw.
      const fx = -sin, fz = -cos; // forward
      const rx = -cos, rz = sin; // right
      mx = fx * ax.y + rx * ax.x;
      mz = fz * ax.y + rz * ax.x;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      this.heading = Math.atan2(mx, mz);
      this.moving = true;
      this.walkPhase += dt * (sprint ? 13 : 9);
    } else {
      this.moving = false;
    }
    const nx = this.x + mx * speed * dt;
    const nz = this.z + mz * speed * dt;
    if (!this.city.collideBuildings(nx, nz, 0.6)) {
      const c = this.city.clampToCity(nx, nz, 4);
      this.x = c.x; this.z = c.z;
    }
    // Animasi jalan: ayun lengan & kaki.
    const sw = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.armL.rotation.x = sw;
    u.armR.rotation.x = -sw;
    u.legL.rotation.x = -sw;
    u.legR.rotation.x = sw;
    this.syncMesh();
  }

  damage(amount) {
    this.health -= amount;
    if (this.health < 0) this.health = 0;
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(CFG.PLAYER_HEALTH, this.health + amount);
  }
}
