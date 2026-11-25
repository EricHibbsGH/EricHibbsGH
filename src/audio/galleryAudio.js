const STORAGE_KEY = 'gallery.sound';
const LEGACY_MUTED_KEY = 'gallery.muted';

/** The soundscapes a visitor can mix. Order is the order shown in the Sound panel. */
export const SOUND_LAYERS = [
  { id: 'christmas', label: 'Christmas music', detail: 'Silent Night on a music box' },
  { id: 'snow', label: 'Snowfall', detail: 'Soft wind and gusts' },
  { id: 'rain', label: 'Rain', detail: 'Light rain on the windows' },
  { id: 'fire', label: 'Fireplace', detail: 'A low, crackling fire' },
  { id: 'pad', label: 'Gallery hum', detail: 'A slow ambient chord' },
];

const DEFAULTS = { muted: false, volume: 0.35, layers: ['christmas', 'snow'] };

function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      return {
        muted: !!saved.muted,
        volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : DEFAULTS.volume,
        layers: Array.isArray(saved.layers) ? saved.layers.filter((id) => SOUND_LAYERS.some((l) => l.id === id)) : DEFAULTS.layers,
      };
    }
    // Earlier visits only stored mute.
    return { ...DEFAULTS, muted: localStorage.getItem(LEGACY_MUTED_KEY) === 'true' };
  } catch {
    return { ...DEFAULTS };
  }
}

// Silent Night (Franz Gruber, 1818; public domain), in C. [MIDI note, beats]
const SILENT_NIGHT = [
  [67, 1.5], [69, 0.5], [67, 1], [64, 3],
  [67, 1.5], [69, 0.5], [67, 1], [64, 3],
  [74, 2], [74, 1], [71, 3],
  [72, 2], [72, 1], [67, 3],
  [69, 2], [69, 1], [72, 1.5], [71, 0.5], [69, 1], [67, 1.5], [69, 0.5], [67, 1], [64, 3],
  [69, 2], [69, 1], [72, 1.5], [71, 0.5], [69, 1], [67, 1.5], [69, 0.5], [67, 1], [64, 3],
  [74, 2], [74, 1], [77, 1.5], [74, 0.5], [71, 1], [72, 3], [76, 3],
  [72, 1], [67, 1], [64, 1], [67, 1.5], [65, 0.5], [62, 1], [60, 6],
];
const BEAT = 0.52; // seconds: unhurried
const BASS = [48, 43, 48, 41, 48, 43, 41, 48]; // C, G, C, F … one every three beats
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

/**
 * Fully synthesized audio (no files). Ambient soundscapes are modular layers a
 * visitor can mix, under one volume and one on/off switch; footsteps, the
 * landing thump and the exhibit chime ride on the same master.
 * The AudioContext is created lazily on the first user gesture (autoplay policy).
 */
export class GalleryAudio {
  constructor() {
    this.ctx = null;
    const s = readSettings();
    this.muted = s.muted;
    this.volume = s.volume;
    this.active = new Set(s.layers);
    this.layers = new Map(); // id → { stop }
    this.listeners = new Set();
  }

  /** Called whenever settings change, so the UI can follow. */
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
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

    this.music = ctx.createGain();
    this.music.connect(this.master);

    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);

    // Two seconds of white noise, looped by the weather layers and cut up for footsteps.
    const len = Math.floor(ctx.sampleRate * 2);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.#applyMaster(0.01);
    this.#syncLayers();
  }

  /* ------------------------------------------------------------- settings */

  get settings() {
    return { muted: this.muted, volume: this.volume, layers: [...this.active] };
  }

  #save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage unavailable: settings just won't persist */
    }
    for (const fn of this.listeners) fn(this.settings);
  }

  /** Volume 0–1 on a gentle curve; even full volume stays under the old level. */
  #applyMaster(timeConstant = 0.25) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0 : 0.7 * this.volume * this.volume;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(target, now, timeConstant);
  }

  setMuted(muted) {
    this.muted = muted;
    this.#applyMaster();
    this.#syncLayers();
    this.#save();
    return muted;
  }

  toggle() {
    return this.setMuted(!this.muted);
  }

  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.volume > 0 && this.muted) this.muted = false;
    this.#applyMaster(0.08);
    this.#syncLayers();
    this.#save();
  }

  setLayer(id, on) {
    if (on) this.active.add(id);
    else this.active.delete(id);
    this.#syncLayers();
    this.#save();
  }

  /** Starts the layers that should play and fades out the rest. Nothing runs while muted. */
  #syncLayers() {
    if (!this.ctx) return;
    for (const { id } of SOUND_LAYERS) {
      const want = !this.muted && this.active.has(id);
      const running = this.layers.get(id);
      if (want && !running) this.layers.set(id, this.#startLayer(id));
      else if (!want && running) {
        this.layers.delete(id);
        running.stop();
      }
    }
  }

  #startLayer(id) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.music);
    const level = { christmas: 0.5, snow: 0.55, rain: 0.42, fire: 0.6, pad: 0.4 }[id];
    out.gain.setTargetAtTime(level, ctx.currentTime, 0.8);
    const build = { christmas: () => this.#christmas(out), snow: () => this.#snow(out), rain: () => this.#rain(out), fire: () => this.#fire(out), pad: () => this.#pad(out) }[id];
    const stopSources = build();
    return {
      stop: () => {
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0, t, 0.4);
        setTimeout(() => {
          stopSources();
          out.disconnect();
        }, 2000);
      },
    };
  }

  /* --------------------------------------------------------------- layers */

  #noiseLoop() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(this.ctx.currentTime, Math.random() * 1.5);
    return src;
  }

  /** A short filtered-noise burst: droplets, crackles and bell shakes are all made of these. */
  #burst(dest, { at, type, freq, q = 1, peak, length }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(f).connect(g).connect(dest);
    src.start(at, Math.random() * 1.8, length + 0.02);
  }

  /** Runs `step` again and again with a jittered delay until stopped. */
  #loop(step) {
    let alive = true;
    let timer = 0;
    const run = () => {
      if (!alive) return;
      timer = setTimeout(run, step());
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }

  /** Silent Night on a music box, a soft bass under it, and the odd sleigh-bell shimmer. */
  #christmas(out) {
    const ctx = this.ctx;
    const dry = ctx.createGain();
    dry.connect(out);
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.24;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    dry.connect(echo);
    echo.connect(feedback).connect(echo);
    echo.connect(wet).connect(out);

    const tone = (freq, type, at, peak, decay) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + (type === 'sine' ? 0.006 : 0.08));
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      osc.connect(g).connect(dry);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    };

    let i = 0;
    let beat = 0;
    let bassIndex = 0;
    let nextTime = ctx.currentTime + 0.4;
    let nextBells = ctx.currentTime + 6 + Math.random() * 6;
    const stop = this.#loop(() => {
      const horizon = ctx.currentTime + 0.6;
      while (nextTime < horizon) {
        if (i >= SILENT_NIGHT.length) {
          i = 0;
          beat = 0;
          nextTime += BEAT * 4; // a breath between verses
          continue;
        }
        const [n, beats] = SILENT_NIGHT[i++];
        if (beat % 3 === 0) tone(midi(BASS[bassIndex++ % BASS.length]), 'triangle', nextTime, 0.05, BEAT * 3);
        // Music-box tine: fundamental plus a bright partial that dies quickly.
        const vel = 0.85 + Math.random() * 0.15;
        tone(midi(n), 'sine', nextTime, 0.22 * vel, Math.min(2.4, beats * BEAT + 1.2));
        tone(midi(n) * 3.98, 'sine', nextTime, 0.05 * vel, 0.35);
        nextTime += beats * BEAT;
        beat += beats;
      }
      if (ctx.currentTime > nextBells) {
        const t = ctx.currentTime + 0.05;
        for (let k = 0; k < 7; k++) {
          this.#burst(out, { at: t + k * 0.075 + Math.random() * 0.02, type: 'bandpass', freq: 6500 + Math.random() * 2500, q: 8, peak: 0.06, length: 0.12 });
        }
        nextBells = ctx.currentTime + 10 + Math.random() * 12;
      }
      return 150;
    });
    return () => {
      stop();
      dry.disconnect();
      wet.disconnect();
    };
  }

  /** Wind over snow: low-passed noise whose brightness and level drift in slow gusts. */
  #snow(out) {
    const ctx = this.ctx;
    const src = this.#noiseLoop();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.Q.value = 0.9;
    const gust = ctx.createGain();
    gust.gain.value = 0.35;
    src.connect(lp).connect(gust).connect(out);
    const stop = this.#loop(() => {
      const t = ctx.currentTime;
      const strength = 0.25 + Math.random() * 0.45;
      lp.frequency.setTargetAtTime(380 + strength * 700, t, 1.6);
      gust.gain.setTargetAtTime(0.18 + strength * 0.4, t, 1.8);
      return 2500 + Math.random() * 3500;
    });
    return () => {
      stop();
      src.stop();
    };
  }

  /** Light rain: a soft hiss plus scattered droplets. */
  #rain(out) {
    const ctx = this.ctx;
    const src = this.#noiseLoop();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    const hiss = ctx.createGain();
    hiss.gain.value = 0.14;
    src.connect(hp).connect(lp).connect(hiss).connect(out);
    const stop = this.#loop(() => {
      const t = ctx.currentTime;
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.4) continue;
        this.#burst(out, { at: t + Math.random() * 0.12, type: 'bandpass', freq: 1800 + Math.random() * 3500, q: 6, peak: 0.12 + Math.random() * 0.15, length: 0.04 });
      }
      return 60 + Math.random() * 90;
    });
    return () => {
      stop();
      src.stop();
    };
  }

  /** A fire: low rumble and irregular crackles. */
  #fire(out) {
    const ctx = this.ctx;
    const src = this.#noiseLoop();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const rumble = ctx.createGain();
    rumble.gain.value = 0.32;
    src.connect(lp).connect(rumble).connect(out);
    const stop = this.#loop(() => {
      const t = ctx.currentTime;
      const pops = Math.random() < 0.25 ? 3 + Math.floor(Math.random() * 4) : 1;
      for (let k = 0; k < pops; k++) {
        this.#burst(out, { at: t + k * (0.02 + Math.random() * 0.05), type: 'highpass', freq: 1500 + Math.random() * 2500, peak: 0.1 + Math.random() * 0.25, length: 0.015 + Math.random() * 0.03 });
      }
      return 90 + Math.random() * 420;
    });
    return () => {
      stop();
      src.stop();
    };
  }

  /** The original ambient pad: a detuned Cmaj9-ish voicing through a slowly breathing low-pass. */
  #pad(out) {
    const ctx = this.ctx;
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
    const oscs = [lfo];
    const pad = ctx.createGain();
    pad.gain.value = 0.11;
    [130.81, 196.0, 246.94, 293.66, 329.63].forEach((freq, i) => {
      const voice = ctx.createGain();
      voice.gain.value = 0.22;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.03 + i * 0.017;
      const swellDepth = ctx.createGain();
      swellDepth.gain.value = 0.12;
      swell.connect(swellDepth).connect(voice.gain);
      swell.start();
      oscs.push(swell);
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = i % 2 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        osc.connect(voice);
        osc.start();
        oscs.push(osc);
      }
      voice.connect(filter);
    });
    filter.connect(pad).connect(out);
    return () => {
      for (const o of oscs) o.stop();
    };
  }

  /* ------------------------------------------------------------------ sfx */

  get #ready() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  footstep(intensity = 1) {
    if (!this.#ready) return;
    const peak = 0.16 * Math.min(1.2, 0.6 + intensity * 0.5);
    this.#burst(this.sfx, { at: this.ctx.currentTime, type: 'bandpass', freq: 320 + Math.random() * 160, q: 1.4, peak, length: 0.12 });
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
