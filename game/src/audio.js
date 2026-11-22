// Suara prosedural WebAudio — tanpa file audio eksternal sama sekali.
// Mesin (sawtooth + lowpass), sirene (dua nada bergantian), tembakan (noise
// burst), pukulan (thud), pickup (blip). Semua dibuat dari oscillator/noise.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Mesin: sawtooth lewat lowpass, gain kecil.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 400;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Sirene: square dua nada.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this._sirenPhase = 0;
    } catch { this.ctx = null; }
  }

  setEngine(speedNorm, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.09 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 140, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + speedNorm * 900, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  }

  update(dt) {
    if (!this.ctx || !this.sirenOn) return;
    this._sirenPhase += dt;
    const f = (Math.floor(this._sirenPhase * 1.6) % 2 === 0) ? 660 : 880;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.03);
  }

  _noiseBurst(dur, filterFreq, gainVal) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = gainVal;
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start();
  }

  _tone(freq, dur, type, gainVal, slideTo) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur + 0.02);
  }

  shot() { this._noiseBurst(0.14, 2600, 0.5); this._tone(180, 0.08, 'square', 0.25, 60); }
  punch() { this._noiseBurst(0.08, 500, 0.4); this._tone(120, 0.1, 'sine', 0.35, 50); }
  pickup() { this._tone(660, 0.09, 'sine', 0.3); setTimeout(() => this._tone(990, 0.12, 'sine', 0.3), 80); }
  crash() { this._noiseBurst(0.3, 800, 0.5); }
  click() { this._tone(800, 0.05, 'square', 0.15); }
  missionDone() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 'sine', 0.3), i * 120)); }
  wasted() { [400, 300, 200, 120].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.25), i * 180)); }
}
