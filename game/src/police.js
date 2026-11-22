// Wanted level + polisi. Bintang naik saat kejahatan, turun perlahan saat
// tenang. Mobil polisi spawn sesuai bintang dan mengejar/menabrak player.
import { CFG, CAR_COLORS } from './config.js';
import { buildCarMesh, Car } from './vehicles.js';
import { pick } from './rng.js';

export class Police {
  constructor(scene, city, rng, audio) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.audio = audio;
    this.wanted = 0;
    this.cars = [];
    this.decayTimer = 0;
    this.flashTimer = 0;
  }

  addCrime(stars) {
    this.wanted = Math.min(CFG.MAX_WANTED, this.wanted + stars);
    this.decayTimer = CFG.WANTED_DECAY_SECONDS;
  }

  clear() {
    this.wanted = 0;
    this.decayTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
  }

  wantedCount() { return this.wanted; }

  update(dt, playerPos, playerCar, onRam) {
    // Decay saat tenang.
    if (this.wanted > 0) {
      this.decayTimer -= dt;
      if (this.decayTimer <= 0) {
        this.wanted -= 1;
        this.decayTimer = CFG.WANTED_DECAY_SECONDS;
      }
    }
    // Jumlah polisi = bintang (maks 4 di jalan).
    const want = Math.min(this.wanted, 4);
    while (this.cars.length < want) this.spawnNear(playerPos);
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    // Sirene menyala kalau ada polisi.
    this.audio.setSiren(this.cars.length > 0);

    // Kejar player: setir ke arah player, tabrak kalau dekat.
    for (const car of this.cars) {
      const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const speed = Math.min(26 + this.wanted * 1.5, 30);
      car.speed += (speed - car.speed) * Math.min(1, dt);
      const f = car.forward();
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      if (this.city.collideBuildings(car.x, car.z, 1.6)) {
        // Mundur sedikit & belok supaya tidak nyangkut di gedung.
        car.x -= f.x * car.speed * dt * 2;
        car.z -= f.z * car.speed * dt * 2;
        car.heading += 0.9;
        car.speed *= 0.5;
      }
      car.syncMesh();
      if (dist < 3.4) onRam?.(car);
    }

    // Lampu strobo merah-biru bergantian.
    this.flashTimer += dt;
    const on = Math.floor(this.flashTimer * 6) % 2 === 0;
    for (const car of this.cars) {
      const u = car.mesh.userData;
      if (u.lightRed) u.lightRed.visible = on;
      if (u.lightBlue) u.lightBlue.visible = !on;
    }
  }

  spawnNear(playerPos) {
    const angle = this.rng() * Math.PI * 2;
    const dist = 55 + this.rng() * 25;
    let x = playerPos.x + Math.sin(angle) * dist;
    let z = playerPos.z + Math.cos(angle) * dist;
    // Taruh di jalan terdekat supaya tidak muncul di dalam gedung.
    x = this.city.roadCoord(x);
    z = this.city.roadCoord(z);
    const mesh = buildCarMesh(0x1a1a1a, { police: true });
    // Strip putih di bodi: tambahkan kotak tipis putih.
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, Math.atan2(playerPos.x - x, playerPos.z - z));
    car.isPolice = true;
    this.cars.push(car);
  }
}
