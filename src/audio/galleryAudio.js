const STORAGE_KEY = 'gallery.muted';

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Fully synthesized audio (no files): a soft ambient pad, filtered-noise
 * footsteps, a landing thump and a chime when an exhibit opens.
 * The AudioContext is created lazily on the first user gesture (autoplay policy).
 */
export class GalleryAudio {
  constructor() {
    this.ctx = null;
    this.muted = readMuted();
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.#build();
      } catch (err) {
        console.warn('[audio] unavailable', err);
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  #build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Ambient pad: detuned Cmaj9-ish voicing through a slowly breathing low-pass.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    filter.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(filter.frequency);
    lfo.start();

    const pad = ctx.createGain();
    pad.gain.value = 0.045;
    [130.81, 196.0, 246.94, 293.66, 329.63].forEach((freq, i) => {
      const voice = ctx.createGain();
      voice.gain.value = 0.22;
      // Each voice swells at its own slow rate so the chord keeps shifting.
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.03 + i * 0.017;
      const swellDepth = ctx.createGain();
      swellDepth.gain.value = 0.12;
      swell.connect(swellDepth).connect(voice.gain);
      swell.start();
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = i % 2 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(voice);
        osc.start();
      }
      voice.connect(filter);
    });
    filter.connect(pad).connect(this.master);

    // Shared white-noise buffer for footsteps.
    const len = Math.floor(ctx.sampleRate * 0.3);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);

    this.#applyMute(0.01);
  }

  #applyMute(timeConstant = 0.35) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, now, timeConstant);
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      /* storage unavailable — preference just won't persist */
    }
    this.#applyMute();
    return muted;
  }

  toggle() {
    return this.setMuted(!this.muted);
  }

  get #ready() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  footstep(intensity = 1) {
    if (!this.#ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320 + Math.random() * 160;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    const peak = 0.16 * Math.min(1.2, 0.6 + intensity * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(bp).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 0.1, 0.14);
  }

  land(intensity = 1) {
    if (!this.#ready || intensity < 0.2) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22 * intensity, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.sfx);
    osc.start(t);
    osc.stop(t + 0.22);
    this.footstep(intensity);
  }

  chime() {
    if (!this.#ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      const start = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.07, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(g).connect(this.sfx);
      osc.start(start);
      osc.stop(start + 1);
    });
  }
}
