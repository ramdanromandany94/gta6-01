// Efek visual: partikel (debu, asap, percikan), muzzle flash, dan jejak ban.
// Semua pakai mesh kecil yang di-pool, tanpa tekstur eksternal.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.skids = [];
    this.flash = null;
    this.flashTimer = 0;
    // Pool partikel: 120 kotak kecil.
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < 120; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false;
      scene.add(m);
      this.particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
    }
    // Muzzle flash: bola cahaya kuning di ujung pistol.
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0 }),
    );
    scene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc860, 0, 9);
    scene.add(this.flashLight);
    // Jejak ban: pool 60 quad gelap di tanah.
    const skidGeo = new THREE.PlaneGeometry(0.5, 1.1);
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0.55 }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.skids.push({ mesh: m, life: 0 });
    }
    this._skidIdx = 0;
  }

  burst(x, y, z, color, n, speed, up = 2) {
    let made = 0;
    for (const p of this.particles) {
      if (made >= n) break;
      if (p.life > 0) continue;
      made++;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = Math.random() * up;
      p.life = p.max = 0.4 + Math.random() * 0.5;
    }
  }

  muzzle(x, y, z) {
    this.flash.position.set(x, y, z);
    this.flash.material.opacity = 1;
    this.flash.scale.setScalar(1.4);
    this.flashLight.position.set(x, y, z);
    this.flashLight.intensity = 6;
    this.flashTimer = 0.06;
  }

  skid(x, z, heading) {
    const s = this.skids[this._skidIdx];
    this._skidIdx = (this._skidIdx + 1) % this.skids.length;
    s.mesh.visible = true;
    s.mesh.position.set(x, 0.03, z);
    s.mesh.rotation.z = -heading;
    s.life = 6;
  }

  update(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 6 * dt;
      p.mesh.material.opacity = Math.max(0, p.life / p.max);
      p.mesh.rotation.x += dt * 5;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flash.material.opacity = 0;
        this.flashLight.intensity = 0;
      }
    }
    for (const s of this.skids) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
}
