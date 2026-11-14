/* Рубеж — map layouts. Every map is a list of axis-aligned boxes (metres, y up),
   plus spawns, bot lanes, floor markings and decorative paper targets.
   The same box list drives rendering, collision, raycasts, navigation and the minimap. */
(function () {
  'use strict';
  var RZ = window.RZ;

  var CONT_L = 6.06, CONT_W = 2.44, CONT_H = 2.6;

  function Builder() {
    this.boxes = [];
    this.marks = [];
    this.targets = [];
  }
  Builder.prototype = {
    rect: function (x0, z0, x1, z1, h, mat, y0, flags) {
      y0 = y0 || 0;
      var b = {
        x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1),
        y0: y0, y1: y0 + h, mat: mat, col: true, vis: true, shadow: true
      };
      if (flags) {
        if (flags.nocol) b.col = false;
        if (flags.invis) b.vis = false;
        if (flags.noshadow) b.shadow = false;
      }
      this.boxes.push(b);
      return b;
    },
    box: function (cx, cz, w, d, h, mat, y0, flags) {
      return this.rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, h, mat, y0, flags);
    },
    wallX: function (x0, x1, z, h, mat, t, y0) { t = t || 0.3; return this.rect(x0, z - t / 2, x1, z + t / 2, h, mat, y0); },
    wallZ: function (z0, z1, x, h, mat, t, y0) { t = t || 0.3; return this.rect(x - t / 2, z0, x + t / 2, z1, h, mat, y0); },
    container: function (cx, cz, alongX, mat, y0) {
      var w = alongX ? CONT_L : CONT_W, d = alongX ? CONT_W : CONT_L;
      var b = this.box(cx, cz, w, d, CONT_H, mat, y0);
      b.alongX = alongX;
      return b;
    },
    crate: function (cx, cz, s, y0) { return this.box(cx, cz, s || 1.2, s || 1.2, s || 1.2, 'crate', y0); },
    /* stairs ascending from foot (fx,fz) in direction dir up to totalH */
    stairs: function (fx, fz, dir, width, totalH, mat) {
      var n = Math.ceil(totalH / 0.3 - 1e-6), sh = totalH / n, sd = 0.45, i;
      for (i = 1; i <= n; i++) {
        var a = (i - 1) * sd, b = i * sd, h = i * sh;
        if (dir === '+z') this.rect(fx - width / 2, fz + a, fx + width / 2, fz + b, h, mat || 'cblock');
        else if (dir === '-z') this.rect(fx - width / 2, fz - b, fx + width / 2, fz - a, h, mat || 'cblock');
        else if (dir === '+x') this.rect(fx + a, fz - width / 2, fx + b, fz + width / 2, h, mat || 'cblock');
        else this.rect(fx - b, fz - width / 2, fx - a, fz + width / 2, h, mat || 'cblock');
      }
    },
    line: function (x0, z0, x1, z1, w, color, dash) { this.marks.push({ k: 'line', x0: x0, z0: z0, x1: x1, z1: z1, w: w || 0.12, c: color || '#f1efe6', dash: dash || 0 }); },
    num: function (x, z, text, size, rot, color) { this.marks.push({ k: 'num', x: x, z: z, text: String(text), size: size || 2, rot: rot || 0, c: color || '#f1efe6' }); },
    zone: function (x0, z0, x1, z1, color) { this.marks.push({ k: 'zone', x0: x0, z0: z0, x1: x1, z1: z1, c: color || '#e7b416' }); },
    target: function (x, y, z, face, s) { this.targets.push({ x: x, y: y, z: z, face: face, s: s || 1 }); }
  };

  /* paper targets along the inner faces of a rectangular perimeter */
  function perimeterTargets(B, x0, z0, x1, z1, y, step) {
    var x, z;
    for (x = x0 + step * 0.7; x < x1 - 2; x += step) { B.target(x, y, z0, '+z'); B.target(x + step * 0.4, y, z1, '-z'); }
    for (z = z0 + step * 0.9; z < z1 - 2; z += step) { B.target(x0, y, z, '+x'); B.target(x1, y, z + step * 0.3, '-x'); }
  }

  /* ================================================================== */
  /* «Склад» — warehouse interior                                       */
  /* ================================================================== */
  function buildSklad() {
    var B = new Builder();
    // perimeter (7 m walls)
    B.rect(-28.75, -30.75, 28.75, -30, 7, 'kraft');
    B.rect(-28.75, 30, 28.75, 30.75, 7, 'kraft');
    B.rect(-28.75, -30, -28, 30, 7, 'plywood');
    B.rect(28, -30, 28.75, 30, 7, 'plywood');

    // two rack lines with crossing gaps
    B.rect(-10.7, -18, -9.3, -5.5, 4.2, 'rack'); B.rect(-10.7, -2.5, -9.3, 2.5, 4.2, 'rack'); B.rect(-10.7, 5.5, -9.3, 18, 4.2, 'rack');
    B.rect(9.3, -18, 10.7, -8.5, 4.2, 'rack'); B.rect(9.3, -5.5, 10.7, 8, 4.2, 'rack'); B.rect(9.3, 11, 10.7, 18, 4.2, 'rack');

    // west lane: site office and crates
    B.rect(-23, -3.5, -16, 3.5, 3.2, 'plywood');
    B.rect(-23.2, -3.7, -15.8, 3.7, 0.25, 'trim', 3.2);
    B.container(-20, -15, false, 'cont_red');
    B.crate(-25.6, -12); B.crate(-25.6, -10.8); B.crate(-25.6, -11.4, 1.2, 1.2);
    B.crate(-14, 10); B.crate(-13.6, -13.5); B.crate(-19, 14); B.crate(-20.2, 14.4, 1.0);
    B.crate(-26.6, 8.5, 1.0); B.crate(-14.5, -7.5, 1.0);

    // mid: staggered containers and a crate stack
    B.container(0, -12, true, 'cont_blue');
    B.container(-5, 0, false, 'cont_ochre');
    B.container(5, 3, false, 'cont_red'); B.container(5, 3, false, 'cont_blue', CONT_H);
    B.container(0, 12, true, 'cont_ochre');
    B.crate(0.65, -2, 1.25); B.crate(-0.6, -2, 1.25); B.crate(0, -2, 1.25, 1.25);
    B.crate(-2, 7, 1.1); B.crate(7.5, -7, 1.1); B.crate(-7.6, 8.2, 1.1); B.crate(6.6, 15.6, 1.0);

    // east lane: steel mezzanine with two stairways and a rail
    B.rect(23.5, -8, 28, 8, 2.1, 'steel');
    B.stairs(25.7, -11.15, '+z', 3.4, 2.1, 'steel');
    B.stairs(25.7, 11.15, '-z', 3.4, 2.1, 'steel');
    B.rect(23.5, -5.5, 23.7, 5.5, 1.0, 'trim', 2.1);
    B.container(16, -14, false, 'cont_red');
    B.container(18.5, 13, false, 'cont_blue');
    B.container(17.5, 1, true, 'cont_ochre');
    B.crate(13, 9); B.crate(21, -4.5, 1.1); B.crate(13.2, -5, 1.2); B.crate(13.2, -5, 1.0, 1.2);

    // spawn cover
    B.wallX(-8, -3, 19.5, 1.1, 'cblock', 0.45); B.wallX(3, 8, 19.5, 1.1, 'cblock', 0.45);
    B.wallX(-8, -3, -19.5, 1.1, 'cblock', 0.45); B.wallX(3, 8, -19.5, 1.1, 'cblock', 0.45);
    B.crate(-20, 21.5); B.crate(21, 22.5); B.crate(20, -21.5); B.crate(-21, -22.5);
    B.crate(-21, -22.5, 1.0, 1.2);

    // roof trusses (overhead, decorative)
    for (var z = -26; z <= 26; z += 6.5) B.rect(-28, z - 0.18, 28, z + 0.18, 0.55, 'steel', 7.3, { nocol: true });
    for (var x = -21; x <= 21; x += 14) B.rect(x - 0.15, -30, x + 0.15, 30, 0.35, 'steel', 7.0, { nocol: true });

    // floor paint
    B.line(-11.5, -18, -11.5, 18, 0.15, '#e7b416'); B.line(-8.5, -18, -8.5, 18, 0.15, '#e7b416');
    B.line(8.5, -18, 8.5, 18, 0.15, '#e7b416'); B.line(11.5, -18, 11.5, 18, 0.15, '#e7b416');
    B.line(-27, 19.5, 27, 19.5, 0.12, '#f1efe6', 1); B.line(-27, -19.5, 27, -19.5, 0.12, '#f1efe6', 1);
    B.zone(-9, 21.5, 9, 29, '#e7b416'); B.zone(-9, -29, 9, -21.5, '#e7b416');
    B.num(-20, 17, '01', 2.4, 0); B.num(0, 17.2, '02', 2.4, 0); B.num(16, 17, '03', 2.4, 0);
    B.num(-20, -17, '04', 2.4, 180); B.num(0, -17.2, '05', 2.4, 180); B.num(16, -17, '06', 2.4, 180);
    B.num(0, 25.2, 'А', 3.2, 0, '#d2351a'); B.num(0, -25.2, 'Б', 3.2, 180, '#d2351a');
    B.num(-25.4, 0, '7', 2, 90); B.num(-13.4, 0, '8', 2, 90); B.num(13.4, 5, '9', 2, -90);

    perimeterTargets(B, -28, -30, 28, 30, 2.1, 9);
    B.target(-16, 1.7, 0, '+x'); B.target(-23, 1.7, -1.5, '-x');

    return {
      id: 'sklad', name: 'Склад', note: 'Тесные проходы, ближний бой', where: 'на «Складе»',
      bounds: [-28, -30, 28, 30], floor: 'concrete',
      env: { sky: '#d3d8d7', fogNear: 30, fogFar: 95, sun: [0.45, 1, 0.3], hemi: 1.15 },
      boxes: B.boxes, marks: B.marks, targets: B.targets,
      spawns: [
        { pts: [[-6, 25.5], [-3, 26.5], [0, 25.5], [3, 26.5], [6, 25.5]], yaw: 0, zone: [-9, 21.5, 9, 29] },
        { pts: [[-6, -25.5], [-3, -26.5], [0, -25.5], [3, -26.5], [6, -25.5]], yaw: Math.PI, zone: [-9, -29, 9, -21.5] }
      ],
      lanes: [
        [[-25, 12], [-25.4, 0], [-24.5, -9], [-16, -23]],
        [[-13.6, 13], [-13.5, 0], [-13.2, -11], [-7, -23]],
        [[0, 16], [-2.2, 7], [2.5, -6], [-5, -16], [0, -23]],
        [[13, 15], [13, 4], [19.5, -6], [19, -20], [6, -24]],
        [[22, 15], [25.7, 9], [25.6, 0], [25.7, -9], [21, -21]]
      ]
    };
  }

  /* ================================================================== */
  /* «Двор» — courtyard between buildings                               */
  /* ================================================================== */
  function buildDvor() {
    var B = new Builder();
    // surrounding buildings
    B.rect(-39, -31, 39, -28, 12, 'plaster');
    B.rect(-39, 28, 39, 31, 12, 'plaster');
    B.rect(-39, -28, -36, 28, 12, 'plaster');
    B.rect(36, -28, 39, 28, 12, 'plaster');
    // porches / setbacks
    B.rect(-20, -28, -12, -26.6, 3.4, 'cblock');
    B.rect(10, -28, 16, -26.8, 3.0, 'kraft');
    B.rect(-36, -14, -34.6, -9, 3.0, 'cblock');
    B.rect(34.6, 9, 36, 14, 3.0, 'cblock');

    // central plinth with stairs and booth
    B.rect(-6, -5, 6, 5, 1.2, 'cblock');
    B.stairs(-7.8, 0, '+x', 3.2, 1.2, 'cblock');
    B.stairs(7.8, 0, '-x', 3.2, 1.2, 'cblock');
    B.rect(-2, -2, 2, 2, 2.6, 'plywood', 1.2);
    B.rect(-2.3, -2.3, 2.3, 2.3, 0.2, 'trim', 3.8);
    B.wallX(-5.6, -3, -4.6, 0.9, 'cblock', 0.35, 1.2); B.wallX(3, 5.6, 4.6, 0.9, 'cblock', 0.35, 1.2);
    B.wallZ(-4.6, -2.6, 5.6, 0.9, 'cblock', 0.35, 1.2); B.wallZ(2.6, 4.6, -5.6, 0.9, 'cblock', 0.35, 1.2);

    // north lane: parked truck, planters, kiosk, low walls
    B.rect(-12, -23.2, -4.2, -20.6, 2.8, 'cont_blue');
    B.rect(-4.2, -23.0, -2.0, -20.8, 2.1, 'trim');
    B.rect(6, -22, 9, -21, 0.9, 'cblock'); B.rect(18, -19, 21, -18, 0.9, 'cblock'); B.rect(-25, -18.5, -22, -17.5, 0.9, 'cblock');
    B.rect(24, -27, 28.5, -23, 2.8, 'kraft');
    B.wallX(-20, -14, -12, 1.1, 'cblock', 0.4); B.wallX(14, 20, -12, 1.1, 'cblock', 0.4);
    B.crate(-28, -24); B.crate(-28, -22.8); B.crate(1, -25, 1.0);

    // south lane: arcade along the south building
    for (var x = -24; x <= 24; x += 6) B.box(x, 18.6, 0.7, 0.7, 4.0, 'cblock');
    B.rect(-27, 18.2, 27, 28, 0.4, 'trim', 4.0, { nocol: true });
    B.rect(-3, 13.8, 3, 14.6, 0.5, 'planks');
    B.rect(-15, 13, -12, 14, 0.9, 'cblock'); B.rect(12, 13, 15, 14, 0.9, 'cblock');
    B.wallX(-20, -14, 12, 1.1, 'cblock', 0.4); B.wallX(14, 20, 12, 1.1, 'cblock', 0.4);
    B.rect(9, 22, 12, 25, 2.6, 'kraft');
    B.crate(-10, 24); B.crate(-8.8, 24.2, 1.0);

    // mid band: L-walls, crates and two site containers
    B.wallZ(-6, -1, -15, 1.2, 'cblock', 0.4); B.wallX(-15, -11.5, -6, 1.2, 'cblock', 0.4);
    B.wallZ(1, 6, 15, 1.2, 'cblock', 0.4); B.wallX(11.5, 15, 6, 1.2, 'cblock', 0.4);
    B.crate(-18, 4); B.crate(-18, 5.2); B.crate(-18, 4.6, 1.2, 1.2);
    B.crate(18, -4); B.crate(18, -5.2); B.crate(18, -4.6, 1.2, 1.2);
    B.container(-22, 9, false, 'cont_red');
    B.container(22, -9, false, 'cont_ochre');

    // spawn cover
    B.wallZ(-8, -3, -25, 1.1, 'cblock', 0.45); B.wallZ(3, 8, -25, 1.1, 'cblock', 0.45);
    B.wallZ(-8, -3, 25, 1.1, 'cblock', 0.45); B.wallZ(3, 8, 25, 1.1, 'cblock', 0.45);

    // floor paint: a big court outline and lane numbers
    B.line(-30, -11, 30, -11, 0.14); B.line(-30, 11, 30, 11, 0.14);
    B.line(-30, -11, -30, 11, 0.14); B.line(30, -11, 30, 11, 0.14);
    B.line(0, -11, 0, -5.4, 0.14); B.line(0, 5.4, 0, 11, 0.14);
    B.line(-34, -16, 34, -16, 0.12, '#e7b416', 1); B.line(-34, 16, 34, 16, 0.12, '#e7b416', 1);
    B.zone(-35.5, -9, -27, 9, '#e7b416'); B.zone(27, -9, 35.5, 9, '#e7b416');
    B.num(-31.5, 0, 'А', 3.4, 90, '#d2351a'); B.num(31.5, 0, 'Б', 3.4, -90, '#d2351a');
    B.num(-20, -21.5, '11', 2.4, 90); B.num(20, -21.5, '12', 2.4, -90);
    B.num(-20, 21.5, '13', 2.4, 90); B.num(20, 21.5, '14', 2.4, -90);
    B.num(-10, 0, '15', 2.2, 90); B.num(10, 0, '16', 2.2, -90);

    perimeterTargets(B, -36, -28, 36, 28, 2.2, 11);
    B.target(-2, 2.4, 0, '-x'); B.target(2, 2.4, 0, '+x');

    return {
      id: 'dvor', name: 'Двор', note: 'Открытый двор, длинные прострелы', where: 'во «Дворе»',
      bounds: [-36, -28, 36, 28], floor: 'asphalt',
      env: { sky: '#cfd7dc', fogNear: 45, fogFar: 150, sun: [-0.5, 1, 0.35], hemi: 1.05 },
      boxes: B.boxes, marks: B.marks, targets: B.targets,
      spawns: [
        { pts: [[-32, -6], [-31, -3], [-32, 0], [-31, 3], [-32, 6]], yaw: -Math.PI / 2, zone: [-35.5, -9, -27, 9] },
        { pts: [[32, -6], [31, -3], [32, 0], [31, 3], [32, 6]], yaw: Math.PI / 2, zone: [27, -9, 35.5, 9] }
      ],
      lanes: [
        [[-24, -15], [-10, -17.5], [8, -18], [24, -15], [31, -6]],
        [[-18, -8], [-8, -7.5], [0, -7.5], [10, -7.5], [21, -2]],
        [[-13, 0], [-9.5, 0], [-4, 3], [4, -3], [9.5, 0], [16, 0]],
        [[-18, 8], [-10, 7.5], [0, 7.5], [8, 7.5], [21, 2]],
        [[-24, 15], [-10, 22], [8, 22], [24, 15], [31, 6]]
      ]
    };
  }

  /* ================================================================== */
  /* «Док» — port dock with stacked containers, crane base and a pier    */
  /* ================================================================== */
  function buildDok() {
    var B = new Builder();
    B.rect(-33, -34, 33, -32, 8, 'kraft');
    B.rect(-33, 32, 33, 34, 8, 'kraft');
    B.rect(-34, -32, -32, 32, 5, 'cblock');
    // pier edge: rail you can see over, invisible wall behind it
    B.rect(31.5, -32, 31.8, 32, 1.0, 'steel');
    B.rect(31.8, -32, 32.4, 32, 9, 'steel', 0, { invis: true });
    for (var bz = -28; bz <= 28; bz += 8) B.box(30.9, bz, 0.5, 0.5, 0.65, 'trim');
    // pier deck (paint layer only)
    B.rect(21.75, -32, 31.5, 32, 0.02, 'planks', 0, { nocol: true, noshadow: true });

    // container wall between the pier lane and the yard, with crossing gaps
    B.container(20.5, -24, false, 'cont_red'); B.container(20.5, -24, false, 'cont_blue', CONT_H);
    B.container(20.5, -12, false, 'cont_ochre');
    B.container(20.5, 0, false, 'cont_blue'); B.container(20.5, 0, false, 'cont_red', CONT_H);
    B.container(20.5, 12, false, 'cont_red');
    B.container(20.5, 24, false, 'cont_ochre'); B.container(20.5, 24, false, 'cont_blue', CONT_H);
    // pier cover
    B.crate(26, -14); B.crate(27.2, -14.2, 1.0); B.crate(27, 6); B.crate(27, 6, 1.1, 1.2);
    B.rect(24, 18, 27, 20, 1.0, 'crate'); B.crate(25, -2, 1.0);

    // crane base
    [[-5, -4], [5, -4], [-5, 4], [5, 4]].forEach(function (p) { B.box(p[0], p[1], 1.2, 1.2, 9, 'steel'); });
    B.rect(-5.6, -4.6, 5.6, -3.4, 1.0, 'steel', 9, { nocol: true });
    B.rect(-5.6, 3.4, 5.6, 4.6, 1.0, 'steel', 9, { nocol: true });
    B.rect(-5.6, -4.6, -4.4, 4.6, 1.0, 'steel', 9, { nocol: true });
    B.rect(4.4, -4.6, 5.6, 4.6, 1.0, 'steel', 9, { nocol: true });
    B.rect(-3, -3, 3, 3, 2.5, 'cont_ochre', 10, { nocol: true });
    B.rect(-1, -0.6, 30, 0.6, 0.9, 'steel', 12.5, { nocol: true });
    B.rect(-8, -0.5, -1, 0.5, 1.6, 'cblock', 12.2, { nocol: true });
    // loading platform under the crane
    B.rect(-3, -2, 3, 2, 1.4, 'cblock');
    B.stairs(0, -4.25, '+z', 2.4, 1.4, 'cblock');
    B.crate(2, 1, 1.0, 1.4); B.crate(-2.2, 1.2, 0.9, 1.4);
    B.rect(-9, 6, -7.5, 7.5, 1.5, 'trim'); B.rect(7.6, -7.6, 9, -6.2, 1.5, 'trim');

    // container yard (west)
    B.container(-26, -20, true, 'cont_blue'); B.container(-26, -20, true, 'cont_ochre', CONT_H);
    B.container(-14, -20, true, 'cont_red');
    B.container(-20, -10, true, 'cont_ochre'); B.container(-20, -10, true, 'cont_red', CONT_H);
    B.container(-24, -1, true, 'cont_red');
    B.stairs(-24, -6.27, '+z', 3, 2.6, 'steel');
    B.container(-12, 2, false, 'cont_blue');
    B.container(-18, 10, true, 'cont_blue'); B.container(-18, 10, true, 'cont_ochre', CONT_H);
    B.container(-28, 14, false, 'cont_ochre');
    B.container(-24, 21, true, 'cont_red');
    B.container(-12, 20, true, 'cont_ochre');
    B.crate(-30, 5); B.crate(-30, 6.2); B.crate(-9, -9, 1.1); B.crate(-16, 15.5, 1.0);

    // mid section
    B.container(10, -18, true, 'cont_ochre');
    B.container(10, 18, true, 'cont_blue');
    B.container(12, -6, false, 'cont_red');
    B.container(12, 8, false, 'cont_ochre');
    B.container(-6, -14, false, 'cont_blue');
    B.container(-6, 14, false, 'cont_red');
    B.crate(5, 11, 1.1); B.crate(4, -11, 1.1); B.crate(15.5, 0, 1.2);

    // spawn cover
    B.wallX(-4, 4, 23, 1.1, 'cblock', 0.45); B.wallX(-4, 4, -23, 1.1, 'cblock', 0.45);
    B.crate(-17, 27); B.crate(16, -27.5);

    // floor paint
    B.line(21.4, -32, 21.4, 32, 0.2, '#e7b416');
    B.line(-31, -15, 17, -15, 0.12, '#f1efe6', 1); B.line(-31, 16, 17, 16, 0.12, '#f1efe6', 1);
    B.zone(-12, 24.5, 12, 31, '#e7b416'); B.zone(-12, -31, 12, -24.5, '#e7b416');
    B.num(0, 28, 'А', 3.4, 0, '#d2351a'); B.num(0, -28, 'Б', 3.4, 180, '#d2351a');
    B.num(26.5, 26, '21', 2.4, 0); B.num(26.5, -26, '22', 2.4, 180);
    B.num(-8, 6, '23', 2.2, 0); B.num(16.5, -11, '24', 2.2, 180); B.num(-28, -5, '25', 2.2, 90);
    for (var lz = -28; lz <= 28; lz += 4) B.line(-31.8, lz, -30.2, lz, 0.12, '#f1efe6');

    for (var tx = -27; tx < 18; tx += 9) { B.target(tx, 2.2, -32, '+z'); B.target(tx + 4, 2.2, 32, '-z'); }
    B.target(-32, 1.9, -6, '+x'); B.target(-32, 1.9, 8, '+x');
    B.target(-5, 1.9, 4.6, '+z'); B.target(5, 1.9, -4.6, '-z');

    return {
      id: 'dok', name: 'Док', note: 'Контейнеры, кран и длинный пирс', where: 'в «Доке»',
      bounds: [-32, -32, 32, 32], floor: 'concrete', water: true,
      env: { sky: '#cdd6dc', fogNear: 40, fogFar: 135, sun: [0.55, 1, -0.4], hemi: 1.1 },
      boxes: B.boxes, marks: B.marks, targets: B.targets,
      spawns: [
        { pts: [[-10, 27.5], [-5, 28.5], [0, 27.5], [5, 28.5], [10, 27.5]], yaw: 0, zone: [-12, 24.5, 12, 31] },
        { pts: [[-10, -27.5], [-5, -28.5], [0, -27.5], [5, -28.5], [10, -27.5]], yaw: Math.PI, zone: [-12, -31, 12, -24.5] }
      ],
      lanes: [
        [[26, 22], [27, 8], [26, -6], [27, -20], [14, -28]],
        [[-18, 25], [-20, 15], [-16, 5], [-17, -5], [-24, -14], [-16, -27]],
        [[0, 18], [3, 8], [0, 0], [-2, -8], [0, -18], [0, -27]],
        [[15, 21], [16, 6], [16.5, -6], [16, -14], [8, -26]],
        [[-24, 6], [-24, -1], [-27, -6], [-28, -26]]
      ]
    };
  }

  var cache = {};
  RZ.MAP_IDS = ['sklad', 'dvor', 'dok'];
  RZ.getMap = function (id) {
    if (!cache[id]) cache[id] = id === 'dvor' ? buildDvor() : id === 'dok' ? buildDok() : buildSklad();
    return cache[id];
  };
})();
