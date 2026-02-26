/* ============================================================
   liquid-glass.js
   Vanilla JS port of vue-web-liquid-glass repo.
   
   Components ported:
   - Filter.vue -> buildSvgFilter()
   - LiquidGlassBottomNavBar.vue -> LiquidGlassNavBar class
   - displacementMap.ts -> calculateDisplacementMap / 2D
   - specular.ts -> calculateSpecular
   - surfaceEquations.ts -> CONVEX_SQUIRCLE
   
   Source: https://github.com/mkj0kjay/vue-web-liquid-glass
   ============================================================ */

(function() {
  'use strict';

  // ============================================================
  // SURFACE EQUATIONS (from surfaceEquations.ts)
  // ============================================================
  var CONVEX_SQUIRCLE = function(x) {
    return Math.pow(1 - Math.pow(1 - x, 4), 1/4);
  };

  // ============================================================
  // 1D DISPLACEMENT MAP (from displacementMap.ts)
  // ============================================================
  function calculateDisplacementMap(glassThickness, bezelWidth, surfaceFn, refractiveIndex, samples) {
    glassThickness = glassThickness || 120;
    bezelWidth = bezelWidth || 40;
    surfaceFn = surfaceFn || CONVEX_SQUIRCLE;
    refractiveIndex = refractiveIndex || 1.5;
    samples = samples || 128;

    var eta = 1 / refractiveIndex;

    function refract(normalX, normalY) {
      var dot = normalY;
      var k = 1 - eta * eta * (1 - dot * dot);
      if (k < 0) return null;
      var kSqrt = Math.sqrt(k);
      return [
        -(eta * dot + kSqrt) * normalX,
        eta - (eta * dot + kSqrt) * normalY
      ];
    }

    var result = [];
    for (var i = 0; i < samples; i++) {
      var x = i / samples;
      var y = surfaceFn(x);
      var dx = x < 1 ? 0.0001 : -0.0001;
      var y2 = surfaceFn(x + dx);
      var derivative = (y2 - y) / dx;
      var magnitude = Math.sqrt(derivative * derivative + 1);
      var normal = [-derivative / magnitude, -1 / magnitude];
      var refracted = refract(normal[0], normal[1]);

      if (!refracted) {
        result.push(0);
      } else {
        var remainingHeightOnBezel = y * bezelWidth;
        var remainingHeight = remainingHeightOnBezel + glassThickness;
        result.push(refracted[0] * (remainingHeight / refracted[1]));
      }
    }
    return result;
  }

  // ============================================================
  // 2D DISPLACEMENT MAP (from displacementMap.ts)
  // ============================================================
  function calculateDisplacementMap2D(w, h, bezelWidth, maxDisp, precomputed, shape, cornerRadius) {
    var bw = Math.floor(w);
    var bh = Math.floor(h);
    var imageData = new ImageData(bw, bh);
    var neutral = 0xff008080;
    new Uint32Array(imageData.data.buffer).fill(neutral);

    var bezel = bezelWidth;
    var maxR = Math.min(bw, bh) / 2;
    var radius = (shape === 'pill') ? maxR : (cornerRadius || 0.5) * maxR;

    for (var y1 = 0; y1 < bh; y1++) {
      for (var x1 = 0; x1 < bw; x1++) {
        var idx = (y1 * bw + x1) * 4;
        var isLeft = x1 < radius;
        var isRight = x1 >= bw - radius;
        var isTop = y1 < radius;
        var isBottom = y1 >= bh - radius;

        var distToEdge = Infinity;
        var nx = 0, ny = 0;
        var inBezel = false;

        if ((isLeft || isRight) && (isTop || isBottom)) {
          var cx = isLeft ? x1 - radius : x1 - (bw - radius);
          var cy = isTop ? y1 - radius : y1 - (bh - radius);
          var dist = Math.sqrt(cx * cx + cy * cy);
          distToEdge = radius - dist;
          if (distToEdge >= -1 && distToEdge <= bezel) {
            inBezel = true;
            var mag = dist || 1;
            nx = cx / mag;
            ny = cy / mag;
          }
        } else if (isLeft || isRight) {
          distToEdge = isLeft ? x1 : (bw - 1 - x1);
          if (distToEdge <= bezel) {
            inBezel = true;
            nx = isLeft ? -1 : 1;
            ny = 0;
          }
        } else if (isTop || isBottom) {
          distToEdge = isTop ? y1 : (bh - 1 - y1);
          if (distToEdge <= bezel) {
            inBezel = true;
            nx = 0;
            ny = isTop ? -1 : 1;
          }
        }

        if (inBezel && distToEdge >= 0) {
          var bezelIdx = Math.min(
            precomputed.length - 1,
            Math.max(0, ((distToEdge / bezel) * precomputed.length) | 0)
          );
          var distance = precomputed[bezelIdx] || 0;
          var dX = (-nx * distance) / maxDisp;
          var dY = (-ny * distance) / maxDisp;

          imageData.data[idx]     = 128 + dX * 127;
          imageData.data[idx + 1] = 128 + dY * 127;
          imageData.data[idx + 2] = 0;
          imageData.data[idx + 3] = 255;
        }
      }
    }
    return imageData;
  }

  // ============================================================
  // SPECULAR MAP (from specular.ts)
  // ============================================================
  function calculateSpecular(w, h, radius, bezelWidth, specularAngle) {
    specularAngle = specularAngle || Math.PI / 3;
    var bw = w;
    var bh = h;
    var imageData = new ImageData(bw, bh);
    new Uint32Array(imageData.data.buffer).fill(0x00000000);

    var specVec = [Math.cos(specularAngle), Math.sin(specularAngle)];
    var rSq = radius * radius;
    var rPlusSq = (radius + 1) * (radius + 1);
    var rMinusBSq = Math.max(0, (radius - bezelWidth) * (radius - bezelWidth));
    var widthBetween = bw - radius * 2;
    var heightBetween = bh - radius * 2;

    for (var y1 = 0; y1 < bh; y1++) {
      for (var x1 = 0; x1 < bw; x1++) {
        var idx = (y1 * bw + x1) * 4;
        var isLeft = x1 < radius;
        var isRight = x1 >= bw - radius;
        var isTop = y1 < radius;
        var isBottom = y1 >= bh - radius;

        var x = isLeft ? x1 - radius : isRight ? x1 - radius - widthBetween : 0;
        var y = isTop ? y1 - radius : isBottom ? y1 - radius - heightBetween : 0;
        var dSq = x * x + y * y;

        if (dSq <= rPlusSq && dSq >= rMinusBSq) {
          var distVal = Math.sqrt(dSq);
          var distFromSide = radius - distVal;
          var opacity = dSq < rSq ? 1 : 1 - (distVal - Math.sqrt(rSq)) / (Math.sqrt(rPlusSq) - Math.sqrt(rSq));
          var cos = distVal > 0 ? x / distVal : 0;
          var sin = distVal > 0 ? -y / distVal : 0;
          var dot = Math.abs(cos * specVec[0] + sin * specVec[1]);
          var t = 1 - distFromSide / 1;
          var coeff = dot * Math.sqrt(Math.max(0, 1 - t * t));
          var color = 255 * coeff;
          var finalOpacity = color * coeff * opacity;

          imageData.data[idx]     = color;
          imageData.data[idx + 1] = color;
          imageData.data[idx + 2] = color;
          imageData.data[idx + 3] = finalOpacity;
        }
      }
    }
    return imageData;
  }

  // ============================================================
  // UTILITY: ImageData -> data URL
  // ============================================================
  function toDataUrl(imageData) {
    var c = document.createElement('canvas');
    c.width = imageData.width;
    c.height = imageData.height;
    var ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.putImageData(imageData, 0, 0);
    return c.toDataURL('image/png');
  }

  // ============================================================
  // SVG FILTER BUILDER (from Filter.vue)
  // ============================================================
  function buildSvgFilter(id, w, h, opts) {
    opts = opts || {};
    var glassThickness = opts.glassThickness || 120;
    var bezelWidth = opts.bezelWidth || 30;
    var refractiveIndex = opts.refractiveIndex || 1.5;
    var blur = opts.blur !== undefined ? opts.blur : 0.3;
    var scaleRatio = opts.scaleRatio !== undefined ? opts.scaleRatio : 1;
    var specularOpacity = opts.specularOpacity !== undefined ? opts.specularOpacity : 0.4;
    var specularSaturation = opts.specularSaturation !== undefined ? opts.specularSaturation : 4;
    var shape = opts.shape || 'pill';
    var cornerRadius = opts.cornerRadius !== undefined ? opts.cornerRadius : 0.5;

    var radius = Math.min(w, h) / 2;

    // Compute 1D displacement
    var precomputed = calculateDisplacementMap(glassThickness, bezelWidth, CONVEX_SQUIRCLE, refractiveIndex);
    var maxDisp = 1;
    for (var i = 0; i < precomputed.length; i++) {
      var abs = Math.abs(precomputed[i]);
      if (abs > maxDisp) maxDisp = abs;
    }

    // Compute 2D maps
    var dispMap = calculateDisplacementMap2D(w, h, bezelWidth, 100, precomputed, shape, cornerRadius);
    var dispUrl = toDataUrl(dispMap);
    var specMap = calculateSpecular(w, h, radius, bezelWidth);
    var specUrl = toDataUrl(specMap);
    var scale = maxDisp * scaleRatio;

    // Build SVG element
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('style', 'display:none;position:absolute;width:0;height:0');
    svg.setAttribute('color-interpolation-filters', 'sRGB');
    svg.setAttribute('data-liquid-glass', 'true');

    var defs = document.createElementNS(svgNS, 'defs');
    var filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', id);

    function addEl(tag, attrs) {
      var el = document.createElementNS(svgNS, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      filter.appendChild(el);
      return el;
    }

    addEl('feGaussianBlur', { 'in': 'SourceGraphic', stdDeviation: blur, result: 'blurred' });
    addEl('feImage', { href: dispUrl, x: '0', y: '0', width: w, height: h, result: 'disp_map' });
    addEl('feDisplacementMap', { 'in': 'blurred', in2: 'disp_map', scale: scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'displaced' });
    addEl('feColorMatrix', { 'in': 'displaced', type: 'saturate', values: specularSaturation, result: 'displaced_sat' });
    addEl('feImage', { href: specUrl, x: '0', y: '0', width: w, height: h, result: 'spec_layer' });
    addEl('feComposite', { 'in': 'displaced_sat', in2: 'spec_layer', operator: 'in', result: 'spec_sat' });

    var feTransfer = document.createElementNS(svgNS, 'feComponentTransfer');
    feTransfer.setAttribute('in', 'spec_layer');
    feTransfer.setAttribute('result', 'spec_faded');
    var feFuncA = document.createElementNS(svgNS, 'feFuncA');
    feFuncA.setAttribute('type', 'linear');
    feFuncA.setAttribute('slope', String(specularOpacity));
    feTransfer.appendChild(feFuncA);
    filter.appendChild(feTransfer);

    addEl('feBlend', { 'in': 'spec_sat', in2: 'displaced', mode: 'normal', result: 'withSat' });
    addEl('feBlend', { 'in': 'spec_faded', in2: 'withSat', mode: 'normal' });

    defs.appendChild(filter);
    svg.appendChild(defs);
    return svg;
  }

  // ============================================================
  // LIQUID GLASS BOTTOM NAV BAR
  // Direct port of LiquidGlassBottomNavBar.vue
  // ============================================================

  function LiquidGlassNavBar(container) {
    var self = this;

    // Read items from DOM: <a data-nav-id="..." data-nav-icon="svg string">Label</a>
    var itemEls = container.querySelectorAll('[data-nav-id]');
    self.items = [];
    itemEls.forEach(function(el) {
      self.items.push({
        id: el.getAttribute('data-nav-id'),
        label: el.textContent.trim(),
        icon: el.getAttribute('data-nav-icon') || '',
        href: el.getAttribute('href') || '#'
      });
    });

    if (self.items.length === 0) return;

    // Determine active item from data-nav-active on container, or first item
    var activeId = container.getAttribute('data-nav-active') || self.items[0].id;

    // Size preset (medium)
    var preset = {
      height: 54,
      itemWidth: 80,
      thumbHeight: 50,
      bezelWidth: 8,
      bazelWidthBg: 30,
      glassThickness: 110,
      fontSize: '0.57rem',
      iconSize: 20,
      thumbScale: 1.3,
      thumbScaleY: 1.1
    };

    var sliderHeight = preset.height;
    var itemWidth = preset.itemWidth;
    var sliderWidth = itemWidth * self.items.length;
    var thumbWidth = itemWidth - 4;
    var thumbHeight = preset.thumbHeight;
    var thumbRadius = thumbHeight / 2;

    // Filter IDs
    var bgFilterId = 'lg-nav-bg-' + Math.random().toString(36).substr(2, 6);
    var thumbFilterId = 'lg-nav-thumb-' + Math.random().toString(36).substr(2, 6);

    // Build SVG filters
    var bgSvg = buildSvgFilter(bgFilterId, sliderWidth, sliderHeight, {
      glassThickness: 190,
      bezelWidth: preset.bazelWidthBg,
      refractiveIndex: 1.3,
      blur: 2,
      scaleRatio: 0.4,
      specularOpacity: 1,
      specularSaturation: 19,
      shape: 'pill'
    });
    document.body.appendChild(bgSvg);

    var thumbSvg = buildSvgFilter(thumbFilterId, thumbWidth, thumbHeight, {
      glassThickness: preset.glassThickness,
      bezelWidth: preset.bezelWidth,
      refractiveIndex: 1.5,
      blur: 0,
      scaleRatio: 0.1,
      specularOpacity: 0.4,
      specularSaturation: 10,
      shape: 'pill'
    });
    document.body.appendChild(thumbSvg);

    // Clear container and rebuild
    container.innerHTML = '';
    container.style.display = 'inline-block';
    container.style.userSelect = 'none';
    container.style.touchAction = 'none';

    // Outer wrapper
    var outer = document.createElement('div');
    outer.style.cssText = 'position:relative;width:' + sliderWidth + 'px;height:' + sliderHeight + 'px;border-radius:' + (sliderHeight / 2) + 'px;';

    // Glass background
    var glassBg = document.createElement('div');
    glassBg.style.cssText = 'position:absolute;inset:0;border-radius:' + (sliderHeight / 2) + 'px;backdrop-filter:url(#' + bgFilterId + ');-webkit-backdrop-filter:url(#' + bgFilterId + ');background:rgba(255,255,255,0.04);box-shadow:0 4px 20px rgba(0,0,0,0.24);';
    outer.appendChild(glassBg);

    // Sliding glass thumb
    var thumb = document.createElement('div');
    thumb.style.cssText = 'position:absolute;cursor:pointer;z-index:40;height:' + thumbHeight + 'px;width:' + thumbWidth + 'px;top:' + (sliderHeight / 2) + 'px;left:0;transform-origin:center center;';

    var thumbBody = document.createElement('div');
    thumbBody.style.cssText = 'position:absolute;inset:0;border-radius:' + thumbRadius + 'px;backdrop-filter:url(#' + thumbFilterId + ');-webkit-backdrop-filter:url(#' + thumbFilterId + ');background:rgba(255,255,255,0.08);transition:background-color 0.1s ease,box-shadow 0.1s ease;';
    thumb.appendChild(thumbBody);
    outer.appendChild(thumb);

    // Interaction layer -- handles both click and drag on the whole bar
    var interactionLayer = document.createElement('div');
    interactionLayer.style.cssText = 'position:absolute;inset:0;z-index:45;cursor:grab;';

    // Items layer (icons + labels)
    var itemsLayer = document.createElement('div');
    itemsLayer.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;pointer-events:none;z-index:50;';

    var itemDivs = [];
    self.items.forEach(function(item) {
      var itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;width:' + itemWidth + 'px;height:100%;transition:all 0.1s;';

      // Icon
      if (item.icon) {
        var iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'width:' + preset.iconSize + 'px;height:' + preset.iconSize + 'px;margin-bottom:4px;transition:color 0.15s;';
        iconWrap.innerHTML = item.icon;
        itemDiv.appendChild(iconWrap);
      }

      // Label
      var label = document.createElement('span');
      label.style.cssText = 'font-weight:500;font-size:' + preset.fontSize + ';line-height:1;text-align:center;white-space:nowrap;transition:color 0.15s;';
      label.textContent = item.label;
      itemDiv.appendChild(label);

      itemDivs.push({ el: itemDiv, iconWrap: iconWrap || null, label: label, id: item.id });
      itemsLayer.appendChild(itemDiv);
    });
    outer.appendChild(itemsLayer);
    outer.appendChild(interactionLayer);

    container.appendChild(outer);

    // ---- State ----
    var selectedIndex = self.items.findIndex(function(it) { return it.id === activeId; });
    if (selectedIndex < 0) selectedIndex = 0;

    var currentThumbX = 0;
    var wobbleScaleX = 1;
    var wobbleScaleY = 1;
    var pointerDown = false;
    var initialPointerX = 0;
    var initialThumbX = 0;
    var isAnimating = false;
    var glassVisible = false;
    var hideGlassTimeout = null;
    var animFrame = null;

    var THUMB_REST_SCALE = 1;
    var THUMB_ACTIVE_SCALE = preset.thumbScale;
    var THUMB_ACTIVE_SCALE_Y = preset.thumbScaleY;

    function getTargetX(index) {
      var centerOffset = (itemWidth - thumbWidth) / 2;
      return index * itemWidth + centerOffset;
    }

    // Initialize thumb position
    currentThumbX = getTargetX(selectedIndex);
    updateThumbTransform();
    updateItemStyles();

    function lerp(a, b, t) {
      return a * (1 - t) + b * t;
    }

    function updatePhysics() {
      if (pointerDown) {
        wobbleScaleX = lerp(wobbleScaleX, 1, 0.2);
        wobbleScaleY = lerp(wobbleScaleY, 1, 0.2);
        updateThumbTransform();
        animFrame = requestAnimationFrame(updatePhysics);
        return;
      }

      var dest = getTargetX(selectedIndex);
      var diff = dest - currentThumbX;
      var newVelocity = diff * 0.5;

      currentThumbX += newVelocity;

      // Wobble (squash & stretch)
      var speed = Math.abs(newVelocity);
      var stretchFactor = 1 + Math.min(speed * 0.02, 0.5);
      var squashFactor = 1 / stretchFactor;

      wobbleScaleX = lerp(wobbleScaleX, stretchFactor, 0.2);
      wobbleScaleY = lerp(wobbleScaleY, squashFactor, 0.2);

      var isSettled = Math.abs(diff) < 0.1 && Math.abs(wobbleScaleX - 1) < 0.01;

      updateThumbTransform();

      if (isSettled) {
        currentThumbX = dest;
        wobbleScaleX = 1;
        wobbleScaleY = 1;
        isAnimating = false;
        updateThumbTransform();
        return;
      }

      animFrame = requestAnimationFrame(updatePhysics);
    }

    function updateThumbTransform() {
      var isActive = glassVisible || pointerDown;
      var baseScaleX = THUMB_REST_SCALE + (THUMB_ACTIVE_SCALE - THUMB_REST_SCALE) * (isActive ? 1 : 0);
      var baseScaleY = THUMB_REST_SCALE + (THUMB_ACTIVE_SCALE_Y - THUMB_REST_SCALE) * (isActive ? 1 : 0);
      var sx = baseScaleX * wobbleScaleX;
      var sy = baseScaleY * wobbleScaleY;

      thumb.style.transform = 'translateX(' + currentThumbX + 'px) translateY(-50%) scaleX(' + sx + ') scaleY(' + sy + ')';

      // When active, items go behind thumb (z-20) so displacement filter distorts them
      itemsLayer.style.zIndex = isActive ? '20' : '50';

      // Thumb body background
      if (isActive) {
        thumbBody.style.background = 'rgba(255,255,255,0.02)';
      } else {
        thumbBody.style.background = 'rgba(255,255,255,0.08)';
      }
    }

    function updateItemStyles() {
      itemDivs.forEach(function(d) {
        var isSelected = d.id === self.items[selectedIndex].id;
        d.el.style.opacity = isSelected ? '1' : '0.6';
        d.el.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)';
        // Meta blue for spatial, default blue for others
        var activeColor = (d.id === 'spatial') ? '#0082fb' : '#0082fb';
        var color = isSelected ? activeColor : 'rgba(255,255,255,0.9)';
        if (d.iconWrap) d.iconWrap.style.color = color;
        d.label.style.color = color;
      });
    }

    var DRAG_THRESHOLD = 5; // px -- beyond this it's a drag, not a click
    var hasDragged = false;

    function animateToItem(idx) {
      selectedIndex = idx;
      updateItemStyles();

      if (hideGlassTimeout) clearTimeout(hideGlassTimeout);
      glassVisible = true;
      hideGlassTimeout = setTimeout(function() {
        glassVisible = false;
        updateThumbTransform();
      }, 280);

      isAnimating = true;
      if (animFrame) cancelAnimationFrame(animFrame);
      updatePhysics();
    }

    // ---- Unified pointer handling on the entire interaction layer ----
    function onPointerDown(e) {
      e.preventDefault();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      pointerDown = true;
      hasDragged = false;
      initialPointerX = clientX;
      initialThumbX = currentThumbX;

      interactionLayer.style.cursor = 'grabbing';

      if (hideGlassTimeout) clearTimeout(hideGlassTimeout);
      glassVisible = true;
      updateThumbTransform();

      isAnimating = false;
      if (animFrame) cancelAnimationFrame(animFrame);

      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('touchmove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);
    }

    function onPointerMove(e) {
      if (!pointerDown) return;
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var delta = clientX - initialPointerX;

      if (Math.abs(delta) > DRAG_THRESHOLD) {
        hasDragged = true;
      }

      var newPos = initialThumbX + delta;

      var maxPos = sliderWidth - thumbWidth - (itemWidth - thumbWidth) / 2;
      var minPos = (itemWidth - thumbWidth) / 2;

      // Edge damping
      if (newPos < minPos) {
        newPos = minPos - (minPos - newPos) / 3;
      }
      if (newPos > maxPos) {
        newPos = maxPos + (newPos - maxPos) / 3;
      }

      // Drag wobble
      var velocity = newPos - currentThumbX;
      var speed = Math.abs(velocity);
      var stretchFactor = 1 + Math.min(speed * 0.05, 0.4);
      var squashFactor = 1 / stretchFactor;
      wobbleScaleX = lerp(wobbleScaleX, stretchFactor, 0.2);
      wobbleScaleY = lerp(wobbleScaleY, squashFactor, 0.2);

      currentThumbX = newPos;
      updateThumbTransform();
    }

    function onPointerUp(e) {
      pointerDown = false;
      interactionLayer.style.cursor = 'grab';

      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);

      if (hasDragged) {
        // DRAG: snap to nearest item
        var thumbCenter = currentThumbX + thumbWidth / 2;
        var idx = Math.round(thumbCenter / itemWidth);
        idx = Math.max(0, Math.min(idx, self.items.length - 1));

        var newItem = self.items[idx];
        if (idx !== selectedIndex) {
          selectedIndex = idx;
          updateItemStyles();
        }

        // Animate snap
        isAnimating = true;
        if (animFrame) cancelAnimationFrame(animFrame);
        updatePhysics();

        // Hide glass
        hideGlassTimeout = setTimeout(function() {
          glassVisible = false;
          updateThumbTransform();
        }, 280);

        // Navigate after snap
        if (newItem.href && newItem.href !== '#') {
          setTimeout(function() { window.location.href = newItem.href; }, 200);
        }
      } else {
        // CLICK: determine which item was clicked based on pointer position
        var clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        var rect = outer.getBoundingClientRect();
        var relX = clientX - rect.left;
        var idx = Math.floor(relX / itemWidth);
        idx = Math.max(0, Math.min(idx, self.items.length - 1));

        var clickedItem = self.items[idx];

        if (idx !== selectedIndex) {
          animateToItem(idx);
          // Navigate after brief animation
          if (clickedItem.href && clickedItem.href !== '#') {
            setTimeout(function() { window.location.href = clickedItem.href; }, 200);
          }
        }
      }
    }

    interactionLayer.addEventListener('mousedown', onPointerDown);
    interactionLayer.addEventListener('touchstart', onPointerDown, { passive: false });

    // Store reference for cleanup
    self._cleanup = function() {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (hideGlassTimeout) clearTimeout(hideGlassTimeout);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);
    };
  }

  // ============================================================
  // INIT: Find all [data-liquid-nav] elements and initialize
  // ============================================================
  function injectDesignTab() {
    // Only show Design tab on Manus dev server
    var host = window.location.hostname;
    if (host.indexOf('manus') === -1) return;
    var navs = document.querySelectorAll('[data-liquid-nav]');
    navs.forEach(function(nav) {
      var designLink = document.createElement('a');
      designLink.setAttribute('data-nav-id', 'design');
      designLink.setAttribute('data-nav-icon', '<svg viewBox="0 0 24 24" fill="none"><path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      designLink.setAttribute('href', 'design-system.html');
      designLink.textContent = 'Design';
      nav.appendChild(designLink);
    });
  }

  function init() {
    injectDesignTab();
    var navs = document.querySelectorAll('[data-liquid-nav]');
    navs.forEach(function(el) {
      try {
        new LiquidGlassNavBar(el);
      } catch(e) {
        console.warn('[liquid-glass] nav init error:', e);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    requestAnimationFrame(function() {
      requestAnimationFrame(init);
    });
  }

  // Expose for manual use
  window.LiquidGlassNavBar = LiquidGlassNavBar;
  window.buildSvgFilter = buildSvgFilter;
})();
