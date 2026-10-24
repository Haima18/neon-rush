/* ==========================================================================
   NEON RUSH — procedural audio
   All sound is synthesized at runtime with the Web Audio API. No external
   files, no network requests, no autoplay violations: the context is created
   only after a real user gesture.
   ========================================================================== */

(function () {
  "use strict";

  const NR = window.NR;
  const U = NR.utils;

  class AudioSystem {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.volume = typeof options.volume === "number" ? U.clamp(options.volume, 0, 1) : 0.7;
      this.musicEnabled = options.musicEnabled !== false;
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.musicFilter = null;
      this.noiseBuffer = null;
      this.supported = Boolean(window.AudioContext || window.webkitAudioContext);
      this.musicStep = 0;
      this.nextNote = 0;
      this.intensity = 0;
      this.mode = "menu";
      this.musicPlaying = true;
      this.lastHover = 0;
      this.droneStarted = false;
    }

    /* Create or resume the context. Must be called from a user gesture. */
    unlock() {
      if (!this.supported) return false;
      try {
        if (!this.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioContext();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.enabled ? this.gainValue() : 0;
          this.master.connect(this.ctx.destination);

          // All generated music runs through its own filter and gain stage so
          // the score can breathe, duck during pause, and sit under the SFX.
          this.musicFilter = this.ctx.createBiquadFilter();
          this.musicFilter.type = "lowpass";
          this.musicFilter.frequency.value = 2400;
          this.musicFilter.Q.value = 0.55;
          this.musicBus = this.ctx.createGain();
          this.musicBus.gain.value = 0.72;
          this.musicFilter.connect(this.musicBus);
          this.musicBus.connect(this.master);
          this.applyMusicMode(true);

          this.createNoiseBuffer();
          this.startDrone();
        }
        if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        return true;
      } catch (error) {
        this.supported = false;
        this.ctx = null;
        return false;
      }
    }

    gainValue() {
      // Slight curve keeps quiet settings genuinely quiet.
      return Math.pow(this.volume, 1.35) * 0.9;
    }

    applyVolume() {
      if (!this.ctx || !this.master) return;
      const target = this.enabled ? this.gainValue() : 0;
      const now = this.ctx.currentTime;
      try {
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(target, now, 0.035);
      } catch (error) {
        this.master.gain.value = target;
      }
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.enabled) this.unlock();
      this.applyVolume();
    }

    setVolume(volume) {
      this.volume = U.clamp(Number(volume) || 0, 0, 1);
      this.applyVolume();
    }

    setMusicPlaying(playing) {
      this.musicPlaying = Boolean(playing);
    }

    setMusicEnabled(enabled) {
      this.musicEnabled = Boolean(enabled);
      this.applyMusicMode(true);
    }

    setIntensity(value) {
      this.intensity = U.clamp(value, 0, 1);
    }

    /* "menu" is the slow synthwave lounge, "game" brings in drums and lead,
       and "pause" keeps a muffled pad alive under the overlay. */
    setMode(mode) {
      if (mode !== "menu" && mode !== "game" && mode !== "pause") return;
      if (this.mode === mode) return;
      this.mode = mode;
      this.applyMusicMode();
    }

    applyMusicMode(immediate = false) {
      if (!this.ctx || !this.musicFilter || !this.musicBus) return;
      // The menu arrangement uses fewer voices than the gameplay score, so its
      // bus gain is higher to keep both modes at a similar perceived loudness.
      // The score sits under the effects but must still read as a song. The
      // menu arrangement uses fewer voices, so it gets the highest bus gain.
      const target =
        this.mode === "game"
          ? { cutoff: 4600, gain: 2.2 }
          : this.mode === "pause"
            ? { cutoff: 720, gain: 1.1 }
            : { cutoff: 2600, gain: 4.2 };
      // The drone and score share this bus, so disabling adaptive music
      // mutes both without touching sound effects.
      if (!this.musicEnabled) target.gain = 0;
      const now = this.ctx.currentTime;
      try {
        if (immediate) {
          this.musicFilter.frequency.setValueAtTime(target.cutoff, now);
          this.musicBus.gain.setValueAtTime(target.gain, now);
        } else {
          this.musicFilter.frequency.setTargetAtTime(target.cutoff, now, 0.16);
          this.musicBus.gain.setTargetAtTime(target.gain, now, 0.16);
        }
      } catch (error) {
        /* Ignore. */
      }
    }

    isRunning() {
      return Boolean(this.ctx && this.ctx.state === "running" && this.enabled);
    }

    isMusicRunning() {
      return Boolean(this.isRunning() && this.musicEnabled && this.musicPlaying);
    }

    createNoiseBuffer() {
      if (!this.ctx) return;
      const length = Math.floor(this.ctx.sampleRate * 0.8);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        channel[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    startDrone() {
      if (!this.ctx || this.droneStarted) return;
      this.droneStarted = true;
      try {
        const bus = this.ctx.createGain();
        bus.gain.value = 0.018;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 300;
        filter.Q.value = 0.7;
        bus.connect(filter);
        filter.connect(this.musicBus || this.master);

        const freqs = [55, 82.5];
        for (const freq of freqs) {
          const osc = this.ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = freq;
          const gain = this.ctx.createGain();
          gain.gain.value = freq === 55 ? 0.5 : 0.16;
          osc.connect(gain);
          gain.connect(bus);
          osc.start();
        }

        // Slow amplitude drift keeps the pad from feeling static.
        const lfo = this.ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.055;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.008;
        lfo.connect(lfoGain);
        lfoGain.connect(bus.gain);
        lfo.start();
      } catch (error) {
        this.droneStarted = false;
      }
    }

    /* Generic oscillator envelope. */
    tone({
      freq = 440,
      endFreq = null,
      duration = 0.15,
      type = "sine",
      gain = 0.08,
      delay = 0,
      attack = 0.006,
      detune = 0,
      filterFreq = null,
    } = {}) {
      if (!this.isRunning()) return;
      try {
        const now = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        osc.type = type;
        osc.detune.value = detune;
        osc.frequency.setValueAtTime(Math.max(20, freq), now);
        if (endFreq && endFreq !== freq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
        }

        let lastNode = osc;
        if (filterFreq) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = filterFreq;
          filter.Q.value = 0.9;
          osc.connect(filter);
          lastNode = filter;
        }

        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + attack);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        lastNode.connect(amp);
        amp.connect(this.master);
        osc.start(now);
        osc.stop(now + duration + 0.03);
      } catch (error) {
        /* Audio is decorative; never let it interrupt gameplay. */
      }
    }

    noise({
      duration = 0.2,
      gain = 0.06,
      filterType = "bandpass",
      filterFreq = 900,
      q = 0.8,
      delay = 0,
    } = {}) {
      if (!this.isRunning() || !this.noiseBuffer) return;
      try {
        const now = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(filterFreq, now);
        filter.Q.value = q;
        const amp = this.ctx.createGain();
        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + 0.008);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        src.connect(filter);
        filter.connect(amp);
        amp.connect(this.master);
        src.start(now);
        src.stop(now + duration + 0.02);
      } catch (error) {
        /* Ignore. */
      }
    }

    /* ------------------------------------------------------------------
       Named cues
       ------------------------------------------------------------------ */

    hover() {
      if (!this.isRunning()) return;
      const now = performance.now();
      if (now - this.lastHover < 55) return;
      this.lastHover = now;
      this.tone({ freq: 1150, endFreq: 1320, duration: 0.045, type: "sine", gain: 0.018 });
    }

    click() {
      this.tone({ freq: 520, endFreq: 760, duration: 0.085, type: "triangle", gain: 0.055 });
      this.tone({ freq: 1040, duration: 0.06, type: "sine", gain: 0.018, delay: 0.03 });
    }

    back() {
      this.tone({ freq: 520, endFreq: 360, duration: 0.09, type: "triangle", gain: 0.045 });
    }

    collect(pitch = 1) {
      this.tone({ freq: 880 * pitch, duration: 0.09, type: "sine", gain: 0.045 });
      this.tone({ freq: 1320 * pitch, duration: 0.12, type: "sine", gain: 0.032, delay: 0.055 });
    }

    dash() {
      this.tone({ freq: 170, endFreq: 780, duration: 0.2, type: "sawtooth", gain: 0.045, filterFreq: 1400 });
      this.noise({ duration: 0.18, gain: 0.032, filterType: "highpass", filterFreq: 1300 });
      this.tone({ freq: 880, endFreq: 1760, duration: 0.12, type: "sine", gain: 0.018 });
    }

    dashUnavailable() {
      this.tone({ freq: 180, endFreq: 140, duration: 0.06, type: "square", gain: 0.018, filterFreq: 700 });
    }

    shred() {
      this.tone({ freq: 1240, endFreq: 420, duration: 0.11, type: "sawtooth", gain: 0.028, filterFreq: 2400 });
      this.noise({ duration: 0.1, gain: 0.024, filterType: "highpass", filterFreq: 2200 });
    }

    pulse() {
      this.tone({ freq: 190, endFreq: 34, duration: 0.7, type: "sawtooth", gain: 0.085, filterFreq: 780 });
      this.tone({ freq: 90, endFreq: 44, duration: 0.6, type: "sine", gain: 0.06 });
      this.tone({ freq: 880, endFreq: 1760, duration: 0.42, type: "triangle", gain: 0.032 });
      this.noise({ duration: 0.55, gain: 0.06, filterType: "bandpass", filterFreq: 620, q: 0.6 });
      this.noise({ duration: 0.2, gain: 0.025, filterType: "highpass", filterFreq: 3000, delay: 0.04 });
    }

    pulseUnavailable() {
      this.tone({ freq: 240, endFreq: 180, duration: 0.09, type: "square", gain: 0.016, filterFreq: 640 });
    }

    pulseReady() {
      this.tone({ freq: 659.25, duration: 0.12, type: "sine", gain: 0.03 });
      this.tone({ freq: 987.77, duration: 0.16, type: "sine", gain: 0.026, delay: 0.08 });
      this.tone({ freq: 1318.5, duration: 0.24, type: "sine", gain: 0.018, delay: 0.16 });
    }

    combo(level = 1) {
      const lift = Math.min(8, Math.max(0, level - 1)) * 30;
      this.tone({ freq: 990 + lift, duration: 0.06, type: "sine", gain: 0.014 });
      this.tone({ freq: 1480 + lift, duration: 0.08, type: "sine", gain: 0.012, delay: 0.04 });
    }

    damage() {
      this.tone({ freq: 150, endFreq: 38, duration: 0.42, type: "sawtooth", gain: 0.075, filterFreq: 700 });
      this.noise({ duration: 0.3, gain: 0.055, filterType: "lowpass", filterFreq: 780 });
      this.tone({ freq: 58, duration: 0.4, type: "sine", gain: 0.05 });
    }

    shieldBlock() {
      this.tone({ freq: 1640, endFreq: 920, duration: 0.24, type: "triangle", gain: 0.055 });
      this.tone({ freq: 820, endFreq: 1640, duration: 0.14, type: "sine", gain: 0.028 });
      this.noise({ duration: 0.14, gain: 0.025, filterType: "highpass", filterFreq: 2200 });
    }

    powerup(type = "shield") {
      const base =
        type === "slow"
          ? 392
          : type === "multiplier"
            ? 523
            : type === "magnet"
              ? 466.16
              : 440;
      this.tone({ freq: base, duration: 0.12, type: "triangle", gain: 0.045 });
      this.tone({ freq: base * 1.25, duration: 0.12, type: "triangle", gain: 0.04, delay: 0.07 });
      this.tone({ freq: base * 1.5, duration: 0.2, type: "sine", gain: 0.04, delay: 0.14 });
      this.tone({ freq: base * 2, duration: 0.16, type: "sine", gain: 0.022, delay: 0.2 });
    }

    powerupExpire() {
      this.tone({ freq: 620, endFreq: 310, duration: 0.24, type: "triangle", gain: 0.03 });
    }

    levelStart() {
      this.tone({ freq: 220, duration: 0.2, type: "triangle", gain: 0.035 });
      this.tone({ freq: 330, duration: 0.24, type: "triangle", gain: 0.032, delay: 0.08 });
      this.tone({ freq: 440, duration: 0.4, type: "sine", gain: 0.035, delay: 0.16 });
    }

    levelClear() {
      const notes = [392, 523.25, 659.25, 783.99];
      notes.forEach((freq, index) => {
        this.tone({ freq, duration: 0.55, type: "triangle", gain: 0.042, delay: index * 0.085 });
        this.tone({ freq: freq * 2, duration: 0.4, type: "sine", gain: 0.014, delay: index * 0.085 });
      });
      this.tone({ freq: 1046.5, duration: 0.9, type: "sine", gain: 0.028, delay: 0.38 });
    }

    gameOver() {
      const notes = [330, 277, 220, 165, 110];
      notes.forEach((freq, index) => {
        this.tone({
          freq,
          endFreq: freq * 0.92,
          duration: 0.55,
          type: "triangle",
          gain: 0.045,
          delay: index * 0.14,
          filterFreq: 900,
        });
      });
      this.noise({ duration: 1.1, gain: 0.035, filterType: "lowpass", filterFreq: 420, delay: 0.1 });
    }

    victory() {
      const melody = [392, 523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
      const times = [0, 0.12, 0.24, 0.36, 0.52, 0.78, 0.9, 1.08];
      melody.forEach((freq, index) => {
        this.tone({
          freq,
          duration: index === melody.length - 1 ? 1.2 : 0.4,
          type: "triangle",
          gain: 0.045,
          delay: times[index],
        });
        this.tone({
          freq: freq / 2,
          duration: 0.5,
          type: "sine",
          gain: 0.018,
          delay: times[index],
        });
      });
      this.tone({ freq: 130.81, duration: 2.2, type: "sine", gain: 0.035, delay: 0.4 });
    }

    newRecord() {
      this.tone({ freq: 880, duration: 0.1, type: "sine", gain: 0.035 });
      this.tone({ freq: 1174.66, duration: 0.1, type: "sine", gain: 0.035, delay: 0.09 });
      this.tone({ freq: 1567.98, duration: 0.26, type: "sine", gain: 0.035, delay: 0.18 });
    }

    /* ------------------------------------------------------------------
       Adaptive synthwave score
       A four-bar A-minor progression. The menu gets a slow pad arrangement,
       gameplay adds bass, arpeggio, lead, kick, snare, and hats, and the
       whole bus ducks behind a low-pass filter while paused. Everything is
       scheduled ahead on a 16th-note grid from the single game loop.
       ------------------------------------------------------------------ */

    getMusicStepDuration() {
      const bpm =
        this.mode === "game"
          ? 112 + this.intensity * 14
          : this.mode === "pause"
            ? 92
            : 96;
      return 60 / bpm / 4;
    }

    update() {
      if (!this.isMusicRunning()) return;
      if (!this.ctx || this.ctx.state !== "running") return;
      if (!this.musicFilter) return;

      const now = this.ctx.currentTime;
      if (this.nextNote < now) this.nextNote = now + 0.05;

      let guard = 0;
      while (this.nextNote < now + 0.28 && guard < 28) {
        this.scheduleMusicStep(this.nextNote, this.musicStep);
        this.nextNote += this.getMusicStepDuration();
        this.musicStep += 1;
        guard += 1;
      }
    }

    scheduleMusicStep(time, step) {
      if (!this.ctx || !this.musicFilter) return;

      // 0: Am, 1: F, 2: C, 3: G. Each chord lasts one bar (16 steps).
      const chords = [
        { bass: 55.0, notes: [220.0, 261.63, 329.63] },
        { bass: 87.31, notes: [174.61, 220.0, 261.63] },
        { bass: 65.41, notes: [196.0, 261.63, 329.63] },
        { bass: 98.0, notes: [196.0, 246.94, 293.66] },
      ];
      // One short motif per chord, played on the offbeats. It gives the menu
      // an actual tune instead of a static pad, and the gameplay arrangement
      // doubles it an octave up.
      const leadMotifs = [
        [440.0, 523.25, 659.25, 587.33],
        [349.23, 440.0, 523.25, 466.16],
        [392.0, 523.25, 659.25, 587.33],
        [392.0, 493.88, 587.33, 493.88],
      ];
      const bar = Math.floor(step / 16);
      const beat = step % 16;
      const chord = chords[bar % chords.length];
      const game = this.mode === "game";
      const paused = this.mode === "pause";
      const stepDuration = this.getMusicStepDuration();
      const intensity = this.intensity;

      if (beat === 0) {
        // Wide pad and sub root on the downbeat.
        chord.notes.forEach((note, index) => {
          this.musicTone(note, time + index * 0.014, 0.0125, stepDuration * 17, "triangle", 0.22, index - 1);
          this.musicTone(note * 1.005, time + 0.05 + index * 0.014, 0.006, stepDuration * 15, "sine", 0.3, 0);
        });
        this.musicTone(chord.bass, time, 0.023, stepDuration * 17, "sine", 0.12, 0);
      }

      if (!paused) {
        // Walking sub-bass. The octave lift on the back half keeps momentum.
        const bassSteps = game ? [0, 3, 6, 8, 11, 14] : [0, 8];
        if (bassSteps.includes(beat)) {
          const lift = beat === 8 || beat === 11 ? 2 : 1;
          this.musicTone(
            chord.bass * lift,
            time,
            game ? 0.034 : 0.024,
            stepDuration * (game ? 1.7 : 3.4),
            "sawtooth",
            0.012,
            0
          );
        }

        // Arpeggio: eighth notes in game, quarter notes in the menu.
        const arpSteps = game ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 4, 8, 12];
        if (arpSteps.includes(beat)) {
          const index = arpSteps.indexOf(beat);
          const note = chord.notes[index % chord.notes.length] * (beat === 12 ? 2 : 1);
          this.musicTone(
            note,
            time,
            game ? 0.014 + intensity * 0.004 : 0.012,
            stepDuration * 1.6,
            "triangle",
            0.008,
            index % 2 === 0 ? -2 : 2
          );
          if (game && intensity > 0.55) {
            this.musicTone(note * 2, time + 0.008, 0.005, stepDuration * 0.9, "sine", 0.004, 0);
          }
        }

        // Lead motif. The short phrases repeat over the four-bar progression,
        // so the score has a hook even when the menu is idle.
        const leadBeats = [2, 6, 10, 14];
        if (leadBeats.includes(beat)) {
          const motif = leadMotifs[bar % leadMotifs.length];
          const note = motif[leadBeats.indexOf(beat) % motif.length];
          const loudLead = game && intensity > 0.28;
          this.musicTone(
            note,
            time,
            loudLead ? 0.017 : 0.012,
            stepDuration * (loudLead ? 2.4 : 3.6),
            "sine",
            0.015,
            0
          );
          if (loudLead) {
            this.musicTone(note * 2, time + 0.02, 0.006, stepDuration * 1.5, "triangle", 0.01, 4);
          }
        }
      }

      if (game) {
        if (beat === 0 || beat === 4 || beat === 8 || beat === 12 ||
            (intensity > 0.72 && beat === 14 && bar % 2 === 1)) {
          this.musicKick(time, beat === 0 ? 0.075 : 0.06);
        }

        if (intensity > 0.3 && (beat === 4 || beat === 12)) {
          this.musicSnare(time, 0.026);
        }

        if (beat % 2 === 0) {
          this.musicHat(time, 0.009 + intensity * 0.006, beat % 4 === 2);
        } else if (intensity > 0.7 && bar % 2 === 1) {
          this.musicHat(time, 0.005, false);
        }

        if (beat === 15 && intensity > 0.6) {
          this.musicSnare(time + stepDuration * 0.55, 0.012);
        }
      }
    }

    musicTone(freq, time, gain, duration, type = "triangle", attack = 0.01, detune = 0) {
      if (!this.ctx || !this.musicFilter) return;
      try {
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, freq), time);
        osc.detune.value = detune;
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + attack);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(amp);
        amp.connect(this.musicFilter);
        osc.start(time);
        osc.stop(time + duration + 0.05);
      } catch (error) {
        /* The score is decorative; never interrupt play. */
      }
    }

    musicKick(time, gain) {
      if (!this.ctx || !this.musicFilter) return;
      try {
        const osc = this.ctx.createOscillator();
        const amp = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(128, time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.18);
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.exponentialRampToValueAtTime(gain, time + 0.004);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
        osc.connect(amp);
        amp.connect(this.musicFilter);
        osc.start(time);
        osc.stop(time + 0.28);
      } catch (error) {
        /* Ignore. */
      }
    }

    musicSnare(time, gain) {
      if (!this.ctx || !this.noiseBuffer || !this.musicFilter) return;
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1900;
        filter.Q.value = 0.75;
        const amp = this.ctx.createGain();
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.exponentialRampToValueAtTime(gain, time + 0.006);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
        src.connect(filter);
        filter.connect(amp);
        amp.connect(this.musicFilter);
        src.start(time);
        src.stop(time + 0.18);
      } catch (error) {
        /* Ignore. */
      }
    }

    musicHat(time, gain, open) {
      if (!this.ctx || !this.noiseBuffer || !this.musicFilter) return;
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = open ? 5600 : 7600;
        const amp = this.ctx.createGain();
        amp.gain.setValueAtTime(0.0001, time);
        amp.gain.exponentialRampToValueAtTime(gain, time + 0.003);
        amp.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.1 : 0.045));
        src.connect(filter);
        filter.connect(amp);
        amp.connect(this.musicFilter);
        src.start(time);
        src.stop(time + (open ? 0.12 : 0.06));
      } catch (error) {
        /* Ignore. */
      }
    }
  }

  NR.AudioSystem = AudioSystem;
})();
