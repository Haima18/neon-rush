/* ==========================================================================
   NEON RUSH — configuration, tuning data, persistence
   Loaded first. Exposes the NR namespace used by the other modules.
   ========================================================================== */

(function () {
  "use strict";

  const NR = (window.NR = window.NR || {});

  NR.VERSION = "1.0.0";

  NR.COLORS = {
    void: "#070812",
    navy: "#0D1024",
    cyan: "#00F5FF",
    magenta: "#FF2BD6",
    violet: "#8B5CFF",
    white: "#F4F7FF",
    red: "#FF4267",
    gold: "#FFD166",
    mint: "#55FFB0",
    ember: "#FF7A45",
  };

  /* Central gameplay tuning. Values are in seconds, pixels, or points unless
     noted otherwise. They are deliberately grouped so balance can be
     adjusted without touching system code. */
  NR.TUNING = {
    maxLives: 3,
    scorePerSecond: 15,
    orbScore: 30,
    powerupScore: 40,
    levelBonusBase: 250,
    victoryBonus: 1000,
    damageInvulnerability: 2.2,
    levelStartGrace: 1.4,
    dashDuration: 0.18,
    dashCooldown: 1.8,
    dashSpeedMultiplier: 2.7,
    dashInvulnerability: 0.25,
    dashShredScore: 35,
    comboWindow: 3.4,
    comboMax: 20,
    comboStep: 0.1,
    pulseMax: 6,
    pulseRadius: 250,
    pulseScore: 45,
    pulseOrbCharge: 1,
    seekerSteer: 82,
    touchPadRadius: 40,
    particleCap: 260,
    orbCap: 2,
    powerupCap: 1,
    maxParticlesReduced: 90,
    playerTrailLength: 18,
    powerupLifetime: 12,
  };

  NR.POWERUPS = {
    shield: {
      key: "shield",
      name: "SHIELD",
      short: "SHIELD",
      duration: 7,
      color: "#00F5FF",
      glyph: "S",
      detail: "Absorbs one impact",
    },
    slow: {
      key: "slow",
      name: "TIME DILATION",
      short: "TIME DILATION",
      duration: 6,
      color: "#FFD166",
      glyph: "T",
      hazardScale: 0.55,
      detail: "Hazards slow to 55%",
    },
    multiplier: {
      key: "multiplier",
      name: "SCORE SURGE",
      short: "SCORE x2",
      duration: 8,
      color: "#FF2BD6",
      glyph: "x2",
      scoreScale: 2,
      detail: "Double score",
    },
    magnet: {
      key: "magnet",
      name: "MAGNET",
      short: "MAGNET",
      duration: 8,
      color: "#55FFB0",
      glyph: "M",
      magnetRange: 280,
      magnetPull: 330,
      detail: "Pull orbs toward you",
    },
  };

  /* Five zones. Each zone changes spawn cadence, speed, silhouette mix,
     pacing events, palette accent, and objective length. */
  NR.LEVELS = [
    {
      id: 1,
      name: "FIRST CONTACT",
      brief: "The outer lattice is quiet. Learn the feel of your craft.",
      duration: 30,
      accent: "#00F5FF",
      threat: "LOW",
      difficulty: 1,
      spawnInterval: 1.5,
      speed: 142,
      maxObstacles: 8,
      waves: 3,
      types: [
        { type: "shard", weight: 76 },
        { type: "mine", weight: 24 },
      ],
      orbInterval: [2.8, 4.2],
      powerupInterval: [15, 20],
      events: [],
      objective: "SURVIVE 30 SECONDS",
      hint: "WASD / ARROWS TO FLY · SPACE TO DASH",
    },
    {
      id: 2,
      name: "OVERDRIVE",
      brief: "Traffic density rises. Weavers cut across the lanes.",
      duration: 35,
      accent: "#8B5CFF",
      threat: "MODERATE",
      difficulty: 2,
      spawnInterval: 1.16,
      speed: 170,
      maxObstacles: 10,
      waves: 3,
      types: [
        { type: "shard", weight: 47 },
        { type: "mine", weight: 19 },
        { type: "weaver", weight: 26 },
        { type: "seeker", weight: 8 },
      ],
      orbInterval: [2.6, 3.8],
      powerupInterval: [16, 21],
      events: [{ t: 18, kind: "pair" }],
      objective: "SURVIVE 35 SECONDS",
      hint: "WEAVERS DRIFT · READ THEIR CURVE",
    },
    {
      id: 3,
      name: "GRID COLLAPSE",
      brief: "Structural barriers join the assault. Dash is now essential.",
      duration: 40,
      accent: "#FF2BD6",
      threat: "HIGH",
      difficulty: 3,
      spawnInterval: 0.98,
      speed: 196,
      maxObstacles: 12,
      waves: 4,
      types: [
        { type: "shard", weight: 34 },
        { type: "mine", weight: 18 },
        { type: "weaver", weight: 21 },
        { type: "barrier", weight: 18 },
        { type: "seeker", weight: 9 },
      ],
      orbInterval: [2.4, 3.5],
      powerupInterval: [15, 20],
      events: [
        { t: 13, kind: "sweep" },
        { t: 29, kind: "pair" },
      ],
      objective: "SURVIVE 40 SECONDS",
      hint: "BARRIERS ROTATE · SLIP THROUGH THE GAP",
    },
    {
      id: 4,
      name: "NEON STORM",
      brief: "The grid is unstable. Formations close in without mercy.",
      duration: 45,
      accent: "#FFD166",
      threat: "SEVERE",
      difficulty: 4,
      spawnInterval: 0.8,
      speed: 220,
      maxObstacles: 14,
      waves: 4,
      types: [
        { type: "shard", weight: 32 },
        { type: "mine", weight: 17 },
        { type: "weaver", weight: 22 },
        { type: "barrier", weight: 20 },
        { type: "seeker", weight: 9 },
      ],
      orbInterval: [2.2, 3.2],
      powerupInterval: [14, 19],
      events: [
        { t: 10, kind: "pair" },
        { t: 23, kind: "barrage" },
        { t: 36, kind: "sweep" },
      ],
      objective: "SURVIVE 45 SECONDS",
      hint: "FORMATIONS LEAVE A GAP · FIND IT EARLY",
    },
    {
      id: 5,
      name: "FINAL BREACH",
      brief: "The core is exposed. Survive the last collapse and take the grid.",
      duration: 50,
      accent: "#FF4267",
      threat: "CRITICAL",
      difficulty: 5,
      spawnInterval: 0.66,
      speed: 246,
      maxObstacles: 16,
      waves: 5,
      types: [
        { type: "shard", weight: 29 },
        { type: "mine", weight: 16 },
        { type: "weaver", weight: 22 },
        { type: "barrier", weight: 24 },
        { type: "seeker", weight: 9 },
      ],
      orbInterval: [2.0, 3.0],
      powerupInterval: [13, 18],
      events: [
        { t: 8, kind: "barrage" },
        { t: 20, kind: "sweep" },
        { t: 31, kind: "barrage" },
        { t: 42, kind: "pair" },
      ],
      objective: "SURVIVE 50 SECONDS",
      hint: "FINAL BREACH · HOLD THE LINE",
    },
  ];

  NR.utils = {
    clamp(value, min, max) {
      return value < min ? min : value > max ? max : value;
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    rand(min, max) {
      return min + Math.random() * (max - min);
    },

    randInt(min, max) {
      return Math.floor(min + Math.random() * (max - min + 1));
    },

    pick(list) {
      return list[Math.floor(Math.random() * list.length)];
    },

    weightedPick(entries) {
      let total = 0;
      for (const entry of entries) total += entry.weight;
      let roll = Math.random() * total;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) return entry.type;
      }
      return entries[entries.length - 1].type;
    },

    formatNumber(value) {
      return Math.max(0, Math.floor(value)).toLocaleString("en-US");
    },

    /* Survival timer shown in HUD and results — mm:ss. */
    formatTime(seconds) {
      const total = Math.max(0, Math.floor(seconds));
      const mins = Math.floor(total / 60);
      const secs = total % 60;
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    },

    formatClock(seconds) {
      const total = Math.max(0, Math.ceil(seconds));
      const mins = Math.floor(total / 60);
      const secs = total % 60;
      return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    },

    clamp01(value) {
      return NR.utils.clamp(value, 0, 1);
    },

    distanceSq(ax, ay, bx, by) {
      const dx = ax - bx;
      const dy = ay - by;
      return dx * dx + dy * dy;
    },

    pointSegmentDistanceSq(px, py, ax, ay, bx, by) {
      const abx = bx - ax;
      const aby = by - ay;
      const lengthSq = abx * abx + aby * aby;
      if (lengthSq === 0) return NR.utils.distanceSq(px, py, ax, ay);
      let t = ((px - ax) * abx + (py - ay) * aby) / lengthSq;
      t = NR.utils.clamp(t, 0, 1);
      return NR.utils.distanceSq(px, py, ax + abx * t, ay + aby * t);
    },

    mulberry32(seed) {
      let a = seed >>> 0;
      return function random() {
        a += 0x6d2b79f5;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    prefersReducedMotion() {
      return (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    },

    /* Small helper for animated pulses; keeps draw code declarative. */
    pulse(time, speed, min, max) {
      const wave = (Math.sin(time * speed) + 1) * 0.5;
      return min + (max - min) * wave;
    },
  };

  /* ==========================================================================
     Persistence
     Everything is namespaced and validated on read. A corrupt value never
     crashes the game and never wipes unrelated preferences.
     ========================================================================== */

  class SaveStore {
    constructor(key = "neonRush.save.v1") {
      this.key = key;
      this.available = true;
      this.found = false;
      this.data = this.defaults();
    }

    defaults() {
      return {
        best: 0,
        unlocked: 1,
        levelBest: {},
        sound: true,
        music: true,
        volume: 0.7,
        reducedShake: false,
        reducedFx: false,
      };
    }

    load() {
      const defaults = this.defaults();
      let parsed = null;

      try {
        const raw = window.localStorage.getItem(this.key);
        if (raw) {
          parsed = JSON.parse(raw);
          this.found = true;
        }
      } catch (error) {
        this.available = false;
      }

      if (!parsed || typeof parsed !== "object") {
        this.data = defaults;
        return this.data;
      }

      const safeNumber = (value, fallback, min, max) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return NR.utils.clamp(num, min, max);
      };

      const data = {
        best: Math.floor(safeNumber(parsed.best, 0, 0, 99_999_999)),
        unlocked: Math.floor(safeNumber(parsed.unlocked, 1, 1, NR.LEVELS.length)),
        sound: parsed.sound !== false,
        music: parsed.music !== false,
        volume: safeNumber(parsed.volume, 0.7, 0, 1),
        reducedShake: parsed.reducedShake === true,
        reducedFx: parsed.reducedFx === true,
        levelBest: {},
      };

      if (parsed.levelBest && typeof parsed.levelBest === "object") {
        for (const level of NR.LEVELS) {
          const value = Number(parsed.levelBest[level.id]);
          if (Number.isFinite(value) && value > 0) {
            data.levelBest[level.id] = Math.floor(value);
          }
        }
      }

      /* If the player has never saved before, honor the OS reduced-motion
         preference as a gentle accessibility default. */
      if (!this.found && NR.utils.prefersReducedMotion()) {
        data.reducedFx = true;
        data.reducedShake = true;
      }

      this.data = data;
      return data;
    }

    save() {
      try {
        window.localStorage.setItem(this.key, JSON.stringify(this.data));
        this.available = true;
        return true;
      } catch (error) {
        this.available = false;
        return false;
      }
    }

    update(patch) {
      Object.assign(this.data, patch);
      return this.save();
    }

    recordRun(score, highestLevel, levelScoreSnapshots) {
      const data = this.data;
      if (Number.isFinite(score) && score > data.best) {
        data.best = Math.floor(score);
      }
      data.unlocked = NR.utils.clamp(
        Math.max(data.unlocked, highestLevel),
        1,
        NR.LEVELS.length
      );
      if (levelScoreSnapshots) {
        for (const [level, value] of Object.entries(levelScoreSnapshots)) {
          if (!Number.isFinite(value)) continue;
          const id = Number(level);
          if (!data.levelBest[id] || value > data.levelBest[id]) {
            data.levelBest[id] = Math.floor(value);
          }
        }
      }
      this.save();
    }

    unlock(levelId) {
      const next = NR.utils.clamp(levelId + 1, 1, NR.LEVELS.length);
      if (next > this.data.unlocked) {
        this.data.unlocked = next;
        this.save();
        return true;
      }
      return false;
    }

    resetProgress() {
      this.data.best = 0;
      this.data.unlocked = 1;
      this.data.levelBest = {};
      this.save();
    }
  }

  NR.SaveStore = SaveStore;
})();
