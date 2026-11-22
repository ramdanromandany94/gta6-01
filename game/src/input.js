// Input: keyboard + mouse. Pointer lock dipakai saat bermain normal;
// mode screenshot (?shot=...) memakai drag mouse biasa supaya bisa jalan headless.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.queued = new Set(); // tombol sekali-tekan: bertahan sampai dibaca pressed()
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // sekali per klik kiri
    this.dragging = false;
    this.locked = false;
    this.shotMode = false;
    this._lastX = 0;
    this._lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.queued.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      } else if (this.dragging) {
        this.mouseDX += e.clientX - this._lastX;
        this.mouseDY += e.clientY - this._lastY;
        this._lastX = e.clientX; this._lastY = e.clientY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        if (!this.locked && !this.shotMode) canvas.requestPointerLock?.();
      }
      if (e.button === 0 && this.shotMode) {
        this.dragging = true; this._lastX = e.clientX; this._lastY = e.clientY;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouseDown = false; this.dragging = false; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  axis() {
    // WASD / panah -> vektor gerak di bidang XZ (x kanan, y maju)
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, y };
  }
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }
  // Dipanggil sekali per frame dari luar untuk tombol sekali-tekan.
  // Membaca antrean keydown (bukan state tahan) supaya tap cepat yang
  // keydown+keyup-nya jatuh di antara dua frame tetap terbaca.
  pressed(code) {
    if (this.queued.has(code)) { this.queued.delete(code); return true; }
    return false;
  }
}
