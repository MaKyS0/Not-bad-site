/* Рубеж — first-person rigs and animations for the two knife models.
   «Бабочка» (balisong): handle A stays in the hand, the blade turns on pin A, handle B turns on
   pin B at the blade's tang — so the classic opening and fan twirls are real joint rotations.
   «Керамбит»: the whole knife hangs on a pivot through the finger ring and spins around the
   index finger; reverse grip with the claw blade below the fist.
   Animations are authored here as keyframes (time, value, easing) per channel — nothing is
   imported. Channels: px/py/pz (m), rx/ry/rz (rad) for the wrist, th/ph (deg) for the balisong
   joints, sp (deg) for the karambit spin, ho (0..1) for the opening hand. */
(function () {
  'use strict';
  var RZ = window.RZ;
  var K = (RZ.Knives = {});
  var D2R = Math.PI / 180;

  /* ---------- easing ---------- */
  var EASE = {
    lin: function (t) { return t; },
    io: function (t) { return t * t * (3 - 2 * t); },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    in: function (t) { return t * t * t; },
    back: function (t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  var ANGLE = { th: 1, ph: 1, sp: 1 }; // degree channels that wrap around

  /* ---------- rest poses ---------- */
  var REST = {
    butterfly: { px: 0, py: 0.02, pz: 0, rx: 0.42, ry: 0.42, rz: -0.5, th: 0, ph: 180, ho: 0 },
    karambit: { px: 0, py: 0.05, pz: 0.02, rx: 1.05, ry: -0.75, rz: 0.3, sp: 0, ho: 0 }
  };

  /* ---------- animations (R = rest value of that channel) ---------- */
  var R = 'R';
  var ANIMS = {
    butterfly: {
      // classic opening: wrist flick, blade swings out over the top on pin A, handle B swings
      // under and round on pin B, overshoots and latches against handle A
      draw: { dur: 1.05, keys: {
        py: [[0, -0.2], [0.2, -0.02, 'out'], [0.55, 0.02, 'io'], [0.9, R, 'io']],
        pz: [[0, 0.05], [0.2, 0, 'out'], [1.05, R]],
        rx: [[0, -0.9], [0.2, -0.1, 'out'], [0.34, 0.38, 'io'], [0.5, -0.18, 'io'], [0.74, 0.28, 'io'], [1.05, R, 'io']],
        ry: [[0, 0.2], [0.3, 0.1, 'io'], [1.05, R, 'io']],
        rz: [[0, -1.25], [0.25, -1.1, 'io'], [0.8, -0.9, 'io'], [1.05, R, 'io']],
        th: [[0, 180], [0.28, 180], [0.52, -14, 'out'], [0.66, 6, 'io'], [0.78, 0, 'io']],
        ph: [[0, 180], [0.32, 180], [0.58, 420, 'io'], [0.72, 548, 'out'], [0.84, 540, 'io']]
      }, ev: [[0.3, 'swish'], [0.5, 'swish'], [0.72, 'clack'], [0.85, 'tick']] },
      // inspect: present the knife, fan handle B all the way round, close the blade into the
      // handles, then reopen it the other way with another full handle twirl
      inspect: { dur: 2.75, keys: {
        rz: [[0, R], [0.3, -1.25, 'io'], [2.35, -1.15], [2.75, R, 'io']],
        ry: [[0, R], [0.3, 0.25, 'io'], [2.35, 0.2], [2.75, R, 'io']],
        py: [[0, R], [0.3, 0.04, 'io'], [2.35, 0.03], [2.75, R, 'io']],
        rx: [[0, R], [0.3, 0.05, 'io'], [0.5, 0.25, 'io'], [0.75, -0.1, 'io'], [1.1, 0.3, 'io'], [1.6, -0.2, 'io'], [2.0, 0.22, 'io'], [2.35, 0.05, 'io'], [2.75, R, 'io']],
        ph: [[0, 180], [0.45, 180], [0.8, 540, 'io'], [0.9, 546, 'out'], [1.0, 540, 'io'], [1.5, 540], [2.0, 900, 'io'], [2.1, 905, 'out'], [2.22, 900, 'io']],
        th: [[0, 0], [1.0, 0], [1.35, 188, 'io'], [1.44, 180, 'io'], [1.5, 180], [1.95, 362, 'io'], [2.05, 356, 'io'], [2.15, 360, 'io']]
      }, ev: [[0.5, 'swish'], [0.82, 'clack'], [1.15, 'swish'], [1.38, 'clack'], [1.65, 'swish'], [1.85, 'swish'], [2.02, 'clack'], [2.12, 'tick']] },
      // fast: flat slash right-to-left with a wrist roll; the latched handles wobble a hair
      fast: { dur: 0.42, keys: {
        ry: [[0, R], [0.08, 0.5, 'out'], [0.24, -0.85, 'io'], [0.42, R, 'io']],
        px: [[0, 0], [0.08, 0.05, 'out'], [0.24, -0.13, 'io'], [0.42, 0, 'io']],
        rz: [[0, R], [0.08, 0.2, 'out'], [0.24, -0.95, 'io'], [0.42, R, 'io']],
        pz: [[0, 0], [0.24, -0.06, 'io'], [0.42, 0, 'io']],
        th: [[0, 0], [0.26, 4, 'io'], [0.33, -2, 'io'], [0.42, 0, 'io']]
      }, ev: [[0.1, 'swish']] },
      // heavy: draw back, straight thrust, hold, recover
      heavy: { dur: 1.0, keys: {
        pz: [[0, 0], [0.25, 0.07, 'io'], [0.4, -0.24, 'out'], [0.6, -0.2, 'io'], [1.0, 0, 'io']],
        rx: [[0, R], [0.25, 0.48, 'io'], [0.4, 0.0, 'out'], [0.6, 0.03, 'io'], [1.0, R, 'io']],
        rz: [[0, R], [0.25, -0.2, 'io'], [0.4, -0.55, 'out'], [1.0, R, 'io']],
        py: [[0, 0], [0.25, 0.03, 'io'], [0.4, 0.02, 'io'], [1.0, 0, 'io']]
      }, ev: [[0.3, 'swishH']] }
    },
    karambit: {
      // drawn up from below, then the hand opens and the knife spins twice round the index
      // finger in the ring, overshoots, settles and the fist closes on the handle
      draw: { dur: 1.15, keys: {
        py: [[0, -0.22], [0.22, 0.01, 'out'], [1.15, R, 'io']],
        rx: [[0, -0.6], [0.22, 0.15, 'out'], [0.9, 0.25, 'io'], [1.15, R, 'io']],
        rz: [[0, -0.3], [0.5, 0.05, 'io'], [1.15, R, 'io']],
        ry: [[0, 0], [0.3, 1.15, 'io'], [0.86, 1.05, 'io'], [1.15, R, 'io']],   // flat to the eye while it spins
        sp: [[0, 0], [0.25, 0], [0.85, 738, 'io'], [0.97, 714, 'io'], [1.07, 720, 'io']],
        ho: [[0, 0], [0.22, 0], [0.3, 1, 'io'], [0.86, 1], [0.98, 0, 'io']]
      }, ev: [[0.42, 'swish'], [0.66, 'swish'], [0.97, 'grip']] },
      // inspect: turn the blade to the eye, one spin forward, one spin back, tilt to look along the edge
      inspect: { dur: 2.5, keys: {
        // flat of the blade turned to the eye, hanging to the left of the fist
        ry: [[0, R], [0.35, 1.35, 'io'], [2.1, 1.25], [2.5, R, 'io']],
        rz: [[0, R], [0.35, -0.45, 'io'], [1.95, -0.2, 'io'], [2.1, -0.25], [2.5, R, 'io']],
        py: [[0, R], [0.35, 0.15, 'io'], [2.1, 0.14], [2.5, R, 'io']],
        px: [[0, 0], [0.35, -0.05, 'io'], [2.1, -0.04], [2.5, 0, 'io']],
        rx: [[0, R], [0.35, 0.12, 'io'], [1.95, 0.3, 'io'], [2.1, 0.28], [2.5, R, 'io']],
        sp: [[0, 0], [0.5, 0], [0.95, 364, 'io'], [1.05, 356, 'io'], [1.15, 360, 'io'], [1.3, 360], [1.75, -4, 'io'], [1.85, 3, 'io'], [1.95, 0, 'io']],
        ho: [[0, 0], [0.45, 0], [0.55, 1, 'io'], [1.08, 1], [1.18, 0, 'io'], [1.3, 0], [1.38, 1, 'io'], [1.86, 1], [1.96, 0, 'io']]
      }, ev: [[0.62, 'swish'], [0.82, 'swish'], [1.12, 'grip'], [1.45, 'swish'], [1.65, 'swish'], [1.93, 'grip']] },
      // fast: diagonal hooked slash, the blade trails a little on the finger
      fast: { dur: 0.42, keys: {
        ry: [[0, R], [0.08, 0.05, 'out'], [0.25, -1.25, 'io'], [0.42, R, 'io']],
        rz: [[0, R], [0.08, 0.7, 'out'], [0.25, -0.4, 'io'], [0.42, R, 'io']],
        px: [[0, 0], [0.08, 0.05, 'out'], [0.25, -0.12, 'io'], [0.42, 0, 'io']],
        py: [[0, R], [0.08, 0.07, 'out'], [0.25, -0.03, 'io'], [0.42, R, 'io']],
        sp: [[0, 0], [0.25, -18, 'io'], [0.36, 4, 'io'], [0.42, 0, 'io']]
      }, ev: [[0.1, 'swish']] },
      // heavy: reach in, hook and rip back down towards the body
      heavy: { dur: 1.0, keys: {
        pz: [[0, R], [0.3, -0.17, 'out'], [0.55, 0.04, 'io'], [1.0, R, 'io']],
        py: [[0, R], [0.3, 0.06, 'out'], [0.55, -0.06, 'io'], [1.0, R, 'io']],
        rx: [[0, R], [0.3, -0.1, 'out'], [0.55, 0.85, 'io'], [1.0, R, 'io']],
        sp: [[0, 0], [0.3, 8, 'io'], [0.55, -30, 'io'], [0.8, 4, 'io'], [1.0, 0, 'io']]
      }, ev: [[0.33, 'swishH']] }
    }
  };
  // resolve 'R' tokens once
  Object.keys(ANIMS).forEach(function (m) {
    Object.keys(ANIMS[m]).forEach(function (a) {
      var A = ANIMS[m][a];
      Object.keys(A.keys).forEach(function (ch) { A.keys[ch].forEach(function (k) { if (k[1] === R) k[1] = REST[m][ch]; }); });
    });
  });
  K.ANIMS = ANIMS; K.REST = REST;

  function sampleCh(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i], u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * EASE[b[2] || 'io'](u);
      }
    }
    return keys[keys.length - 1][1];
  }
  function wrap180(d) { d = (d + 180) % 360; if (d < 0) d += 360; return d - 180; }

  /* ---------- geometry helpers (cm in, then scaled by the parent group) ---------- */
  function shapeOf(pts, holes) {
    var sh = new THREE.Shape();
    pts.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
    (holes || []).forEach(function (h) {
      var path = new THREE.Path();
      h.forEach(function (p, i) { if (i) path.lineTo(p[0], p[1]); else path.moveTo(p[0], p[1]); });
      sh.holes.push(path);
    });
    return sh;
  }
  function extrude(pts, depth, bevel, holes, z) {
    var b = Math.min(bevel || 0, depth * 0.45);
    var g = new THREE.ExtrudeGeometry(shapeOf(pts, holes), {
      depth: Math.max(0.01, depth - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelOffset: -b * 0.8, bevelSegments: 2, curveSegments: 6
    });
    g.translate(0, 0, -(depth - 2 * b) / 2 + (z || 0));
    g.computeVertexNormals();
    return g;
  }
  function rounded(x0, y0, x1, y1, r, n) {
    // rounded rectangle outline (cm)
    var pts = [], seg = n || 4;
    [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]].forEach(function (c) {
      for (var i = 0; i <= seg; i++) { var a = (c[2] + 90 * i / seg) * D2R; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    });
    return pts;
  }
  function mesh(g, mat, track) { track(g); var m = new THREE.Mesh(g, mat); return m; }

  /* sleeve + glove placed between two points in the pose group's space */
  function limb(parent, geo, mat, a, b) {
    var m = new THREE.Mesh(geo, mat), dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(dx, dz); m.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
    m.scale.set(1, 1, len);
    parent.add(m);
    return m;
  }

  /* ================================================================== */
  /* «Бабочка» rig                                                       */
  /* ================================================================== */
  function buildButterfly(M, geo, track) {
    var rig = {};
    var knife = new THREE.Group(); knife.scale.setScalar(0.01);            // cm
    // handle profile: channel handle with three skeleton cut-outs, extends backwards from the pins
    var handlePts = rounded(-13.3, -0.78, 0.9, 0.88, 0.45, 3);
    var holes = [[[-11.6, -0.25], [-9.3, -0.25], [-9.3, 0.35], [-11.6, 0.35]], [[-8.2, -0.25], [-5.9, -0.25], [-5.9, 0.35], [-8.2, 0.35]], [[-4.8, -0.25], [-2.5, -0.25], [-2.5, 0.35], [-4.8, 0.35]]];
    holes.forEach(function (h) { h.reverse(); });
    var hA = mesh(extrude(handlePts, 0.55, 0.12, holes, 0.47), M.paint, track);
    knife.add(hA);
    var pinA = mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 12), M.dark, track); pinA.rotation.x = Math.PI / 2; pinA.position.set(0, 0.05, 0);
    knife.add(pinA);
    var blade = new THREE.Group(); blade.position.set(0, 0.05, 0); knife.add(blade);
    var bladePts = [[-0.9, -0.75], [0.6, -0.75], [7.6, -0.8], [10.6, 0.3], [8.4, 0.85], [0.6, 0.85], [-0.9, 0.85]];
    var bm = mesh(extrude(bladePts.map(function (p) { return [p[0], p[1] - 0.05]; }), 0.3, 0.06), M.metal, track);
    blade.add(bm);
    // swedge / bevel line on the blade
    var bev = mesh(extrude([[1.4, -0.75], [7.5, -0.78], [10.4, 0.25], [9.8, 0.25], [7.3, -0.45], [1.4, -0.42]], 0.32, 0.02), M.dark, track);
    bev.position.y = -0.05; blade.add(bev);
    var hingeB = new THREE.Group(); blade.add(hingeB);                     // pin B, coaxial with A but on the other side
    var hB = mesh(extrude(handlePts, 0.55, 0.12, holes, -0.47), M.paint, track);
    hB.position.y = -0.05; hingeB.add(hB);
    var latch = mesh(extrude(rounded(-14.1, -0.5, -12.9, 0.6, 0.2, 2), 0.5, 0.08, null, -0.47), M.metal, track);
    latch.position.y = -0.05; hingeB.add(latch);
    rig.knife = knife; rig.blade = blade; rig.hingeB = hingeB;
    // in hand: handle A along the palm. Knife +x → view forward (-z)
    var orient = new THREE.Group(); orient.rotation.y = Math.PI / 2; orient.add(knife);
    orient.position.set(0, 0, 0.065);   // grip centre on handle A sits at the hand
    rig.orient = orient;
    return rig;
  }

  /* ================================================================== */
  /* «Керамбит» rig                                                      */
  /* ================================================================== */
  function buildKarambit(M, geo, track) {
    var rig = {};
    var W = RZ.WEAPONS.knife_karambit;
    var body = new THREE.Group();
    // 2D art space: ring at (-11.2, 0), blade curving down at +x. Map to knife space: ring up,
    // blade down, curve forward: (x, y) → (−y, −x) = rotate −90° then mirror x.
    var mirror = new THREE.Group(); mirror.scale.x = -1;
    var rot = new THREE.Group(); rot.rotation.z = -Math.PI / 2; mirror.add(rot);
    var art = new THREE.Group(); art.scale.setScalar(0.01); rot.add(art);
    art.add(mesh(extrude(W.shape[0].p, 0.45, 0.08), M.paint, track));            // painted blade
    art.add(mesh(extrude(W.shape[1].p, 0.32, 0.04), M.metal, track));            // honed edge
    art.add(mesh(extrude(rounded(-8.9, -1.45, 0.2, 1.45, 0.9, 3), 1.8, 0.45), M.grip, track)); // handle
    art.add(mesh(extrude(rounded(-0.6, -1.95, 0.4, 1.95, 0.3, 2), 2.0, 0.2), M.dark, track));  // guard
    var ring = mesh(new THREE.TorusGeometry(1.82, 0.5, 10, 28), M.dark, track); ring.position.set(-11.2, 0, 0); art.add(ring);
    var ringBoss = mesh(extrude(rounded(-10, -1.0, -8.6, 1.0, 0.3, 2), 1.5, 0.3), M.dark, track); art.add(ringBoss);
    body.add(mirror);
    // spin pivot at the ring centre (knife space (0, 11.2 cm)) — the index finger
    var pivot = new THREE.Group(); pivot.position.set(0, 0.112, 0);
    body.position.set(0, -0.112, 0); pivot.add(body);
    var orient = new THREE.Group(); orient.rotation.y = Math.PI / 2; orient.add(pivot);
    orient.position.set(0, -0.09, 0); // fist around the handle; ring above the fist
    rig.pivot = pivot; rig.orient = orient;
    return rig;
  }

  /* ================================================================== */
  /* controller                                                          */
  /* ================================================================== */
  /* mats: {paint, dark, metal, grip, glove, sleeve}; geo: {limb, hand}; track(fn) registers for disposal */
  K.buildVm = function (model, mats, geo, track) {
    var pose = new THREE.Group(); pose.rotation.order = 'YXZ';
    var rig = model === 'butterfly' ? buildButterfly(mats, geo, track) : buildKarambit(mats, geo, track);
    pose.add(rig.orient);
    // hand and forearm (the hand stays put while the knife moves inside it)
    var hand = new THREE.Mesh(geo.hand, mats.glove);
    var handBase = model === 'butterfly' ? [0.006, -0.016, 0.06] : [0.0, -0.035, 0.0];
    hand.position.set(handBase[0], handBase[1], handBase[2]);
    // the shared glove is shaped for a vertical grip: turn it for the balisong's horizontal handle
    var handRot = model === 'butterfly' ? [Math.PI / 2, 0, 0.25] : [0, 0, 0];
    hand.rotation.set(handRot[0], handRot[1], handRot[2]);
    hand.scale.setScalar(model === 'butterfly' ? 0.82 : 0.9);
    pose.add(hand);
    var group = new THREE.Group(); group.add(pose);
    // forearm: from a fixed elbow to the wrist, re-aimed every frame so wrist rolls don't swing it around
    var ELBOW = [0.08, -0.3, 0.38], wristLocal = new THREE.Vector3(handBase[0] + 0.004, handBase[1] - 0.012, handBase[2] + 0.045), wrist = new THREE.Vector3();
    var arm = limb(group, geo.limb, mats.sleeve, ELBOW, [wristLocal.x, wristLocal.y, wristLocal.z]);
    function aimArm() {
      pose.updateMatrix();
      wrist.copy(wristLocal).applyMatrix4(pose.matrix);
      var dx = wrist.x - ELBOW[0], dy = wrist.y - ELBOW[1], dz = wrist.z - ELBOW[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      arm.position.set((wrist.x + ELBOW[0]) / 2, (wrist.y + ELBOW[1]) / 2, (wrist.z + ELBOW[2]) / 2);
      arm.rotation.y = Math.atan2(dx, dz); arm.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
      arm.scale.z = len;
    }

    var rest = REST[model], anims = ANIMS[model];
    var cur = Object.assign({}, rest), from = null, blendT = 0, BLEND = 0.12;
    var anim = null, name = 'idle', t = 0, idleT = 0, nextEv = 0;
    var C = {
      model: model, group: group,
      play: function (n) {
        var A = anims[n]; if (!A) return;
        from = n === 'draw' ? null : Object.assign({}, cur);
        blendT = from ? BLEND : 0;
        anim = A; name = n; t = 0; nextEv = 0;
      },
      busy: function () { return !!anim && name !== 'inspect'; },
      name: function () { return name; },
      time: function () { return t; },
      pose: function () { return Object.assign({}, cur); },
      reset: function () { anim = null; name = 'idle'; t = 0; from = null; cur = Object.assign({}, rest); apply(); },
      update: function (dt) {
        dt = Math.min(0.1, Math.max(0, dt || 0));
        idleT += dt;
        var target = Object.assign({}, rest);
        if (anim) {
          t += dt;
          for (var ch in anim.keys) target[ch] = sampleCh(anim.keys[ch], Math.min(t, anim.dur));
          while (nextEv < anim.ev.length && anim.ev[nextEv][0] <= t) { cue(anim.ev[nextEv][1]); nextEv++; }
          if (t >= anim.dur) {
            // finished: angles back into range so the next blend is short
            for (var c2 in ANGLE) if (c2 in target) target[c2] = rest[c2] + wrap180(target[c2] - rest[c2]);
            anim = null; name = 'idle';
          }
        }
        if (!anim) {
          // idle: breathing wrist, the balisong's loose handle and the karambit's finger play
          target.py += Math.sin(idleT * 1.3) * 0.003;
          target.rz += Math.sin(idleT * 0.9) * 0.02;
          target.rx += Math.sin(idleT * 0.7 + 1) * 0.012;
          if (model === 'butterfly') target.ph += Math.sin(idleT * 2.1) * 1.2;
          else target.sp += Math.sin(idleT * 1.7) * 1.5;
        }
        if (from && blendT > 0) {
          blendT -= dt;
          var k = EASE.io(1 - Math.max(0, blendT) / BLEND);
          for (var c in target) {
            var f = from[c] == null ? target[c] : from[c];
            if (ANGLE[c]) f = target[c] + wrap180(f - target[c]);
            target[c] = f + (target[c] - f) * k;
          }
          if (blendT <= 0) from = null;
        }
        cur = target;
        apply();
      }
    };
    function cue(ev) {
      var A = RZ.Audio; if (!A) return;
      if (ev === 'swish') A.knife(null, false);
      else if (ev === 'swishH') A.knife(null, true);
      else if (ev === 'clack') A.clack(0.32, 1.45);
      else if (ev === 'tick') A.clack(0.14, 1.9);
      else if (ev === 'grip') A.clack(0.12, 0.85);
    }
    function apply() {
      pose.position.set(cur.px, cur.py, cur.pz);
      pose.rotation.set(cur.rx, cur.ry, cur.rz);
      aimArm();
      if (model === 'butterfly') {
        rig.blade.rotation.z = cur.th * D2R;
        rig.hingeB.rotation.z = (cur.ph - 180 - cur.th) * D2R;
      } else {
        rig.pivot.rotation.z = -cur.sp * D2R;
        // the fist opens and drops back a little while the knife spins on the finger
        hand.position.set(handBase[0], handBase[1] - 0.03 * cur.ho, handBase[2] + 0.035 * cur.ho);
        hand.rotation.x = handRot[0] + 0.6 * cur.ho;
      }
    }
    C.update(0);
    return C;
  };

  /* is a pose finite (no NaN transforms)? */
  K.finite = function (p) { for (var k in p) if (!isFinite(p[k])) return false; return true; };
})();
