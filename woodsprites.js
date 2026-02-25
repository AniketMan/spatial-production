/* ============================================================
   Woodsprites (Atokirina) - Pandora-inspired particle background
   Luminous seed-like particles drifting through dark space,
   out of focus, with soft organic glow and tendrils.
   ============================================================ */

(function() {
  const canvas = document.getElementById('woodsprite-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let w, h;
  let sprites = [];
  let time = 0;

  // --- Configuration ---
  const SPRITE_COUNT = 35;
  const BASE_SPEED = 0.15; // slow, dreamy drift

  // Atokirina color palette -- bioluminescent whites, soft cyans, pale violets
  const COLORS = [
    { r: 220, g: 240, b: 255, a: 0.9 },   // cool white
    { r: 180, g: 220, b: 255, a: 0.85 },  // pale blue
    { r: 200, g: 255, b: 240, a: 0.8 },   // soft cyan-green
    { r: 210, g: 200, b: 255, a: 0.85 },  // pale violet
    { r: 255, g: 255, b: 255, a: 0.95 },  // pure white
    { r: 170, g: 230, b: 255, a: 0.75 },  // sky blue
    { r: 190, g: 255, b: 220, a: 0.7 },   // bioluminescent green
  ];

  function createSprite() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const size = 6 + Math.random() * 14; // core size -- much larger
    const glowSize = size * (5 + Math.random() * 8); // massive soft glow

    return {
      x: Math.random() * w,
      y: Math.random() * h,
      size: size,
      glowSize: glowSize,
      color: color,
      // Drift velocity -- mostly upward with slight lateral wander
      vx: (Math.random() - 0.5) * BASE_SPEED * 0.6,
      vy: -BASE_SPEED * (0.3 + Math.random() * 0.7), // upward drift
      // Organic wobble parameters
      wobbleAmpX: 0.3 + Math.random() * 0.8,
      wobbleAmpY: 0.15 + Math.random() * 0.4,
      wobbleFreqX: 0.2 + Math.random() * 0.5,
      wobbleFreqY: 0.3 + Math.random() * 0.4,
      wobblePhase: Math.random() * Math.PI * 2,
      // Pulsing glow
      pulseFreq: 0.3 + Math.random() * 0.6,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseAmp: 0.15 + Math.random() * 0.3,
      // Tendril parameters
      tendrilCount: Math.floor(2 + Math.random() * 4),
      tendrilLength: size * (2 + Math.random() * 4),
      tendrilPhase: Math.random() * Math.PI * 2,
      // Depth layer (affects blur and opacity)
      depth: 0.3 + Math.random() * 0.7,
    };
  }

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    // Regenerate sprites on resize
    sprites = [];
    for (let i = 0; i < SPRITE_COUNT; i++) {
      sprites.push(createSprite());
    }
  }

  function drawSprite(s, t) {
    // Compute wobble offset
    const wx = Math.sin(t * s.wobbleFreqX + s.wobblePhase) * s.wobbleAmpX
             + Math.sin(t * s.wobbleFreqX * 1.7 + s.wobblePhase + 2.0) * s.wobbleAmpX * 0.4;
    const wy = Math.cos(t * s.wobbleFreqY + s.wobblePhase) * s.wobbleAmpY;

    const x = s.x + wx;
    const y = s.y + wy;

    // Pulsing opacity
    const pulse = 1 + s.pulseAmp * Math.sin(t * s.pulseFreq + s.pulsePhase);
    const alpha = s.color.a * pulse * s.depth;

    // --- Draw outer glow (very soft, large) ---
    const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, s.glowSize);
    outerGlow.addColorStop(0, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.35})`);
    outerGlow.addColorStop(0.3, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.15})`);
    outerGlow.addColorStop(0.7, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.04})`);
    outerGlow.addColorStop(1, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, 0)`);
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(x, y, s.glowSize, 0, Math.PI * 2);
    ctx.fill();

    // --- Draw inner glow (brighter core) ---
    const innerGlow = ctx.createRadialGradient(x, y, 0, x, y, s.size * 2.5);
    innerGlow.addColorStop(0, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.9})`);
    innerGlow.addColorStop(0.4, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.4})`);
    innerGlow.addColorStop(1, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, 0)`);
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(x, y, s.size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // --- Draw bright core ---
    const coreGlow = ctx.createRadialGradient(x, y, 0, x, y, s.size);
    coreGlow.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, alpha * 1.2)})`);
    coreGlow.addColorStop(0.5, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.7})`);
    coreGlow.addColorStop(1, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, 0)`);
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(x, y, s.size, 0, Math.PI * 2);
    ctx.fill();

    // --- Draw tendrils (delicate filaments radiating outward) ---
    ctx.strokeStyle = `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.35})`;
    ctx.lineWidth = 0.8 * s.depth;
    for (let i = 0; i < s.tendrilCount; i++) {
      const angle = (i / s.tendrilCount) * Math.PI * 2 + s.tendrilPhase + t * 0.1;
      const len = s.tendrilLength * (0.6 + 0.4 * Math.sin(t * 0.4 + i * 1.5 + s.wobblePhase));

      // Curved tendril using quadratic bezier
      const endX = x + Math.cos(angle) * len;
      const endY = y + Math.sin(angle) * len;
      const cpX = x + Math.cos(angle + 0.3 * Math.sin(t * 0.3 + i)) * len * 0.6;
      const cpY = y + Math.sin(angle + 0.3 * Math.cos(t * 0.25 + i)) * len * 0.6;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      ctx.stroke();

      // Tiny glow at tendril tip
      const tipGlow = ctx.createRadialGradient(endX, endY, 0, endX, endY, 4 * s.depth);
      tipGlow.addColorStop(0, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, ${alpha * 0.5})`);
      tipGlow.addColorStop(1, `rgba(${s.color.r}, ${s.color.g}, ${s.color.b}, 0)`);
      ctx.fillStyle = tipGlow;
      ctx.beginPath();
      ctx.arc(endX, endY, 4 * s.depth, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function update() {
    time += 0.008;

    for (const s of sprites) {
      // Drift
      s.x += s.vx;
      s.y += s.vy;

      // Wrap around edges with padding
      const pad = s.glowSize * 2;
      if (s.y < -pad) { s.y = h + pad; s.x = Math.random() * w; }
      if (s.y > h + pad) { s.y = -pad; s.x = Math.random() * w; }
      if (s.x < -pad) { s.x = w + pad; }
      if (s.x > w + pad) { s.x = -pad; }
    }
  }

  function draw() {
    // Clear to transparent black
    ctx.clearRect(0, 0, w, h);

    // Sort by depth for layering (far sprites first)
    const sorted = [...sprites].sort((a, b) => a.depth - b.depth);

    for (const s of sorted) {
      drawSprite(s, time);
    }

    update();
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();
})();
