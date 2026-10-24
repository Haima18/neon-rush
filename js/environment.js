/* ==========================================================================
   NEON RUSH — procedural environment
   A seeded, pre-rendered skyline (three parallax layers) with animated window
   lights, stars, drifting dust, a synthwave sun, and a perspective grid.
   Pre-rendering keeps the expensive window detail out of the frame loop.
   ========================================================================== */

(function () {
  "use strict";

  const NR = window.NR;
  const U = NR.utils;

  const LAYER_SPECS = [
    {
      seed: 811,
      heightRatio: 0.27,
      widthScale: 0.74,
      minHeight: 0.42,
      maxHeight: 0.96,
      offsetY: -16,
      parallax: 0.35,
      alpha: 0.72,
      colorTop: "#111634",
      colorBottom: "#090c1d",
      edgeColor: "rgba(139, 92, 255, 0.34)",
      litRatio: 0.1,
      windowColors: ["#8B5CFF", "#00F5FF", "#6f7bff"],
      windowChance: 0.34,
      lightChance: 0.05,
    },
    {
      seed: 1409,
      heightRatio: 0.36,
      widthScale: 0.92,
      minHeight: 0.4,
      maxHeight: 1,
      offsetY: 2,
      parallax: 0.66,
      alpha: 0.88,
      colorTop: "#0d1130",
      colorBottom: "#060917",
      edgeColor: "rgba(0, 245, 255, 0.3)",
      litRatio: 0.14,
      windowColors: ["#00F5FF", "#8B5CFF", "#FFD166", "#FF2BD6"],
      windowChance: 0.4,
      lightChance: 0.07,
    },
    {
      seed: 2711,
      heightRatio: 0.48,
      widthScale: 1.22,
      minHeight: 0.36,
      maxHeight: 1,
      offsetY: 20,
      parallax: 1,
      alpha: 1,
      colorTop: "#080b1c",
      colorBottom: "#04050d",
      edgeColor: "rgba(255, 43, 214, 0.3)",
      litRatio: 0.09,
      windowColors: ["#FF2BD6", "#00F5FF", "#FFD166"],
      windowChance: 0.3,
      lightChance: 0.06,
    },
  ];

  class Environment {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.width = 1;
      this.height = 1;
      this.dpr = 1;
      this.time = 0;
      this.gridOffset = 0;
      this.stars = [];
      this.dust = [];
      this.layers = [];
      this.reduced = false;
      this.horizon = 0;
      this.sunPhase = 0;
      this._needsRebuild = false;
    }

    setReducedFx(reduced) {
      const value = Boolean(reduced);
      if (this.reduced === value) return;
      this.reduced = value;
      this._needsRebuild = true;
      this.resize(this.width, this.height, this.dpr);
    }

    resize(width, height, dpr) {
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.dpr = dpr || 1;
      this.horizon = this.height * 0.665;

      this.buildStars();
      this.buildDust();
      this.layers = LAYER_SPECS.map((spec, index) =>
        this.buildSkylineLayer(spec, index)
      );
      this._needsRebuild = false;
    }

    buildStars() {
      const rand = U.mulberry32(9301);
      const count = this.reduced
        ? Math.min(54, Math.round(this.width / 22))
        : Math.min(150, Math.round(this.width / 9));
      this.stars = [];
      for (let i = 0; i < count; i += 1) {
        const palette = [NR.COLORS.white, NR.COLORS.cyan, NR.COLORS.violet, NR.COLORS.magenta];
        this.stars.push({
          x: rand() * this.width,
          y: rand() * this.horizon * 0.92,
          size: 0.5 + rand() * 1.4,
          alpha: 0.18 + rand() * 0.62,
          phase: rand() * Math.PI * 2,
          speed: 0.35 + rand() * 1.4,
          color: palette[Math.floor(rand() * palette.length)],
        });
      }
    }

    buildDust() {
      const rand = U.mulberry32(6613);
      const count = this.reduced ? 16 : 46;
      this.dust = [];
      for (let i = 0; i < count; i += 1) {
        const palette = [
          "rgba(0, 245, 255, 0.55)",
          "rgba(255, 43, 214, 0.44)",
          "rgba(255, 209, 102, 0.4)",
          "rgba(244, 247, 255, 0.32)",
        ];
        this.dust.push({
          x: rand() * this.width,
          y: rand() * this.height,
          vx: (rand() - 0.5) * 7,
          vy: -(2 + rand() * 9),
          size: 0.6 + rand() * 1.9,
          alpha: 0.15 + rand() * 0.45,
          color: palette[Math.floor(rand() * palette.length)],
          phase: rand() * Math.PI * 2,
        });
      }
    }

    buildSkylineLayer(spec, index) {
      const layerWidth = Math.max(this.width * 1.55, this.width + 280);
      const layerHeight = this.height * spec.heightRatio;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(layerWidth * this.dpr);
      canvas.height = Math.ceil(layerHeight * this.dpr);
      const ctx = canvas.getContext("2d");
      ctx.scale(this.dpr, this.dpr);

      const rand = U.mulberry32(spec.seed);
      const baseline = layerHeight;
      const lights = [];

      let x = -40;
      while (x < layerWidth + 40) {
        const buildingWidth = (22 + rand() * 66) * spec.widthScale;
        const gap = 3 + rand() * 9;
        const heightFraction = spec.minHeight + rand() * (spec.maxHeight - spec.minHeight);
        const buildingHeight = layerHeight * heightFraction;
        const top = baseline - buildingHeight;

        const bodyGradient = ctx.createLinearGradient(0, top, 0, baseline);
        bodyGradient.addColorStop(0, spec.colorTop);
        bodyGradient.addColorStop(1, spec.colorBottom);
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(x, top, buildingWidth, buildingHeight);

        // Lit crown edge.
        ctx.globalAlpha = 0.52;
        ctx.strokeStyle = spec.edgeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, top + 0.5);
        ctx.lineTo(x + buildingWidth, top + 0.5);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Stepped crown / antenna for silhouette variety.
        if (rand() < 0.34) {
          const crownWidth = buildingWidth * (0.28 + rand() * 0.28);
          const crownHeight = 5 + rand() * 18;
          ctx.fillStyle = spec.colorTop;
          ctx.fillRect(x + buildingWidth * 0.5 - crownWidth * 0.5, top - crownHeight, crownWidth, crownHeight);
          if (rand() < 0.55) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = spec.edgeColor;
            ctx.fillRect(x + buildingWidth * 0.5 - 0.5, top - crownHeight, 1, crownHeight);
            ctx.globalAlpha = 1;
          }
        } else if (rand() < 0.2) {
          const antennaX = x + buildingWidth * 0.5;
          const antennaH = 8 + rand() * 22;
          ctx.strokeStyle = spec.edgeColor;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.moveTo(antennaX, top);
          ctx.lineTo(antennaX, top - antennaH);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Window grid.
        const pad = 4;
        const cellW = 7;
        const cellH = 9;
        const cols = Math.max(1, Math.floor((buildingWidth - pad * 2) / cellW));
        const rows = Math.max(1, Math.floor((buildingHeight - pad * 2) / cellH));
        for (let row = 1; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            if (rand() > spec.windowChance) continue;
            const wx = x + pad + col * cellW;
            const wy = top + pad + row * cellH;
            if (wx + 2.5 > x + buildingWidth - pad || wy + 2 > baseline - pad) continue;
            const color = spec.windowColors[Math.floor(rand() * spec.windowColors.length)];
            ctx.globalAlpha = spec.litRatio + rand() * 0.55;
            ctx.fillStyle = color;
            ctx.fillRect(wx, wy, 2.4, 2.1);
            ctx.globalAlpha = 1;
            if (rand() < spec.lightChance && lights.length < 13) {
              lights.push({ x: wx, y: wy, color, phase: rand() * Math.PI * 2 });
            }
          }
        }

        // Occasional horizontal neon strip.
        if (rand() < 0.22 && buildingHeight > 32) {
          const stripY = top + 6 + rand() * Math.min(40, buildingHeight * 0.4);
          ctx.globalAlpha = 0.2 + rand() * 0.35;
          ctx.fillStyle = spec.edgeColor;
          ctx.fillRect(x + 3, stripY, buildingWidth - 6, 1);
          ctx.globalAlpha = 1;
        }

        x += buildingWidth + gap;
      }

      return {
        canvas,
        width: layerWidth,
        height: layerHeight,
        offsetY: spec.offsetY,
        parallax: spec.parallax,
        alpha: spec.alpha,
        lights,
      };
    }

    update(dt, options = {}) {
      this.time += dt;
      const mode = options.mode || "menu";
      const intensity = U.clamp(options.intensity || 0, 0, 1);
      const baseSpeed = mode === "game" ? 0.48 + intensity * 0.55 : 0.18;
      this.gridOffset = (this.gridOffset + dt * baseSpeed) % 1;
      this.sunPhase += dt * 0.12;

      for (const particle of this.dust) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.y < -8) {
          particle.y = this.height + 8;
          particle.x = Math.random() * this.width;
        }
        if (particle.x < -8) particle.x = this.width + 8;
        if (particle.x > this.width + 8) particle.x = -8;
      }
    }

    draw(ctx, options = {}) {
      const width = this.width;
      const height = this.height;
      const mode = options.mode || "menu";
      const focus = U.clamp(options.focusX || 0.5, 0, 1) - 0.5;
      const intensity = U.clamp(options.intensity || 0, 0, 1);
      const isGame = mode === "game";

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      this.drawSky(ctx, width, height, mode);
      this.drawStars(ctx, isGame);
      this.drawSun(ctx, width, height, mode);
      this.drawHorizonGlow(ctx, width, height, mode);
      this.drawSkyline(ctx, width, mode, focus);
      this.drawGrid(ctx, width, height, isGame, intensity);
      this.drawDust(ctx, isGame);

      ctx.restore();
    }

    drawSky(ctx, width, height, mode) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#05060f");
      gradient.addColorStop(0.36, "#070a1a");
      gradient.addColorStop(0.56, "#0b0d25");
      gradient.addColorStop(0.655, mode === "menu" ? "#1a1140" : "#120e2c");
      gradient.addColorStop(0.75, "#0a0920");
      gradient.addColorStop(1, "#04050c");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    drawStars(ctx, isGame) {
      ctx.save();
      for (const star of this.stars) {
        const twinkle = 0.55 + Math.sin(this.time * star.speed + star.phase) * 0.45;
        ctx.globalAlpha = star.alpha * twinkle * (isGame ? 0.6 : 1);
        ctx.fillStyle = star.color;
        ctx.fillRect(star.x, star.y, star.size, star.size);
        if (!this.reduced && star.size > 1.1) {
          ctx.globalAlpha *= 0.22;
          ctx.fillRect(star.x - 1.5, star.y + 0.3, star.size + 3, 0.4);
        }
      }
      ctx.restore();
    }

    drawSun(ctx, width, height, mode) {
      const radius = Math.min(width, height) * 0.205;
      const cx = width * 0.53;
      const cy = this.horizon - radius * 0.34;
      const isGame = mode === "game";
      const glowAlpha = isGame ? 0.28 : 0.52;

      ctx.save();

      const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2.1);
      glow.addColorStop(0, `rgba(255, 43, 214, ${glowAlpha * 0.34})`);
      glow.addColorStop(0.45, `rgba(139, 92, 255, ${glowAlpha * 0.16})`);
      glow.addColorStop(1, "rgba(139, 92, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);

      const sunGradient = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
      sunGradient.addColorStop(0, "rgba(255, 209, 102, 0.92)");
      sunGradient.addColorStop(0.38, "rgba(255, 122, 180, 0.78)");
      sunGradient.addColorStop(0.72, "rgba(255, 43, 214, 0.58)");
      sunGradient.addColorStop(1, "rgba(139, 92, 255, 0.26)");

      ctx.globalAlpha = isGame ? 0.3 : 0.72;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = sunGradient;
      ctx.fill();

      // Retro slit bands cut through the lower half of the disc.
      ctx.globalAlpha = isGame ? 0.34 : 0.6;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      const bandStart = cy + radius * 0.06;
      let gap = 2;
      for (let y = bandStart; y < cy + radius; y += gap + 5) {
        const thickness = 2 + ((y - bandStart) / radius) * 5;
        ctx.fillStyle = "rgba(7, 8, 18, 0.82)";
        ctx.fillRect(cx - radius, y, radius * 2, thickness);
        gap += 1.1;
      }
      ctx.restore();

      // Thin orbital ring.
      ctx.globalAlpha = isGame ? 0.14 : 0.28;
      ctx.strokeStyle = "rgba(0, 245, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.48, radius * 0.34, -0.16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    drawHorizonGlow(ctx, width, height, mode) {
      const isGame = mode === "game";
      ctx.save();
      const glow = ctx.createLinearGradient(0, this.horizon - 80, 0, this.horizon + 90);
      glow.addColorStop(0, "rgba(139, 92, 255, 0)");
      glow.addColorStop(0.45, `rgba(255, 43, 214, ${isGame ? 0.05 : 0.11})`);
      glow.addColorStop(0.55, `rgba(0, 245, 255, ${isGame ? 0.045 : 0.09})`);
      glow.addColorStop(1, "rgba(0, 245, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, this.horizon - 80, width, 170);

      ctx.globalAlpha = isGame ? 0.28 : 0.52;
      ctx.strokeStyle = "rgba(0, 245, 255, 0.32)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, this.horizon + 0.5);
      ctx.lineTo(width, this.horizon + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    drawSkyline(ctx, width, mode, focus) {
      const isGame = mode === "game";
      for (let index = 0; index < this.layers.length; index += 1) {
        const layer = this.layers[index];
        const drift =
          Math.sin(this.time * 0.045 + index * 1.7) * (5 + index * 3) +
          focus * layer.parallax * -34;
        const x = (width - layer.width) * 0.5 + drift;
        const y = this.horizon + layer.offsetY - layer.height;

        ctx.save();
        ctx.globalAlpha = layer.alpha * (isGame ? 0.62 : 1);
        ctx.drawImage(layer.canvas, x, y, layer.width, layer.height);

        // A handful of pulsing windows adds life without redrawing the city.
        if (!this.reduced) {
          for (let i = 0; i < layer.lights.length; i += 1) {
            const light = layer.lights[i];
            const flicker = 0.34 + Math.sin(this.time * 0.9 + light.phase) * 0.28;
            ctx.globalAlpha = flicker * (isGame ? 0.42 : 0.8);
            ctx.fillStyle = light.color;
            ctx.fillRect(x + light.x, y + light.y, 2.6, 2.2);
          }
        }
        ctx.restore();
      }
    }

    drawGrid(ctx, width, height, isGame, intensity) {
      const horizon = this.horizon + 3;
      const floorHeight = height - horizon;
      if (floorHeight <= 0) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, width, floorHeight);
      ctx.clip();

      const vanishX = width * 0.5;
      const columns = 18;
      const spread = width * 1.7;
      ctx.lineWidth = 1;

      for (let i = 0; i <= columns; i += 1) {
        const ratio = i / columns - 0.5;
        const bottomX = vanishX + ratio * spread;
        const lineGradient = ctx.createLinearGradient(vanishX, horizon, bottomX, height);
        lineGradient.addColorStop(0, "rgba(0, 245, 255, 0)");
        lineGradient.addColorStop(0.45, `rgba(0, 245, 255, ${isGame ? 0.035 : 0.07})`);
        lineGradient.addColorStop(1, `rgba(139, 92, 255, ${isGame ? 0.1 : 0.18})`);
        ctx.strokeStyle = lineGradient;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bottomX, height);
        ctx.stroke();
      }

      const rows = 16;
      for (let i = 0; i < rows; i += 1) {
        const t = ((i + this.gridOffset) % rows) / rows;
        const y = horizon + floorHeight * Math.pow(t, 2.35);
        const alpha = (0.02 + t * 0.13) * (isGame ? 0.66 : 1);
        ctx.strokeStyle =
          i % 5 === 0
            ? `rgba(255, 43, 214, ${alpha * 0.9})`
            : `rgba(0, 245, 255, ${alpha})`;
        ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Horizon energy bloom, stronger in the arcade menu.
      const bloom = ctx.createRadialGradient(vanishX, horizon, 0, vanishX, horizon, width * 0.4);
      bloom.addColorStop(0, `rgba(0, 245, 255, ${(isGame ? 0.035 : 0.07) + intensity * 0.02})`);
      bloom.addColorStop(0.5, "rgba(139, 92, 255, 0.018)");
      bloom.addColorStop(1, "rgba(7, 8, 18, 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, horizon, width, floorHeight);

      ctx.restore();
    }

    drawDust(ctx, isGame) {
      ctx.save();
      for (const particle of this.dust) {
        const twinkle = 0.6 + Math.sin(this.time * 0.8 + particle.phase) * 0.4;
        ctx.globalAlpha = particle.alpha * twinkle * (isGame ? 0.55 : 0.85);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.restore();
    }
  }

  NR.Environment = Environment;
})();
