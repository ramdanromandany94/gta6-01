// Traffic AI: mobil yang mengikuti jalan grid + pejalan kaki di trotoar.
// Mobil jalan di jalurnya; di persimpangan kadang belok. Pejalan kaki jalan
// lurus di trotoar lalu berbalik arah secara acak.
import * as THREE from 'three';
import { CFG, CAR_COLORS } from './config.js';
import { buildCarMesh, Car } from './vehicles.js';
import { buildPersonMesh } from './character.js';
import { pick, range } from './rng.js';

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
    this.spawnCars(10);
    this.spawnPeds(14);
  }

  spawnCars(n) {
    for (let i = 0; i < n; i++) this.addCar();
  }

  addCar() {
    const rng = this.rng;
    const horizontal = rng() < 0.5;
    const line = pick(rng, this.city.roadLines);
    const along = range(rng, -CFG.GRID * CFG.PITCH, CFG.GRID * CFG.PITCH);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = 3.5;
    const x = horizontal ? along : line + (dir > 0 ? lane : -lane);
    const z = horizontal ? line + (dir > 0 ? lane : -lane) : along;
    // heading: mobil menghadap arah jalan. forward = (sin h, cos h).
    const heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const mesh = buildCarMesh(pick(rng, CAR_COLORS));
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, heading);
    car.isTraffic = true;
    car.horizontal = horizontal;
    car.line = line;
    car.dir = dir;
    car.cruise = range(rng, 8, 13);
    this.cars.push(car);
    return car;
  }

  spawnPeds(n) {
    const palette = [0xe74c3c, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e];
    for (let i = 0; i < n; i++) {
      const p = this.city.randomSidewalkPos(this.rng);
      const mesh = buildPersonMesh(pick(this.rng, palette), 0x2c3e50, pick(this.rng, [0xc98a5e, 0x8a5a3a, 0xe8b88a]));
      mesh.position.set(p.x, 0, p.z);
      this.scene.add(mesh);
      this.peds.push({
        mesh, x: p.x, z: p.z,
        heading: this.rng() * Math.PI * 2,
        speed: range(this.rng, 1.2, 2.4),
        phase: this.rng() * 6,
        turnTimer: range(this.rng, 3, 9),
        dead: false,
      });
    }
  }

  update(dt, playerCar, playerPos) {
    // Mobil traffic: jalan lurus di jalur, belok acak di persimpangan.
    for (const car of this.cars) {
      if (car.dead) continue;
      // Rem kalau ada mobil/player di depan (cek kasar jarak).
      let slow = false;
      const f = car.forward();
      for (const other of this.cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x, dz = other.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * -f.z + dz * f.x);
        if (ahead > 0 && ahead < 9 && side < 2.4) { slow = true; break; }
      }
      if (playerCar && playerCar !== car) {
        const dx = playerCar.x - car.x, dz = playerCar.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * -f.z + dz * f.x);
        if (ahead > 0 && ahead < 10 && side < 2.6) slow = true;
      }
      const target = slow ? 0 : car.cruise;
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      // Persimpangan: peluang belok 90 derajat.
      const onIntersection = Math.abs(car.x - this.city.roadCoord(car.x)) < 1.2
        && Math.abs(car.z - this.city.roadCoord(car.z)) < 1.2;
      if (onIntersection && this.rng() < dt * 0.35) {
        const turn = this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.heading += turn;
        car.horizontal = !car.horizontal;
        car.line = car.horizontal ? this.city.roadCoord(car.z) : this.city.roadCoord(car.x);
        car.dir = Math.sin(car.heading) !== 0
          ? Math.sign(Math.sin(car.heading))
          : Math.sign(Math.cos(car.heading));
        // Snap ke jalur baru.
        if (car.horizontal) car.z = car.line + (car.dir > 0 ? 3.5 : -3.5);
        else car.x = car.line + (car.dir > 0 ? 3.5 : -3.5);
      }
      // Keluar kota -> teleport ke sisi lain.
      const lim = CFG.GRID * CFG.PITCH + 10;
      if (Math.abs(car.x) > lim || Math.abs(car.z) > lim) {
        this.scene.remove(car.mesh);
        const idx = this.cars.indexOf(car);
        this.cars.splice(idx, 1);
        this.addCar();
      } else {
        car.syncMesh();
      }
    }

    // Pejalan kaki.
    for (const ped of this.peds) {
      if (ped.dead) continue;
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.heading += (this.rng() - 0.5) * Math.PI;
        ped.turnTimer = range(this.rng, 4, 10);
      }
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      if (this.city.collideBuildings(ped.x, ped.z, 0.5) || Math.abs(ped.x) > this.city.half + 20 || Math.abs(ped.z) > this.city.half + 20) {
        ped.heading += Math.PI;
        ped.x += Math.sin(ped.heading) * ped.speed * dt * 2;
        ped.z += Math.cos(ped.heading) * ped.speed * dt * 2;
      }
      ped.phase += dt * 7;
      const sw = Math.sin(ped.phase) * 0.5;
      ped.mesh.userData.armL.rotation.x = sw;
      ped.mesh.userData.armR.rotation.x = -sw;
      ped.mesh.userData.legL.rotation.x = -sw;
      ped.mesh.userData.legR.rotation.x = sw;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  nearestPed(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
