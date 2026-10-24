/* ==========================================================================
   NEON RUSH — game controller, simulation, rendering
   Classic script (no build step). Depends on config.js, audio.js and
   environment.js. One requestAnimationFrame loop drives everything.
   ========================================================================== */

(function () {
  "use strict";

  const NR = window.NR;
  const U = NR.utils;
  const T = NR.TUNING;
  const C = NR.COLORS;
  const TAU = Math.PI * 2;
  const MONO_FONT =
    '"Cascadia Mono", "JetBrains Mono", "SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

  /* Converts an opaque palette hex (#abc or #aabbcc) to rgba() with the given
     alpha. The renderer calls this for rails, glows, and shield strokes. */
  function colorWithAlpha(hex, alpha) {
    const safeAlpha = U.clamp(Number(alpha) || 0, 0, 1);
    if (typeof hex !== "string" || hex.charAt(0) !== "#") {
      return hex;
    }
    let value = hex.slice(1);
    if (value.length === 3) {
      value = value
        .split("")
        .map((char) => char + char)
        .join("");
    }
    if (value.length !== 6) return hex;
    const number = parseInt(value, 16);
    if (!Number.isFinite(number)) return hex;
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }

  const MOVEMENT_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);

  const GAME_SCENE_STATES = new Set([
    "playing",
    "paused",
    "dying",
    "levelcomplete",
    "gameover",
    "victory",
  ]);

  const MENU_STATES = new Set(["menu", "levels", "howto", "settings"]);

  class NeonRush {
    constructor() {
      this.canvas = document.getElementById("scene");
      this.ctx = this.canvas.getContext("2d");
      this.cacheDom();

      this.saveStore = new NR.SaveStore();
      this.save = this.saveStore.load();
      this.audio = new NR.AudioSystem({
        enabled: this.save.sound,
        volume: this.save.volume,
        musicEnabled: this.save.music,
      });
      this.env = new NR.Environment(this.canvas);

      this.state = "menu";
      this.screenName = "menu";
      this.w = 1;
      this.h = 1;
      this.dpr = 1;
      this.arena = { x: 0, y: 0, w: 1, h: 1, bottom: 1 };
      this.scale = 1;
      this.fallScale = 1;
      this.playerSpeed = 420;
      this.touch = false;

      this.player = this.createPlayer();
      this.obstacles = [];
      this.orbs = [];
      this.powerups = [];
      this.particles = [];
      this.rings = [];
      this.floatTexts = [];

      this.run = null;
      this.level = NR.LEVELS[0];
      this.levelTime = 0;
      this.wave = 1;
      this.spawnTimer = 0;
      this.orbTimer = 0;
      this.powerupTimer = 0;
      this.eventIndex = 0;
      this.activePowerup = null;
      this.levelScoreSnapshots = {};
      this.autoAdvance = 0;
      this.autoAdvanceTotal = 4.5;
      this.lastSpawnX = null;

      this.time = 0;
      this.gameTime = 0;
      this.shake = 0;
      this.dyingTimer = 0;

      this.keys = new Set();
      this.joystick = { x: 0, y: 0, active: false, pointerId: null };
      this.hudCache = {};
      this.toastTimer = null;
      this.bannerTimer = null;
      this.flashTimer = null;
      this.pulseFlashTimer = null;
      this.lastTimestamp = performance.now();
      this.resizeScheduled = false;
      this.boundLoop = this.loop.bind(this);

      this.detectTouch();
      this.bindEvents();
      this.syncPreferences();
      this.refreshMeta();
      this.resize();
      this.setState("menu");
      this.showScreen("menu", { focus: false });
      this.updateHud(true);

      requestAnimationFrame(this.boundLoop);
    }

    /* ====================================================================
       DOM cache
       ==================================================================== */

    cacheDom() {
      const byId = (id) => document.getElementById(id);
      this.el = {
        hud: byId("hud"),
        hudLevelIndex: byId("hud-level-index"),
        hudWave: byId("hud-wave"),
        hudLevelName: byId("hud-level-name"),
        hudScore: byId("hud-score"),
        hudBest: byId("hud-best"),
        hudObjective: byId("hud-objective"),
        hudTimer: byId("hud-timer"),
        hudDuration: byId("hud-duration"),
        hudProgressBar: byId("hud-progress-bar"),
        hudProgressFill: byId("hud-progress-fill"),
        hudLives: byId("hud-lives"),
        hudEnergy: byId("hud-energy"),
        hudDash: byId("hud-dash"),
        hudDashFill: byId("hud-dash-fill"),
        hudPowerup: byId("hud-powerup"),
        hudPowerupName: byId("hud-powerup-name"),
        hudPowerupTime: byId("hud-powerup-time"),
        hudPulse: byId("hud-pulse"),
        hudCombo: byId("hud-combo"),
        hudComboValue: byId("hud-combo-value"),
        hudComboFill: byId("hud-combo-fill"),
        damageFlash: byId("damage-flash"),
        pulseFlash: byId("pulse-flash"),
        banner: byId("banner"),
        bannerKicker: byId("banner-kicker"),
        bannerTitle: byId("banner-title"),
        bannerSub: byId("banner-sub"),
        toast: byId("toast"),
        touchControls: byId("touch-controls"),
        joystick: byId("joystick"),
        joystickKnob: byId("joystick-knob"),
        dashBtn: byId("dash-btn"),
        dashBtnRing: byId("dash-btn-ring"),
        dashBtnSub: byId("dash-btn-sub"),
        pulseBtn: byId("pulse-btn"),
        pulseBtnRing: byId("pulse-btn-ring"),
        pulseBtnSub: byId("pulse-btn-sub"),
        musicStatus: byId("music-status"),
        musicState: byId("music-state"),
        menuBest: byId("menu-best"),
        menuLevels: byId("menu-levels"),
        levelGrid: byId("level-grid"),
        settingSound: byId("setting-sound"),
        settingMusic: byId("setting-music"),
        settingVolume: byId("setting-volume"),
        volumeValue: byId("volume-value"),
        settingShake: byId("setting-shake"),
        settingFx: byId("setting-fx"),
        resetConfirm: byId("reset-confirm"),
        pauseScore: byId("pause-score"),
        pauseLevel: byId("pause-level"),
        pauseTime: byId("pause-time"),
        lcScore: byId("lc-score"),
        lcTime: byId("lc-time"),
        lcEnergy: byId("lc-energy"),
        lcLives: byId("lc-lives"),
        lcNextLabel: byId("lc-next-label"),
        lcName: byId("levelcomplete-name"),
        autoFill: byId("auto-advance-fill"),
        autoTime: byId("auto-advance-time"),
        goScore: byId("go-score"),
        goBest: byId("go-best"),
        goLevel: byId("go-level"),
        goEnergy: byId("go-energy"),
        goTime: byId("go-time"),
        goOrbs: byId("go-orbs"),
        goRecord: byId("gameover-record"),
        vScore: byId("v-score"),
        vBest: byId("v-best"),
        vTime: byId("v-time"),
        vEnergy: byId("v-energy"),
        vOrbs: byId("v-orbs"),
        vRecord: byId("victory-record"),
      };

      this.screens = {};
      document.querySelectorAll("[data-screen]").forEach((screen) => {
        this.screens[screen.dataset.screen] = screen;
      });
    }

    /* ====================================================================
       Input and lifecycle listeners — registered exactly once
       ==================================================================== */

    bindEvents() {
      document.addEventListener("pointerdown", () => this.audio.unlock(), { passive: true });

      document.addEventListener("click", (event) => {
        const target = event.target.closest("[data-action]");
        if (!target) return;
        event.preventDefault();
        this.audio.unlock();
        const action = target.dataset.action;
        if (action !== "sound-toggle") this.audio.click();
        this.handleAction(action, target);
      });

      document.addEventListener("pointerover", (event) => {
        if (event.pointerType && event.pointerType !== "mouse") return;
        const target = event.target.closest("button, .level-card");
        if (!target) return;
        if (event.relatedTarget && target.contains(event.relatedTarget)) return;
        this.audio.hover();
      });

      window.addEventListener("keydown", (event) => this.onKeyDown(event));
      window.addEventListener("keyup", (event) => this.onKeyUp(event));

      window.addEventListener("resize", () => this.requestResize());
      window.addEventListener("orientationchange", () => this.requestResize());

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.clearInputs();
          if (this.state === "playing") this.pauseGame();
        } else {
          this.lastTimestamp = performance.now();
        }
      });

      window.addEventListener("blur", () => {
        this.clearInputs();
        if (this.state === "playing") this.pauseGame();
      });

      window.addEventListener("beforeunload", () => {
        if (this.run && !this.run.finalized) this.finalizeRun();
        else this.saveStore.save();
      });

      document.addEventListener(
        "touchmove",
        (event) => {
          if (this.state === "playing") event.preventDefault();
        },
        { passive: false }
      );

      document.addEventListener("contextmenu", (event) => {
        if (this.state === "playing") event.preventDefault();
      });

      this.bindJoystick();
      this.el.dashBtn.addEventListener("click", (event) => {
        event.preventDefault();
        this.audio.unlock();
        this.tryDash();
      });

      this.el.settingSound.addEventListener("change", (event) => {
        this.setSound(event.target.checked);
      });

      this.el.settingMusic.addEventListener("change", (event) => {
        this.setMusic(event.target.checked);
      });

      this.el.settingVolume.addEventListener("input", (event) => {
        const value = U.clamp(Number(event.target.value) / 100, 0, 1);
        this.audio.setVolume(value);
        this.el.volumeValue.textContent = `${Math.round(value * 100)}%`;
      });

      this.el.settingVolume.addEventListener("change", () => {
        this.save.volume = this.audio.volume;
        this.saveStore.save();
      });

      this.el.settingShake.addEventListener("change", (event) => {
        this.save.reducedShake = event.target.checked;
        this.saveStore.save();
        if (this.save.reducedShake) this.shake = 0;
        this.showToast(event.target.checked ? "GENTLE IMPACT FEEDBACK" : "STANDARD IMPACT FEEDBACK");
      });

      this.el.settingFx.addEventListener("change", (event) => {
        this.save.reducedFx = event.target.checked;
        this.saveStore.save();
        this.env.setReducedFx(this.save.reducedFx);
        this.showToast(event.target.checked ? "REDUCED EFFECTS ENABLED" : "FULL EFFECTS ENABLED");
      });

      const coarseQuery = window.matchMedia("(pointer: coarse)");
      const onPointerChange = () => {
        this.detectTouch();
        this.requestResize();
      };
      if (coarseQuery.addEventListener) coarseQuery.addEventListener("change", onPointerChange);
      else if (coarseQuery.addListener) coarseQuery.addListener(onPointerChange);

      document.addEventListener(
        "touchstart",
        () => {
          if (!this.touch) {
            this.touch = true;
            document.body.classList.add("is-touch");
            this.requestResize();
          }
        },
        { passive: true, once: true }
      );
    }

    bindJoystick() {
      const joystick = this.el.joystick;
      const knob = this.el.joystickKnob;

      const move = (event) => {
        if (!this.joystick.active || event.pointerId !== this.joystick.pointerId) return;
        const rect = joystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = event.clientX - cx;
        let dy = event.clientY - cy;
        const maxRadius = rect.width / 2 - 18;
        const distance = Math.hypot(dx, dy);
        if (distance > maxRadius) {
          dx = (dx / distance) * maxRadius;
          dy = (dy / distance) * maxRadius;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const nx = U.clamp(dx / maxRadius, -1, 1);
        const ny = U.clamp(dy / maxRadius, -1, 1);
        const dead = 0.12;
        this.joystick.x = Math.abs(nx) < dead ? 0 : nx;
        this.joystick.y = Math.abs(ny) < dead ? 0 : ny;
      };

      const end = (event) => {
        if (event && event.pointerId !== undefined && event.pointerId !== this.joystick.pointerId) return;
        this.resetJoystick();
      };

      joystick.addEventListener("pointerdown", (event) => {
        if (this.state !== "playing" || !this.touch) return;
        event.preventDefault();
        this.audio.unlock();
        this.joystick.active = true;
        this.joystick.pointerId = event.pointerId;
        try {
          joystick.setPointerCapture(event.pointerId);
        } catch (error) {
          /* Pointer capture is a progressive enhancement. */
        }
        move(event);
      });

      joystick.addEventListener("pointermove", move);
      joystick.addEventListener("pointerup", end);
      joystick.addEventListener("pointercancel", end);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    }

    requestResize() {
      if (this.resizeScheduled) return;
      this.resizeScheduled = true;
      requestAnimationFrame(() => {
        this.resizeScheduled = false;
        this.resize();
      });
    }

    detectTouch() {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      this.touch = coarse || (navigator.maxTouchPoints > 0 && window.innerWidth < 900);
      document.body.classList.toggle("is-touch", this.touch);
    }

    /* ====================================================================
       Screen and state management
       ==================================================================== */

    setState(next) {
      this.state = next;
      const hudVisible = ["playing", "dying", "paused", "levelcomplete"].includes(next);
      document.body.classList.toggle("is-playing", next === "playing");
      document.body.classList.toggle("is-dying", next === "dying");
      this.el.hud.classList.toggle("is-visible", hudVisible);
      this.el.hud.setAttribute("aria-hidden", hudVisible ? "false" : "true");
      if (next !== "playing") this.resetJoystick();
      this.audio.setIntensity(this.currentIntensity());
      this.audio.setMode(
        next === "playing" || next === "dying"
          ? "game"
          : next === "paused"
            ? "pause"
            : "menu"
      );
    }

    currentIntensity() {
      if (this.state === "playing" && this.run) {
        const progress = this.level.duration
          ? U.clamp(this.levelTime / this.level.duration, 0, 1)
          : 0;
        const comboBoost = U.clamp((this.run.combo || 0) / 40, 0, 0.08);
        return Math.min(1, 0.2 + (this.level.difficulty / 5) * 0.55 + progress * 0.2 + comboBoost);
      }
      return 0.18;
    }

    showScreen(name, options = {}) {
      this.screenName = name;
      for (const [key, screen] of Object.entries(this.screens)) {
        const active = key === name;
        screen.classList.toggle("is-active", active);
        screen.setAttribute("aria-hidden", active ? "false" : "true");
        if (active) screen.removeAttribute("inert");
        else screen.setAttribute("inert", "");
      }

      if (!name) {
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        return;
      }

      if (options.focus !== false) {
        const screen = this.screens[name];
        const target =
          screen.querySelector(".btn--primary") ||
          screen.querySelector(".level-card__deploy:not(:disabled)") ||
          screen.querySelector(".btn--back") ||
          screen.querySelector("button:not(:disabled)");
        if (target) {
          requestAnimationFrame(() => {
            if (this.screenName === name) target.focus({ preventScroll: true });
          });
        }
      }
    }

    handleAction(action, element) {
      switch (action) {
        case "play":
          this.startRun(1);
          break;
        case "levels":
          this.openLevelSelect();
          break;
        case "howto":
          this.setState("howto");
          this.showScreen("howto");
          break;
        case "settings":
          this.setState("settings");
          this.el.resetConfirm.hidden = true;
          this.showScreen("settings");
          break;
        case "back":
          this.goBack();
          break;
        case "select-level": {
          const id = Number(element.dataset.level);
          if (Number.isFinite(id) && id >= 1 && id <= this.save.unlocked) {
            this.startRun(id);
          }
          break;
        }
        case "pause":
          this.pauseGame();
          break;
        case "pulse":
          this.tryPulse();
          break;
        case "resume":
          this.resumeGame();
          break;
        case "restart":
          this.startRun(1);
          break;
        case "menu":
          this.returnToMenu();
          break;
        case "continue-level":
          this.continueLevel();
          break;
        case "retry":
        case "replay":
          this.startRun(1);
          break;
        case "sound-toggle":
          this.toggleSound();
          break;
        case "music-toggle":
          this.setMusic(!this.save.music);
          break;
        case "reset-request":
          this.el.resetConfirm.hidden = false;
          this.el.resetConfirm.querySelector("button")?.focus({ preventScroll: true });
          break;
        case "reset-cancel":
          this.el.resetConfirm.hidden = true;
          this.screens.settings
            .querySelector('[data-action="reset-request"]')
            ?.focus({ preventScroll: true });
          break;
        case "reset-confirm":
          this.resetProgress();
          break;
        default:
          break;
      }
    }

    openLevelSelect() {
      this.buildLevelCards();
      this.setState("levels");
      this.showScreen("levels");
    }

    goBack() {
      if (["levels", "howto", "settings"].includes(this.state)) {
        const from = this.state;
        this.el.resetConfirm.hidden = true;
        this.setState("menu");
        this.showScreen("menu", { focus: false });
        const menuButton = document.querySelector(`.menu-panel [data-action="${from}"]`);
        if (menuButton) menuButton.focus({ preventScroll: true });
      } else if (this.state === "gameover" || this.state === "victory") {
        this.returnToMenu();
      }
    }

    /* ====================================================================
       Preferences
       ==================================================================== */

    syncPreferences() {
      const data = this.save;
      this.audio.enabled = data.sound;
      this.audio.musicEnabled = data.music;
      this.audio.volume = data.volume;
      this.audio.applyVolume();
      this.audio.setMusicEnabled(data.music);
      this.env.setReducedFx(data.reducedFx);

      this.el.settingSound.checked = data.sound;
      if (this.el.settingMusic) this.el.settingMusic.checked = data.music;
      this.el.settingShake.checked = data.reducedShake;
      this.el.settingFx.checked = data.reducedFx;
      this.el.settingVolume.value = String(Math.round(data.volume * 100));
      this.el.volumeValue.textContent = `${Math.round(data.volume * 100)}%`;
      this.syncSoundUI();
      this.syncMusicUI();
      document.body.classList.toggle("reduce-motion", U.prefersReducedMotion());
    }

    syncSoundUI() {
      const on = this.save.sound;
      document.body.classList.toggle("is-muted", !on);
      document.querySelectorAll('[data-action="sound-toggle"]').forEach((button) => {
        button.setAttribute("aria-pressed", String(on));
        button.setAttribute("aria-label", on ? "Mute sound" : "Unmute sound");
        const label = button.querySelector(".sound-label");
        if (label) label.textContent = on ? "SOUND ON" : "SOUND OFF";
      });
      if (this.el.settingSound) this.el.settingSound.checked = on;
    }

    syncMusicUI() {
      const musicOn = Boolean(this.save.music);
      const audible = musicOn && this.save.sound;
      const state = audible ? "ON" : musicOn ? "MUTED" : "OFF";
      document.body.classList.toggle("is-music-off", !musicOn);
      if (this.el.settingMusic) this.el.settingMusic.checked = musicOn;
      if (this.el.musicState) this.el.musicState.textContent = state;
      if (this.el.musicStatus) {
        this.el.musicStatus.setAttribute("aria-pressed", String(musicOn));
        this.el.musicStatus.setAttribute(
          "aria-label",
          audible
            ? "Adaptive synth score: Neon Drive, on. Toggle music"
            : musicOn
              ? "Adaptive synth score muted by the master sound setting. Toggle music"
              : "Adaptive synth score off. Toggle music"
        );
      }
    }

    toggleSound() {
      this.setSound(!this.save.sound);
    }

    setSound(enabled) {
      this.audio.unlock();
      this.save.sound = Boolean(enabled);
      this.saveStore.save();
      this.audio.setEnabled(this.save.sound);
      this.syncSoundUI();
      this.syncMusicUI();
      if (this.save.sound) {
        this.audio.click();
        this.showToast("AUDIO ONLINE");
      } else {
        this.showToast("AUDIO MUTED");
      }
    }

    setMusic(enabled) {
      this.audio.unlock();
      this.save.music = Boolean(enabled);
      this.saveStore.save();
      this.audio.setMusicEnabled(this.save.music);
      this.syncMusicUI();
      if (this.save.music && this.save.sound) {
        this.audio.pulseReady();
        this.showToast("ADAPTIVE SCORE ONLINE", 1800);
      } else {
        this.showToast("ADAPTIVE SCORE OFFLINE", 1800);
      }
    }

    resetProgress() {
      this.saveStore.resetProgress();
      this.el.resetConfirm.hidden = true;
      this.refreshMeta();
      this.updateHud(true);
      this.showToast("PROGRESS ERASED");
      this.screens.settings
        .querySelector('[data-action="reset-request"]')
        ?.focus({ preventScroll: true });
    }

    /* ====================================================================
       Menu metadata and level cards
       ==================================================================== */

    refreshMeta() {
      const data = this.saveStore.data;
      this.save = data;
      if (this.el.menuBest) this.el.menuBest.textContent = U.formatNumber(data.best);
      if (this.el.menuLevels) this.el.menuLevels.textContent = String(data.unlocked);
      this.buildLevelCards();
      if (this.el.hudBest && !this.run) this.el.hudBest.textContent = U.formatNumber(data.best);
    }

    buildLevelCards() {
      if (!this.el.levelGrid) return;
      const data = this.saveStore.data;
      const lockSvg =
        '<span class="level-card__lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>';

      this.el.levelGrid.innerHTML = NR.LEVELS.map((level) => {
        const locked = level.id > data.unlocked;
        const best = data.levelBest[level.id] || 0;
        const cleared = best > 0;
        const status = locked ? "LOCKED" : cleared ? "CLEARED" : "ONLINE";
        const number = String(level.id).padStart(2, "0");
        return `
          <article class="level-card${locked ? " is-locked" : ""}" style="--accent: ${level.accent}">
            <div class="level-card__top">
              <span class="level-card__number">${number}</span>
              <span class="level-card__status${locked ? " level-card__status--locked" : ""}">${status}</span>
            </div>
            <h3 class="level-card__name">${level.name}</h3>
            <p class="level-card__brief">${level.brief}</p>
            <div class="level-card__meta">
              <span>OBJ <strong>${level.duration}s</strong></span>
              <span>THREAT <strong>${level.threat}</strong></span>
            </div>
            <div class="level-card__best"><span>BEST</span><span>${U.formatNumber(best)}</span></div>
            <button class="level-card__deploy" type="button" data-action="select-level" data-level="${level.id}"
              aria-label="Deploy to Zone ${level.id}, ${level.name}${locked ? ", locked" : ""}" ${locked ? "disabled" : ""}>
              ${locked ? "LOCKED" : "DEPLOY"}
            </button>
            ${locked ? lockSvg : ""}
          </article>`;
      }).join("");
    }

    /* ====================================================================
       Run lifecycle
       ==================================================================== */

    createPlayer() {
      return {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 10,
        angle: 0,
        invuln: 0,
        dashTime: 0,
        dashCooldown: 0,
        dashVec: { x: 0, y: -1 },
        lastDir: { x: 0, y: -1 },
        trail: [],
        trailTimer: 0,
        engineTimer: 0,
        damageTimer: 0,
        alive: true,
      };
    }

    startRun(startLevelId = 1) {
      this.audio.unlock();
      if (this.run && !this.run.finalized) this.finalizeRun();
      this.hideBanner();
      this.hideToast();
      this.clearWorld();

      const requested = Number.isFinite(startLevelId) ? Math.floor(startLevelId) : 1;
      const id = U.clamp(requested, 1, this.saveStore.data.unlocked);
      this.player = this.createPlayer();
      this.run = {
        score: 0,
        lives: T.maxLives,
        energy: 0,
        orbs: 0,
        combo: 0,
        comboTimer: 0,
        pulse: 0,
        totalTime: 0,
        levelIndex: id - 1,
        highestLevel: id,
        clearedLevel: id - 1,
        bestAtStart: this.saveStore.data.best,
        isNewBest: false,
        finalized: false,
        recordShown: false,
        levelOrbs: 0,
      };
      this.levelScoreSnapshots = {};
      this.level = NR.LEVELS[id - 1];
      this.activePowerup = null;
      this.shake = 0;
      this.gameTime = 0;
      this.showScreen(null);
      this.setState("playing");
      this.resize();
      this.startLevel(id - 1);
      this.updateHud(true);
    }

    startLevel(index) {
      const level = NR.LEVELS[index];
      if (!level || !this.run) return;

      this.level = level;
      this.run.levelIndex = index;
      this.run.highestLevel = Math.max(this.run.highestLevel, level.id);
      this.run.levelOrbs = 0;
      this.run.combo = 0;
      this.run.comboTimer = 0;
      this.levelTime = 0;
      this.wave = 1;
      this.spawnTimer = T.levelStartGrace + 0.7;
      this.orbTimer = 1.2;
      this.powerupTimer = U.rand(level.powerupInterval[0] * 0.85, level.powerupInterval[1]);
      this.eventIndex = 0;
      this.lastSpawnX = null;
      this.activePowerup = null;
      this.autoAdvance = 0;

      this.obstacles = [];
      this.orbs = [];
      this.powerups = [];
      this.particles = [];
      this.rings = [];
      this.floatTexts = [];
      this.shake = 0;
      this.dyingTimer = 0;

      this.spawnPlayerAtStart();
      this.player.invuln = 2;

      this.showBanner(
        `ZONE ${String(level.id).padStart(2, "0")}`,
        level.name,
        level.objective
      );
      this.showToast(
        this.touch ? "DRAG THE FLIGHT PAD · TAP DASH" : level.hint,
        3400
      );
      this.audio.levelStart();
      this.updateHud(true);
    }

    spawnPlayerAtStart() {
      const player = this.player;
      player.x = this.arena.x + this.arena.w / 2;
      player.y = this.arena.y + this.arena.h * 0.76;
      player.vx = 0;
      player.vy = 0;
      player.angle = 0;
      player.invuln = 2;
      player.dashTime = 0;
      player.dashCooldown = 0;
      player.dashVec = { x: 0, y: -1 };
      player.lastDir = { x: 0, y: -1 };
      player.trail = [];
      player.trailTimer = 0;
      player.engineTimer = 0;
      player.damageTimer = 0;
      player.alive = true;
      player.r = 10 * this.scale;
    }

    finalizeRun() {
      if (!this.run || this.run.finalized) return;
      const score = Math.max(0, Math.floor(this.run.score));
      if (!this.levelScoreSnapshots[this.level.id]) {
        this.levelScoreSnapshots[this.level.id] = score;
      }
      this.run.isNewBest = score > this.run.bestAtStart;
      this.run.score = score;
      this.saveStore.recordRun(
        score,
        this.run.clearedLevel + 1,
        this.levelScoreSnapshots
      );
      this.run.finalized = true;
      this.save = this.saveStore.data;
      this.refreshMeta();
    }

    completeLevel() {
      if (this.state !== "playing" || !this.run) return;
      const level = this.level;
      const bonus = T.levelBonusBase * level.id + this.run.levelOrbs * 10;

      this.run.score += bonus;
      this.run.clearedLevel = Math.max(this.run.clearedLevel, level.id);
      this.run.highestLevel = Math.max(this.run.highestLevel, level.id);
      this.run.lives = Math.min(T.maxLives, this.run.lives + 1);
      this.levelScoreSnapshots[level.id] = Math.floor(this.run.score);
      this.saveStore.recordRun(
        Math.floor(this.run.score),
        level.id + 1,
        this.levelScoreSnapshots
      );
      this.save = this.saveStore.data;
      this.refreshMeta();
      this.clearInputs();

      if (level.id >= NR.LEVELS.length) {
        this.winGame();
        return;
      }

      this.spawnRing(
        this.player.x,
        this.player.y,
        level.accent,
        Math.min(this.w, this.h) * 0.2,
        0.8,
        2
      );
      this.spawnBurst(this.player.x, this.player.y, {
        colors: [level.accent, C.cyan, C.white],
        count: this.save.reducedFx ? 10 : 26,
        speed: 220,
        size: 3,
        life: 0.9,
      });
      this.audio.levelClear();
      this.hideBanner();
      this.setState("levelcomplete");
      this.showScreen("levelcomplete");
      this.autoAdvanceTotal = 4.5;
      this.autoAdvance = this.autoAdvanceTotal;
      this.populateLevelComplete();
      this.updateHud(true);
      this.showToast(
        `ZONE BONUS +${U.formatNumber(bonus)} · LIFE REPAIRED`,
        3200
      );
    }

    continueLevel() {
      if (this.state !== "levelcomplete" || !this.run) return;
      const nextIndex = this.run.levelIndex + 1;
      if (nextIndex >= NR.LEVELS.length) {
        this.winGame();
        return;
      }
      this.autoAdvance = 0;
      this.showScreen(null);
      this.setState("playing");
      this.resize();
      this.startLevel(nextIndex);
      this.updateHud(true);
    }

    winGame() {
      if (!this.run) return;
      this.run.score += T.victoryBonus;
      this.run.clearedLevel = NR.LEVELS.length;
      this.run.highestLevel = NR.LEVELS.length;
      this.finalizeRun();

      this.player.alive = false;
      this.obstacles = [];
      this.orbs = [];
      this.powerups = [];
      this.activePowerup = null;
      this.clearInputs();
      this.hideBanner();
      this.hideToast();
      this.setState("victory");
      this.showScreen("victory");
      this.populateVictory();
      this.audio.victory();
      this.audio.setIntensity(0.28);
      this.spawnVictoryBurst();
    }

    gameOver() {
      if (!this.run || this.state === "gameover") return;
      this.finalizeRun();
      this.clearInputs();
      this.hideBanner();
      this.hideToast();
      this.setState("gameover");
      this.showScreen("gameover");
      this.populateGameOver();
      this.audio.gameOver();
      this.audio.setIntensity(0.15);
    }

    pauseGame() {
      if (this.state !== "playing") return;
      this.clearInputs();
      this.hideBanner();
      this.hideToast();
      this.populatePause();
      this.setState("paused");
      this.showScreen("pause");
    }

    resumeGame() {
      if (this.state !== "paused") return;
      this.clearInputs();
      this.showScreen(null);
      this.setState("playing");
      this.resize();
      this.lastTimestamp = performance.now();
      this.audio.unlock();
    }

    returnToMenu() {
      if (this.run && !this.run.finalized) this.finalizeRun();
      this.clearWorld();
      this.run = null;
      this.activePowerup = null;
      this.levelTime = 0;
      this.autoAdvance = 0;
      this.level = NR.LEVELS[0];
      this.hideBanner();
      this.hideToast();
      this.setState("menu");
      this.showScreen("menu", { focus: false });
      this.refreshMeta();
      this.updateHud(true);
      this.audio.setIntensity(0.18);
    }

    clearWorld() {
      this.obstacles = [];
      this.orbs = [];
      this.powerups = [];
      this.particles = [];
      this.rings = [];
      this.floatTexts = [];
      if (this.player) {
        this.player.alive = false;
        this.player.trail = [];
      }
      this.shake = 0;
      this.dyingTimer = 0;
    }

    updateDying(dt) {
      this.dyingTimer -= dt;
      this.gameTime += dt;
      if (this.dyingTimer <= 0) this.gameOver();
    }

    updateLevelComplete(dt) {
      this.autoAdvance = Math.max(0, this.autoAdvance - dt);
      const ratio = this.autoAdvanceTotal
        ? this.autoAdvance / this.autoAdvanceTotal
        : 0;
      if (this.el.autoFill) this.el.autoFill.style.transform = `scaleX(${ratio})`;
      if (this.el.autoTime) this.el.autoTime.textContent = String(Math.ceil(this.autoAdvance));
      if (this.autoAdvance <= 0) this.continueLevel();
    }

    /* ====================================================================
       Results screens
       ==================================================================== */

    populatePause() {
      if (!this.run) return;
      this.el.pauseScore.textContent = U.formatNumber(this.run.score);
      this.el.pauseLevel.textContent = String(this.level.id).padStart(2, "0");
      this.el.pauseTime.textContent = U.formatTime(this.run.totalTime);
    }

    populateLevelComplete() {
      if (!this.run) return;
      const level = this.level;
      const next = NR.LEVELS[this.run.levelIndex + 1];
      this.el.lcScore.textContent = U.formatNumber(this.run.score);
      this.el.lcTime.textContent = U.formatTime(this.levelTime);
      this.el.lcEnergy.textContent = U.formatNumber(this.run.levelOrbs);
      this.el.lcLives.textContent = `${this.run.lives} / ${T.maxLives}`;
      if (next) {
        this.el.lcName.textContent = `NEXT: ZONE ${String(next.id).padStart(2, "0")} — ${next.name}`;
        this.el.lcNextLabel.textContent = `ENTER ZONE ${String(next.id).padStart(2, "0")}`;
      } else {
        this.el.lcName.textContent = "FINAL ZONE SECURED";
        this.el.lcNextLabel.textContent = "COMPLETE THE RUN";
      }
      this.el.autoFill.style.transform = "scaleX(1)";
      this.el.autoTime.textContent = String(Math.ceil(this.autoAdvanceTotal));
      this.el.levelGrid?.setAttribute("data-current", String(level.id));
    }

    populateGameOver() {
      if (!this.run) return;
      const run = this.run;
      const data = this.saveStore.data;
      this.el.goScore.textContent = U.formatNumber(run.score);
      this.el.goBest.textContent = U.formatNumber(data.best);
      this.el.goLevel.textContent = String(run.highestLevel).padStart(2, "0");
      this.el.goLevel.title =
        NR.LEVELS[run.highestLevel - 1]?.name || "FIRST CONTACT";
      this.el.goEnergy.textContent = U.formatNumber(run.energy);
      this.el.goTime.textContent = U.formatTime(run.totalTime);
      this.el.goOrbs.textContent = U.formatNumber(run.orbs);
      this.el.goRecord.hidden = !(run.isNewBest && run.score > 0);
    }

    populateVictory() {
      if (!this.run) return;
      const run = this.run;
      const data = this.saveStore.data;
      this.el.vScore.textContent = U.formatNumber(run.score);
      this.el.vBest.textContent = U.formatNumber(data.best);
      this.el.vTime.textContent = U.formatTime(run.totalTime);
      this.el.vEnergy.textContent = U.formatNumber(run.energy);
      this.el.vOrbs.textContent = U.formatNumber(run.orbs);
      this.el.vRecord.hidden = !(run.isNewBest && run.score > 0);
    }

    /* ====================================================================
       HUD
       ==================================================================== */

    updateHud(force = false) {
      if (!this.run) {
        if (force) {
          this.el.hudLevelIndex.textContent = "LEVEL 01";
          this.el.hudLevelName.textContent = NR.LEVELS[0].name;
          this.el.hudObjective.textContent = NR.LEVELS[0].objective;
          this.el.hudTimer.textContent = "00:00";
          this.el.hudDuration.textContent = U.formatTime(NR.LEVELS[0].duration);
          this.el.hudProgressFill.style.width = "0%";
          this.el.hudScore.textContent = "0";
          this.el.hudBest.textContent = U.formatNumber(this.saveStore.data.best);
        }
        return;
      }

      const run = this.run;
      const level = this.level;
      const player = this.player;
      const cache = this.hudCache;
      const score = Math.max(0, Math.floor(run.score));

      if (force || cache.levelId !== level.id) {
        cache.levelId = level.id;
        this.el.hudLevelIndex.textContent = `LEVEL ${String(level.id).padStart(2, "0")}`;
        this.el.hudLevelName.textContent = level.name;
        this.el.hudObjective.textContent = level.objective;
        this.el.hudDuration.textContent = U.formatTime(level.duration);
      }

      if (force || cache.score !== score) {
        cache.score = score;
        this.el.hudScore.textContent = U.formatNumber(score);
      }

      const liveBest = Math.max(this.saveStore.data.best, score);
      if (force || cache.best !== liveBest) {
        cache.best = liveBest;
        this.el.hudBest.textContent = U.formatNumber(liveBest);
      }

      const timeText = U.formatTime(this.levelTime);
      if (force || cache.timeText !== timeText) {
        cache.timeText = timeText;
        this.el.hudTimer.textContent = timeText;
      }

      const progress = U.clamp(this.levelTime / level.duration, 0, 1);
      if (force || Math.abs(progress - (cache.progress || 0)) > 0.0005) {
        cache.progress = progress;
        this.el.hudProgressFill.style.width = `${(progress * 100).toFixed(2)}%`;
        this.el.hudProgressBar.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      }

      if (force || cache.wave !== this.wave) {
        cache.wave = this.wave;
        this.el.hudWave.textContent = `WAVE ${this.wave}`;
      }

      if (force || cache.lives !== run.lives) {
        cache.lives = run.lives;
        this.updateLivesDisplay(run.lives);
      }

      if (force || cache.energy !== run.energy) {
        cache.energy = run.energy;
        this.el.hudEnergy.textContent = U.formatNumber(run.energy);
      }

      const dashProgress = 1 - U.clamp(player.dashCooldown / T.dashCooldown, 0, 1);
      if (force || Math.abs(dashProgress - (cache.dashProgress || 0)) > 0.002) {
        cache.dashProgress = dashProgress;
        this.el.hudDashFill.style.transform = `scaleX(${dashProgress.toFixed(3)})`;
        this.el.dashBtnRing.style.setProperty("--dash-progress", dashProgress.toFixed(3));
      }
      const dashReady = player.dashCooldown <= 0;
      if (force || cache.dashReady !== dashReady) {
        cache.dashReady = dashReady;
        this.el.hudDash.classList.toggle("is-ready", dashReady);
        this.el.hudDash.setAttribute("aria-label", dashReady ? "Dash ready" : "Dash recharging");
        this.el.dashBtn.classList.toggle("is-cooling", !dashReady);
      }
      const dashSub = dashReady ? "READY" : `${player.dashCooldown.toFixed(1)}s`;
      if (force || cache.dashSub !== dashSub) {
        cache.dashSub = dashSub;
        this.el.dashBtnSub.textContent = dashSub;
      }

      const pulse = U.clamp(run.pulse || 0, 0, T.pulseMax);
      const pulseReady = pulse >= T.pulseMax;
      const pulseProgress = pulse / T.pulseMax;
      if (force || cache.pulse !== pulse) {
        cache.pulse = pulse;
        const pips = this.el.hudPulse.children;
        for (let i = 0; i < pips.length; i += 1) {
          pips[i].classList.toggle("is-charged", i < pulse);
        }
        this.el.hudPulse.classList.toggle("is-ready", pulseReady);
        this.el.hudPulse.setAttribute(
          "aria-label",
          `Nova Pulse: ${pulse} of ${T.pulseMax} cells charged${pulseReady ? ", ready" : ""}`
        );
        this.el.pulseBtn.classList.toggle("is-ready", pulseReady);
        this.el.pulseBtn.classList.toggle("is-cooling", !pulseReady);
        this.el.pulseBtn.setAttribute(
          "aria-label",
          pulseReady
            ? "Nova Pulse ready. Activate to clear nearby hazards."
            : `Nova Pulse: ${pulse} of ${T.pulseMax} cells charged`
        );
        this.el.pulseBtnSub.textContent = pulseReady ? "READY" : `${pulse}/${T.pulseMax}`;
        this.el.pulseBtnRing.style.setProperty("--pulse-progress", pulseProgress.toFixed(3));
      }

      const combo = run.combo >= 2 ? run.combo : 0;
      if (force || cache.combo !== combo) {
        const gained = combo > (cache.combo || 0);
        cache.combo = combo;
        this.el.hudCombo.hidden = combo < 2;
        if (combo >= 2) {
          this.el.hudComboValue.textContent = `x${this.getComboMultiplier().toFixed(1)}`;
          this.el.hudCombo.setAttribute(
            "aria-label",
            `Orb chain ${combo}, score multiplier ${this.getComboMultiplier().toFixed(1)}`
          );
          if (gained) {
            this.el.hudCombo.classList.remove("is-bumped");
            void this.el.hudCombo.offsetWidth;
            this.el.hudCombo.classList.add("is-bumped");
          }
        }
      }
      const comboFill = run.combo >= 2 ? U.clamp(run.comboTimer / T.comboWindow, 0, 1) : 0;
      if (force || Math.abs(comboFill - (cache.comboFill || 0)) > 0.01) {
        cache.comboFill = comboFill;
        this.el.hudComboFill.style.transform = `scaleX(${comboFill.toFixed(3)})`;
      }

      const power = this.activePowerup;
      const powerKey = power ? power.key : "";
      const powerTime = power ? power.timeLeft.toFixed(1) : "";
      if (force || cache.powerKey !== powerKey || cache.powerTime !== powerTime) {
        cache.powerKey = powerKey;
        cache.powerTime = powerTime;
        if (power) {
          const def = NR.POWERUPS[power.key];
          this.el.hudPowerup.hidden = false;
          this.el.hudPowerup.dataset.power = power.key;
          this.el.hudPowerupName.textContent = def.short;
          this.el.hudPowerupTime.textContent = power.timeLeft.toFixed(1);
          this.el.hudPowerup.style.setProperty("--power-color", def.color);
        } else {
          this.el.hudPowerup.hidden = true;
        }
      }
    }

    updateLivesDisplay(lives) {
      const safe = U.clamp(lives, 0, T.maxLives);
      let markup = "";
      for (let i = 0; i < T.maxLives; i += 1) {
        markup += `<span class="life${i < safe ? "" : " is-lost"}" aria-hidden="true"></span>`;
      }
      this.el.hudLives.innerHTML = markup;
      this.el.hudLives.setAttribute("aria-label", `${safe} of ${T.maxLives} lives remaining`);
    }

    bumpScore() {
      const el = this.el.hudScore;
      el.classList.remove("is-bumped");
      // Force a reflow so the CSS animation can restart.
      void el.offsetWidth;
      el.classList.add("is-bumped");
    }

    /* ====================================================================
       Transient UI
       ==================================================================== */

    showBanner(kicker, title, sub) {
      this.el.bannerKicker.textContent = kicker;
      this.el.bannerTitle.textContent = title;
      this.el.bannerSub.textContent = sub;
      this.el.banner.classList.remove("is-visible");
      void this.el.banner.offsetWidth;
      this.el.banner.classList.add("is-visible");
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => {
        this.el.banner.classList.remove("is-visible");
      }, 2600);
    }

    hideBanner() {
      clearTimeout(this.bannerTimer);
      this.el.banner.classList.remove("is-visible");
    }

    showToast(message, duration = 2200) {
      this.el.toast.textContent = message;
      this.el.toast.classList.add("is-visible");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.el.toast.classList.remove("is-visible");
      }, duration);
    }

    hideToast() {
      clearTimeout(this.toastTimer);
      this.el.toast.classList.remove("is-visible");
    }

    flashDamage() {
      const el = this.el.damageFlash;
      el.classList.remove("is-active");
      void el.offsetWidth;
      el.classList.add("is-active");
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => el.classList.remove("is-active"), 550);
    }

    flashPulse() {
      const el = this.el.pulseFlash;
      if (!el) return;
      el.classList.remove("is-active");
      void el.offsetWidth;
      el.classList.add("is-active");
      clearTimeout(this.pulseFlashTimer);
      this.pulseFlashTimer = setTimeout(() => el.classList.remove("is-active"), 600);
    }

    /* ====================================================================
       Keyboard and movement input
       ==================================================================== */

    onKeyDown(event) {
      const code = event.code;
      this.audio.unlock();

      if (this.state === "playing") {
        if (MOVEMENT_KEYS.has(code)) {
          this.keys.add(code);
          event.preventDefault();
        }
        if (code === "Space") {
          event.preventDefault();
          if (!event.repeat) this.tryDash();
        } else if (code === "KeyE" || code === "ShiftLeft" || code === "ShiftRight") {
          event.preventDefault();
          if (!event.repeat) this.tryPulse();
        } else if (code === "KeyP" || code === "Escape") {
          event.preventDefault();
          if (!event.repeat) this.pauseGame();
        }
        return;
      }

      if (this.state === "paused") {
        if (code === "KeyP" || code === "Escape") {
          event.preventDefault();
          if (!event.repeat) this.resumeGame();
        }
        return;
      }

      if (this.state === "levelcomplete") {
        if (code === "Enter" || code === "Space") {
          event.preventDefault();
          if (!event.repeat) this.continueLevel();
        }
        return;
      }

      if (this.state === "gameover") {
        if (code === "Enter") {
          event.preventDefault();
          if (!event.repeat) this.startRun(1);
        } else if (code === "Escape") {
          event.preventDefault();
          if (!event.repeat) this.returnToMenu();
        }
        return;
      }

      if (this.state === "victory") {
        if (code === "Enter") {
          event.preventDefault();
          if (!event.repeat) this.startRun(1);
        } else if (code === "Escape") {
          event.preventDefault();
          if (!event.repeat) this.returnToMenu();
        }
        return;
      }

      if (MENU_STATES.has(this.state)) {
        if (code === "Escape" && this.state !== "menu") {
          event.preventDefault();
          this.goBack();
        } else if (code === "Enter" && document.activeElement === document.body) {
          const primary = this.screens[this.screenName]?.querySelector(".btn--primary");
          if (primary) {
            event.preventDefault();
            primary.click();
          }
        }
      }
    }

    onKeyUp(event) {
      if (MOVEMENT_KEYS.has(event.code)) {
        this.keys.delete(event.code);
      }
    }

    clearInputs() {
      this.keys.clear();
      this.resetJoystick();
    }

    resetJoystick() {
      const joystick = this.el && this.el.joystick;
      if (joystick && this.joystick.pointerId !== null) {
        try {
          joystick.releasePointerCapture(this.joystick.pointerId);
        } catch (error) {
          /* Capture may already be released. */
        }
      }
      this.joystick.active = false;
      this.joystick.pointerId = null;
      this.joystick.x = 0;
      this.joystick.y = 0;
      if (this.el && this.el.joystickKnob) {
        this.el.joystickKnob.style.transform = "translate(0px, 0px)";
      }
    }

    getInputVector() {
      let x = 0;
      let y = 0;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;

      if (this.joystick.active) {
        x += this.joystick.x;
        y += this.joystick.y;
      }

      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }
      return { x, y, magnitude: Math.min(1, magnitude) };
    }

    /* ====================================================================
       Responsive arena
       ==================================================================== */

    resize() {
      const width = Math.max(320, window.innerWidth || 320);
      const height = Math.max(320, window.innerHeight || 320);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const oldArena = this.arena;
      const oldScale = this.scale;

      this.w = width;
      this.h = height;
      this.dpr = dpr;

      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
      }
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;

      const hudHeight = this.el.hud ? this.el.hud.getBoundingClientRect().height : 100;
      const isTouch = this.touch || document.body.classList.contains("is-touch");
      let bottomInset = 16;

      if (isTouch) {
        // Keep the arena above the touch buttons. Measure them when they are
        // visible; otherwise use a conservative size based on the layout mode.
        const controls = document.querySelector(".touch-controls");
        const measured = controls ? controls.getBoundingClientRect().height : 0;
        const controlsHeight =
          measured > 80
            ? measured
            : height <= 520 && width > height
              ? 96
              : width < 520
                ? 172
                : 202;
        bottomInset = Math.min(height * 0.45, controlsHeight + 10);
      }

      const top = Math.min(height * 0.38, hudHeight + 2);
      const marginX = width < 560 ? 10 : 16;
      // Short landscape phones are height-constrained; allow a smaller arena
      // rather than letting it slide underneath the touch controls.
      const minArena = height < 460 ? 84 : 150;
      const bottom = Math.min(height - 8, Math.max(top + minArena, height - bottomInset));
      const arenaHeight = Math.max(minArena, bottom - top);

      this.arena = {
        x: marginX,
        y: top,
        w: width - marginX * 2,
        h: arenaHeight,
        bottom: top + arenaHeight,
      };

      this.scale = U.clamp(Math.min(width, height) / 820, 0.8, 1.32);
      this.fallScale = U.clamp(arenaHeight / 720, 0.72, 1.18);
      this.playerSpeed = U.clamp(this.arena.w * 0.58, 300, 560);

      if (this.player) this.player.r = 10 * this.scale;

      if (this.run && oldArena.w > 1 && oldArena.h > 1) {
        const scaleRatio = this.scale / (oldScale || this.scale);
        const mapX = (x) => this.arena.x + ((x - oldArena.x) / oldArena.w) * this.arena.w;
        const mapY = (y) => this.arena.y + ((y - oldArena.y) / oldArena.h) * this.arena.h;

        if (this.player) {
          this.player.x = mapX(this.player.x);
          this.player.y = mapY(this.player.y);
          this.player.trail = [];
        }

        for (const obstacle of this.obstacles) {
          obstacle.x = mapX(obstacle.x);
          obstacle.y = mapY(obstacle.y);
          if (obstacle.baseX !== undefined) obstacle.baseX = mapX(obstacle.baseX);
          if (obstacle.steer) obstacle.steer *= scaleRatio;
          if (obstacle.r) obstacle.r *= scaleRatio;
          if (obstacle.length) {
            obstacle.length *= scaleRatio;
            obstacle.thickness *= scaleRatio;
          }
        }

        for (const orb of this.orbs) {
          orb.x = mapX(orb.x);
          orb.y = mapY(orb.y);
          orb.baseX = mapX(orb.baseX);
          orb.r *= scaleRatio;
        }

        for (const power of this.powerups) {
          power.x = mapX(power.x);
          power.y = mapY(power.y);
          power.baseX = mapX(power.baseX);
          power.baseY = mapY(power.baseY);
          power.r *= scaleRatio;
        }

        this.lastSpawnX = null;
      } else if (this.player) {
        this.player.x = this.arena.x + this.arena.w / 2;
        this.player.y = this.arena.y + this.arena.h * 0.76;
      }

      if (this.player) {
        const pad = this.player.r + 2;
        this.player.x = U.clamp(this.player.x, this.arena.x + pad, this.arena.x + this.arena.w - pad);
        this.player.y = U.clamp(this.player.y, this.arena.y + pad, this.arena.bottom - pad);
      }

      this.env.resize(width, height, dpr);
      this.updateHud(true);
    }

    /* ====================================================================
       Player simulation
       ==================================================================== */

    tryDash() {
      if (this.state !== "playing" || !this.player || !this.player.alive) return;
      const player = this.player;
      if (player.dashCooldown > 0) {
        this.audio.dashUnavailable();
        return;
      }

      const move = this.getInputVector();
      let dx = move.x;
      let dy = move.y;
      if (Math.hypot(dx, dy) < 0.2) {
        dx = player.lastDir.x;
        dy = player.lastDir.y;
      }
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;

      player.dashVec = { x: dx, y: dy };
      player.dashTime = T.dashDuration;
      player.dashCooldown = T.dashCooldown;
      player.invuln = Math.max(player.invuln, T.dashInvulnerability);

      this.audio.dash();
      this.spawnBurst(player.x, player.y, {
        colors: [C.cyan, C.magenta, C.white],
        count: this.save.reducedFx ? 6 : 16,
        speed: 180,
        size: 2.6,
        life: 0.45,
      });
      this.spawnRing(player.x, player.y, C.cyan, 42 * this.scale, 0.32, 2);
      this.shake = Math.max(this.shake, 2);
      this.updateHud(true);
    }

    tryPulse() {
      if (this.state !== "playing" || !this.player || !this.player.alive || !this.run) return;
      const run = this.run;
      if ((run.pulse || 0) < T.pulseMax) {
        this.audio.pulseUnavailable();
        return;
      }

      run.pulse = 0;
      const radius = T.pulseRadius * this.scale;
      const player = this.player;
      const scoreMultiplier = this.getScoreMultiplier();
      let destroyed = 0;
      let gained = 0;

      for (const obstacle of this.obstacles) {
        if (obstacle.dead) continue;
        let inRange = false;
        if (obstacle.type === "barrier") {
          const half = obstacle.length / 2;
          const cos = Math.cos(obstacle.angle);
          const sin = Math.sin(obstacle.angle);
          const reach = radius + obstacle.thickness;
          const d2 = U.pointSegmentDistanceSq(
            player.x,
            player.y,
            obstacle.x - cos * half,
            obstacle.y - sin * half,
            obstacle.x + cos * half,
            obstacle.y + sin * half
          );
          inRange = d2 < reach * reach;
        } else {
          const reach = radius + obstacle.r;
          inRange = U.distanceSq(player.x, player.y, obstacle.x, obstacle.y) < reach * reach;
        }
        if (!inRange) continue;

        obstacle.dead = true;
        destroyed += 1;
        const points = Math.round(T.pulseScore * scoreMultiplier);
        gained += points;
        this.spawnBurst(obstacle.x, obstacle.y, {
          colors: [C.cyan, C.white, obstacle.color || C.magenta],
          count: this.save.reducedFx ? 5 : 12,
          speed: 180,
          size: 2.4,
          life: 0.6,
        });
      }

      this.obstacles = this.obstacles.filter((obstacle) => !obstacle.dead);
      if (destroyed > 0) {
        run.score += gained;
        this.extendCombo(1, T.comboWindow);
        this.bumpScore();
        this.addFloatText(`NOVA +${U.formatNumber(gained)}`, player.x, player.y - player.r * 3.6, C.cyan, 11);
      }

      this.audio.pulse();
      this.flashPulse();
      this.shake = Math.max(this.shake, this.save.reducedShake ? 5 : 12);
      this.spawnRing(player.x, player.y, C.cyan, radius, 0.55, 3);
      this.spawnRing(player.x, player.y, C.white, radius * 0.68, 0.38, 1.5);
      this.spawnBurst(player.x, player.y, {
        colors: [C.cyan, C.violet, C.white],
        count: this.save.reducedFx ? 8 : 22,
        speed: 300,
        size: 3,
        life: 0.7,
      });
      this.showToast(
        destroyed > 0
          ? `NOVA PULSE // ${destroyed} HAZARD${destroyed === 1 ? "" : "S"} PURGED`
          : "NOVA PULSE // AREA CLEAR",
        1900
      );
      this.updateHud(true);
    }

    updatePlaying(dt) {
      if (!this.run) return;

      this.gameTime += dt;
      this.levelTime += dt;
      this.run.totalTime += dt;

      const multiplier = this.getScoreMultiplier();
      this.run.score += T.scorePerSecond * dt * multiplier;
      this.audio.setIntensity(this.currentIntensity());

      if (this.run.comboTimer > 0) {
        this.run.comboTimer = Math.max(0, this.run.comboTimer - dt);
        if (this.run.comboTimer === 0) {
          this.run.combo = 0;
        }
      }

      const waveLength = this.level.duration / this.level.waves;
      const nextWave = U.clamp(
        Math.floor(this.levelTime / waveLength) + 1,
        1,
        this.level.waves
      );
      if (nextWave > this.wave) {
        this.wave = nextWave;
        if (nextWave > 1) {
          this.showToast(`WAVE ${nextWave} // GRID DENSITY RISING`, 1800);
        }
      }

      if (
        !this.run.recordShown &&
        this.run.bestAtStart > 0 &&
        this.run.score > this.run.bestAtStart
      ) {
        this.run.recordShown = true;
        this.showToast("NEW PERSONAL BEST", 2600);
        this.audio.newRecord();
      }

      this.updatePlayer(dt);
      this.updateActivePowerup(dt);
      this.updateObstacles(dt);
      this.updateOrbs(dt);
      this.updatePowerups(dt);
      this.handleLevelEvents();
      this.updateSpawners(dt);
      this.checkCollisions();

      if (this.state !== "playing") {
        this.updateHud(true);
        return;
      }

      if (this.levelTime >= this.level.duration) {
        this.completeLevel();
        return;
      }

      this.updateHud();
    }

    updatePlayer(dt) {
      const player = this.player;
      if (!player.alive) return;
      const arena = this.arena;
      const move = this.getInputVector();

      if (move.magnitude > 0.15) {
        const magnitude = Math.hypot(move.x, move.y) || 1;
        player.lastDir.x = move.x / magnitude;
        player.lastDir.y = move.y / magnitude;
      }

      if (player.dashTime > 0) {
        player.dashTime = Math.max(0, player.dashTime - dt);
        const dashSpeed = this.playerSpeed * T.dashSpeedMultiplier;
        player.vx = player.dashVec.x * dashSpeed;
        player.vy = player.dashVec.y * dashSpeed;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        if (player.dashTime === 0) {
          player.vx *= 0.4;
          player.vy *= 0.4;
        }
      } else {
        const targetX = move.x * this.playerSpeed;
        const targetY = move.y * this.playerSpeed;
        const smoothing = 1 - Math.exp(-14 * dt);
        player.vx += (targetX - player.vx) * smoothing;
        player.vy += (targetY - player.vy) * smoothing;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
      }

      const minX = arena.x + player.r + 2;
      const maxX = arena.x + arena.w - player.r - 2;
      const minY = arena.y + player.r + 2;
      const maxY = arena.bottom - player.r - 2;

      if (player.x < minX) {
        player.x = minX;
        if (player.vx < 0) player.vx = 0;
      } else if (player.x > maxX) {
        player.x = maxX;
        if (player.vx > 0) player.vx = 0;
      }
      if (player.y < minY) {
        player.y = minY;
        if (player.vy < 0) player.vy = 0;
      } else if (player.y > maxY) {
        player.y = maxY;
        if (player.vy > 0) player.vy = 0;
      }

      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      player.invuln = Math.max(0, player.invuln - dt);
      player.damageTimer = Math.max(0, player.damageTimer - dt);

      const tiltTarget = U.clamp(player.vx / (this.playerSpeed * 1.1), -1, 1) * 0.34;
      player.angle += (tiltTarget - player.angle) * Math.min(1, dt * 10);

      const moving = move.magnitude > 0.06 || player.dashTime > 0;
      player.trailTimer -= dt;
      if (moving && player.trailTimer <= 0) {
        player.trailTimer = 0.026;
        player.trail.push({
          x: player.x,
          y: player.y,
          life: 0.34,
          maxLife: 0.34,
          size: player.r * (player.dashTime > 0 ? 1.35 : 0.85),
          color: player.dashTime > 0 ? C.magenta : C.cyan,
        });
        if (player.trail.length > T.playerTrailLength) player.trail.shift();
      }
      for (const trace of player.trail) trace.life -= dt;
      player.trail = player.trail.filter((trace) => trace.life > 0);

      if (moving) {
        player.engineTimer -= dt;
        if (player.engineTimer <= 0) {
          player.engineTimer = this.save.reducedFx ? 0.1 : 0.05;
          const cap = this.save.reducedFx ? T.maxParticlesReduced : T.particleCap;
          if (this.particles.length < cap) {
            const life = U.rand(0.22, 0.42);
            this.particles.push({
              x: player.x + U.rand(-player.r * 0.4, player.r * 0.4),
              y: player.y + player.r * 1.35,
              vx: U.rand(-22, 22) + player.vx * 0.08,
              vy: U.rand(35, 95),
              size: U.rand(1.4, 3.2),
              life,
              maxLife: life,
              color: Math.random() < 0.3 ? C.magenta : C.cyan,
              drag: 2.6,
              gravity: 10,
              glow: true,
            });
          }
        }
      }
    }

    getScoreMultiplier() {
      return this.activePowerup && this.activePowerup.key === "multiplier"
        ? NR.POWERUPS.multiplier.scoreScale
        : 1;
    }

    getComboMultiplier() {
      const combo = this.run ? this.run.combo || 0 : 0;
      return Math.min(2.5, 1 + Math.max(0, combo - 1) * T.comboStep);
    }

    extendCombo(amount = 1, window = T.comboWindow) {
      if (!this.run) return;
      this.run.combo = U.clamp((this.run.combo || 0) + amount, 0, T.comboMax);
      this.run.comboTimer = Math.max(this.run.comboTimer || 0, window);
    }

    breakCombo(announce = false) {
      if (!this.run || !this.run.combo) return;
      if (announce && this.run.combo >= 4 && this.player) {
        this.addFloatText("CHAIN LOST", this.player.x, this.player.y - this.player.r * 3, C.red, 9);
      }
      this.run.combo = 0;
      this.run.comboTimer = 0;
    }

    updateActivePowerup(dt) {
      if (!this.activePowerup) return;
      this.activePowerup.timeLeft -= dt;
      if (this.activePowerup.timeLeft <= 0) {
        const def = NR.POWERUPS[this.activePowerup.key];
        this.activePowerup = null;
        this.audio.powerupExpire();
        this.showToast(`${def.name} OFFLINE`, 1800);
        this.updateHud(true);
      }
    }

    activatePowerup(type) {
      const def = NR.POWERUPS[type];
      if (!def) return;
      this.activePowerup = {
        key: type,
        timeLeft: def.duration,
        duration: def.duration,
      };
      this.audio.powerup(type);
      this.showToast(`${def.name} ONLINE · ${def.detail.toUpperCase()}`, 2600);
      this.addFloatText(def.name, this.player.x, this.player.y - this.player.r * 3.4, def.color, 11);
      this.spawnRing(this.player.x, this.player.y, def.color, this.player.r * 4.2, 0.5, 2);
      this.updateHud(true);
    }

    collectOrb(orb) {
      if (orb.dead || !this.run) return;
      orb.dead = true;
      const run = this.run;

      run.combo = run.comboTimer > 0 ? Math.min(T.comboMax, run.combo + 1) : 1;
      run.comboTimer = T.comboWindow;
      const comboMultiplier = this.getComboMultiplier();
      const points = Math.round(T.orbScore * this.getScoreMultiplier() * comboMultiplier);
      run.score += points;
      run.energy += 1;
      run.orbs += 1;
      run.levelOrbs += 1;

      const pulseBefore = run.pulse || 0;
      run.pulse = U.clamp(pulseBefore + T.pulseOrbCharge, 0, T.pulseMax);
      if (run.pulse >= T.pulseMax && pulseBefore < T.pulseMax) {
        this.audio.pulseReady();
        this.showToast("NOVA PULSE READY // E OR SHIFT", 2200);
        this.addFloatText("PULSE READY", this.player.x, this.player.y - this.player.r * 3.4, C.cyan, 10);
      }

      this.audio.collect(1 + Math.min(0.4, run.orbs * 0.008) + Math.min(0.18, run.combo * 0.008));
      if (run.combo >= 2 && run.combo % 5 === 0) {
        this.audio.combo(run.combo);
        this.addFloatText(`CHAIN x${run.combo}`, orb.x, orb.y + orb.r + 10, C.gold, 9);
      }

      this.spawnBurst(orb.x, orb.y, {
        colors: [C.gold, C.white, C.cyan],
        count: this.save.reducedFx ? 6 : 14,
        speed: 130,
        size: 2.1,
        life: 0.6,
      });
      this.spawnRing(orb.x, orb.y, C.gold, orb.r * 2.6, 0.4, 1.5);
      this.addFloatText(`+${points}`, orb.x, orb.y - orb.r - 5, C.gold, 11);
      this.bumpScore();
    }

    collectPowerup(power) {
      if (power.dead || !this.run) return;
      power.dead = true;
      const def = NR.POWERUPS[power.type];
      if (!def) return;
      this.run.score += Math.round(T.powerupScore * this.getScoreMultiplier());
      const pulseBefore = this.run.pulse || 0;
      this.run.pulse = U.clamp(pulseBefore + 2, 0, T.pulseMax);
      if (this.run.pulse >= T.pulseMax && pulseBefore < T.pulseMax) {
        this.audio.pulseReady();
        this.showToast("NOVA PULSE READY // E OR SHIFT", 2200);
      }
      this.extendCombo(1, T.comboWindow);
      this.activatePowerup(power.type);
      this.spawnBurst(power.x, power.y, {
        colors: [def.color, C.white],
        count: this.save.reducedFx ? 8 : 20,
        speed: 170,
        size: 2.8,
        life: 0.7,
      });
      this.bumpScore();
    }

    /* ====================================================================
       Spawning
       ==================================================================== */

    updateSpawners(dt) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const spawned = this.spawnObstacle();
        this.spawnTimer = spawned ? this.nextSpawnDelay() : 0.4;
      }

      if (this.orbs.length < T.orbCap) {
        this.orbTimer -= dt;
        if (this.orbTimer <= 0) {
          this.spawnOrb();
          const range = this.level.orbInterval;
          this.orbTimer = U.rand(range[0], range[1]);
        }
      } else {
        this.orbTimer = Math.max(this.orbTimer, 0.5);
      }

      if (this.powerups.length < T.powerupCap) {
        this.powerupTimer -= dt;
        if (this.powerupTimer <= 0) {
          this.spawnPowerup();
          const range = this.level.powerupInterval;
          this.powerupTimer = U.rand(range[0], range[1]);
        }
      } else {
        this.powerupTimer = Math.max(this.powerupTimer, 0.8);
      }
    }

    nextSpawnDelay() {
      const progress = U.clamp(this.levelTime / this.level.duration, 0, 1);
      const waveFactor = 1 - (this.wave - 1) * 0.045;
      const progressFactor = 1 - progress * 0.14;
      return Math.max(
        0.34,
        this.level.spawnInterval * waveFactor * progressFactor * U.rand(0.84, 1.16)
      );
    }

    spawnObstacle() {
      if (!this.run || this.obstacles.length >= this.level.maxObstacles) return false;
      const type = U.weightedPick(this.level.types);
      const scale = this.scale;
      const arena = this.arena;
      const baseSpeed = this.level.speed * this.fallScale;
      const margin = 20;

      let x = U.rand(arena.x + margin, arena.x + arena.w - margin);
      if (type !== "barrier" && this.lastSpawnX !== null) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (Math.abs(x - this.lastSpawnX) > 62 * scale) break;
          x = U.rand(arena.x + margin, arena.x + arena.w - margin);
        }
      }

      const obstacle = {
        type,
        dead: false,
        age: 0,
        x,
        baseX: x,
        y: arena.y - 40,
        r: 14 * scale,
        vy: baseSpeed,
        vx: 0,
        rotation: U.rand(0, TAU),
        spin: U.rand(-2, 2),
        color: C.magenta,
      };

      if (type === "shard") {
        const r = U.rand(11, 16) * scale;
        obstacle.r = r;
        obstacle.x = U.clamp(x, arena.x + r + 8, arena.x + arena.w - r - 8);
        obstacle.baseX = obstacle.x;
        obstacle.y = arena.y - r - 30;
        obstacle.vy = baseSpeed * U.rand(0.9, 1.1);
        obstacle.vx = U.rand(-36, 36);
        obstacle.spin = U.rand(-2.6, 2.6);
        obstacle.color = Math.random() < 0.55 ? C.magenta : C.red;
      } else if (type === "mine") {
        const r = U.rand(14, 19) * scale;
        obstacle.r = r;
        obstacle.x = U.clamp(x, arena.x + r + 8, arena.x + arena.w - r - 8);
        obstacle.baseX = obstacle.x;
        obstacle.y = arena.y - r - 32;
        obstacle.vy = baseSpeed * U.rand(0.72, 0.86);
        obstacle.amp = U.rand(10, 30) * scale;
        obstacle.freq = U.rand(1.3, 2.1);
        obstacle.phase = U.rand(0, TAU);
        obstacle.spin = U.rand(-1.4, 1.4);
        obstacle.color = C.red;
      } else if (type === "weaver") {
        const r = U.rand(10, 14) * scale;
        obstacle.r = r;
        obstacle.x = U.clamp(x, arena.x + r + 8, arena.x + arena.w - r - 8);
        obstacle.baseX = obstacle.x;
        obstacle.y = arena.y - r - 34;
        obstacle.vy = baseSpeed * U.rand(1.0, 1.14);
        obstacle.amp = Math.min(arena.w * 0.2, U.rand(52, 95) * scale);
        obstacle.freq = U.rand(0.85, 1.45);
        obstacle.phase = U.rand(0, TAU);
        obstacle.spin = U.rand(-1.6, 1.6);
        obstacle.color = C.violet;
      } else if (type === "seeker") {
        const r = U.rand(13, 17) * scale;
        obstacle.r = r;
        obstacle.x = U.clamp(x, arena.x + r + 8, arena.x + arena.w - r - 8);
        obstacle.baseX = obstacle.x;
        obstacle.y = arena.y - r - 38;
        obstacle.vy = baseSpeed * U.rand(0.48, 0.62);
        obstacle.steer = U.rand(T.seekerSteer * 0.78, T.seekerSteer * 1.15) * scale;
        obstacle.spin = U.rand(-1.1, 1.1);
        obstacle.phase = U.rand(0, TAU);
        obstacle.color = C.ember;
      } else if (type === "barrier") {
        const maxLength = Math.max(80, arena.w - 56);
        const preferred = U.rand(arena.w * 0.34, arena.w * 0.5);
        const length = Math.min(preferred, 280 * scale, maxLength);
        const thickness = U.rand(7, 10) * scale;
        const minX = arena.x + length / 2 + 8;
        const maxX = arena.x + arena.w - length / 2 - 8;
        const spawnX = maxX > minX ? U.rand(minX, maxX) : arena.x + arena.w / 2;
        obstacle.length = Math.max(70, length);
        obstacle.thickness = thickness;
        obstacle.x = spawnX;
        obstacle.baseX = spawnX;
        obstacle.y = arena.y - obstacle.length * 0.58 - 22;
        obstacle.vy = baseSpeed * 0.62;
        obstacle.angle = U.rand(0, TAU);
        obstacle.spin = (Math.random() < 0.5 ? -1 : 1) * U.rand(0.35, 0.8);
        obstacle.r = obstacle.length / 2;
        obstacle.color = C.magenta;
      }

      this.lastSpawnX = obstacle.x;
      this.obstacles.push(obstacle);
      return true;
    }

    spawnFormation(kind) {
      if (!this.run) return;
      const arena = this.arena;
      const scale = this.scale;
      const baseSpeed = this.level.speed * this.fallScale;
      const max = this.level.maxObstacles;

      if (kind === "pair") {
        for (let i = 0; i < 2; i += 1) {
          if (this.obstacles.length >= max) break;
          const r = U.rand(11, 14) * scale;
          const x = arena.x + arena.w * (i === 0 ? 0.3 : 0.7);
          this.obstacles.push({
            type: "shard",
            dead: false,
            age: 0,
            x,
            baseX: x,
            y: arena.y - r - 34 - i * 20,
            r,
            vy: baseSpeed * 0.9,
            vx: i === 0 ? 20 : -20,
            rotation: U.rand(0, TAU),
            spin: i === 0 ? 2 : -2,
            color: i === 0 ? C.magenta : C.violet,
          });
        }
      } else if (kind === "barrage") {
        const count = U.clamp(Math.floor(arena.w / (160 * scale)), 3, 6);
        const gap = U.randInt(0, count - 1);
        for (let i = 0; i < count; i += 1) {
          if (i === gap) continue;
          if (this.obstacles.length >= max) break;
          const r = U.rand(10, 14) * scale;
          const x = arena.x + ((i + 0.5) * arena.w) / count;
          this.obstacles.push({
            type: "shard",
            dead: false,
            age: 0,
            x,
            baseX: x,
            y: arena.y - r - 28 - (i % 2) * 22,
            r,
            vy: baseSpeed * U.rand(0.82, 0.94),
            vx: U.rand(-12, 12),
            rotation: U.rand(0, TAU),
            spin: U.rand(-2.2, 2.2),
            color: C.red,
          });
        }
      } else if (kind === "sweep") {
        if (this.obstacles.length >= max) return;
        const maxLength = Math.max(80, arena.w - 56);
        const length = Math.min(arena.w * 0.52, 300 * scale, maxLength);
        this.obstacles.push({
          type: "barrier",
          dead: false,
          age: 0,
          x: arena.x + arena.w / 2,
          baseX: arena.x + arena.w / 2,
          y: arena.y - length * 0.58 - 20,
          r: length / 2,
          length,
          thickness: U.rand(8, 11) * scale,
          vy: baseSpeed * 0.58,
          vx: 0,
          angle: U.rand(-0.16, 0.16),
          spin: (Math.random() < 0.5 ? -1 : 1) * U.rand(0.5, 0.9),
          rotation: 0,
          color: C.magenta,
        });
      }
    }

    spawnOrb() {
      if (this.orbs.length >= T.orbCap) return;
      const arena = this.arena;
      const r = 13 * this.scale;
      const x = U.rand(arena.x + r + 14, arena.x + arena.w - r - 14);
      const y = U.rand(arena.y + arena.h * 0.16, arena.y + arena.h * 0.64);
      this.orbs.push({
        x,
        baseX: x,
        y,
        r,
        age: 0,
        phase: U.rand(0, TAU),
        drift: U.rand(8, 18),
        life: 11,
        dead: false,
      });
    }

    spawnPowerup() {
      if (this.powerups.length >= T.powerupCap) return;
      const arena = this.arena;
      const kinds = Object.keys(NR.POWERUPS);
      const type = U.pick(kinds);
      const r = 17 * this.scale;
      const x = U.rand(arena.x + r + 24, arena.x + arena.w - r - 24);
      const y = U.rand(arena.y + arena.h * 0.2, arena.y + arena.h * 0.58);
      this.powerups.push({
        type,
        x,
        baseX: x,
        y,
        baseY: y,
        r,
        age: 0,
        phase: U.rand(0, TAU),
        life: T.powerupLifetime,
        dead: false,
      });
    }

    /* ====================================================================
       Entity updates and collisions
       ==================================================================== */

    updateObstacles(dt) {
      const slowFactor =
        this.activePowerup && this.activePowerup.key === "slow"
          ? NR.POWERUPS.slow.hazardScale
          : 1;

      for (const obstacle of this.obstacles) {
        if (obstacle.dead) continue;
        const step = dt * slowFactor;
        obstacle.age += step;
        obstacle.y += obstacle.vy * step;

        if (obstacle.type === "shard") {
          obstacle.x += obstacle.vx * step;
          obstacle.rotation += obstacle.spin * step;
        } else if (obstacle.type === "mine") {
          obstacle.x = obstacle.baseX + Math.sin(obstacle.age * obstacle.freq + obstacle.phase) * obstacle.amp;
          obstacle.rotation += obstacle.spin * step;
        } else if (obstacle.type === "weaver") {
          obstacle.x = obstacle.baseX + Math.sin(obstacle.age * obstacle.freq + obstacle.phase) * obstacle.amp;
          obstacle.rotation += obstacle.spin * step;
        } else if (obstacle.type === "seeker") {
          const targetX = this.player && this.player.alive ? this.player.x : obstacle.x;
          const maxStep = obstacle.steer * step;
          obstacle.x += U.clamp(targetX - obstacle.x, -maxStep, maxStep);
          obstacle.x = U.clamp(
            obstacle.x,
            this.arena.x + obstacle.r + 4,
            this.arena.x + this.arena.w - obstacle.r - 4
          );
          obstacle.rotation += obstacle.spin * step;
        } else if (obstacle.type === "barrier") {
          obstacle.angle += obstacle.spin * step;
        }
      }

      this.obstacles = this.obstacles.filter((obstacle) => {
        if (obstacle.dead) return false;
        const reach = obstacle.type === "barrier" ? obstacle.length : obstacle.r;
        return obstacle.y - reach <= this.arena.bottom + 100;
      });
    }

    updateOrbs(dt) {
      const magnet =
        this.activePowerup && this.activePowerup.key === "magnet"
          ? NR.POWERUPS.magnet
          : null;
      for (const orb of this.orbs) {
        orb.age += dt;
        orb.life -= dt;
        orb.magnetized = false;

        let nextX = orb.baseX + Math.sin(orb.age * 1.4 + orb.phase) * 5;
        let nextY = orb.y + orb.drift * dt;

        if (magnet && this.player) {
          const dx = this.player.x - nextX;
          const dy = this.player.y - nextY;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq < magnet.magnetRange * magnet.magnetRange && distanceSq > 1) {
            const distance = Math.sqrt(distanceSq);
            const pull = magnet.magnetPull * dt;
            nextX += (dx / distance) * pull;
            nextY += (dy / distance) * pull;
            // Re-anchor the idle drift so the pull accumulates instead of
            // snapping back to the original spawn column every frame.
            orb.baseX = nextX;
            orb.magnetized = true;
          }
        }

        orb.x = nextX;
        orb.y = nextY;
      }
      this.orbs = this.orbs.filter(
        (orb) => !orb.dead && orb.life > 0 && orb.y < this.arena.bottom + 60
      );
    }

    updatePowerups(dt) {
      for (const power of this.powerups) {
        power.age += dt;
        power.life -= dt;
        power.x = power.baseX + Math.cos(power.age * 0.9 + power.phase) * 5;
        power.y = power.baseY + Math.sin(power.age * 1.5 + power.phase) * 8;
      }
      this.powerups = this.powerups.filter((power) => !power.dead && power.life > 0);
    }

    handleLevelEvents() {
      const events = this.level.events || [];
      while (
        this.eventIndex < events.length &&
        this.levelTime >= events[this.eventIndex].t
      ) {
        const event = events[this.eventIndex];
        this.eventIndex += 1;
        this.spawnFormation(event.kind);
        this.showToast("GRID SURGE // FORMATION INBOUND", 1700);
        this.spawnTimer = Math.max(this.spawnTimer, 0.9);
      }
    }

    checkCollisions() {
      const player = this.player;
      if (!player.alive) return;

      for (const orb of this.orbs) {
        if (orb.dead) continue;
        const radius = orb.r + player.r + 4;
        if (U.distanceSq(player.x, player.y, orb.x, orb.y) < radius * radius) {
          this.collectOrb(orb);
        }
      }
      this.orbs = this.orbs.filter((orb) => !orb.dead);

      for (const power of this.powerups) {
        if (power.dead) continue;
        const radius = power.r + player.r + 5;
        if (U.distanceSq(player.x, player.y, power.x, power.y) < radius * radius) {
          this.collectPowerup(power);
        }
      }
      this.powerups = this.powerups.filter((power) => !power.dead);

      if (player.dashTime > 0) {
        for (const obstacle of this.obstacles) {
          if (obstacle.dead) continue;
          if (this.obstacleHitsPlayer(obstacle)) this.shatterObstacle(obstacle);
        }
        this.obstacles = this.obstacles.filter((obstacle) => !obstacle.dead);
      }

      if (player.invuln > 0) return;

      for (const obstacle of this.obstacles) {
        if (obstacle.dead) continue;
        if (this.obstacleHitsPlayer(obstacle)) {
          obstacle.dead = true;
          this.onPlayerHit(obstacle);
          break;
        }
      }

      this.obstacles = this.obstacles.filter((obstacle) => !obstacle.dead);
    }

    obstacleHitsPlayer(obstacle) {
      const player = this.player;
      if (!player || !player.alive) return false;
      if (obstacle.type === "barrier") {
        const half = obstacle.length / 2;
        const cos = Math.cos(obstacle.angle);
        const sin = Math.sin(obstacle.angle);
        const d2 = U.pointSegmentDistanceSq(
          player.x,
          player.y,
          obstacle.x - cos * half,
          obstacle.y - sin * half,
          obstacle.x + cos * half,
          obstacle.y + sin * half
        );
        const threshold = obstacle.thickness * 0.5 + player.r * 0.8;
        return d2 < threshold * threshold;
      }
      const threshold = obstacle.r * 0.82 + player.r * 0.8;
      return U.distanceSq(player.x, player.y, obstacle.x, obstacle.y) < threshold * threshold;
    }

    shatterObstacle(obstacle) {
      if (!obstacle || obstacle.dead || !this.run) return;
      obstacle.dead = true;
      const points = Math.round(T.dashShredScore * this.getScoreMultiplier());
      this.run.score += points;
      this.extendCombo(1, T.comboWindow);
      this.audio.shred();
      this.spawnBurst(obstacle.x, obstacle.y, {
        colors: [C.cyan, C.white, obstacle.color || C.magenta],
        count: this.save.reducedFx ? 5 : 12,
        speed: 230,
        size: 2.4,
        life: 0.5,
      });
      this.spawnRing(obstacle.x, obstacle.y, C.cyan, obstacle.r * 2.4, 0.3, 1.4);
      this.addFloatText(`PHASE +${points}`, obstacle.x, obstacle.y - obstacle.r, C.cyan, 9);
      this.shake = Math.max(this.shake, 2);
      this.bumpScore();
    }

    onPlayerHit(obstacle) {
      const player = this.player;
      const impactColor = obstacle.color || C.magenta;

      this.spawnBurst(player.x, player.y, {
        colors: [impactColor, C.red, C.white],
        count: this.save.reducedFx ? 8 : 20,
        speed: 210,
        size: 2.6,
        life: 0.55,
      });

      if (this.activePowerup && this.activePowerup.key === "shield") {
        this.activePowerup = null;
        this.breakCombo(false);
        player.invuln = Math.max(player.invuln, 1.15);
        this.audio.shieldBlock();
        this.spawnRing(player.x, player.y, C.cyan, player.r * 4.6, 0.5, 2);
        this.spawnBurst(player.x, player.y, {
          colors: [C.cyan, C.white],
          count: this.save.reducedFx ? 8 : 18,
          speed: 190,
          size: 2.4,
          life: 0.55,
        });
        this.shake = Math.max(this.shake, this.save.reducedShake ? 3 : 8);
        this.addFloatText("SHIELD BROKEN", player.x, player.y - player.r * 3, C.cyan, 10);
        this.showToast("SHIELD ABSORBED THE IMPACT", 1800);
        this.updateHud(true);
        return;
      }

      this.run.lives = Math.max(0, this.run.lives - 1);
      this.breakCombo(true);
      player.invuln = T.damageInvulnerability;
      player.damageTimer = 0.55;
      this.audio.damage();
      this.flashDamage();
      this.shake = Math.max(this.shake, this.save.reducedShake ? 4 : 14);
      this.spawnRing(player.x, player.y, C.red, player.r * 5, 0.55, 2.5);
      this.addFloatText("-1 LIFE", player.x, player.y - player.r * 3.2, C.red, 12);
      this.updateHud(true);

      if (this.run.lives <= 0) {
        this.startDestruction();
      }
    }

    startDestruction() {
      const player = this.player;
      player.alive = false;
      this.activePowerup = null;
      this.clearInputs();
      this.dyingTimer = 1.25;
      this.audio.gameOver();
      this.spawnBurst(player.x, player.y, {
        colors: [C.cyan, C.magenta, C.white, C.red],
        count: this.save.reducedFx ? 18 : 48,
        speed: 360,
        size: 4,
        life: 1.3,
        gravity: 30,
      });
      this.spawnRing(player.x, player.y, C.magenta, Math.min(this.w, this.h) * 0.24, 0.9, 3);
      this.spawnRing(player.x, player.y, C.cyan, Math.min(this.w, this.h) * 0.15, 0.65, 2);
      this.shake = Math.max(this.shake, this.save.reducedShake ? 5 : 20);
      this.setState("dying");
      this.updateHud(true);
    }

    /* ====================================================================
       Effects
       ==================================================================== */

    spawnBurst(x, y, options = {}) {
      const colors = options.colors || [C.cyan];
      const palette = Array.isArray(colors) ? colors : [colors];
      const cap = this.save.reducedFx ? T.maxParticlesReduced : T.particleCap;
      const count = Math.max(0, options.count || 12);
      const spread = options.spread === undefined ? TAU : options.spread;
      const angle = options.angle || 0;
      const speed = options.speed || 180;
      const life = options.life || 0.6;
      const size = options.size || 2.6;
      const available = cap - this.particles.length;

      for (let i = 0; i < Math.min(count, available); i += 1) {
        const theta = angle + (Math.random() - 0.5) * spread;
        const velocity = U.rand(speed * 0.3, speed);
        const particleLife = U.rand(life * 0.6, life);
        this.particles.push({
          x,
          y,
          vx: Math.cos(theta) * velocity,
          vy: Math.sin(theta) * velocity,
          size: U.rand(size * 0.45, size),
          life: particleLife,
          maxLife: particleLife,
          color: U.pick(palette),
          drag: options.drag === undefined ? 2.2 : options.drag,
          gravity: options.gravity || 0,
          glow: true,
        });
      }
    }

    spawnRing(x, y, color, maxRadius, life, width = 2) {
      if (this.rings.length > 18) this.rings.shift();
      this.rings.push({
        x,
        y,
        color,
        radius: maxRadius * 0.12,
        maxRadius,
        life,
        maxLife: life,
        width,
      });
    }

    addFloatText(text, x, y, color, size = 10) {
      if (this.floatTexts.length > 24) this.floatTexts.shift();
      this.floatTexts.push({
        text,
        x,
        y,
        color,
        size,
        life: 0.95,
        maxLife: 0.95,
        vy: -30,
      });
    }

    spawnVictoryBurst() {
      const colors = [C.gold, C.cyan, C.magenta, C.white];
      const bursts = this.save.reducedFx ? 1 : 3;
      for (let i = 0; i < bursts; i += 1) {
        this.spawnBurst(U.rand(this.w * 0.2, this.w * 0.8), U.rand(this.h * 0.22, this.h * 0.5), {
          colors,
          count: this.save.reducedFx ? 12 : 34,
          speed: 260,
          size: 3.6,
          life: 1.5,
          gravity: 35,
          drag: 1.4,
        });
      }
      this.spawnRing(
        this.w / 2,
        this.h * 0.48,
        C.gold,
        Math.min(this.w, this.h) * 0.38,
        1.1,
        3
      );
    }

    updateEffects(dt) {
      for (const particle of this.particles) {
        particle.life -= dt;
        if (particle.life <= 0) continue;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        const damping = Math.exp(-particle.drag * dt);
        particle.vx *= damping;
        particle.vy = particle.vy * damping + particle.gravity * dt;
      }
      this.particles = this.particles.filter((particle) => particle.life > 0);

      for (const ring of this.rings) {
        ring.life -= dt;
        ring.radius += (ring.maxRadius - ring.radius) * Math.min(1, dt * 6);
      }
      this.rings = this.rings.filter((ring) => ring.life > 0);

      for (const text of this.floatTexts) {
        text.life -= dt;
        text.y += text.vy * dt;
        text.vy *= Math.exp(-1.8 * dt);
      }
      this.floatTexts = this.floatTexts.filter((text) => text.life > 0);

      this.shake = Math.max(0, this.shake - dt * 38);
    }

    /* ====================================================================
       Main loop and rendering
       ==================================================================== */

    loop(timestamp) {
      const rawDelta = (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;
      const dt = U.clamp(Number.isFinite(rawDelta) ? rawDelta : 0, 0, 1 / 20);

      this.time += dt;
      this.env.update(dt, {
        mode: GAME_SCENE_STATES.has(this.state) ? "game" : "menu",
        intensity: this.currentIntensity(),
      });
      this.audio.update();

      if (this.state === "playing") {
        this.updatePlaying(dt);
      } else if (this.state === "dying") {
        this.updateDying(dt);
      } else if (this.state === "levelcomplete") {
        this.updateLevelComplete(dt);
      }

      const effectsActive = !["menu", "levels", "howto", "settings", "paused"].includes(
        this.state
      );
      if (effectsActive) this.updateEffects(dt);

      this.render();
      requestAnimationFrame(this.boundLoop);
    }

    render() {
      const ctx = this.ctx;
      const width = this.w;
      const height = this.h;
      const gameScene = GAME_SCENE_STATES.has(this.state);
      const focusX = this.player && this.run ? U.clamp(this.player.x / this.w, 0, 1) : 0.5;

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      this.env.draw(ctx, {
        mode: gameScene ? "game" : "menu",
        focusX,
        intensity: this.currentIntensity(),
      });

      if (!gameScene) return;

      // Keep hazard silhouettes readable over the city.
      ctx.fillStyle = "rgba(7, 8, 18, 0.38)";
      ctx.fillRect(0, 0, width, height);

      if (this.player && this.player.alive) {
        const glow = ctx.createRadialGradient(
          this.player.x,
          this.player.y,
          0,
          this.player.x,
          this.player.y,
          Math.min(width, height) * 0.42
        );
        glow.addColorStop(0, "rgba(0, 245, 255, 0.055)");
        glow.addColorStop(0.55, "rgba(139, 92, 255, 0.02)");
        glow.addColorStop(1, "rgba(7, 8, 18, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }

      this.drawArena(ctx);

      ctx.save();
      if (this.shake > 0.15) {
        ctx.translate(
          (Math.random() * 2 - 1) * this.shake,
          (Math.random() * 2 - 1) * this.shake
        );
      }

      if (this.activePowerup && this.activePowerup.key === "magnet" && this.player) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = colorWithAlpha(C.mint, 0.36);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 7]);
        ctx.lineDashOffset = -this.gameTime * 42;
        for (const orb of this.orbs) {
          if (!orb.magnetized) continue;
          ctx.beginPath();
          ctx.moveTo(this.player.x, this.player.y);
          ctx.lineTo(orb.x, orb.y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
      }

      this.drawRings(ctx);
      for (const orb of this.orbs) this.drawOrb(ctx, orb);
      for (const power of this.powerups) this.drawPowerup(ctx, power);
      for (const obstacle of this.obstacles) this.drawObstacle(ctx, obstacle);
      this.drawParticles(ctx);
      if (this.player.alive) this.drawPlayer(ctx);
      this.drawFloatTexts(ctx);
      ctx.restore();
    }

    drawArena(ctx) {
      const arena = this.arena;
      const accent = (this.level && this.level.accent) || C.cyan;
      const topShade = ctx.createLinearGradient(0, arena.y, 0, arena.y + 74);
      topShade.addColorStop(0, colorWithAlpha(accent, 0.11));
      topShade.addColorStop(1, colorWithAlpha(accent, 0));
      ctx.fillStyle = topShade;
      ctx.fillRect(arena.x, arena.y, arena.w, 74);

      ctx.save();
      const rail = ctx.createLinearGradient(0, arena.y, 0, arena.bottom);
      rail.addColorStop(0, colorWithAlpha(accent, 0.5));
      rail.addColorStop(0.5, colorWithAlpha(accent, 0.14));
      rail.addColorStop(1, colorWithAlpha(accent, 0.03));
      ctx.strokeStyle = rail;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(arena.x - 2, arena.y);
      ctx.lineTo(arena.x - 2, arena.bottom);
      ctx.moveTo(arena.x + arena.w + 2, arena.y);
      ctx.lineTo(arena.x + arena.w + 2, arena.bottom);
      ctx.stroke();

      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      const corner = 18;
      ctx.beginPath();
      ctx.moveTo(arena.x - 2, arena.y + corner);
      ctx.lineTo(arena.x - 2, arena.y);
      ctx.lineTo(arena.x + corner, arena.y);
      ctx.moveTo(arena.x + arena.w + 2 - corner, arena.y);
      ctx.lineTo(arena.x + arena.w + 2, arena.y);
      ctx.lineTo(arena.x + arena.w + 2, arena.y + corner);
      ctx.moveTo(arena.x - 2, arena.bottom - corner);
      ctx.lineTo(arena.x - 2, arena.bottom);
      ctx.moveTo(arena.x + arena.w + 2, arena.bottom - corner);
      ctx.lineTo(arena.x + arena.w + 2, arena.bottom);
      ctx.stroke();

      ctx.globalAlpha = 0.26;
      ctx.setLineDash([2, 10]);
      ctx.beginPath();
      ctx.moveTo(arena.x + corner, arena.y);
      ctx.lineTo(arena.x + arena.w - corner, arena.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawPlayer(ctx) {
      const player = this.player;
      const r = player.r;
      const t = this.gameTime;
      const reduced = this.save.reducedFx;
      const blinking =
        player.invuln > 0 && player.dashTime <= 0
          ? Math.sin(t * 26) > 0
            ? 0.45
            : 1
          : 1;
      const damaged = player.damageTimer > 0;

      // Movement trail.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const trace of player.trail) {
        const alpha = trace.life / trace.maxLife;
        ctx.globalAlpha = alpha * 0.32;
        ctx.fillStyle = trace.color;
        ctx.beginPath();
        ctx.arc(trace.x, trace.y, Math.max(0.4, trace.size * alpha), 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.globalAlpha = blinking;

      // Twin engine exhaust.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const thrust = player.dashTime > 0 ? 1.9 : 1;
      const flicker = 0.82 + Math.sin(t * 24) * 0.18;
      const flameHeight = r * 2.2 * thrust * flicker;
      const flame = ctx.createLinearGradient(0, r * 0.7, 0, r * 0.7 + flameHeight);
      flame.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      flame.addColorStop(0.32, "rgba(0, 245, 255, 0.85)");
      flame.addColorStop(0.68, "rgba(255, 43, 214, 0.5)");
      flame.addColorStop(1, "rgba(139, 92, 255, 0)");
      ctx.fillStyle = flame;
      for (const offset of [-r * 0.62, r * 0.62]) {
        ctx.beginPath();
        ctx.moveTo(offset - r * 0.24, r * 0.65);
        ctx.lineTo(offset, r * 0.65 + flameHeight * (offset < 0 ? 0.9 : 0.78));
        ctx.lineTo(offset + r * 0.24, r * 0.65);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(-r * 0.34, r * 0.7);
      ctx.lineTo(0, r * 0.7 + flameHeight * 1.12);
      ctx.lineTo(r * 0.34, r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Outer shell.
      const bodyGradient = ctx.createLinearGradient(0, -r * 2.9, 0, r * 1.25);
      bodyGradient.addColorStop(0, "rgba(244, 247, 255, 0.98)");
      bodyGradient.addColorStop(0.22, "#8ffcff");
      bodyGradient.addColorStop(0.52, "#00d7ea");
      bodyGradient.addColorStop(0.82, "#6f5bff");
      bodyGradient.addColorStop(1, "rgba(43, 25, 92, 0.95)");

      ctx.beginPath();
      ctx.moveTo(0, -r * 2.9);
      ctx.bezierCurveTo(r * 0.55, -r * 2.1, r * 1.35, -r * 0.8, r * 1.95, r * 0.35);
      ctx.lineTo(r * 2.05, r * 0.7);
      ctx.lineTo(r * 0.65, r * 0.42);
      ctx.lineTo(r * 0.5, r * 1.2);
      ctx.lineTo(0, r * 0.9);
      ctx.lineTo(-r * 0.5, r * 1.2);
      ctx.lineTo(-r * 0.65, r * 0.42);
      ctx.lineTo(-r * 2.05, r * 0.7);
      ctx.lineTo(-r * 1.95, r * 0.35);
      ctx.bezierCurveTo(-r * 1.35, -r * 0.8, -r * 0.55, -r * 2.1, 0, -r * 2.9);
      ctx.closePath();
      ctx.fillStyle = bodyGradient;
      ctx.fill();

      if (!reduced) {
        ctx.shadowColor = damaged ? C.red : C.cyan;
        ctx.shadowBlur = 20;
      }
      ctx.strokeStyle = damaged ? "rgba(255, 66, 103, 0.95)" : "rgba(0, 245, 255, 0.9)";
      ctx.lineWidth = 1.35;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Wing accents.
      ctx.strokeStyle = "rgba(255, 43, 214, 0.86)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 1.62, r * 0.28);
      ctx.lineTo(-r * 0.5, -r * 0.18);
      ctx.moveTo(r * 1.62, r * 0.28);
      ctx.lineTo(r * 0.5, -r * 0.18);
      ctx.moveTo(-r * 1.15, r * 0.5);
      ctx.lineTo(-r * 0.4, r * 0.2);
      ctx.moveTo(r * 1.15, r * 0.5);
      ctx.lineTo(r * 0.4, r * 0.2);
      ctx.stroke();

      // Canopy.
      const canopy = ctx.createLinearGradient(0, -r * 1.4, 0, r * 0.35);
      canopy.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      canopy.addColorStop(0.5, "rgba(255, 43, 214, 0.72)");
      canopy.addColorStop(1, "rgba(72, 32, 132, 0.4)");
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.52, r * 0.38, r * 0.92, 0, 0, TAU);
      ctx.fillStyle = canopy;
      ctx.fill();

      // Energy core.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 1 + Math.sin(t * 7.5) * 0.1;
      const core = ctx.createRadialGradient(0, -r * 0.2, 0, 0, -r * 0.2, r * 1.05 * pulse);
      core.addColorStop(0, "rgba(255, 255, 255, 1)");
      core.addColorStop(0.3, "rgba(0, 245, 255, 0.95)");
      core.addColorStop(0.7, "rgba(0, 245, 255, 0.2)");
      core.addColorStop(1, "rgba(0, 245, 255, 0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 1.05 * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();

      if (player.dashTime > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(0, 245, 255, 0.55)";
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i += 1) {
          ctx.globalAlpha = 0.3 / i;
          ctx.beginPath();
          ctx.moveTo(-r * 1.6, r * (0.2 + i * 0.28));
          ctx.lineTo(-r * (3 + i * 1.5), r * (0.35 + i * 0.35));
          ctx.moveTo(r * 1.6, r * (0.2 + i * 0.28));
          ctx.lineTo(r * (3 + i * 1.5), r * (0.35 + i * 0.35));
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();

      if (this.activePowerup && this.activePowerup.key === "shield") {
        this.drawShieldBubble(ctx);
      } else if (this.activePowerup && this.activePowerup.key === "magnet") {
        this.drawMagnetField(ctx);
      }
    }

    drawMagnetField(ctx) {
      const player = this.player;
      const t = this.gameTime;
      const radius = NR.POWERUPS.magnet.magnetRange * 0.82;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = C.mint;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 11]);
      ctx.lineDashOffset = -t * 26;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.1;
      const field = ctx.createRadialGradient(0, 0, player.r, 0, 0, radius);
      field.addColorStop(0, colorWithAlpha(C.mint, 0.2));
      field.addColorStop(1, colorWithAlpha(C.mint, 0));
      ctx.fillStyle = field;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    drawShieldBubble(ctx) {
      const player = this.player;
      const def = NR.POWERUPS.shield;
      const t = this.gameTime;
      const radius = player.r * (3.15 + Math.sin(t * 3.2) * 0.1);
      ctx.save();
      ctx.translate(player.x, player.y);

      const fill = ctx.createRadialGradient(0, 0, radius * 0.62, 0, 0, radius);
      fill.addColorStop(0, "rgba(0, 245, 255, 0)");
      fill.addColorStop(0.82, "rgba(0, 245, 255, 0.055)");
      fill.addColorStop(1, "rgba(0, 245, 255, 0.16)");
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = colorWithAlpha(def.color, 0.52);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();

      ctx.globalAlpha = 0.36;
      ctx.setLineDash([3, 8]);
      ctx.lineDashOffset = -t * 14;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.09, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawObstacle(ctx, obstacle) {
      const r = obstacle.r;
      const reduced = this.save.reducedFx;
      const t = this.gameTime;
      ctx.save();
      ctx.translate(obstacle.x, obstacle.y);

      if (obstacle.type === "shard") {
        ctx.rotate(obstacle.rotation);
        if (!reduced) {
          ctx.shadowColor = obstacle.color;
          ctx.shadowBlur = 13;
        }
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.35);
        ctx.lineTo(r * 0.92, r * 0.95);
        ctx.lineTo(0, r * 0.42);
        ctx.lineTo(-r * 0.92, r * 0.78);
        ctx.closePath();
        ctx.fillStyle = "rgba(14, 7, 26, 0.94)";
        ctx.fill();
        ctx.strokeStyle = obstacle.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = colorWithAlpha(C.red, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9);
        ctx.lineTo(0, r * 0.15);
        ctx.stroke();
        ctx.fillStyle = obstacle.color;
        ctx.beginPath();
        ctx.arc(0, r * 0.06, Math.max(1, r * 0.14), 0, TAU);
        ctx.fill();
      } else if (obstacle.type === "mine") {
        ctx.rotate(obstacle.rotation);
        if (!reduced) {
          ctx.shadowColor = C.red;
          ctx.shadowBlur = 14;
        }
        ctx.beginPath();
        const spikes = 10;
        for (let i = 0; i < spikes * 2; i += 1) {
          const angle = (i / (spikes * 2)) * TAU;
          const radius = i % 2 === 0 ? r * 1.3 : r * 0.84;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(20, 7, 24, 0.95)";
        ctx.fill();
        ctx.strokeStyle = C.red;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = colorWithAlpha(C.magenta, 0.8);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 5]);
        ctx.lineDashOffset = -obstacle.rotation * 9;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);

        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.48);
        core.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        core.addColorStop(0.35, "rgba(255, 66, 103, 0.9)");
        core.addColorStop(1, "rgba(255, 43, 214, 0)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.48, 0, TAU);
        ctx.fill();
      } else if (obstacle.type === "weaver") {
        ctx.rotate(obstacle.rotation);
        if (!reduced) {
          ctx.shadowColor = C.violet;
          ctx.shadowBlur = 13;
        }
        const body = ctx.createLinearGradient(0, -r * 1.6, 0, r * 1.5);
        body.addColorStop(0, "rgba(139, 92, 255, 0.32)");
        body.addColorStop(0.45, "rgba(49, 20, 90, 0.96)");
        body.addColorStop(1, "rgba(28, 8, 46, 0.98)");
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.62);
        ctx.quadraticCurveTo(r * 1.05, -r * 0.42, r * 1.38, r * 0.15);
        ctx.lineTo(0, r * 1.45);
        ctx.lineTo(-r * 1.38, r * 0.15);
        ctx.quadraticCurveTo(-r * 1.05, -r * 0.42, 0, -r * 1.62);
        ctx.closePath();
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = C.violet;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = colorWithAlpha(C.magenta, 0.8);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.15);
        ctx.lineTo(0, r * 0.9);
        ctx.stroke();
        ctx.fillStyle = C.magenta;
        ctx.beginPath();
        ctx.arc(0, -r * 0.15, Math.max(1, r * 0.16), 0, TAU);
        ctx.fill();
      } else if (obstacle.type === "seeker") {
        ctx.rotate(obstacle.rotation);
        if (!reduced) {
          ctx.shadowColor = C.ember;
          ctx.shadowBlur = 15;
        }
        const body = ctx.createLinearGradient(0, -r * 1.7, 0, r * 1.5);
        body.addColorStop(0, "rgba(255, 122, 69, 0.42)");
        body.addColorStop(0.5, "rgba(48, 13, 20, 0.96)");
        body.addColorStop(1, "rgba(22, 7, 16, 0.98)");
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.7);
        ctx.lineTo(r * 1.15, 0);
        ctx.lineTo(0, r * 1.45);
        ctx.lineTo(-r * 1.15, 0);
        ctx.closePath();
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = C.ember;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Forward-raked fins make the homing intent readable.
        ctx.strokeStyle = colorWithAlpha(C.gold, 0.75);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.72, -r * 0.15);
        ctx.lineTo(-r * 1.5, -r * 0.68);
        ctx.moveTo(r * 0.72, -r * 0.15);
        ctx.lineTo(r * 1.5, -r * 0.68);
        ctx.stroke();

        const pulse = 1 + Math.sin(t * 6 + (obstacle.phase || 0)) * 0.18;
        ctx.strokeStyle = colorWithAlpha(C.gold, 0.82);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -r * 0.05, r * 0.48 * pulse, 0, TAU);
        ctx.stroke();
        const eye = ctx.createRadialGradient(0, -r * 0.05, 0, 0, -r * 0.05, r * 0.34);
        eye.addColorStop(0, "rgba(255, 255, 255, 1)");
        eye.addColorStop(0.35, "rgba(255, 209, 102, 0.95)");
        eye.addColorStop(1, "rgba(255, 122, 69, 0.12)");
        ctx.fillStyle = eye;
        ctx.beginPath();
        ctx.arc(0, -r * 0.05, r * 0.34, 0, TAU);
        ctx.fill();
      } else if (obstacle.type === "barrier") {
        ctx.rotate(obstacle.angle);
        const half = obstacle.length / 2;
        const thickness = obstacle.thickness;
        if (!reduced) {
          ctx.shadowColor = C.magenta;
          ctx.shadowBlur = 16;
        }
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(10, 4, 20, 0.95)";
        ctx.lineWidth = thickness + 5;
        ctx.beginPath();
        ctx.moveTo(-half, 0);
        ctx.lineTo(half, 0);
        ctx.stroke();

        const barGradient = ctx.createLinearGradient(-half, 0, half, 0);
        barGradient.addColorStop(0, C.violet);
        barGradient.addColorStop(0.45, C.magenta);
        barGradient.addColorStop(1, C.red);
        ctx.strokeStyle = barGradient;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(-half, 0);
        ctx.lineTo(half, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-half + 4, 0);
        ctx.lineTo(half - 4, 0);
        ctx.stroke();

        ctx.strokeStyle = colorWithAlpha(C.red, 0.65);
        ctx.lineWidth = 1.2;
        for (let i = 1; i <= 5; i += 1) {
          const x = -half + (i / 6) * obstacle.length;
          ctx.beginPath();
          ctx.moveTo(x, -thickness * 0.72);
          ctx.lineTo(x, thickness * 0.72);
          ctx.stroke();
        }

        for (const side of [-1, 1]) {
          const x = side * half;
          ctx.beginPath();
          ctx.arc(x, 0, thickness * 0.92, 0, TAU);
          ctx.fillStyle = "rgba(10, 6, 20, 0.96)";
          ctx.fill();
          ctx.strokeStyle = C.magenta;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, 0, Math.max(1.2, thickness * 0.26), 0, TAU);
          ctx.fillStyle = C.red;
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawOrb(ctx, orb) {
      const fade = orb.life < 1.5 ? U.clamp(orb.life / 1.5, 0, 1) : 1;
      const pulse = 1 + Math.sin(this.gameTime * 4 + orb.phase) * 0.08;
      const r = orb.r * pulse;

      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.globalAlpha = fade;
      ctx.globalCompositeOperation = "lighter";

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.1);
      glow.addColorStop(0, "rgba(255, 209, 102, 0.45)");
      glow.addColorStop(0.35, "rgba(255, 209, 102, 0.13)");
      glow.addColorStop(1, "rgba(255, 209, 102, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 3.1, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 209, 102, 0.8)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.98, 0, TAU);
      ctx.stroke();

      const core = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r * 0.78);
      core.addColorStop(0, "rgba(255, 255, 255, 1)");
      core.addColorStop(0.36, "rgba(255, 231, 154, 0.95)");
      core.addColorStop(0.8, "rgba(255, 209, 102, 0.55)");
      core.addColorStop(1, "rgba(255, 209, 102, 0.05)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.78, 0, TAU);
      ctx.fill();

      for (let i = 0; i < 2; i += 1) {
        const angle = this.gameTime * 2.1 + orb.phase + i * Math.PI;
        const orbitX = Math.cos(angle) * r * 1.5;
        const orbitY = Math.sin(angle) * r * 0.95;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(orbitX, orbitY, Math.max(0.8, r * 0.12), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawPowerup(ctx, power) {
      const def = NR.POWERUPS[power.type];
      if (!def) return;
      const t = this.gameTime;
      const fade = power.life < 3 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 9)) : 1;
      const rotation = t * 0.75 + power.phase;
      const r = power.r;

      ctx.save();
      ctx.translate(power.x, power.y);
      ctx.globalAlpha = fade;

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.4);
      glow.addColorStop(0, colorWithAlpha(def.color, 0.36));
      glow.addColorStop(0.45, colorWithAlpha(def.color, 0.1));
      glow.addColorStop(1, colorWithAlpha(def.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, r * 3.4, 0, TAU);
      ctx.fill();

      ctx.rotate(rotation);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = -Math.PI / 2 + (i / 6) * TAU;
        const x = Math.cos(angle) * r * 1.32;
        const y = Math.sin(angle) * r * 1.32;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(7, 10, 24, 0.94)";
      ctx.fill();
      if (!this.save.reducedFx) {
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 16;
      }
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.rotate(-rotation);
      ctx.fillStyle = def.color;
      ctx.font = `700 ${Math.round(r * 0.92)}px ${MONO_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.glyph, 0, r * 0.04);
      ctx.restore();

      ctx.save();
      ctx.translate(power.x, power.y);
      ctx.rotate(-t * 1.1);
      ctx.globalAlpha = fade * 0.42;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.86, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = fade * 0.88;
      ctx.fillStyle = def.color;
      ctx.font = `600 ${Math.max(7, Math.round(r * 0.46))}px ${MONO_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(def.name, power.x, power.y + r * 2.02);
      ctx.restore();
    }

    drawParticles(ctx) {
      if (!this.particles.length) return;
      const reduced = this.save.reducedFx;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const particle of this.particles) {
        const alpha = particle.life / particle.maxLife;
        if (alpha <= 0) continue;
        const radius = Math.max(0.4, particle.size * (0.55 + alpha * 0.45));
        ctx.globalAlpha = alpha * 0.82;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, TAU);
        ctx.fill();
        if (!reduced) {
          ctx.globalAlpha = alpha * 0.16;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, radius * 2.3, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    drawRings(ctx) {
      if (!this.rings.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const ring of this.rings) {
        const alpha = ring.life / ring.maxLife;
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = Math.max(0.5, ring.width * alpha);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, Math.max(0.5, ring.radius), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawFloatTexts(ctx) {
      if (!this.floatTexts.length) return;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const text of this.floatTexts) {
        const alpha = U.clamp((text.life / text.maxLife) * 1.7, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = text.color;
        ctx.font = `700 ${Math.round(text.size * Math.max(0.85, this.scale))}px ${MONO_FONT}`;
        if (!this.save.reducedFx) {
          ctx.shadowColor = text.color;
          ctx.shadowBlur = 8;
        }
        ctx.fillText(text.text, text.x, text.y);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

  }

  /* Boot after the DOM is parsed. The scripts sit at the end of <body>, so the
     cached elements and canvas are always available. */
  function boot() {
    const game = new NeonRush();
    window.NEON_RUSH = game;
    document.body.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
