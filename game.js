
(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const overlay = document.getElementById("overlay");
  const overlayTag = document.getElementById("overlayTag");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startButton = document.getElementById("startButton");

  const scoreDisplay = document.getElementById("score");
  const bestDisplay = document.getElementById("best");
  const levelDisplay = document.getElementById("level");
  const levelNameDisplay = document.getElementById("levelName");
  const progressText = document.getElementById("progressText");
  const progressBar = document.getElementById("levelProgress");
  const livesDisplay = document.getElementById("lives");
  const powerStatus = document.getElementById("powerStatus");
  const pauseButton = document.getElementById("pauseButton");
  const soundToggle = document.getElementById("soundToggle");
  const soundLabel = document.getElementById("soundLabel");

  const W = canvas.width;
  const H = canvas.height;
  const LEVELS = window.NEON_LEVELS || [];

  const BEST_KEY = "neonRushBestV2";

  const C = {
    cyan: "#52f7ff",
    pink: "#ff3bcb",
    purple: "#a76bff",
    yellow: "#ffe66d",
    green: "#76ffad",
    white: "#effcff"
  };

  let state = "ready";
  let score = 0;
  let best = loadBest();
  let levelIndex = 0;
  let lives = 3;
  let elapsed = 0;
  let spawnTimer = 0;
  let orbTimer = 0;
  let powerTimer = 0;
  let invulnerable = 0;
  let shieldTime = 0;
  let slowTime = 0;
  let combo = 0;
  let comboTime = 0;
  let levelNotice = 0;
  let lastTime = 0;
  let animationId = 0;
  let muted = false;
  let audioContext = null;

  const keys = new Set();
  const obstacles = [];
  const orbs = [];
  const powerUps = [];
  const particles = [];
  const stars = [];

  const player = {
    x: W / 2,
    y: H - 76,
    radius: 13,
    speed: 280
  };

  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 1.7 + 0.4,
      speed: Math.random() * 24 + 10,
      alpha: Math.random() * 0.7 + 0.15
    });
  }

  function loadBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Saving is optional.
    }
  }

  function currentLevel() {
    return LEVELS[levelIndex] || {
      level: 1,
      name: "FIRST CONTACT",
      targetScore: 100,
      obstacleSpeed: 135,
      spawnInterval: 1.45,
      maxObstacles: 3,
      powerUpChance: 0.12
    };
  }

  function sound(frequency = 440, duration = 0.08, type = "sine") {
    if (muted) return;

    try {
      if (!audioContext) {
        audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = type;
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.04, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Continue without audio if unsupported.
    }
  }

  function showOverlay(tag, title, message, buttonText) {
    overlayTag.textContent = tag;
    overlayTitle.textContent = title;
    overlayText.textContent = message;
    startButton.textContent = buttonText;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function updateHUD() {
    scoreDisplay.textContent = String(score).padStart(4, "0");
    bestDisplay.textContent = String(best).padStart(4, "0");
    levelDisplay.textContent = String(currentLevel().level).padStart(2, "0");

    if (levelNameDisplay) {
      levelNameDisplay.textContent = currentLevel().name;
    }

    if (progressText) {
      progressText.textContent =
        `LEVEL ${String(currentLevel().level).padStart(2, "0")} / ${LEVELS.length || 10}`;
    }

    if (livesDisplay) {
      livesDisplay.textContent =
        "♥".repeat(Math.max(0, lives)) + "♡".repeat(Math.max(0, 3 - lives));
    }

    if (powerStatus) {
      const active = [];

      if (shieldTime > 0) active.push(`SHIELD ${shieldTime.toFixed(1)}s`);
      if (slowTime > 0) active.push(`SLOW-MO ${slowTime.toFixed(1)}s`);

      powerStatus.textContent = active.join(" · ") || "NONE";
    }

    if (progressBar) {
      const previousTarget = levelIndex > 0
        ? LEVELS[levelIndex - 1].targetScore
        : 0;

      const target = currentLevel().targetScore;
      const span = Math.max(1, target - previousTarget);

      const percent = Math.max(
        0,
        Math.min(100, ((score - previousTarget) / span) * 100)
      );

      progressBar.style.width = `${percent}%`;
    }

    if (pauseButton) {
      pauseButton.disabled = state !== "playing" && state !== "paused";
      pauseButton.textContent = state === "paused" ? "▶ RESUME" : "Ⅱ PAUSE";
    }
  }

  function resetGame() {
    score = 0;
    levelIndex = 0;
    lives = 3;
    elapsed = 0;

    spawnTimer = 0.6;
    orbTimer = 0.8;
    powerTimer = 4;

    invulnerable = 0;
    shieldTime = 0;
    slowTime = 0;
    combo = 0;
    comboTime = 0;
    levelNotice = 0;

    obstacles.length = 0;
    orbs.length = 0;
    powerUps.length = 0;
    particles.length = 0;

    player.x = W / 2;
    player.y = H - 76;

    keys.clear();
    updateHUD();
  }

  function startGame() {
    resetGame();

    state = "playing";
    lastTime = performance.now();

    hideOverlay();
    updateHUD();
    sound(520, 0.12);

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
  }

  function pauseGame() {
    if (state !== "playing") return;

    state = "paused";
    keys.clear();

    showOverlay(
      "SYSTEM PAUSED",
      "TAKE A BREATH",
      "Your run is safe. Resume when you're ready.",
      "RESUME ↗"
    );

    updateHUD();
    sound(260, 0.1);
    draw();
  }

  function resumeGame() {
    if (state !== "paused") return;

    state = "playing";
    hideOverlay();

    lastTime = performance.now();
    updateHUD();
    sound(440, 0.08);

    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(gameLoop);
  }

  function finishGame(victory = false) {
    state = victory ? "victory" : "over";

    const newRecord = score > best;

    if (newRecord) {
      best = score;
      saveBest();
    }

    updateHUD();

    const result = newRecord ? " ✦ NEW PERSONAL BEST!" : "";

    showOverlay(
      victory ? "ALL SYSTEMS CLEARED" : "RUN TERMINATED",
      victory ? "YOU BEAT THE GRID" : "GAME OVER",
      `Score: ${score} · Level: ${currentLevel().level} · Survival: ${Math.floor(elapsed)}s.${result}`,
      "PLAY AGAIN ↗"
    );

    sound(victory ? 880 : 150, 0.28, victory ? "sine" : "sawtooth");
    draw();
  }

  function addParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 130 + 35;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.45 + 0.25,
        maxLife: 0.7,
        size: Math.random() * 3 + 1,
        color
      });
    }
  }

  function spawnObstacle() {
    const level = currentLevel();

    if (obstacles.length >= level.maxObstacles) return;

    const size = Math.random() * 12 + 11;

    obstacles.push({
      x: Math.random() * (W - 44) + 22,
      y: -25,
      size,
      speed: level.obstacleSpeed * (0.82 + Math.random() * 0.42),
      drift: (Math.random() - 0.5) * (25 + levelIndex * 4),
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 3
    });
  }

  function spawnOrb() {
    orbs.push({
      x: Math.random() * (W - 48) + 24,
      y: -15,
      radius: 6,
      speed: 105 + levelIndex * 8,
      pulse: Math.random() * 6
    });
  }

  function spawnPowerUp() {
    const types = ["shield", "slow", "life"];
    const type = types[Math.floor(Math.random() * types.length)];

    powerUps.push({
      x: Math.random() * (W - 60) + 30,
      y: -20,
      radius: 11,
      speed: 95 + levelIndex * 5,
      type,
      pulse: 0
    });
  }

  function collectOrb(index) {
    const orb = orbs[index];
    orbs.splice(index, 1);

    combo++;
    comboTime = 2.5;

    const multiplier = Math.min(5, 1 + Math.floor(combo / 4));
    score += 25 * multiplier;

    addParticles(orb.x, orb.y, C.cyan, 10);
    sound(650 + multiplier * 80, 0.06);
    updateHUD();
  }

  function collectPowerUp(index) {
    const power = powerUps[index];
    powerUps.splice(index, 1);

    if (power.type === "shield") {
      shieldTime = Math.max(shieldTime, 6);
      addParticles(player.x, player.y, C.cyan, 18);
      sound(720, 0.18);
    } else if (power.type === "slow") {
      slowTime = Math.max(slowTime, 5);
      addParticles(player.x, player.y, C.purple, 18);
      sound(530, 0.18);
    } else {
      if (lives < 3) {
        lives++;
      } else {
        score += 100;
      }

      addParticles(player.x, player.y, C.green, 18);
      sound(880, 0.18);
    }

    updateHUD();
  }

  function hitPlayer(index) {
    const obstacle = obstacles[index];
    obstacles.splice(index, 1);

    addParticles(obstacle.x, obstacle.y, C.pink, 20);

    if (shieldTime > 0) {
      sound(500, 0.12);
      return;
    }

    if (invulnerable > 0) return;

    lives--;
    invulnerable = 1.6;
    combo = 0;
    comboTime = 0;

    sound(125, 0.22, "sawtooth");
    addParticles(player.x, player.y, C.cyan, 15);
    updateHUD();

    if (lives <= 0) {
      finishGame(false);
    }
  }

  function advanceLevel() {
    if (levelIndex >= LEVELS.length - 1) {
      finishGame(true);
      return;
    }

    levelIndex++;
    levelNotice = 2.2;
    spawnTimer = 0.8;

    addParticles(player.x, player.y, C.purple, 28);
    sound(740, 0.2);
    updateHUD();
  }

  function update(dt) {
    elapsed += dt;

    invulnerable = Math.max(0, invulnerable - dt);
    shieldTime = Math.max(0, shieldTime - dt);
    slowTime = Math.max(0, slowTime - dt);
    comboTime = Math.max(0, comboTime - dt);
    levelNotice = Math.max(0, levelNotice - dt);

    if (comboTime === 0) combo = 0;

    const level = currentLevel();

    let dx = 0;
    let dy = 0;

    if (keys.has("arrowleft") || keys.has("a")) dx--;
    if (keys.has("arrowright") || keys.has("d")) dx++;
    if (keys.has("arrowup") || keys.has("w")) dy--;
    if (keys.has("arrowdown") || keys.has("s")) dy++;

    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    player.x = Math.max(18, Math.min(W - 18, player.x));
    player.y = Math.max(18, Math.min(H - 18, player.y));

    const slowFactor = slowTime > 0 ? 0.48 : 1;

    spawnTimer -= dt;

    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = level.spawnInterval * (0.82 + Math.random() * 0.36);
    }

    orbTimer -= dt;

    if (orbTimer <= 0) {
      spawnOrb();
      orbTimer = 1.25 + Math.random() * 1.1;
    }

    powerTimer -= dt;

    if (powerTimer <= 0) {
      if (Math.random() < level.powerUpChance) spawnPowerUp();
      powerTimer = 5 + Math.random() * 4;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];

      obstacle.y += obstacle.speed * slowFactor * dt;
      obstacle.x += obstacle.drift * dt;
      obstacle.rotation += obstacle.spin * dt;

      if (obstacle.x < obstacle.size || obstacle.x > W - obstacle.size) {
        obstacle.drift *= -1;
      }

      if (obstacle.y > H + 35) {
        obstacles.splice(i, 1);
        score += 5;
        updateHUD();
        continue;
      }

      const distance = Math.hypot(
        obstacle.x - player.x,
        obstacle.y - player.y
      );

      if (distance < obstacle.size + player.radius * 0.72) {
        hitPlayer(i);
        if (state !== "playing") return;
      }
    }

    for (let i = orbs.length - 1; i >= 0; i--) {
      const orb = orbs[i];

      orb.y += orb.speed * slowFactor * dt;
      orb.pulse += dt * 5;

      if (orb.y > H + 20) {
        orbs.splice(i, 1);
        continue;
      }

      if (Math.hypot(orb.x - player.x, orb.y - player.y) < orb.radius + player.radius) {
        collectOrb(i);
      }
    }

    for (let i = powerUps.length - 1; i >= 0; i--) {
      const power = powerUps[i];

      power.y += power.speed * slowFactor * dt;
      power.pulse += dt * 4;

      if (power.y > H + 25) {
        powerUps.splice(i, 1);
        continue;
      }

      if (Math.hypot(power.x - player.x, power.y - player.y) < power.radius + player.radius) {
        collectPowerUp(i);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= dt;

      if (p.life <= 0) particles.splice(i, 1);
    }

    for (const star of stars) {
      star.y += star.speed * dt;

      if (star.y > H) {
        star.y = 0;
        star.x = Math.random() * W;
      }
    }

    if (score >= level.targetScore) {
      advanceLevel();
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#070914";
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(
      W / 2, H / 2, 20, W / 2, H / 2, W * 0.7
    );

    glow.addColorStop(0, "rgba(34,37,92,0.28)");
    glow.addColorStop(1, "rgba(7,9,20,0)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = C.white;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(82,247,255,0.09)";
    ctx.lineWidth = 1;

    const gridSize = 42;
    const offset = (elapsed * 18) % gridSize;

    for (let x = 0; x <= W; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (let y = -gridSize + offset; y < H; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(82,247,255,0.25)";
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  function drawPlayer() {
    if (invulnerable > 0 && Math.floor(invulnerable * 12) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.shadowBlur = 22;
    ctx.shadowColor = C.cyan;

    if (shieldTime > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 23 + Math.sin(elapsed * 8) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(13, 12);
    ctx.lineTo(0, 7);
    ctx.lineTo(-13, 12);
    ctx.closePath();

    ctx.fillStyle = "#102a3b";
    ctx.fill();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = C.white;
    ctx.fillRect(-2, -2, 4, 6);

    ctx.restore();
  }

  function drawObstacles() {
    for (const obstacle of obstacles) {
      ctx.save();
      ctx.translate(obstacle.x, obstacle.y);
      ctx.rotate(obstacle.rotation);

      ctx.shadowBlur = 17;
      ctx.shadowColor = C.pink;

      ctx.beginPath();
      ctx.moveTo(0, -obstacle.size);
      ctx.lineTo(obstacle.size * 0.85, 0);
      ctx.lineTo(0, obstacle.size);
      ctx.lineTo(-obstacle.size * 0.85, 0);
      ctx.closePath();

      ctx.fillStyle = "rgba(255,59,203,0.15)";
      ctx.fill();
      ctx.strokeStyle = C.pink;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawOrbs() {
    for (const orb of orbs) {
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = C.cyan;

      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius + Math.sin(orb.pulse) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = C.cyan;
      ctx.fill();

      ctx.restore();
    }
  }

  function drawPowerUps() {
    for (const power of powerUps) {
      const color = power.type === "shield"
        ? C.cyan
        : power.type === "slow"
          ? C.purple
          : C.green;

      ctx.save();
      ctx.translate(power.x, power.y);
      ctx.rotate(Math.sin(power.pulse) * 0.12);

      ctx.shadowBlur = 20;
      ctx.shadowColor = color;

      ctx.beginPath();
      ctx.arc(0, 0, power.radius + Math.sin(power.pulse * 2) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10,20,38,0.95)";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        power.type === "shield" ? "S" : power.type === "slow" ? "T" : "+",
        0, 1
      );

      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }
  }

  function drawStatus() {
    ctx.save();
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(239,252,255,0.72)";
    ctx.textAlign = "left";

    const multiplier = Math.min(5, 1 + Math.floor(combo / 4));
    ctx.fillText(`COMBO x${multiplier}`, 18, 25);

    if (shieldTime > 0 || slowTime > 0) {
      ctx.textAlign = "right";
      ctx.fillStyle = shieldTime > 0 ? C.cyan : C.purple;

      ctx.fillText(
        shieldTime > 0
          ? `SHIELD ${shieldTime.toFixed(1)}s`
          : `SLOW-MO ${slowTime.toFixed(1)}s`,
        W - 18,
        25
      );
    }

    if (levelNotice > 0) {
      ctx.globalAlpha = Math.min(1, levelNotice * 1.5);
      ctx.textAlign = "center";
      ctx.shadowBlur = 20;
      ctx.shadowColor = C.cyan;
      ctx.fillStyle = C.cyan;
      ctx.font = "bold 25px monospace";

      ctx.fillText(`LEVEL ${currentLevel().level}`, W / 2, H / 2 - 8);

      ctx.shadowBlur = 0;
      ctx.fillStyle = C.white;
      ctx.font = "12px monospace";
      ctx.fillText(currentLevel().name, W / 2, H / 2 + 18);
    }

    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawOrbs();
    drawPowerUps();
    drawObstacles();
    drawParticles();
    drawPlayer();
    drawStatus();
  }

  function gameLoop(timestamp) {
    if (state !== "playing") {
      draw();
      return;
    }

    const dt = Math.min((timestamp - lastTime) / 1000, 0.035);
    lastTime = timestamp;

    update(dt);
    draw();

    if (state === "playing") {
      animationId = requestAnimationFrame(gameLoop);
    }
  }

  // Main menu / restart button
  startButton.addEventListener("click", () => {
    if (state === "paused") {
      resumeGame();
    } else {
      startGame();
    }
  });

  // Pause / resume button
  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      if (state === "playing") {
        pauseGame();
      } else if (state === "paused") {
        resumeGame();
      }
    });
  }

  // Sound toggle
  if (soundToggle) {
    soundToggle.addEventListener("click", () => {
      muted = !muted;

      soundToggle.setAttribute("aria-pressed", String(muted));

      if (soundLabel) {
        soundLabel.textContent = muted ? "OFF" : "ON";
      }

      if (!muted) sound(660, 0.08);
    });
  }

  // Keyboard controls
  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if ([
      "arrowup", "arrowdown", "arrowleft", "arrowright", " "
    ].includes(key)) {
      event.preventDefault();
    }

    if (key === "escape" || key === "p") {
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
      return;
    }

    if (key === "m") {
      muted = !muted;

      if (soundToggle) {
        soundToggle.setAttribute("aria-pressed", String(muted));
      }

      if (soundLabel) {
        soundLabel.textContent = muted ? "OFF" : "ON";
      }

      if (!muted) sound(660, 0.08);
      return;
    }

    keys.add(key);
  });

  document.addEventListener("keyup", event => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("blur", () => {
    keys.clear();
    if (state === "playing") pauseGame();
  });

  // Initial state
  updateHUD();
  draw();

  showOverlay(
    "AFTERHOURS PRESENTS",
    "ENTER THE GRID.",
    "Dodge hostile signals. Collect energy. Survive all ten levels.",
    "INITIALIZE RUN ↗"
  );
})();
