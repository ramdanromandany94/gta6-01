// Kota prosedural "Solmar Bay": jalan grid, gedung dengan jendela bercahaya,
// trotoar, lampu jalan, pepohonan, dan langit sunset. Semua geometri dibuat
// dari BoxGeometry + material standar; jendela digambar di CanvasTexture
// saat runtime (bukan aset eksternal).
import * as THREE from 'three';
import { CFG } from './config.js';
import { pick, range, rangeInt } from './rng.js';

const PALETTE = [
  0x8a6f5c, 0x6e7f8a, 0x9c8a6e, 0x5c6e8a, 0x7a5c6e,
  0x4e5e6e, 0xa08a70, 0x6e5c4e, 0x546e7a, 0x8a7a5c,
];

function windowTexture(rng, base) {
  // Tekstur fasad: dinding + grid jendela, sebagian menyala kuning (sunset).
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + base.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 128, 256);
  const cols = 5, rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? '#ffd27a' : '#20242e';
      g.fillRect(8 + x * 24, 10 + y * 24, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.buildings = []; // {x, z, hw, hd, h} untuk tabrakan sederhana
    this.lamps = [];
    this.roadLines = [];
    for (let k = -CFG.GRID; k <= CFG.GRID; k++) this.roadLines.push(k * CFG.PITCH);
    this.half = CFG.GRID * CFG.PITCH + CFG.ROAD / 2 + CFG.BLOCK / 2;
    this.build();
  }

  isOnRoad(x, z) {
    const r = CFG.ROAD / 2 + 1;
    for (const l of this.roadLines) {
      if (Math.abs(x - l) < r || Math.abs(z - l) < r) return true;
    }
    return false;
  }

  roadCoord(v) {
    // Sumbu jalan terdekat dari koordinat v.
    let best = this.roadLines[0], bd = 1e9;
    for (const l of this.roadLines) {
      const d = Math.abs(v - l);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }

  randomRoadPos(rng) {
    const horizontal = rng() < 0.5;
    const line = pick(rng, this.roadLines);
    const along = range(rng, -CFG.GRID * CFG.PITCH, CFG.GRID * CFG.PITCH);
    const lane = (rng() < 0.5 ? -1 : 1) * 3.5;
    return horizontal ? { x: along, z: line + lane } : { x: line + lane, z: along };
  }

  randomSidewalkPos(rng) {
    // Titik di trotoar: pinggir jalan.
    const p = this.randomRoadPos(rng);
    return { x: p.x + (rng() < 0.5 ? -1 : 1) * 8, z: p.z + (rng() < 0.5 ? -1 : 1) * 8 };
  }

  build() {
    const { scene, rng } = this;
    scene.fog = new THREE.Fog(CFG.FOG_COLOR, 120, 520);
    scene.background = new THREE.Color(CFG.SKY_HORIZON);

    // Langit: kubah gradien (shader sederhana, warna sunset).
    const skyGeo = new THREE.SphereGeometry(700, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(CFG.SKY_TOP) },
        mid: { value: new THREE.Color(0xff5e3a) },
        bot: { value: new THREE.Color(CFG.SKY_HORIZON) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){ float h=normalize(vP).y; vec3 c = h>0.25 ? mix(mid,top,smoothstep(0.25,0.8,h)) : mix(bot,mid,smoothstep(-0.05,0.25,h));
        gl_FragColor=vec4(c,1.0); }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Matahari: cakram bercahaya di barat.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
    );
    sun.position.set(-420, 95, -260);
    sun.lookAt(0, 60, 0);
    scene.add(sun);
    const sunGlow = new THREE.Mesh(
      new THREE.CircleGeometry(60, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.35, fog: false }),
    );
    sunGlow.position.copy(sun.position).add(new THREE.Vector3(0, 0, -2));
    sunGlow.lookAt(0, 60, 0);
    scene.add(sunGlow);

    // Cahaya: matahari hangat + ambient senja.
    const dir = new THREE.DirectionalLight(CFG.SUN_COLOR, 1.6);
    dir.position.set(-180, 120, -120);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0xff9a6a, 0x3a2a4a, 0.75));
    this.sunLight = dir;

    // Tanah dasar (rumput/tanah kota) + aspal jalan.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.half * 2 + 120, this.half * 2 + 120),
      new THREE.MeshStandardMaterial({ color: 0x4a5d3a, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
    for (const l of this.roadLines) {
      for (const horiz of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(this.half * 2 + 40, CFG.ROAD), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = horiz ? 0 : Math.PI / 2;
        road.position.set(horiz ? 0 : l, 0, horiz ? l : 0);
        scene.add(road);
        // Garis tengah putus-putus.
        for (let d = -this.half; d < this.half; d += 16) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.5), lineMat);
          dash.rotation.x = -Math.PI / 2;
          dash.rotation.z = horiz ? 0 : Math.PI / 2;
          dash.position.set(horiz ? d : l, 0.02, horiz ? l : d);
          scene.add(dash);
        }
      }
    }

    // Trotoar di tiap blok.
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x8a8d94, roughness: 1 });
    for (let bx = -CFG.GRID; bx < CFG.GRID; bx++) {
      for (let bz = -CFG.GRID; bz < CFG.GRID; bz++) {
        const cx = (bx + 0.5) * CFG.PITCH;
        const cz = (bz + 0.5) * CFG.PITCH;
        const walk = new THREE.Mesh(new THREE.BoxGeometry(CFG.BLOCK + 8, 0.3, CFG.BLOCK + 8), walkMat);
        walk.position.set(cx, 0.12, cz);
        scene.add(walk);
      }
    }

    // Gedung prosedural per blok: 1-3 gedung per blok.
    const texCache = new Map();
    for (let bx = -CFG.GRID; bx < CFG.GRID; bx++) {
      for (let bz = -CFG.GRID; bz < CFG.GRID; bz++) {
        const cx = (bx + 0.5) * CFG.PITCH;
        const cz = (bz + 0.5) * CFG.PITCH;
        const n = rangeInt(rng, 1, 3);
        for (let i = 0; i < n; i++) {
          const w = range(rng, 10, 18), d = range(rng, 10, 18);
          const h = range(rng, 12, 62);
          const ox = range(rng, -9, 9), oz = range(rng, -9, 9);
          const base = pick(rng, PALETTE);
          if (!texCache.has(base)) texCache.set(base, windowTexture(rng, base));
          const mat = new THREE.MeshStandardMaterial({ map: texCache.get(base), roughness: 0.85 });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(cx + ox, h / 2 + 0.25, cz + oz);
          scene.add(b);
          // Atap: kotak kecil (AC / heli pad) supaya siluet bervariasi.
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.4, 1.6, d * 0.4),
            new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 1 }),
          );
          roof.position.set(cx + ox, h + 1, cz + oz);
          scene.add(roof);
          this.buildings.push({ x: cx + ox, z: cz + oz, hw: w / 2, hd: d / 2, h });
        }
        // Pohon di sudut blok.
        if (rng() < 0.7) {
          const tx = cx + range(rng, -18, 18), tz = cz + range(rng, -18, 18);
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.5, 3, 6),
            new THREE.MeshStandardMaterial({ color: 0x5a3a22 }),
          );
          trunk.position.set(tx, 1.7, tz);
          const crown = new THREE.Mesh(
            new THREE.SphereGeometry(range(rng, 2, 3.2), 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 1 }),
          );
          crown.position.set(tx, 4.6, tz);
          scene.add(trunk); scene.add(crown);
        }
      }
    }

    // Lampu jalan di tiap persimpangan (tiang + bola lampu menyala).
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.6, metalness: 0.4 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
    for (const lx of this.roadLines) {
      for (const lz of this.roadLines) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
        pole.position.set(lx + 8.5, 3.5, lz + 8.5);
        scene.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), poleMat);
        arm.position.set(lx + 7.4, 6.9, lz + 8.5);
        scene.add(arm);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), lampMat);
        bulb.position.set(lx + 6.3, 6.8, lz + 8.5);
        scene.add(bulb);
        this.lamps.push(bulb);
      }
    }

    // Dermaga selatan & tempat persembunyian utara (landmark misi).
    this.makeLandmark(0, CFG.GRID * CFG.PITCH + 26, 0x2e86c1, 'Dermaga');
    this.makeLandmark(0, -CFG.GRID * CFG.PITCH - 26, 0x8e44ad, 'Hideout');
  }

  makeLandmark(x, z, color, name) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.6, 18),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    pad.position.set(x, 0.3, z);
    pad.name = name;
    this.scene.add(pad);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    sign.position.set(x, 6, z - 8);
    this.scene.add(sign);
  }

  // Tabrakan kotak sederhana terhadap gedung.
  collideBuildings(x, z, radius) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.hw + radius && Math.abs(z - b.z) < b.hd + radius) {
        return b;
      }
    }
    return null;
  }

  clampToCity(x, z, margin = 6) {
    const lim = this.half + 30;
    return {
      x: Math.max(-lim + margin, Math.min(lim - margin, x)),
      z: Math.max(-lim + margin, Math.min(lim - margin, z)),
    };
  }
}
