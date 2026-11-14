/* Рубеж — smoother models. Loaded after actors.js; replaces the boxy fighter, the weapon
   extrusion and supplies first-person arm/hand geometry. The skeleton (group names, joint
   positions) is unchanged, so Actors.animate, hit boxes and the AI keep working as before.
   Each rigid body part is ONE merged mesh with vertex colours, so a fighter costs about as
   many draw calls as the old box model. Forward is -z, units are metres. */
(function () {
  'use strict';
  var RZ = window.RZ, Act = RZ.Actors, Mo = (RZ.Models = {});
  var PI = Math.PI;

  /* ------------------------------------------------------------------ */
  /* geometry helpers                                                    */
  /* ------------------------------------------------------------------ */
  var _mat = new THREE.Matrix4(), _pos = new THREE.Vector3(), _quat = new THREE.Quaternion(),
      _scl = new THREE.Vector3(), _eul = new THREE.Euler(), _col = new THREE.Color(), _v = new THREE.Vector3();

  /* part: { g, c: '#hex', p: [x,y,z], r: [x,y,z], s: [x,y,z] | number } → one non-indexed geometry */
  function merge(parts) {
    var list = [], total = 0;
    parts.forEach(function (p) {
      var g = p.g;
      if (g.index) { var n = g.toNonIndexed(); g.dispose(); g = n; }
      var s = p.s == null ? [1, 1, 1] : typeof p.s === 'number' ? [p.s, p.s, p.s] : p.s;
      _pos.fromArray(p.p || [0, 0, 0]); _scl.fromArray(s);
      _eul.set(p.r ? p.r[0] : 0, p.r ? p.r[1] : 0, p.r ? p.r[2] : 0); _quat.setFromEuler(_eul);
      g.applyMatrix4(_mat.compose(_pos, _quat, _scl));
      list.push({ g: g, c: p.c || '#888888' });
      total += g.attributes.position.count;
    });
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), off = 0;
    list.forEach(function (e) {
      var a = e.g.attributes, n = a.position.count;
      pos.set(a.position.array, off * 3); nor.set(a.normal.array, off * 3);
      _col.set(e.c);
      for (var i = 0; i < n; i++) { col[(off + i) * 3] = _col.r; col[(off + i) * 3 + 1] = _col.g; col[(off + i) * 3 + 2] = _col.b; }
      off += n; e.g.dispose();
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
  function cyl(rTop, rBot, h, seg) { return new THREE.CylinderGeometry(rTop, rBot, h, Math.min(seg || 10, 12), 1); }
  function sph(r, w, h) { return new THREE.SphereGeometry(r, Math.min(w || 10, 12), Math.min(h || 6, 8)); }
  function dome(r, frac, w, h) { return new THREE.SphereGeometry(r, Math.min(w || 12, 14), Math.min(h || 5, 5), 0, PI * 2, 0, PI * frac); }
  function lathe(pts, seg) {
    return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), Math.min(seg || 14, 14));
  }
  /* box with rounded edges, centred on the origin */
  function rbox(w, h, d, r) {
    r = Math.min(r || 0.012, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    var x = w / 2 - r, y = h / 2 - r, sh = new THREE.Shape();
    sh.moveTo(-x, -y); sh.lineTo(x, -y); sh.lineTo(x, y); sh.lineTo(-x, y); sh.closePath();
    var g = new THREE.ExtrudeGeometry(sh, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return g;
  }

  /* ------------------------------------------------------------------ */
  /* fighter                                                             */
  /* ------------------------------------------------------------------ */
  var TEAM = [
    { vest: '#3e6388', vestDark: '#2c4863', shirt: '#2f3e4b', helmet: '#34495c', pack: '#28394a' },
    { vest: '#c9562a', vestDark: '#97401f', shirt: '#5a3427', helmet: '#74391f', pack: '#4a2b20' }
  ];
  var C = { pants: '#4d4c42', pantsDark: '#3b3a33', skin: '#c79d7a', boot: '#1f2020', sole: '#111212', strap: '#23262a', visor: '#12151a', glass: '#2c3b47', glove: '#26282b' };

  function torsoGeo(t) {
    var parts = [
      // pelvis and belt
      { g: sph(0.17, 14, 8), c: C.pants, p: [0, 0.0, 0], s: [1.12, 0.66, 0.8] },
      { g: cyl(0.186, 0.186, 0.06, 18), c: C.strap, p: [0, 0.075, 0], s: [1.06, 1, 0.7] },
      // shirt body, then the vest shell over it
      { g: lathe([[0, 0], [0.165, 0], [0.18, 0.1], [0.195, 0.3], [0.2, 0.42], [0.185, 0.5], [0.1, 0.565], [0, 0.565]], 18), c: t.shirt, s: [1.06, 1, 0.66] },
      { g: lathe([[0.17, 0.1], [0.205, 0.13], [0.222, 0.24], [0.23, 0.38], [0.22, 0.46], [0.19, 0.515], [0.13, 0.545], [0.07, 0.55]], 18), c: t.vest, s: [1.06, 1, 0.72] },
      // front plate, three pouches, radio, back panel
      { g: rbox(0.27, 0.19, 0.05, 0.02), c: t.vestDark, p: [0, 0.385, -0.152] },
      { g: rbox(0.082, 0.1, 0.055, 0.016), c: t.shirt, p: [-0.095, 0.215, -0.166] },
      { g: rbox(0.082, 0.1, 0.055, 0.016), c: t.shirt, p: [0, 0.215, -0.172] },
      { g: rbox(0.082, 0.1, 0.055, 0.016), c: t.shirt, p: [0.095, 0.215, -0.166] },
      { g: rbox(0.05, 0.085, 0.04, 0.012), c: C.strap, p: [-0.135, 0.43, -0.14], r: [0, 0.35, 0] },
      { g: cyl(0.006, 0.006, 0.1, 6), c: C.strap, p: [-0.15, 0.51, -0.13] },
      { g: rbox(0.29, 0.3, 0.08, 0.03), c: t.pack, p: [0, 0.33, 0.16] },
      // shoulder straps and neck
      { g: rbox(0.07, 0.03, 0.26, 0.012), c: t.vestDark, p: [-0.115, 0.54, 0.0] },
      { g: rbox(0.07, 0.03, 0.26, 0.012), c: t.vestDark, p: [0.115, 0.54, 0.0] },
      { g: cyl(0.05, 0.06, 0.1, 12), c: C.skin, p: [0, 0.585, 0.005] }
    ];
    return merge(parts);
  }
  function headGeo(t) {
    return merge([
      { g: sph(0.112, 16, 12), c: C.skin, p: [0, 0.135, 0], s: [0.94, 1.1, 1.0] },
      // balaclava over jaw and neck, cap on top
      { g: new THREE.SphereGeometry(0.117, 16, 6, 0, PI * 2, PI * 0.56, PI * 0.44), c: t.shirt, p: [0, 0.135, 0], s: [0.95, 1.1, 1.0] },
      { g: dome(0.118, 0.42, 16, 5), c: t.shirt, p: [0, 0.145, 0], s: [0.96, 1.05, 1.02] },
      // goggles: strap all round, lens band at the front (-z)
      { g: cyl(0.1135, 0.1135, 0.022, 18), c: C.strap, p: [0, 0.14, 0], s: [0.95, 1, 1.0] },
      { g: new THREE.CylinderGeometry(0.119, 0.119, 0.052, 12, 1, false, PI - 0.95, 1.9), c: C.visor, p: [0, 0.14, 0], s: [0.95, 1, 1.0] },
      { g: sph(0.022, 8, 6), c: t.shirt, p: [0, 0.1, -0.106], s: [0.8, 1.1, 1] }
    ]);
  }
  function helmetGeo(t) {
    return merge([
      { g: dome(0.14, 0.53, 18, 7), c: t.helmet, p: [0, 0.178, 0.004], s: [1.0, 1.0, 1.1] },
      { g: cyl(0.143, 0.14, 0.022, 18), c: t.helmet, p: [0, 0.166, 0.004], s: [1.0, 1, 1.1] },
      { g: sph(0.05, 8, 6), c: t.helmet, p: [-0.118, 0.14, 0.012], s: [0.45, 1.1, 1.0] },
      { g: sph(0.05, 8, 6), c: t.helmet, p: [0.118, 0.14, 0.012], s: [0.45, 1.1, 1.0] },
      { g: rbox(0.05, 0.03, 0.03, 0.008), c: C.strap, p: [0, 0.28, -0.09], r: [-0.6, 0, 0] }
    ]);
  }
  function thighGeo() {
    return merge([
      { g: sph(0.096, 12, 8), c: C.pants, p: [0, -0.01, 0] },
      { g: cyl(0.094, 0.073, 0.44, 12), c: C.pants, p: [0, -0.23, 0] },
      { g: rbox(0.07, 0.11, 0.05, 0.014), c: C.pantsDark, p: [0, -0.2, -0.085] } // cargo pocket
    ]);
  }
  function shinGeo() {
    return merge([
      { g: sph(0.078, 12, 8), c: C.pantsDark, p: [0, 0, -0.012], s: [1, 1.05, 1.1] },   // knee pad
      { g: cyl(0.07, 0.054, 0.34, 12), c: C.pants, p: [0, -0.18, 0] },
      { g: cyl(0.058, 0.064, 0.13, 12), c: C.boot, p: [0, -0.37, 0] },                   // boot shaft
      { g: sph(0.07, 12, 8), c: C.boot, p: [0, -0.418, -0.055], s: [0.92, 0.66, 1.8] }, // foot
      { g: rbox(0.118, 0.02, 0.238, 0.008), c: C.sole, p: [0, -0.452, -0.055] }
    ]);
  }
  /* arm segments are 0.3 m long along +z; Actors.limb() scales z to the real length */
  function armSegGeo(rA, rB, color) {
    var g = cyl(rB, rA, 0.3, 12); g.rotateX(PI / 2);
    return merge([{ g: g, c: color }]);
  }
  var ELBOW = { 1: [0.02, -0.26, -0.08], '-1': [0.04, -0.24, -0.16] }; // relative to the shoulder group
  function jointsGeo(t, side) {
    var e = ELBOW[side];
    return merge([
      { g: sph(0.07, 12, 8), c: t.vest, p: [0, 0.005, 0], s: [1.05, 0.95, 1.05] },
      { g: sph(0.052, 10, 7), c: t.shirt, p: e },
      { g: sph(0.056, 10, 6), c: C.strap, p: [e[0], e[1] - 0.004, e[2] + 0.012], s: [0.9, 0.8, 0.8] }
    ]);
  }
  function handGeo() {
    var parts = [{ g: sph(0.043, 10, 8), c: C.glove, s: [0.9, 1.0, 1.2] }];
    for (var i = 0; i < 4; i++) parts.push({ g: sph(0.015, 6, 5), c: C.glove, p: [-0.024 + i * 0.016, -0.012, 0.05], s: [1, 1.2, 1.5] });
    parts.push({ g: sph(0.016, 6, 5), c: C.glove, p: [0.036, 0.012, 0.03], s: [1, 1, 1.6] });
    return merge(parts);
  }

  var lib = null, sharedRef = null;
  var origInit = Act.initShared, origDispose = Act.disposeShared, origSetWeapon = Act.setModelWeapon;
  Act.initShared = function (track) {
    sharedRef = origInit(track);
    lib = { mat: track(new THREE.MeshLambertMaterial({ vertexColors: true })), team: [] };
    TEAM.forEach(function (t) {
      lib.team.push({
        torso: track(torsoGeo(t)), head: track(headGeo(t)), helmet: track(helmetGeo(t)),
        up: track(armSegGeo(0.06, 0.05, t.shirt)), fo: track(armSegGeo(0.048, 0.039, t.shirt)),
        jointsR: track(jointsGeo(t, 1)), jointsL: track(jointsGeo(t, -1))
      });
    });
    lib.thigh = track(thighGeo()); lib.shin = track(shinGeo()); lib.hand = track(handGeo());
    return sharedRef;
  };
  Act.disposeShared = function () { lib = null; sharedRef = null; origDispose(); };

  Act.buildModel = function (team) {
    var T = lib.team[team], mat = lib.mat;
    function mesh(geo) { var o = new THREE.Mesh(geo, mat); o.castShadow = true; return o; }
    var root = new THREE.Group(); root.rotation.order = 'YXZ';
    var hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
    var legs = [];
    [-0.11, 0.11].forEach(function (x) {
      var hip = new THREE.Group(); hip.position.set(x, 0, 0); hips.add(hip);
      hip.add(mesh(lib.thigh));
      var knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
      knee.add(mesh(lib.shin));
      legs.push({ hip: hip, knee: knee });
    });
    var torso = new THREE.Group(); hips.add(torso);
    torso.add(mesh(T.torso));
    var neck = new THREE.Group(); neck.position.y = 0.56; torso.add(neck);
    neck.add(mesh(T.head));
    var helmet = mesh(T.helmet); neck.add(helmet);
    var aim = new THREE.Group(); aim.position.y = 0.44; torso.add(aim);
    function arm(side) {
      var sh = new THREE.Group(); sh.position.set(side * 0.24, 0, 0); aim.add(sh);
      sh.add(mesh(side > 0 ? T.jointsR : T.jointsL));
      var up = mesh(T.up); sh.add(up);
      var fo = mesh(T.fo); sh.add(fo);
      var hand = mesh(lib.hand); sh.add(hand);
      return { sh: sh, up: up, fo: fo, hand: hand };
    }
    var armR = arm(1), armL = arm(-1);
    var mount = new THREE.Group(); mount.position.set(0.1, -0.06, -0.3); aim.add(mount);
    var gun = new THREE.Mesh(Act.getWeaponGeo('osa'), sharedRef.m.gun); gun.castShadow = true; mount.add(gun);
    var model = { root: root, hips: hips, legs: legs, torso: torso, neck: neck, helmet: helmet, aim: aim, armR: armR, armL: armL, mount: mount, gun: gun, gunId: null };
    Act.setModelWeapon(model, 'osa');
    return model;
  };

  /* hands sit at the far end of each forearm, wherever the weapon pose put it */
  function placeHands(model) {
    [model.armR, model.armL].forEach(function (a) {
      if (!a || !a.hand) return;
      _v.set(0, 0, 1).applyEuler(a.fo.rotation).multiplyScalar(a.fo.scale.z * 0.15 + 0.02);
      a.hand.position.copy(a.fo.position).add(_v);
      a.hand.rotation.copy(a.fo.rotation);
    });
  }
  Act.setModelWeapon = function (model, wid) {
    var changed = model.gunId !== wid;
    origSetWeapon(model, wid);
    if (changed) placeHands(model);
  };

  /* ------------------------------------------------------------------ */
  /* weapons: same side-view shapes, but with rounded outlines and a     */
  /* rounded cross-section instead of flat slabs                         */
  /* ------------------------------------------------------------------ */
  var MI = { paint: 0, dark: 1, metal: 2, grip: 3 };
  function roundedShape(pts, rad) {
    // drop a duplicated closing point, then cut every corner with a quadratic curve
    var p = pts.slice(), n = p.length;
    if (n > 2 && p[0][0] === p[n - 1][0] && p[0][1] === p[n - 1][1]) { p.pop(); n--; }
    var sh = new THREE.Shape();
    for (var i = 0; i < n; i++) {
      var a = p[(i + n - 1) % n], b = p[i], c = p[(i + 1) % n];
      var l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      var r = Math.min(rad, l1 * 0.34, l2 * 0.34);
      var ax = b[0] + (a[0] - b[0]) / (l1 || 1) * r, ay = b[1] + (a[1] - b[1]) / (l1 || 1) * r;
      var cx = b[0] + (c[0] - b[0]) / (l2 || 1) * r, cy = b[1] + (c[1] - b[1]) / (l2 || 1) * r;
      if (i === 0) sh.moveTo(ax, ay); else sh.lineTo(ax, ay);
      sh.quadraticCurveTo(b[0], b[1], cx, cy);
    }
    sh.closePath();
    return sh;
  }
  Act.weaponGeometry = function (id) {
    var W = RZ.WEAPONS[id], parts = [];
    W.shape.forEach(function (part) {
      var g;
      if (part.c) {
        var c = part.c, len = c[1] - c[0];
        g = new THREE.CylinderGeometry(c[3], c[3], len, 18, 1);
        g.rotateZ(PI / 2);
        g.translate(c[0] + len / 2, c[2], 0);
      } else {
        var t = part.t || 2, thin = t < 1.6;
        var bev = thin ? t * 0.3 : Math.min(0.9, t * 0.3);
        g = new THREE.ExtrudeGeometry(roundedShape(part.p, thin ? 0.35 : 0.9), {
          depth: t - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: Math.min(bev, 0.6), bevelOffset: -Math.min(bev, 0.6),
          bevelSegments: thin ? 2 : 3, curveSegments: 4
        });
        g.translate(0, 0, -(t - 2 * bev) / 2);
      }
      if (g.index) { var ng = g.toNonIndexed(); g.dispose(); g = ng; }
      parts.push({ g: g, m: MI[part.m] != null ? MI[part.m] : 1 });
    });
    parts.sort(function (a, b) { return a.m - b.m; });
    var total = 0;
    parts.forEach(function (p) { total += p.g.attributes.position.count; });
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    var geo = new THREE.BufferGeometry(), off = 0, gStart = 0, gMat = parts.length ? parts[0].m : 0;
    parts.forEach(function (p, i) {
      var a = p.g.attributes, n = a.position.count;
      if (p.m !== gMat) { geo.addGroup(gStart, off - gStart, gMat); gStart = off; gMat = p.m; }
      pos.set(a.position.array, off * 3); nor.set(a.normal.array, off * 3);
      if (a.uv) uv.set(a.uv.array, off * 2);
      off += n; p.g.dispose();
      if (i === parts.length - 1) geo.addGroup(gStart, off - gStart, gMat);
    });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.scale(0.01, 0.01, 0.01);   // cm → m
    geo.rotateY(PI / 2);           // muzzle from +x to -z
    geo.computeBoundingSphere();
    return geo;
  };

  /* ------------------------------------------------------------------ */
  /* first person: sleeve (1 m long along z, scaled to length) and glove */
  /* ------------------------------------------------------------------ */
  Mo.vmLimbGeo = function () {
    var a = cyl(0.036, 0.046, 1, 16); a.rotateX(PI / 2);       // wrist end at +z
    var cuff = cyl(0.041, 0.041, 0.07, 16); cuff.rotateX(PI / 2);
    return merge([{ g: a }, { g: cuff, p: [0, 0, 0.46] }]);
  };
  Mo.vmHandGeo = function () {
    var parts = [
      { g: sph(0.04, 14, 10), s: [0.86, 1.02, 1.22] },                                // back of the hand
      { g: sph(0.03, 10, 8), p: [0, 0.0, 0.04], s: [0.9, 1.0, 1.0] }                  // wrist
    ];
    for (var i = 0; i < 4; i++) {                                                     // knuckles and curled fingers
      var y = 0.03 - i * 0.02;
      parts.push({ g: sph(0.0125, 8, 6), p: [-0.012, y, -0.04], s: [1.1, 1, 1.3] });
      parts.push({ g: new THREE.CapsuleGeometry(0.0105, 0.03, 3, 8), p: [-0.03, y, -0.03], r: [0, 0, PI / 2] });
    }
    parts.push({ g: new THREE.CapsuleGeometry(0.012, 0.03, 3, 8), p: [0.012, 0.045, -0.022], r: [PI / 2, 0, 0.3] }); // thumb
    return merge(parts);
  };
})();
