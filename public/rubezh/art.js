/* Рубеж — procedural 2D art: paint swatches, the single weapon side-view renderer,
   minimaps, and canvas textures for the 3D world. Everything is generated, nothing is loaded. */
(function () {
  'use strict';
  var RZ = window.RZ;
  var Art = (RZ.Art = {});

  /* ---------- helpers ---------- */
  function rng(seed) {
    var a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  Art.rng = rng;
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  Art.hash = hash;
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /* generation canvases are read back with getImageData */
  function ctx2d(cv) { return cv.getContext('2d', { willReadFrequently: true }); }
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function shade(hex, f) {
    var c = hexToRgb(hex), t = f < 0 ? [0, 0, 0] : [255, 255, 255], k = Math.abs(f);
    c = mix(c, t, k);
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }
  Art.shade = shade;

  /* tileable value noise with period p (in lattice cells) */
  function makeNoise(seed, p) {
    var r = rng(seed), g = new Float32Array(p * p);
    for (var i = 0; i < g.length; i++) g[i] = r();
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = g[y0 * p + x0], b = g[y0 * p + x1], c = g[y1 * p + x0], d = g[y1 * p + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  function fbm(noise, x, y, oct) {
    var s = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) { s += amp * noise(x * f, y * f); norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }
  /* grain: random per-pixel brightness jitter over whatever is drawn */
  function grain(ctx, w, h, amt, seed) {
    var img = ctx.getImageData(0, 0, w, h), d = img.data, r = rng(seed || 7);
    for (var i = 0; i < d.length; i += 4) {
      var n = (r() - 0.5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ================================================================== */
  /* Paint swatches: 512×512, tileable, represents 80×80 cm of surface   */
  /* ================================================================== */
  var SW = 512, SW_CM = 80;
  var swatchCache = {};
  Art.SWATCH_CM = SW_CM;

  /* draw fn at 9 offsets so shapes wrap and the swatch tiles seamlessly */
  function wrapDraw(fn) { for (var ox = -SW; ox <= SW; ox += SW) for (var oy = -SW; oy <= SW; oy += SW) fn(ox, oy); }

  function blob(ctx, cx, cy, r, r2, k) {
    ctx.beginPath();
    var n = 9;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2, rr = r * (0.7 + 0.6 * r2[i % n]);
      var x = cx + Math.cos(a) * rr * k, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else {
        var pa = ((i - 0.5) / n) * Math.PI * 2, pr = r * (0.85 + 0.5 * r2[(i + 3) % n]);
        ctx.quadraticCurveTo(cx + Math.cos(pa) * pr * k, cy + Math.sin(pa) * pr, x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawPattern(ctx, pat, seed) {
    var c = pat.c, s = pat.s || 1, r = rng(seed), i, j;
    var t = pat.t;
    ctx.fillStyle = c[0];
    ctx.fillRect(0, 0, SW, SW);
    if (t === 'plain') {
      var rr = rng(seed + 1);
      for (i = 0; i < 260; i++) {
        ctx.fillStyle = c[1] || shade(c[0], -0.1);
        ctx.globalAlpha = 0.25 + rr() * 0.3;
        var px = rr() * SW, py = rr() * SW, pr = 2 + rr() * 9;
        wrapDraw(function (ox, oy) { ctx.beginPath(); ctx.arc(px + ox, py + oy, pr, 0, 6.283); ctx.fill(); });
      }
      ctx.globalAlpha = 1;
    } else if (t === 'stripes') {
      var bw = 32 * s, cols = c.slice(1);
      ctx.save(); ctx.translate(SW / 2, SW / 2); ctx.rotate((pat.a || 0) * Math.PI / 180);
      for (i = -SW * 1.5, j = 0; i < SW * 1.5; i += bw * 2, j++) {
        ctx.fillStyle = cols[j % cols.length];
        ctx.fillRect(i, -SW * 1.5, bw, SW * 3);
      }
      ctx.restore();
    } else if (t === 'camo') {
      for (var layer = 1; layer < c.length; layer++) {
        ctx.fillStyle = c[layer];
        var count = Math.round((26 - layer * 4) / (s * s));
        for (i = 0; i < count; i++) {
          var bx = r() * SW, by = r() * SW, br = (28 + r() * 46) * s * (1 - layer * 0.12), r2 = [], k = 0.8 + r() * 1.1;
          for (j = 0; j < 9; j++) r2.push(r());
          wrapDraw(function (ox, oy) { blob(ctx, bx + ox, by + oy, br, r2, k); });
        }
      }
    } else if (t === 'chevron') {
      var cw = 42 * s;
      ctx.fillStyle = c[1];
      for (i = -SW; i < SW * 2; i += cw * 2) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + cw, 0); ctx.lineTo(i + cw + SW, SW); ctx.lineTo(i + SW, SW);
        ctx.closePath(); ctx.fill();
      }
      // chipped paint
      ctx.fillStyle = c[0];
      for (i = 0; i < 140; i++) { ctx.globalAlpha = 0.5; ctx.fillRect(r() * SW, r() * SW, 2 + r() * 7, 1 + r() * 4); }
      ctx.globalAlpha = 1;
    } else if (t === 'grid') {
      var gs = 40 * s;
      if (c[2]) {
        ctx.fillStyle = c[2];
        for (i = 0; i < SW; i += gs) for (j = 0; j < SW; j += gs) if (r() < 0.22) ctx.fillRect(i, j, gs, gs);
      }
      ctx.strokeStyle = c[1]; ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (i = 0; i <= SW; i += gs) { ctx.moveTo(i, 0); ctx.lineTo(i, SW); ctx.moveTo(0, i); ctx.lineTo(SW, i); }
      ctx.stroke();
      ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6; ctx.beginPath();
      for (i = gs / 2; i <= SW; i += gs) { ctx.moveTo(i, 0); ctx.lineTo(i, SW); ctx.moveTo(0, i); ctx.lineTo(SW, i); }
      ctx.stroke(); ctx.globalAlpha = 1;
    } else if (t === 'splatter') {
      for (var L = 1; L < c.length; L++) {
        ctx.fillStyle = c[L];
        var n = Math.round(60 / s);
        for (i = 0; i < n; i++) {
          var sx = r() * SW, sy = r() * SW, sr = (4 + Math.pow(r(), 3) * 30) * s;
          var drops = [];
          for (j = 0; j < 6; j++) drops.push([(r() - 0.5) * sr * 5, (r() - 0.5) * sr * 5, sr * (0.1 + r() * 0.3)]);
          wrapDraw(function (ox, oy) {
            ctx.beginPath(); ctx.arc(sx + ox, sy + oy, sr, 0, 6.283); ctx.fill();
            for (var q = 0; q < drops.length; q++) { ctx.beginPath(); ctx.arc(sx + ox + drops[q][0], sy + oy + drops[q][1], drops[q][2], 0, 6.283); ctx.fill(); }
          });
        }
      }
    } else if (t === 'gradient') {
      var ang = (pat.a || 0) * Math.PI / 180, dx = Math.cos(ang) * SW / 2, dy = Math.sin(ang) * SW / 2;
      var g = ctx.createLinearGradient(SW / 2 - dx, SW / 2 - dy, SW / 2 + dx, SW / 2 + dy);
      for (i = 0; i < c.length; i++) g.addColorStop(i / (c.length - 1), c[i]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SW);
      // fine brushed lines
      ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff';
      for (i = 0; i < SW; i += 3) if (r() < 0.5) ctx.fillRect(0, i, SW, 1);
      ctx.globalAlpha = 1;
    } else if (t === 'hex') {
      var hr = 26 * s, hw = Math.sqrt(3) * hr, row = 0;
      for (var y = -hr; y < SW + hr * 2; y += hr * 1.5, row++) {
        for (var x = -hw; x < SW + hw * 2; x += hw) {
          var cx = x + (row % 2 ? hw / 2 : 0);
          ctx.beginPath();
          for (j = 0; j < 6; j++) {
            var a = Math.PI / 6 + j * Math.PI / 3;
            ctx.lineTo(cx + Math.cos(a) * (hr - 2), y + Math.sin(a) * (hr - 2));
          }
          ctx.closePath();
          ctx.fillStyle = r() < 0.18 && c[2] ? c[2] : c[0];
          ctx.fill();
          ctx.strokeStyle = c[1]; ctx.lineWidth = 3; ctx.stroke();
        }
      }
    } else if (t === 'digital') {
      var ps = 16 * s;
      var nz = makeNoise(seed, 8);
      for (i = 0; i < SW; i += ps) for (j = 0; j < SW; j += ps) {
        var v = fbm(nz, (i / SW) * 8, (j / SW) * 8, 2) + (r() - 0.5) * 0.25;
        var idx = Math.max(0, Math.min(c.length - 1, Math.floor(v * c.length)));
        ctx.fillStyle = c[idx]; ctx.fillRect(i, j, ps, ps);
      }
    } else if (t === 'topo' || t === 'marble') {
      var img = ctx.getImageData(0, 0, SW, SW), d = img.data;
      var nz2 = makeNoise(seed, 6), nz3 = makeNoise(seed + 9, 12);
      var c0 = hexToRgb(c[0]), c1 = hexToRgb(c[1]), c2 = hexToRgb(c[2] || c[1]);
      for (j = 0; j < SW; j++) for (i = 0; i < SW; i++) {
        var u = i / SW, w = j / SW, col;
        if (t === 'topo') {
          var hgt = fbm(nz2, u * 6 / s, w * 6 / s, 4) * 9;
          var f = hgt - Math.floor(hgt), line = f < 0.09 || f > 0.91;
          var major = Math.floor(hgt) % 3 === 0 && line;
          col = major ? c2 : line ? c1 : mix(c0, c1, 0.08 * (hgt / 9));
        } else {
          var m = fbm(nz2, u * 6 / s, w * 6 / s, 5), q = fbm(nz3, u * 12, w * 12, 3);
          var vein = Math.abs(Math.sin((u * 3 + m * 4.5) * Math.PI));
          col = mix(c0, c2, Math.pow(1 - vein, 9) * 0.9);
          col = mix(col, c1, Math.max(0, q - 0.55) * 1.4);
        }
        var k2 = (j * SW + i) * 4;
        d[k2] = col[0]; d[k2 + 1] = col[1]; d[k2 + 2] = col[2]; d[k2 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    } else if (t === 'rings') {
      var rs = 34 * s;
      for (var cxr = 0; cxr <= SW; cxr += SW / 2) for (var cyr = 0; cyr <= SW; cyr += SW / 2) {
        for (i = 6; i >= 0; i--) {
          ctx.beginPath(); ctx.arc(cxr, cyr, (i + 1) * rs * 0.55, 0, 6.283);
          ctx.fillStyle = i < 2 ? c[1] : c[0]; ctx.fill();
          ctx.strokeStyle = i < 2 ? c[0] : c[1]; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(cxr, cyr, rs * 0.22, 0, 6.283); ctx.fillStyle = c[2]; ctx.fill();
      }
      ctx.fillStyle = c[1];
      for (i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(r() * SW, r() * SW, 3 + r() * 3, 0, 6.283); ctx.fill(); }
    }
    // wear: light speckle, slight grain
    grain(ctx, SW, SW, 14, seed + 3);
  }

  /* Swatch canvas for a paint id (or factory finish of a weapon) */
  Art.swatch = function (key) {
    if (swatchCache[key]) return swatchCache[key];
    var pat, seed = hash(key);
    if (key.indexOf('factory:') === 0) pat = RZ.FACTORY[key.slice(8)] || RZ.FACTORY.osa;
    else pat = (RZ.PAINT_BY_ID[key] || { pattern: RZ.FACTORY.osa }).pattern;
    var cv = canvas(SW, SW), ctx = ctx2d(cv);
    drawPattern(ctx, pat, seed);
    swatchCache[key] = cv;
    return cv;
  };
  Art.swatchKey = function (weaponId, paintId) { return paintId ? paintId : 'factory:' + weaponId; };

  /* ================================================================== */
  /* Weapon side-view renderer (one renderer for every weapon canvas)    */
  /* ================================================================== */
  var MAT_FILL = {
    dark: ['#2b2e30', '#17191a'],
    metal: ['#a6adb1', '#5b6266'],
    grip: ['#34322f', '#1e1d1b']
  };

  function shapeBounds(shape) {
    var b = [1e9, 1e9, -1e9, -1e9];
    shape.forEach(function (part) {
      var pts = partPoints(part);
      pts.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
    });
    return b;
  }
  function partPoints(part) {
    if (part.p) return part.p;
    var c = part.c; // [x0,x1,y,r]
    return [[c[0], c[2] - c[3]], [c[1], c[2] - c[3]], [c[1], c[2] + c[3]], [c[0], c[2] + c[3]]];
  }
  Art.partPoints = partPoints;
  Art.shapeBounds = shapeBounds;

  function tracePart(ctx, part) {
    ctx.beginPath();
    if (part.c) {
      var c = part.c, r = c[3];
      ctx.moveTo(c[0], c[2] - r); ctx.lineTo(c[1] - r * 0.25, c[2] - r);
      ctx.quadraticCurveTo(c[1], c[2] - r, c[1], c[2]);
      ctx.quadraticCurveTo(c[1], c[2] + r, c[1] - r * 0.25, c[2] + r);
      ctx.lineTo(c[0], c[2] + r); ctx.closePath();
    } else {
      var p = part.p;
      ctx.moveTo(p[0][0], p[0][1]);
      for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
    }
  }

  /* opts: {pad, shadow, flip, bg} — draws centered, muzzle to the right */
  Art.drawWeapon = function (cv, weaponId, paintId, opts) {
    opts = opts || {};
    var W = RZ.WEAPONS[RZ.paintModelWeapon ? RZ.paintModelWeapon(weaponId, paintId) : weaponId]; if (!W) return;
    var ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var b = shapeBounds(W.shape), pad = opts.pad == null ? 0.08 : opts.pad;
    var bw = b[2] - b[0], bh = b[3] - b[1];
    var k = Math.min((w * (1 - pad * 2)) / bw, (h * (1 - pad * 2)) / bh);
    var ox = w / 2 - (b[0] + bw / 2) * k, oy = h / 2 + (b[1] + bh / 2) * k;
    var sw = Art.swatch(Art.swatchKey(weaponId, paintId));
    var pattern = ctx.createPattern(sw, 'repeat');
    if (pattern && pattern.setTransform && window.DOMMatrix) {
      var ps = (SW_CM / SW); // cm per swatch px
      pattern.setTransform(new DOMMatrix([ps, 0, 0, -ps, 0, 0]));
    }
    ctx.setTransform(k, 0, 0, -k, ox, oy); // y up, cm units
    ctx.lineJoin = 'round';
    if (opts.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(23,20,15,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#000';
      W.shape.forEach(function (part) { tracePart(ctx, part); ctx.fill(); });
      ctx.restore();
    }
    var lw = Math.max(1.1 / k, 0.28);
    W.shape.forEach(function (part) {
      tracePart(ctx, part);
      var pts = partPoints(part), y0 = 1e9, y1 = -1e9;
      pts.forEach(function (p) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      if (part.m === 'paint') {
        ctx.fillStyle = pattern || '#555';
      } else {
        var mf = MAT_FILL[part.m] || MAT_FILL.dark, g = ctx.createLinearGradient(0, y1, 0, y0);
        g.addColorStop(0, mf[0]); g.addColorStop(1, mf[1]);
        ctx.fillStyle = g;
      }
      ctx.fill();
      // volume: highlight on top, shade underneath
      var gl = ctx.createLinearGradient(0, y1, 0, y0);
      gl.addColorStop(0, 'rgba(255,255,255,.26)'); gl.addColorStop(0.35, 'rgba(255,255,255,0)');
      gl.addColorStop(0.7, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,.32)');
      ctx.fillStyle = gl; ctx.fill();
      ctx.strokeStyle = 'rgba(12,11,9,.9)'; ctx.lineWidth = lw; ctx.stroke();
      if (part.m === 'grip') {
        ctx.save(); tracePart(ctx, part); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = lw * 0.8;
        for (var gy = y0; gy < y1; gy += 1.1) { ctx.beginPath(); ctx.moveTo(-60, gy); ctx.lineTo(80, gy + 0.6); ctx.stroke(); }
        ctx.restore();
      }
    });
    if (W.details) {
      ctx.strokeStyle = 'rgba(12,11,9,.55)'; ctx.lineWidth = lw * 0.9;
      W.details.forEach(function (d) { ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(d[2], d[3]); ctx.stroke(); });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  /* ================================================================== */
  /* Minimap (top-down from the real box list)                           */
  /* ================================================================== */
  var MM_COL = {
    kraft: '#b99b63', plywood: '#c7a56c', cblock: '#9a9a92', plaster: '#cfc3a8', cont_blue: '#4f6f8c', cont_red: '#9a4a32',
    cont_ochre: '#b9933f', crate: '#a98352', rack: '#c0682e', steel: '#b29a4c', trim: '#3b3e40', planks: '#8a7a62'
  };
  Art.drawMinimap = function (cv, map) {
    var ctx = cv.getContext('2d'), w = cv.width, h = cv.height, bd = map.bounds;
    var mw = bd[2] - bd[0] + 6, mh = bd[3] - bd[1] + 6;
    var k = Math.min(w / mw, h / mh);
    var ox = w / 2 - ((bd[0] + bd[2]) / 2) * k, oy = h / 2 - ((bd[1] + bd[3]) / 2) * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = map.water ? '#3e5967' : '#3d4a54'; ctx.fillRect(0, 0, w, h);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.fillStyle = map.floor === 'asphalt' ? '#80817c' : '#a3a29b';
    ctx.fillRect(bd[0], bd[1], bd[2] - bd[0], bd[3] - bd[1]);
    // grid
    ctx.strokeStyle = 'rgba(23,20,15,.12)'; ctx.lineWidth = 0.08;
    ctx.beginPath();
    for (var gx = Math.ceil(bd[0] / 4) * 4; gx <= bd[2]; gx += 4) { ctx.moveTo(gx, bd[1]); ctx.lineTo(gx, bd[3]); }
    for (var gz = Math.ceil(bd[1] / 4) * 4; gz <= bd[3]; gz += 4) { ctx.moveTo(bd[0], gz); ctx.lineTo(bd[2], gz); }
    ctx.stroke();
    // spawn zones
    map.spawns.forEach(function (s, i) {
      var z = s.zone;
      ctx.fillStyle = i === 0 ? 'rgba(80,150,220,.45)' : 'rgba(210,53,26,.45)';
      ctx.fillRect(z[0], z[1], z[2] - z[0], z[3] - z[1]);
    });
    // boxes, low to high
    var list = map.boxes.filter(function (b) { return b.vis && b.mat !== 'planks' || (b.mat === 'planks' && b.col); });
    list.sort(function (a, b) { return a.y1 - b.y1; });
    list.forEach(function (b) {
      var col = MM_COL[b.mat] || '#777';
      if (!b.col && b.y0 > 2) { ctx.fillStyle = 'rgba(23,20,15,.12)'; ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); return; }
      var lift = Math.min(1, b.y1 / 8);
      ctx.fillStyle = shade(col, b.y1 > 3 ? 0.08 * lift : -0.12 + 0.1 * lift);
      ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
      ctx.strokeStyle = 'rgba(23,20,15,.55)'; ctx.lineWidth = 0.12;
      ctx.strokeRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    });
    // pier deck
    map.boxes.forEach(function (b) {
      if (b.mat === 'planks' && !b.col) { ctx.fillStyle = 'rgba(120,100,70,.45)'; ctx.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); }
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  /* ================================================================== */
  /* World textures                                                     */
  /* ================================================================== */
  var texCache = {};
  /* tile: metres covered by one texture repeat; uv:'box' = 0..1 per face */
  Art.MATS = {
    concrete: { tile: 4 }, asphalt: { tile: 4 }, plywood: { tile: 2.44 }, kraft: { tile: 3 }, cblock: { tile: 2.4 },
    plaster: { tile: 6 }, cont_blue: { tile: 2.6 }, cont_red: { tile: 2.6 }, cont_ochre: { tile: 2.6 },
    crate: { uv: 'box' }, rack: { tile: 2.8 }, steel: { tile: 2 }, trim: { tile: 2 }, planks: { tile: 2.4 }
  };

  function stencilText(ctx, text, x, y, size, color) {
    ctx.save();
    ctx.font = '900 ' + size + 'px "Tektur", "Arial Narrow", Impact, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(text, x, y);
    // stencil bridges
    ctx.globalCompositeOperation = 'destination-out';
    var m = ctx.measureText(text), tw = m.width;
    ctx.fillRect(x - tw / 2 - 4, y - size * 0.04, tw + 8, size * 0.07);
    ctx.restore();
  }
  Art.stencilText = stencilText;

  function wood(ctx, x, y, w, h, base, r, vertical) {
    ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (var i = 0; i < 26; i++) {
      ctx.strokeStyle = 'rgba(80,50,20,' + (0.05 + r() * 0.12) + ')'; ctx.lineWidth = 1 + r() * 2;
      ctx.beginPath();
      if (vertical) { var px = x + r() * w; ctx.moveTo(px, y); ctx.bezierCurveTo(px + 6, y + h * 0.3, px - 6, y + h * 0.7, px + r() * 4, y + h); }
      else { var py = y + r() * h; ctx.moveTo(x, py); ctx.bezierCurveTo(x + w * 0.3, py + 5, x + w * 0.7, py - 5, x + w, py + r() * 3); }
      ctx.stroke();
    }
    ctx.restore();
  }

  var texDraw = {
    concrete: function (ctx, S, r) {
      ctx.fillStyle = '#9d9c95'; ctx.fillRect(0, 0, S, S);
      var nz = makeNoise(11, 8), img = ctx.getImageData(0, 0, S, S), d = img.data;
      for (var j = 0; j < S; j++) for (var i = 0; i < S; i++) {
        var v = fbm(nz, i / S * 8, j / S * 8, 4) - 0.5, k = (j * S + i) * 4;
        d[k] += v * 40; d[k + 1] += v * 40; d[k + 2] += v * 36;
      }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = 'rgba(40,38,34,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(S, 1); ctx.moveTo(1, 0); ctx.lineTo(1, S);
      ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke();
      for (var s = 0; s < 6; s++) { ctx.fillStyle = 'rgba(60,55,45,' + (0.04 + r() * 0.06) + ')'; ctx.beginPath(); ctx.arc(r() * S, r() * S, 10 + r() * 40, 0, 6.283); ctx.fill(); }
      grain(ctx, S, S, 18, 5);
    },
    asphalt: function (ctx, S, r) {
      ctx.fillStyle = '#74756f'; ctx.fillRect(0, 0, S, S);
      for (var i = 0; i < 3000; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(30,30,28,.25)' : 'rgba(200,198,190,.18)'; ctx.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
      ctx.strokeStyle = 'rgba(40,40,38,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, S * 0.3); ctx.bezierCurveTo(S * 0.3, S * 0.35, S * 0.6, S * 0.2, S, S * 0.3); ctx.stroke();
      grain(ctx, S, S, 22, 6);
    },
    plywood: function (ctx, S, r) {
      wood(ctx, 0, 0, S, S, '#c9a46a', r, false);
      ctx.strokeStyle = 'rgba(70,45,20,.55)'; ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
      ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
      ctx.fillStyle = 'rgba(50,35,20,.6)';
      for (var i = 12; i < S; i += 48) { ctx.fillRect(i, 8, 3, 3); ctx.fillRect(i, S / 2 + 6, 3, 3); ctx.fillRect(i, S - 10, 3, 3); }
      grain(ctx, S, S, 16, 8);
    },
    kraft: function (ctx, S, r) {
      ctx.fillStyle = '#b99b63'; ctx.fillRect(0, 0, S, S);
      for (var i = 0; i < 900; i++) { ctx.strokeStyle = 'rgba(90,65,30,' + r() * 0.12 + ')'; ctx.lineWidth = 1; var x = r() * S, y = r() * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 4); ctx.stroke(); }
      for (var y2 = 0; y2 < S; y2 += 8) { ctx.fillStyle = 'rgba(80,60,30,.05)'; ctx.fillRect(0, y2, S, 3); }
      ctx.fillStyle = 'rgba(70,50,25,.5)'; ctx.fillRect(0, 0, 4, S); ctx.fillRect(0, S - 6, S, 6);
      ctx.fillStyle = 'rgba(210,190,140,.55)'; ctx.fillRect(S * 0.62, 0, S * 0.09, S);
      stencilText(ctx, 'НЕ КАНТОВАТЬ', S * 0.3, S * 0.78, 22, 'rgba(23,20,15,.55)');
      grain(ctx, S, S, 16, 9);
    },
    cblock: function (ctx, S, r) {
      ctx.fillStyle = '#a3a29a'; ctx.fillRect(0, 0, S, S);
      var bh = S / 12, bw = S / 6;
      for (var row = 0; row < 12; row++) for (var c = -1; c < 7; c++) {
        var x = c * bw + (row % 2 ? bw / 2 : 0), v = (r() - 0.5) * 18;
        ctx.fillStyle = 'rgb(' + (163 + v | 0) + ',' + (162 + v | 0) + ',' + (154 + v | 0) + ')';
        ctx.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      }
      grain(ctx, S, S, 20, 10);
    },
    plaster: function (ctx, S, r) {
      ctx.fillStyle = '#d6cbb2'; ctx.fillRect(0, 0, S, S);
      var nz = makeNoise(21, 6), img = ctx.getImageData(0, 0, S, S), d = img.data;
      for (var j = 0; j < S; j++) for (var i = 0; i < S; i++) {
        var v = fbm(nz, i / S * 6, j / S * 6, 3) - 0.5, k = (j * S + i) * 4;
        d[k] += v * 30; d[k + 1] += v * 28; d[k + 2] += v * 22;
      }
      ctx.putImageData(img, 0, 0);
      // windows: texture covers 6 m; one window per tile, sill line
      var wx = S * 0.3, wy = S * 0.18, ww = S * 0.4, wh = S * 0.36;
      ctx.fillStyle = '#5d6b73'; ctx.fillRect(wx, wy, ww, wh);
      var g = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.12)');
      ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = '#efe7d4'; ctx.lineWidth = 6; ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh * 0.35); ctx.lineTo(wx + ww, wy + wh * 0.35); ctx.stroke();
      ctx.fillStyle = '#b8ad95'; ctx.fillRect(wx - 10, wy + wh + 3, ww + 20, 8);
      ctx.fillStyle = 'rgba(80,70,55,.15)'; ctx.fillRect(wx, wy + wh + 11, ww, S * 0.2);
      ctx.fillStyle = 'rgba(120,110,90,.35)'; ctx.fillRect(0, S - 8, S, 8);
      grain(ctx, S, S, 12, 11);
    },
    cont: function (ctx, S, r, base) {
      ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
      var rib = S / 18;
      for (var x = 0; x < S; x += rib) {
        var g = ctx.createLinearGradient(x, 0, x + rib, 0);
        g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(0.3, 'rgba(255,255,255,.12)'); g.addColorStop(0.55, 'rgba(255,255,255,.02)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
        ctx.fillStyle = g; ctx.fillRect(x, 0, rib, S);
      }
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, S, S * 0.035); ctx.fillRect(0, S * 0.965, S, S * 0.035);
      for (var i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(110,55,25,' + (0.1 + r() * 0.25) + ')'; ctx.beginPath(); ctx.ellipse(r() * S, r() < 0.5 ? S * (0.9 + r() * 0.1) : r() * S, 2 + r() * 10, 1 + r() * 18, 0, 0, 6.283); ctx.fill(); }
      stencilText(ctx, 'РБЖУ ' + (100000 + (r() * 899999 | 0)), S * 0.3, S * 0.2, 26, 'rgba(240,236,224,.75)');
      stencilText(ctx, '22G1', S * 0.26, S * 0.3, 20, 'rgba(240,236,224,.7)');
      grain(ctx, S, S, 14, 12);
    },
    crate: function (ctx, S, r) {
      wood(ctx, 0, 0, S, S, '#b48c57', r, false);
      ctx.strokeStyle = 'rgba(60,40,18,.45)'; ctx.lineWidth = 2;
      for (var y = S / 5; y < S; y += S / 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke(); }
      var f = S * 0.11;
      wood(ctx, 0, 0, S, f, '#9c7646', r, false); wood(ctx, 0, S - f, S, f, '#9c7646', r, false);
      wood(ctx, 0, 0, f, S, '#9c7646', r, true); wood(ctx, S - f, 0, f, S, '#9c7646', r, true);
      ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(Math.PI / 4);
      wood(ctx, -S * 0.7, -f / 2, S * 1.4, f, '#a07a4a', r, false); ctx.restore();
      ctx.strokeStyle = 'rgba(40,25,10,.7)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
      ctx.strokeRect(f, f, S - 2 * f, S - 2 * f);
      stencilText(ctx, '№' + (10 + (r() * 89 | 0)), S * 0.72, S * 0.28, 30, 'rgba(30,20,10,.55)');
      grain(ctx, S, S, 16, 13);
    },
    rack: function (ctx, S, r) {
      ctx.fillStyle = '#4a4c4e'; ctx.fillRect(0, 0, S, S);
      var shelfH = S / 3;
      for (var s = 0; s < 3; s++) {
        var y = s * shelfH;
        // boxes on the shelf
        for (var x = 10; x < S - 20;) {
          var bw = 40 + r() * 70, bh = shelfH * (0.45 + r() * 0.4);
          if (x + bw > S - 12) break;
          var col = ['#b99b63', '#a88a55', '#c2a56c', '#8d7a5a', '#6d7f8c'][r() * 5 | 0];
          ctx.fillStyle = col; ctx.fillRect(x, y + shelfH - 10 - bh, bw, bh);
          ctx.fillStyle = 'rgba(210,190,140,.5)'; ctx.fillRect(x + bw * 0.42, y + shelfH - 10 - bh, bw * 0.14, bh);
          ctx.strokeStyle = 'rgba(30,25,18,.6)'; ctx.lineWidth = 2; ctx.strokeRect(x, y + shelfH - 10 - bh, bw, bh);
          x += bw + 4 + r() * 10;
        }
        ctx.fillStyle = '#c0682e'; ctx.fillRect(0, y + shelfH - 12, S, 12);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, y + shelfH - 2, S, 2);
      }
      ctx.fillStyle = '#2f5d8a'; ctx.fillRect(0, 0, 14, S); ctx.fillRect(S - 14, 0, 14, S);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      for (var h = 6; h < S; h += 16) { ctx.fillRect(4, h, 5, 6); ctx.fillRect(S - 10, h, 5, 6); }
      grain(ctx, S, S, 12, 14);
    },
    steel: function (ctx, S, r) {
      ctx.fillStyle = '#b5963f'; ctx.fillRect(0, 0, S, S);
      for (var i = 0; i < 160; i++) { ctx.strokeStyle = 'rgba(60,50,30,' + r() * 0.3 + ')'; ctx.lineWidth = 1; var x = r() * S, y = r() * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 6); ctx.stroke(); }
      for (var j = 0; j < 30; j++) { ctx.fillStyle = 'rgba(90,45,20,' + r() * 0.3 + ')'; ctx.beginPath(); ctx.arc(r() * S, r() * S, 2 + r() * 8, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, S, 5); ctx.fillRect(0, 0, 5, S);
      // diamond tread hint
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      for (var y2 = 10; y2 < S; y2 += 22) for (var x2 = (y2 / 22 % 2) * 11 + 6; x2 < S; x2 += 22) ctx.fillRect(x2, y2, 9, 3);
      grain(ctx, S, S, 14, 15);
    },
    trim: function (ctx, S, r) {
      ctx.fillStyle = '#3d4042'; ctx.fillRect(0, 0, S, S);
      for (var i = 0; i < 400; i++) { ctx.fillStyle = 'rgba(255,255,255,' + r() * 0.05 + ')'; ctx.fillRect(r() * S, r() * S, 2, 2); }
      grain(ctx, S, S, 14, 16);
    },
    planks: function (ctx, S, r) {
      var n = 8, ph = S / n;
      for (var i = 0; i < n; i++) {
        var v = (r() - 0.5) * 24;
        wood(ctx, 0, i * ph, S, ph, 'rgb(' + (130 + v | 0) + ',' + (112 + v | 0) + ',' + (88 + v | 0) + ')', r, false);
        ctx.fillStyle = 'rgba(30,22,14,.6)'; ctx.fillRect(0, i * ph, S, 3);
        ctx.fillStyle = 'rgba(30,22,14,.5)'; var jx = r() * S; ctx.fillRect(jx, i * ph, 3, ph);
      }
      grain(ctx, S, S, 16, 17);
    },
    target: function (ctx, S) {
      ctx.fillStyle = '#ece2c6'; ctx.fillRect(0, 0, S, S);
      var cx = S / 2, cy = S / 2, R = S * 0.46;
      var rings = [1, 0.84, 0.69, 0.53, 0.38, 0.22];
      rings.forEach(function (k, i) {
        ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, 6.283);
        ctx.fillStyle = i >= 3 ? '#17140f' : '#ece2c6'; ctx.fill();
        ctx.strokeStyle = i >= 3 ? '#ece2c6' : '#17140f'; ctx.lineWidth = 3; ctx.stroke();
      });
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.08, 0, 6.283); ctx.fillStyle = '#d2351a'; ctx.fill();
      ctx.font = '700 ' + (S * 0.05) + 'px "Arial Narrow", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [5, 6, 7].forEach(function (n, i) { ctx.fillStyle = '#17140f'; var rr = R * (0.92 - i * 0.155); ctx.fillText(n, cx, cy - rr); ctx.fillText(n, cx, cy + rr); ctx.fillText(n, cx - rr, cy); ctx.fillText(n, cx + rr, cy); });
      ctx.strokeStyle = 'rgba(23,20,15,.25)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, S - 6, S - 6);
      grain(ctx, S, S, 10, 18);
    },
    water: function (ctx, S, r) {
      ctx.fillStyle = '#4b6774'; ctx.fillRect(0, 0, S, S);
      for (var i = 0; i < 300; i++) {
        ctx.strokeStyle = r() < 0.5 ? 'rgba(200,220,228,.12)' : 'rgba(20,35,45,.18)'; ctx.lineWidth = 1 + r() * 2;
        var x = r() * S, y = r() * S, l = 8 + r() * 30;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 3, x + l, y); ctx.stroke();
      }
    }
  };

  /* returns a canvas for a material */
  Art.texCanvas = function (mat, size) {
    var key = mat + ':' + size;
    if (texCache[key]) return texCache[key];
    var S = size || 512, cv = canvas(S, S), ctx = ctx2d(cv), r = rng(hash(mat));
    if (mat === 'cont_blue') texDraw.cont(ctx, S, r, '#4f6f8c');
    else if (mat === 'cont_red') texDraw.cont(ctx, S, r, '#94442c');
    else if (mat === 'cont_ochre') texDraw.cont(ctx, S, r, '#b38c3a');
    else (texDraw[mat] || texDraw.trim)(ctx, S, r);
    texCache[key] = cv;
    return cv;
  };

  /* floor markings for a map: transparent canvas covering map bounds */
  Art.markings = function (map, pxPerM) {
    var bd = map.bounds, w = Math.ceil((bd[2] - bd[0]) * pxPerM), h = Math.ceil((bd[3] - bd[1]) * pxPerM);
    var cv = canvas(w, h), ctx = cv.getContext('2d'), r = rng(hash(map.id + 'marks'));
    ctx.setTransform(pxPerM, 0, 0, pxPerM, -bd[0] * pxPerM, -bd[1] * pxPerM);
    map.marks.forEach(function (m) {
      if (m.k === 'line') {
        ctx.strokeStyle = m.c; ctx.lineWidth = m.w; ctx.globalAlpha = 0.85;
        ctx.setLineDash(m.dash ? [1.2, 0.8] : []);
        ctx.beginPath(); ctx.moveTo(m.x0, m.z0); ctx.lineTo(m.x1, m.z1); ctx.stroke();
      } else if (m.k === 'zone') {
        ctx.save(); ctx.beginPath(); ctx.rect(m.x0, m.z0, m.x1 - m.x0, m.z1 - m.z0); ctx.clip();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = m.c; ctx.lineWidth = 0.35; ctx.setLineDash([]);
        for (var d = -60; d < 60; d += 1.4) { ctx.beginPath(); ctx.moveTo(m.x0 + d, m.z0); ctx.lineTo(m.x0 + d + 30, m.z0 + 30); ctx.stroke(); }
        ctx.restore();
        ctx.globalAlpha = 0.85; ctx.strokeStyle = m.c; ctx.lineWidth = 0.2; ctx.setLineDash([]);
        ctx.strokeRect(m.x0, m.z0, m.x1 - m.x0, m.z1 - m.z0);
      } else if (m.k === 'num') {
        ctx.save(); ctx.globalAlpha = 0.8; ctx.translate(m.x, m.z); ctx.rotate(m.rot * Math.PI / 180);
        ctx.scale(1 / pxPerM, 1 / pxPerM);
        stencilText(ctx, m.text, 0, 0, m.size * pxPerM, m.c);
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    // wear the paint
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < w * h / 90; i++) { ctx.globalAlpha = 0.3 + r() * 0.5; ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    return cv;
  };

  /* radial soft sprite (muzzle flash, puffs) */
  Art.sprite = function (kind) {
    var key = 'sprite:' + kind;
    if (texCache[key]) return texCache[key];
    var S = 128, cv = canvas(S, S), ctx = cv.getContext('2d');
    if (kind === 'flash') {
      var g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,200,90,.9)'); g.addColorStop(0.6, 'rgba(255,120,30,.25)'); g.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
      ctx.translate(S / 2, S / 2);
      ctx.fillStyle = 'rgba(255,240,190,.9)';
      for (var i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -S * 0.48); ctx.lineTo(5, 0); ctx.fill(); }
    } else if (kind === 'puff') {
      var g2 = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g2.addColorStop(0, 'rgba(220,214,200,.9)'); g2.addColorStop(0.5, 'rgba(200,192,178,.45)'); g2.addColorStop(1, 'rgba(200,190,170,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, S, S);
    } else if (kind === 'hole') {
      var g3 = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g3.addColorStop(0, 'rgba(10,9,8,1)'); g3.addColorStop(0.28, 'rgba(15,13,11,.95)'); g3.addColorStop(0.42, 'rgba(40,36,30,.6)'); g3.addColorStop(1, 'rgba(40,36,30,0)');
      ctx.fillStyle = g3; ctx.fillRect(0, 0, S, S);
    } else if (kind === 'blood') {
      var g4 = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g4.addColorStop(0, 'rgba(150,20,10,.95)'); g4.addColorStop(0.6, 'rgba(120,15,8,.4)'); g4.addColorStop(1, 'rgba(100,10,5,0)');
      ctx.fillStyle = g4; ctx.fillRect(0, 0, S, S);
    }
    texCache[key] = cv;
    return cv;
  };
})();
