/* Рубеж — 3D world: merged static geometry from the map box list, collision and raycasts,
   a 2.5D navigation grid with A*, and pooled visual effects (tracers, decals, puffs, flashes). */
(function () {
  'use strict';
  var RZ = window.RZ, Art = RZ.Art;

  var CELL = 0.5, STEP = 0.65, CLEAR_R = 0.42;

  function World(map, opts) {
    this.map = map;
    this.opts = opts || {};
    this.disposables = [];
    this.buildCollision();
    this.buildNav();
    if (!this.opts.headless) this.buildScene();
  }
  RZ.World = World;

  /* ================================================================== */
  /* Collision + raycasts                                                */
  /* ================================================================== */
  World.prototype.buildCollision = function () {
    var list = this.map.boxes.filter(function (b) { return b.col; });
    this.colBoxes = list;
    var n = list.length, a = new Float32Array(n * 6);
    for (var i = 0; i < n; i++) {
      var b = list[i];
      a[i * 6] = b.x0; a[i * 6 + 1] = b.y0; a[i * 6 + 2] = b.z0; a[i * 6 + 3] = b.x1; a[i * 6 + 4] = b.y1; a[i * 6 + 5] = b.z1;
    }
    this.cb = a; this.nb = n;
  };

  /* Returns hit distance (or maxT if nothing). hit.nx/ny/nz receive the face normal. */
  World.prototype.raycast = function (ox, oy, oz, dx, dy, dz, maxT, hit) {
    var a = this.cb, n = this.nb, best = maxT, bn = -1, axis = 0;
    var ix = 1 / (dx || 1e-9), iy = 1 / (dy || 1e-9), iz = 1 / (dz || 1e-9);
    for (var i = 0; i < n; i++) {
      var k = i * 6;
      var t1 = (a[k] - ox) * ix, t2 = (a[k + 3] - ox) * ix;
      var tmin = t1 < t2 ? t1 : t2, tmax = t1 < t2 ? t2 : t1, ax = 0;
      t1 = (a[k + 1] - oy) * iy; t2 = (a[k + 4] - oy) * iy;
      var lo = t1 < t2 ? t1 : t2, hi = t1 < t2 ? t2 : t1;
      if (lo > tmin) { tmin = lo; ax = 1; }
      if (hi < tmax) tmax = hi;
      if (tmax < tmin) continue;
      t1 = (a[k + 2] - oz) * iz; t2 = (a[k + 5] - oz) * iz;
      lo = t1 < t2 ? t1 : t2; hi = t1 < t2 ? t2 : t1;
      if (lo > tmin) { tmin = lo; ax = 2; }
      if (hi < tmax) tmax = hi;
      if (tmax < tmin || tmax < 0 || tmin >= best) continue;
      if (tmin < 0) tmin = 0;
      best = tmin; bn = i; axis = ax;
    }
    if (hit) {
      hit.box = bn;
      hit.nx = hit.ny = hit.nz = 0;
      if (bn >= 0) {
        if (axis === 0) hit.nx = dx > 0 ? -1 : 1;
        else if (axis === 1) hit.ny = dy > 0 ? -1 : 1;
        else hit.nz = dz > 0 ? -1 : 1;
      }
    }
    return best;
  };
  World.prototype.visible = function (ax, ay, az, bx, by, bz) {
    var dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-4) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, null) >= d - 0.05;
  };

  /* Calls cb(index) for every collision box overlapping the AABB; returns true if any */
  World.prototype.overlaps = function (x0, y0, z0, x1, y1, z1) {
    var a = this.cb, n = this.nb;
    for (var i = 0; i < n; i++) {
      var k = i * 6;
      if (x1 > a[k] && x0 < a[k + 3] && y1 > a[k + 1] && y0 < a[k + 4] && z1 > a[k + 2] && z0 < a[k + 5]) return i;
    }
    return -1;
  };
  /* highest box top under a point among boxes whose top is <= maxY (ground probe) */
  World.prototype.groundAt = function (x0, z0, x1, z1, maxY) {
    var a = this.cb, n = this.nb, g = 0;
    for (var i = 0; i < n; i++) {
      var k = i * 6;
      if (x1 > a[k] && x0 < a[k + 3] && z1 > a[k + 2] && z0 < a[k + 5]) {
        var top = a[k + 4];
        if (top <= maxY && top > g) g = top;
      }
    }
    return g;
  };

  /* ================================================================== */
  /* Navigation: heightfield grid + A*                                   */
  /* ================================================================== */
  World.prototype.buildNav = function () {
    var bd = this.map.bounds;
    var nx = Math.ceil((bd[2] - bd[0]) / CELL), nz = Math.ceil((bd[3] - bd[1]) / CELL), N = nx * nz;
    this.nx = nx; this.nz = nz; this.ox = bd[0]; this.oz = bd[1];
    var h = new Float32Array(N), walk = new Uint8Array(N);
    var boxes = this.colBoxes.slice().sort(function (a, b) { return a.y0 - b.y0; });
    var i, j, c, bi, b;
    for (j = 0; j < nz; j++) for (i = 0; i < nx; i++) {
      c = j * nx + i;
      var x = this.ox + (i + 0.5) * CELL, z = this.oz + (j + 0.5) * CELL, hh = 0, blocked = false;
      for (bi = 0; bi < boxes.length; bi++) {
        b = boxes[bi];
        if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
        if (b.y0 <= hh + 0.5) { if (b.y1 > hh) hh = b.y1; }
      }
      // overhead clearance
      for (bi = 0; bi < boxes.length; bi++) {
        b = boxes[bi];
        if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
        if (b.y0 > hh + 0.5 && b.y0 < hh + 2.0) blocked = true;
      }
      if (hh > 3.0) blocked = true;
      h[c] = hh;
      walk[c] = blocked ? 0 : 1;
    }
    // clearance: block cells whose disc touches a box rising above a step from this height
    for (j = 0; j < nz; j++) for (i = 0; i < nx; i++) {
      c = j * nx + i;
      if (!walk[c]) continue;
      var cx = this.ox + (i + 0.5) * CELL, cz = this.oz + (j + 0.5) * CELL, base = h[c];
      if (cx - CLEAR_R < bd[0] || cx + CLEAR_R > bd[2] || cz - CLEAR_R < bd[1] || cz + CLEAR_R > bd[3]) { walk[c] = 0; continue; }
      for (bi = 0; bi < boxes.length; bi++) {
        b = boxes[bi];
        if (b.y1 <= base + STEP || b.y0 >= base + 1.9) continue;
        var px = cx < b.x0 ? b.x0 : cx > b.x1 ? b.x1 : cx, pz = cz < b.z0 ? b.z0 : cz > b.z1 ? b.z1 : cz;
        if ((px - cx) * (px - cx) + (pz - cz) * (pz - cz) < CLEAR_R * CLEAR_R) { walk[c] = 0; break; }
      }
    }
    this.navH = h; this.walk = walk;
    // penalty near walls: distance to a blocked cell (in cells, capped)
    var pen = new Uint8Array(N);
    for (c = 0; c < N; c++) {
      if (!walk[c]) continue;
      var ci = c % nx, cj = (c / nx) | 0, near = 0;
      for (var dj = -2; dj <= 2 && !near; dj++) for (var di = -2; di <= 2; di++) {
        var ii = ci + di, jj = cj + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || !walk[jj * nx + ii]) { near = Math.abs(di) <= 1 && Math.abs(dj) <= 1 ? 2 : 1; if (near === 2) break; }
      }
      pen[c] = near;
    }
    this.pen = pen;
    // connected components (so goals snap into the reachable area)
    var comp = new Int32Array(N).fill(-1), stack = new Int32Array(N), nc = 0, sizes = [];
    for (c = 0; c < N; c++) {
      if (!walk[c] || comp[c] >= 0) continue;
      var sp = 0, size = 0; stack[sp++] = c; comp[c] = nc;
      while (sp) {
        var cur = stack[--sp]; size++;
        var cx2 = cur % nx, cz2 = (cur / nx) | 0;
        for (var k = 0; k < 4; k++) {
          var ax = cx2 + (k === 0 ? 1 : k === 1 ? -1 : 0), az = cz2 + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (ax < 0 || az < 0 || ax >= nx || az >= nz) continue;
          var nb = az * nx + ax;
          if (walk[nb] && comp[nb] < 0 && Math.abs(h[nb] - h[cur]) <= STEP) { comp[nb] = nc; stack[sp++] = nb; }
        }
      }
      sizes.push(size); nc++;
    }
    var main = 0;
    for (c = 1; c < nc; c++) if (sizes[c] > sizes[main]) main = c;
    this.comp = comp; this.mainComp = main;
    // A* buffers
    this.g = new Float32Array(N); this.par = new Int32Array(N); this.stamp = new Uint32Array(N); this.closed = new Uint32Array(N);
    this.gen = 0;
    this.heap = new Int32Array(N * 4); this.heapF = new Float32Array(N * 4);
    // list of main-component cells for random roaming
    var cells = [];
    for (c = 0; c < N; c++) if (comp[c] === main && pen[c] === 0) cells.push(c);
    this.roamCells = cells;
  };

  World.prototype.cellOf = function (x, z) {
    var i = Math.floor((x - this.ox) / CELL), j = Math.floor((z - this.oz) / CELL);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  };
  World.prototype.cellX = function (c) { return this.ox + ((c % this.nx) + 0.5) * CELL; };
  World.prototype.cellZ = function (c) { return this.oz + (((c / this.nx) | 0) + 0.5) * CELL; };
  World.prototype.cellWalkable = function (c) { return c >= 0 && this.walk[c] === 1 && this.comp[c] === this.mainComp; };

  /* nearest main-component cell to (x,z); prefers cells whose height is close to y */
  World.prototype.nearestCell = function (x, z, y) {
    var c0 = this.cellOf(x, z), nx = this.nx, nz = this.nz;
    var ci = Math.floor((x - this.ox) / CELL), cj = Math.floor((z - this.oz) / CELL);
    if (c0 >= 0 && this.cellWalkable(c0) && (y == null || Math.abs(this.navH[c0] - y) < 1.2)) return c0;
    var best = -1, bd = 1e9;
    for (var r = 1; r < 24; r++) {
      for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) {
        if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
        var i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        var c = j * nx + i;
        if (!this.cellWalkable(c)) continue;
        var d = di * di + dj * dj + (y == null ? 0 : Math.pow((this.navH[c] - y) * 3, 2));
        if (d < bd) { bd = d; best = c; }
      }
      if (best >= 0 && r * r > bd) break;
    }
    return best;
  };

  /* can a fighter walk straight between two points along the grid? */
  World.prototype.lineWalkable = function (x0, z0, x1, z1) {
    var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.ceil(len / 0.25), prev = -1;
    for (var s = 0; s <= n; s++) {
      var t = n ? s / n : 0, c = this.cellOf(x0 + dx * t, z0 + dz * t);
      if (c < 0 || !this.walk[c] || this.pen[c] === 2) return false;
      if (prev >= 0 && Math.abs(this.navH[c] - this.navH[prev]) > STEP) return false;
      prev = c;
    }
    return true;
  };

  /* A* from world point to world point. Returns array of {x,y,z} or null. */
  World.prototype.findPath = function (sx, sz, sy, tx, tz, ty) {
    var start = this.nearestCell(sx, sz, sy), goal = this.nearestCell(tx, tz, ty);
    if (start < 0 || goal < 0) return null;
    var nx = this.nx, nz = this.nz, h = this.navH, walk = this.walk, pen = this.pen;
    var g = this.g, par = this.par, stamp = this.stamp, closed = this.closed, heap = this.heap, hf = this.heapF;
    var gen = ++this.gen, hs = 0;
    var gi = goal % nx, gj = (goal / nx) | 0;
    function heur(c) { var di = Math.abs(c % nx - gi), dj = Math.abs(((c / nx) | 0) - gj); return (di + dj) + (1.4142 - 2) * Math.min(di, dj); }
    function push(c, f) {
      var i = hs++;
      while (i > 0) { var p = (i - 1) >> 1; if (hf[p] <= f) break; heap[i] = heap[p]; hf[i] = hf[p]; i = p; }
      heap[i] = c; hf[i] = f;
    }
    function pop() {
      var top = heap[0], last = heap[--hs], lf = hf[hs], i = 0;
      while (true) {
        var l = i * 2 + 1; if (l >= hs) break;
        var r = l + 1, m = r < hs && hf[r] < hf[l] ? r : l;
        if (hf[m] >= lf) break;
        heap[i] = heap[m]; hf[i] = hf[m]; i = m;
      }
      heap[i] = last; hf[i] = lf;
      return top;
    }
    g[start] = 0; stamp[start] = gen; par[start] = -1; push(start, heur(start));
    var found = false, iter = 0;
    while (hs > 0 && iter++ < 60000) {
      var cur = pop();
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === goal) { found = true; break; }
      var ci = cur % nx, cj = (cur / nx) | 0, hc = h[cur];
      for (var k = 0; k < 8; k++) {
        var di = k === 0 || k === 4 || k === 5 ? 1 : k === 1 || k === 6 || k === 7 ? -1 : 0;
        var dj = k === 2 || k === 4 || k === 6 ? 1 : k === 3 || k === 5 || k === 7 ? -1 : 0;
        var ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        var nb = nj * nx + ni;
        if (!walk[nb] || closed[nb] === gen || Math.abs(h[nb] - hc) > STEP) continue;
        var cost = 1;
        if (di && dj) {
          if (!walk[cj * nx + ni] || !walk[nj * nx + ci]) continue;
          cost = 1.4142;
        }
        cost += pen[nb] * 0.6;
        var ng = g[cur] + cost;
        if (stamp[nb] !== gen || ng < g[nb]) {
          stamp[nb] = gen; g[nb] = ng; par[nb] = cur;
          if (hs < heap.length - 1) push(nb, ng + heur(nb));
        }
      }
    }
    if (!found) return null;
    var cells = [];
    for (var c = goal; c >= 0; c = par[c]) cells.push(c);
    cells.reverse();
    // string-pulling smoothing
    var pts = [], a = 0;
    pts.push(cells[0]);
    while (a < cells.length - 1) {
      var bIdx = cells.length - 1;
      var ax = this.cellX(cells[a]), az = this.cellZ(cells[a]);
      while (bIdx > a + 1 && !this.lineWalkable(ax, az, this.cellX(cells[bIdx]), this.cellZ(cells[bIdx]))) bIdx = a + 1 + ((bIdx - a - 1) >> 1) || a + 1;
      // walk forward greedily from the binary guess
      while (bIdx + 1 < cells.length && this.lineWalkable(ax, az, this.cellX(cells[bIdx + 1]), this.cellZ(cells[bIdx + 1]))) bIdx++;
      pts.push(cells[bIdx]);
      a = bIdx;
    }
    var self = this;
    var out = pts.map(function (c) { return { x: self.cellX(c), y: h[c], z: self.cellZ(c) }; });
    out[out.length - 1] = { x: this.cellX(goal), y: h[goal], z: this.cellZ(goal) };
    return out;
  };

  World.prototype.randomCell = function (rand) {
    var c = this.roamCells[(rand() * this.roamCells.length) | 0];
    return { x: this.cellX(c), y: this.navH[c], z: this.cellZ(c) };
  };

  /* ================================================================== */
  /* Scene                                                              */
  /* ================================================================== */
  var FACE = [
    // normal, corner offsets (in box-local 0/1) CCW from outside
    { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], u: 'z', v: 'y', fu: -1 },
    { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], u: 'z', v: 'y', fu: 1 },
    { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], u: 'x', v: 'z', fu: 1 },
    { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], u: 'x', v: 'z', fu: 1 },
    { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], u: 'x', v: 'y', fu: 1 },
    { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], u: 'x', v: 'y', fu: -1 }
  ];

  function GeoAcc() { this.p = []; this.n = []; this.uv = []; this.idx = []; }
  GeoAcc.prototype.addBox = function (b, tile, boxUV) {
    var ext = { x: [b.x0, b.x1], y: [b.y0, b.y1], z: [b.z0, b.z1] };
    for (var f = 0; f < 6; f++) {
      var F = FACE[f];
      if (f === 3 && b.y0 <= 0.01) continue; // bottom on the floor is never seen
      var base = this.p.length / 3;
      for (var k = 0; k < 4; k++) {
        var cc = F.c[k];
        var x = ext.x[cc[0]], y = ext.y[cc[1]], z = ext.z[cc[2]];
        this.p.push(x, y, z); this.n.push(F.n[0], F.n[1], F.n[2]);
        var w = { x: x, y: y, z: z };
        if (boxUV) {
          var lu = { x: cc[0], y: cc[1], z: cc[2] };
          this.uv.push(F.fu > 0 ? lu[F.u] : 1 - lu[F.u], lu[F.v]);
        } else this.uv.push((w[F.u] * F.fu) / tile, w[F.v] / tile);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };
  GeoAcc.prototype.addQuad = function (pts, nrm, uvs) {
    var base = this.p.length / 3;
    for (var k = 0; k < 4; k++) { this.p.push(pts[k][0], pts[k][1], pts[k][2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.uv.push(uvs[k][0], uvs[k][1]); }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  GeoAcc.prototype.build = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  };

  World.prototype.track = function (o) { this.disposables.push(o); return o; };
  World.prototype.texture = function (cv, repeat) {
    var t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.opts.anisotropy || 1;
    if (repeat) t.repeat.set(repeat, repeat);
    return this.track(t);
  };

  World.prototype.buildScene = function () {
    var map = this.map, env = map.env, q = this.opts.quality || 'medium';
    var texSize = q === 'low' ? 256 : 512;
    var scene = (this.scene = new THREE.Scene());
    var sky = new THREE.Color(env.sky);
    scene.background = sky;
    scene.fog = new THREE.Fog(sky, env.fogNear, env.fogFar);
    this.mats = {};

    // sky dome with a gentle gradient
    var sg = this.track(new THREE.SphereGeometry(400, 24, 12));
    var colors = [], pos = sg.attributes.position, top = new THREE.Color('#b9c6cf'), hor = new THREE.Color(env.sky).lerp(new THREE.Color('#ffffff'), 0.15);
    for (var i = 0; i < pos.count; i++) {
      var yy = Math.max(0, pos.getY(i) / 400), c = hor.clone().lerp(top, Math.pow(yy, 0.6));
      colors.push(c.r, c.g, c.b);
    }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    var dome = new THREE.Mesh(sg, this.track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
    dome.renderOrder = -1;
    scene.add(dome);

    // lights
    var hemi = new THREE.HemisphereLight('#e4ecf1', '#8c8474', 1.9 * env.hemi);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight('#fff3df', 2.6);
    var sd = new THREE.Vector3(env.sun[0], env.sun[1], env.sun[2]).normalize();
    sun.position.copy(sd).multiplyScalar(60);
    sun.target.position.set(0, 0, 0);
    scene.add(sun); scene.add(sun.target);
    // shadow camera is always configured so the setting can be toggled during a match
    var shadows = true;
    sun.castShadow = !!this.opts.shadows;
    {
      var ms = q === 'low' ? 1024 : 2048;
      sun.shadow.mapSize.set(ms, ms);
      var bd = map.bounds, half = Math.max(bd[2] - bd[0], bd[3] - bd[1]) * 0.62;
      var sc = sun.shadow.camera;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 5; sc.far = 140;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    }
    this.sun = sun;

    // materials
    var self = this;
    function mat(name) {
      if (self.mats[name]) return self.mats[name];
      var m = self.track(new THREE.MeshLambertMaterial({ map: self.texture(Art.texCanvas(name, texSize)) }));
      self.mats[name] = m;
      return m;
    }
    this.getMat = mat;

    // merged boxes per material (shadow casters / non-casters split)
    var acc = {};
    map.boxes.forEach(function (b) {
      if (!b.vis) return;
      var key = b.mat + (b.shadow ? '' : ':ns');
      var A = acc[key] || (acc[key] = new GeoAcc());
      var M = Art.MATS[b.mat] || { tile: 2 };
      A.addBox(b, M.tile || 2, M.uv === 'box');
    });
    Object.keys(acc).forEach(function (key) {
      var name = key.split(':')[0], ns = key.indexOf(':ns') > 0;
      var mesh = new THREE.Mesh(self.track(acc[key].build()), mat(name));
      mesh.castShadow = !ns && !!shadows; mesh.receiveShadow = !!shadows;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
    });

    // floor
    var bd2 = map.bounds, fx0 = bd2[0] - 3, fz0 = bd2[1] - 3, fx1 = map.water ? bd2[2] + 0.4 : bd2[2] + 3, fz1 = bd2[3] + 3;
    var floorName = map.floor || 'concrete', ft = (Art.MATS[floorName] || { tile: 4 }).tile;
    var fa = new GeoAcc();
    fa.addQuad([[fx0, 0, fz1], [fx1, 0, fz1], [fx1, 0, fz0], [fx0, 0, fz0]], [0, 1, 0],
      [[fx0 / ft, -fz1 / ft], [fx1 / ft, -fz1 / ft], [fx1 / ft, -fz0 / ft], [fx0 / ft, -fz0 / ft]]);
    var floor = new THREE.Mesh(this.track(fa.build()), mat(floorName));
    floor.receiveShadow = !!shadows; floor.matrixAutoUpdate = false;
    scene.add(floor);
    // outer ground (beyond the walls)
    if (!map.water) {
      var og = new THREE.Mesh(this.track(new THREE.PlaneGeometry(500, 500)), this.track(new THREE.MeshLambertMaterial({ color: '#8d8b84' })));
      og.rotation.x = -Math.PI / 2; og.position.y = -0.02;
      scene.add(og);
    } else this.buildWater(scene, bd2);

    // floor markings overlay
    var ppm = q === 'high' ? 24 : q === 'low' ? 10 : 16;
    var mk = Art.markings(map, ppm), mt = this.texture(mk);
    mt.wrapS = mt.wrapT = THREE.ClampToEdgeWrapping;
    var mm = this.track(new THREE.MeshLambertMaterial({ map: mt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    var ma = new GeoAcc();
    ma.addQuad([[bd2[0], 0.01, bd2[3]], [bd2[2], 0.01, bd2[3]], [bd2[2], 0.01, bd2[1]], [bd2[0], 0.01, bd2[1]]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    var marks = new THREE.Mesh(this.track(ma.build()), mm);
    marks.receiveShadow = !!shadows; marks.renderOrder = 1;
    scene.add(marks);

    // paper targets
    var ta = new GeoAcc(), self2 = this;
    map.targets.forEach(function (t) {
      var s = 0.55 * t.s, o = 0.03, n, p;
      var x = t.x, y = t.y, z = t.z;
      // keep only targets that sit on a wall face (avoid floating ones)
      var dir = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] }[t.face];
      var probe = self2.raycast(x + dir[0] * 0.3, y, z + dir[1] * 0.3, -dir[0], 0, -dir[1], 1.2, null);
      if (probe > 1.1) return;
      x += dir[0] * (0.3 - probe + o); z += dir[1] * (0.3 - probe + o);
      if (t.face === '+z' || t.face === '-z') {
        var sx = t.face === '+z' ? 1 : -1;
        p = [[x - s * sx, y - s, z], [x + s * sx, y - s, z], [x + s * sx, y + s, z], [x - s * sx, y + s, z]];
        n = [0, 0, dir[1]];
      } else {
        var sz = t.face === '+x' ? -1 : 1;
        p = [[x, y - s, z - s * sz], [x, y - s, z + s * sz], [x, y + s, z + s * sz], [x, y + s, z - s * sz]];
        n = [dir[0], 0, 0];
      }
      ta.addQuad(p, n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    });
    if (ta.p.length) {
      var tm = this.track(new THREE.MeshLambertMaterial({ map: this.texture(Art.texCanvas('target', 256)), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      var tmesh = new THREE.Mesh(this.track(ta.build()), tm);
      tmesh.receiveShadow = !!shadows;
      scene.add(tmesh);
    }

    this.buildFx(scene);
  };

  World.prototype.buildWater = function (scene, bd) {
    var wt = this.texture(Art.texCanvas('water', 256), 1);
    wt.repeat.set(60, 60);
    var wm = this.track(new THREE.MeshLambertMaterial({ map: wt, color: '#9fb2bb' }));
    var w = new THREE.Mesh(this.track(new THREE.PlaneGeometry(600, 600)), wm);
    w.rotation.x = -Math.PI / 2; w.position.set(bd[2] + 300.4, -1.3, 0);
    scene.add(w);
    this.waterTex = wt;
    // quay wall face and distant shore silhouettes
    var A = new GeoAcc(), M = this.getMat('cblock');
    A.addBox({ x0: bd[2] + 0.4, x1: bd[2] + 0.6, y0: -1.6, y1: 0, z0: bd[1] - 40, z1: bd[3] + 40 }, 2.4, false);
    A.addBox({ x0: bd[0] - 3, x1: bd[2] + 0.4, y0: -1.6, y1: -0.001, z0: bd[1] - 3, z1: bd[3] + 3 }, 2.4, false);
    var far = [[95, -60, 30, 22, 14], [100, -20, 18, 40, 22], [92, 30, 26, 30, 11], [110, 75, 30, 26, 18], [70, -110, 40, 20, 9]];
    var B = new GeoAcc();
    far.forEach(function (f) { B.addBox({ x0: f[0], x1: f[0] + f[2], z0: f[1], z1: f[1] + f[3], y0: -1.3, y1: f[4] }, 6, false); });
    scene.add(new THREE.Mesh(this.track(A.build()), M));
    scene.add(new THREE.Mesh(this.track(B.build()), this.getMat('plaster')));
    // breakwater
    var C = new GeoAcc();
    C.addBox({ x0: 60, x1: 64, z0: -140, z1: 140, y0: -1.3, y1: 0.6 }, 2.4, false);
    scene.add(new THREE.Mesh(this.track(C.build()), M));
  };

  /* ================================================================== */
  /* Effects                                                            */
  /* ================================================================== */
  World.prototype.buildFx = function (scene) {
    var self = this;
    // tracers
    var tg = this.track(new THREE.BoxGeometry(0.018, 0.018, 1));
    tg.translate(0, 0, 0.5);
    this.tracers = [];
    for (var i = 0; i < 32; i++) {
      var m = this.track(new THREE.MeshBasicMaterial({ color: '#ffe6a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      var t = new THREE.Mesh(tg, m); t.visible = false; t.frustumCulled = false;
      scene.add(t); this.tracers.push({ mesh: t, life: 0, max: 0.07 });
    }
    this.tracerI = 0;
    // bullet hole decals (instanced)
    var dg = this.track(new THREE.PlaneGeometry(0.13, 0.13));
    var dm = this.track(new THREE.MeshBasicMaterial({ map: this.texture(Art.sprite('hole')), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, color: '#cfcfcf' }));
    this.decals = new THREE.InstancedMesh(dg, dm, 140);
    this.decals.count = 0; this.decals.frustumCulled = false;
    this.decalI = 0; this.decalN = 0;
    scene.add(this.decals);
    // puffs and flashes (sprites)
    var puffTex = this.texture(Art.sprite('puff')), bloodTex = this.texture(Art.sprite('blood')), flashTex = this.texture(Art.sprite('flash'));
    this.puffs = [];
    for (i = 0; i < 24; i++) {
      var sm = this.track(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
      var s = new THREE.Sprite(sm); s.visible = false; scene.add(s);
      this.puffs.push({ s: s, life: 0, max: 0.5, grow: 1 });
    }
    this.puffI = 0; this.puffTex = puffTex; this.bloodTex = bloodTex;
    this.flashes = [];
    for (i = 0; i < 10; i++) {
      var fm = this.track(new THREE.SpriteMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      var f = new THREE.Sprite(fm); f.visible = false; f.scale.set(0.5, 0.5, 0.5); scene.add(f);
      this.flashes.push({ s: f, life: 0 });
    }
    this.flashI = 0;
    this._m4 = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1); this._z = new THREE.Vector3(0, 0, 1);
  };

  World.prototype.tracer = function (sx, sy, sz, ex, ey, ez) {
    if (!this.tracers) return;
    var T = this.tracers[this.tracerI++ % this.tracers.length];
    var dx = ex - sx, dy = ey - sy, dz = ez - sz, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 0.5) return;
    // start a little ahead so it doesn't cover the muzzle
    var off = Math.min(1.2, len * 0.2);
    T.mesh.position.set(sx + dx / len * off, sy + dy / len * off, sz + dz / len * off);
    T.mesh.lookAt(ex, ey, ez);
    T.mesh.scale.set(1, 1, Math.min(len - off, 30));
    T.mesh.visible = true; T.mesh.material.opacity = 0.85; T.life = T.max;
  };
  World.prototype.decal = function (x, y, z, nx, ny, nz) {
    if (!this.decals) return;
    var v = this._v.set(nx, ny, nz);
    this._q.setFromUnitVectors(this._z, v);
    this._q2.setFromAxisAngle(v, Math.random() * 6.28);
    this._q.premultiply(this._q2);
    var sc = 0.7 + Math.random() * 0.6;
    this._s.set(sc, sc, sc);
    this._v2.set(x + nx * 0.006, y + ny * 0.006, z + nz * 0.006);
    this._m4.compose(this._v2, this._q, this._s);
    this.decals.setMatrixAt(this.decalI, this._m4);
    this.decalI = (this.decalI + 1) % 140;
    this.decalN = Math.min(140, this.decalN + 1);
    this.decals.count = this.decalN;
    this.decals.instanceMatrix.needsUpdate = true;
  };
  World.prototype.puff = function (x, y, z, blood) {
    if (!this.puffs) return;
    var P = this.puffs[this.puffI++ % this.puffs.length];
    P.s.position.set(x, y, z);
    P.s.material.map = blood ? this.bloodTex : this.puffTex;
    P.s.material.opacity = blood ? 0.9 : 0.75;
    P.life = P.max = blood ? 0.3 : 0.55; P.grow = blood ? 0.5 : 0.9;
    P.s.scale.set(0.15, 0.15, 0.15); P.s.visible = true;
  };
  World.prototype.flash = function (x, y, z, size) {
    if (!this.flashes) return;
    var F = this.flashes[this.flashI++ % this.flashes.length];
    F.s.position.set(x, y, z); F.s.visible = true; F.life = 0.05;
    var s = (size || 0.45) * (0.8 + Math.random() * 0.4);
    F.s.scale.set(s, s, s); F.s.material.rotation = Math.random() * 6.28;
  };
  World.prototype.updateFx = function (dt) {
    if (!this.tracers) return;
    var i;
    for (i = 0; i < this.tracers.length; i++) {
      var T = this.tracers[i];
      if (T.life > 0) { T.life -= dt; T.mesh.material.opacity = Math.max(0, T.life / T.max) * 0.85; if (T.life <= 0) T.mesh.visible = false; }
    }
    for (i = 0; i < this.puffs.length; i++) {
      var P = this.puffs[i];
      if (P.life > 0) {
        P.life -= dt;
        var k = 1 - P.life / P.max, s = 0.15 + k * P.grow;
        P.s.scale.set(s, s, s); P.s.position.y += dt * 0.25;
        P.s.material.opacity = Math.max(0, 1 - k) * 0.75;
        if (P.life <= 0) P.s.visible = false;
      }
    }
    for (i = 0; i < this.flashes.length; i++) {
      var F = this.flashes[i];
      if (F.life > 0) { F.life -= dt; if (F.life <= 0) F.s.visible = false; }
    }
    if (this.waterTex) { this.waterTex.offset.x += dt * 0.004; this.waterTex.offset.y += dt * 0.002; }
  };

  World.prototype.dispose = function () {
    if (this.scene) {
      this.scene.traverse(function (o) { if (o.isInstancedMesh && o.dispose) o.dispose(); });
      this.scene.clear();
    }
    this.disposables.forEach(function (d) { if (d && d.dispose) d.dispose(); });
    this.disposables.length = 0;
    this.scene = null;
  };
})();
