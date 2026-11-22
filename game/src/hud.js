// HUD: health, uang, bintang wanted, teks objektif, kecepatan, dialog,
// minimap canvas (jalan, gedung, player, mobil, polisi, marker misi).
import { CFG } from './config.js';

export class HUD {
  constructor(city) {
    this.city = city;
    this.el = {
      health: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      money: document.getElementById('money'),
      stars: document.getElementById('stars'),
      objective: document.getElementById('objective'),
      dialog: document.getElementById('dialog'),
      speed: document.getElementById('speed'),
      minimap: document.getElementById('minimap'),
      crosshair: document.getElementById('crosshair'),
      weapon: document.getElementById('weapon'),
      toast: document.getElementById('toast'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this._toastTimer = 0;
  }

  toast(text, seconds = 3) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this._toastTimer = seconds;
  }

  update(dt, s) {
    // s: {health, money, wanted, objective, dialog, dialogTimer, speedKmh,
    //     inCar, weapon, ammo, player, cars, polices, peds, marker, city}
    this.el.health.style.width = Math.max(0, s.health) + '%';
    this.el.healthText.textContent = Math.ceil(s.health);
    this.el.money.textContent = '$' + s.money;
    this.el.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(CFG.MAX_WANTED - s.wanted);
    this.el.stars.style.color = s.wanted > 0 ? '#ff3b30' : '#888';
    this.el.objective.textContent = s.objective;
    if (s.dialog && s.dialogTimer > 0) {
      this.el.dialog.textContent = s.dialog;
      this.el.dialog.style.opacity = '1';
    } else {
      this.el.dialog.style.opacity = '0';
    }
    this.el.speed.textContent = s.inCar ? Math.round(s.speedKmh) + ' km/h' : '';
    this.el.speed.style.display = s.inCar ? 'block' : 'none';
    this.el.weapon.textContent = s.inCar ? 'MOBIL — E keluar · Spasi rem tangan'
      : (s.weapon === 'pistol' ? `PISTOL — ${s.ammo}/12 · klik tembak · R isi · F pukul · 1/2 ganti` : 'TANGAN KOSONG — F pukul · 2 pistol · E masuk mobil');
    this.el.crosshair.style.display = (!s.inCar && s.weapon === 'pistol') ? 'block' : 'none';
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.el.toast.style.opacity = '0';
    }
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const ctx = this.mapCtx;
    const W = 180, H = 180;
    const city = this.city;
    const lim = city.half + 30;
    const toMap = (x, z) => [((x + lim) / (2 * lim)) * W, ((z + lim) / (2 * lim)) * H];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(12,16,24,0.85)';
    ctx.fillRect(0, 0, W, H);
    // Gedung.
    ctx.fillStyle = '#5a6270';
    for (const b of city.buildings) {
      const [x, y] = toMap(b.x, b.z);
      const w = (b.hw * 2 / (2 * lim)) * W;
      const h = (b.hd * 2 / (2 * lim)) * H;
      ctx.fillRect(x - w / 2, y - h / 2, Math.max(1, w), Math.max(1, h));
    }
    // Jalan.
    ctx.strokeStyle = '#3a4150';
    ctx.lineWidth = 3;
    for (const l of city.roadLines) {
      const [x1] = toMap(l, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke();
      const [, y1] = toMap(0, l);
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(W, y1); ctx.stroke();
    }
    // Marker misi.
    if (s.marker) {
      const [x, y] = toMap(s.marker.x, s.marker.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    }
    // Mobil traffic.
    ctx.fillStyle = '#9aa5b1';
    for (const c of s.cars) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Polisi (berkedip).
    ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff2020' : '#2040ff';
    for (const c of s.polices) {
      const [x, y] = toMap(c.x, c.z);
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player (segitiga hijau menghadap arah hadap).
    const [px, py] = toMap(s.player.x, s.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(s.player.heading), -Math.cos(s.player.heading)) + Math.PI);
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
