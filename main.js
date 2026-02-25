/* ============================================================
   Meta Spatial Production - Vanilla JS
   Handles: navigation, gradient canvas, scroll fade-in
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // --- Mobile hamburger toggle ---
  const hamburger = document.querySelector('.pill-nav-hamburger');
  const mobileMenu = document.querySelector('.pill-nav-mobile');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });

    // Close mobile menu when a link is clicked
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
      });
    });
  }

  // --- Intersection Observer for fade-in animations ---
  const fadeElements = document.querySelectorAll('.fade-in');
  if (fadeElements.length > 0) {
    // First, immediately show elements already in viewport
    fadeElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        // Small stagger based on delay class
        const delay = el.classList.contains('delay-1') ? 100 :
                      el.classList.contains('delay-2') ? 200 :
                      el.classList.contains('delay-3') ? 300 :
                      el.classList.contains('delay-4') ? 400 :
                      el.classList.contains('delay-5') ? 500 : 0;
        setTimeout(() => el.classList.add('visible'), delay);
      }
    });

    // Then observe elements below the fold
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    fadeElements.forEach(el => {
      if (!el.classList.contains('visible')) {
        observer.observe(el);
      }
    });
  }

  // --- Dynamic gradient canvas (hero page only) ---
  const canvas = document.getElementById('hero-gradient');
  if (canvas) {
    initGradient(canvas);
  }
});

/**
 * Lava lamp metaball background for the hero section
 * Renders at low resolution then scales up with CSS blur for
 * a massive out-of-focus lava lamp behind frosted glass effect.
 * True metaball field: blobs merge organically when close.
 * Sunset palette from Typical Evening Pictures.
 */
function initGradient(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Render at very low res for performance + natural softness
  const SCALE = 6; // 1/6th resolution
  let rw, rh; // render dimensions
  let time = 0;

  // Blob definitions -- smaller, more numerous, faster
  const blobs = [
    { baseX: 0.15, baseY: 0.3,  xA: 0.15, yA: 0.25, xF: 0.45, yF: 0.30, xP: 0,   yP: 0,   r: 100, color: [120, 45, 170] },
    { baseX: 0.8,  baseY: 0.25, xA: 0.12, yA: 0.28, xF: 0.35, yF: 0.25, xP: 1.8, yP: 0.7, r: 90,  color: [210, 55, 85] },
    { baseX: 0.5,  baseY: 0.6,  xA: 0.18, yA: 0.22, xF: 0.28, yF: 0.38, xP: 3.2, yP: 2.1, r: 110, color: [245, 135, 35] },
    { baseX: 0.3,  baseY: 0.75, xA: 0.14, yA: 0.2,  xF: 0.4,  yF: 0.22, xP: 4.8, yP: 3.3, r: 85,  color: [225, 180, 45] },
    { baseX: 0.7,  baseY: 0.55, xA: 0.2,  yA: 0.25, xF: 0.5,  yF: 0.32, xP: 5.5, yP: 1.2, r: 95,  color: [235, 65, 115] },
    { baseX: 0.45, baseY: 0.35, xA: 0.16, yA: 0.18, xF: 0.2,  yF: 0.15, xP: 2.5, yP: 4.0, r: 130, color: [160, 40, 90] },
    { baseX: 0.9,  baseY: 0.7,  xA: 0.1,  yA: 0.22, xF: 0.38, yF: 0.28, xP: 0.5, yP: 5.5, r: 80,  color: [140, 80, 200] },
    { baseX: 0.1,  baseY: 0.6,  xA: 0.18, yA: 0.3,  xF: 0.42, yF: 0.35, xP: 3.8, yP: 1.5, r: 75,  color: [200, 100, 50] },
    { baseX: 0.6,  baseY: 0.15, xA: 0.2,  yA: 0.2,  xF: 0.33, yF: 0.4,  xP: 2.0, yP: 3.0, r: 90,  color: [180, 50, 120] },
    { baseX: 0.35, baseY: 0.5,  xA: 0.15, yA: 0.25, xF: 0.48, yF: 0.3,  xP: 6.0, yP: 0.3, r: 85,  color: [230, 150, 30] },
    { baseX: 0.85, baseY: 0.4,  xA: 0.12, yA: 0.2,  xF: 0.36, yF: 0.42, xP: 1.2, yP: 4.5, r: 70,  color: [150, 60, 160] },
    { baseX: 0.2,  baseY: 0.85, xA: 0.16, yA: 0.15, xF: 0.44, yF: 0.26, xP: 4.2, yP: 2.8, r: 95,  color: [220, 70, 70] },
  ];

  function resize() {
    rw = Math.ceil(canvas.offsetWidth / SCALE);
    rh = Math.ceil(canvas.offsetHeight / SCALE);
    canvas.width = rw;
    canvas.height = rh;
    // CSS handles the upscale + blur
    canvas.style.imageRendering = 'auto';
  }

  function draw() {
    const dispW = canvas.offsetWidth;
    const dispH = canvas.offsetHeight;
    time += 0.008;

    const imgData = ctx.createImageData(rw, rh);
    const data = imgData.data;

    // Compute blob positions at current time
    const blobState = blobs.map(b => {
      const x = dispW * (b.baseX
        + b.xA * Math.sin(time * b.xF + b.xP)
        + b.xA * 0.4 * Math.sin(time * b.xF * 2.1 + b.xP + 1.3)
      ) / SCALE;
      const y = dispH * (b.baseY
        + b.yA * Math.sin(time * b.yF + b.yP)
        + b.yA * 0.3 * Math.cos(time * b.yF * 1.6 + b.yP + 2.7)
      ) / SCALE;
      // Pulsing radius
      const r = (b.r + b.r * 0.25 * Math.sin(time * 0.15 + b.xP)) / SCALE;
      return { x, y, r, color: b.color };
    });

    // Per-pixel metaball field computation
    for (let py = 0; py < rh; py++) {
      for (let px = 0; px < rw; px++) {
        let totalField = 0;
        let cr = 0, cg = 0, cb = 0;

        for (const bl of blobState) {
          const dx = px - bl.x;
          const dy = py - bl.y;
          const distSq = dx * dx + dy * dy;
          const rSq = bl.r * bl.r;
          // Metaball field: r^2 / dist^2
          const field = rSq / (distSq + 1);
          totalField += field;
          // Weight color by field strength
          cr += bl.color[0] * field;
          cg += bl.color[1] * field;
          cb += bl.color[2] * field;
        }

        const idx = (py * rw + px) * 4;

        // Normalize colors by total field
        if (totalField > 0.001) {
          cr /= totalField;
          cg /= totalField;
          cb /= totalField;
        }

        // Higher threshold = more black background showing
        const threshold = 0.8;
        const intensity = Math.min(1, Math.max(0, (totalField - threshold) / 1.0));
        // Cubic ease for smoother falloff
        const smooth = intensity * intensity * (3 - 2 * intensity);

        // Blend blob color with black background
        data[idx]     = Math.min(255, cr * smooth * 0.9) | 0;
        data[idx + 1] = Math.min(255, cg * smooth * 0.9) | 0;
        data[idx + 2] = Math.min(255, cb * smooth * 0.9) | 0;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();
}
