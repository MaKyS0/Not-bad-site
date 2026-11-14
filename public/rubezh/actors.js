/* Рубеж — fighters (articulated low-poly models), weapon geometry and bot AI.
   The bot brain only produces inputs (move vector, aim angles, fire/reload flags); the game
   applies the same movement, weapon and damage rules to bots and to the player. */
(function () {
  'use strict';
  var RZ = window.RZ;
  var Act = (RZ.Actors = {});

  /* ================================================================== */
  /* Weapon geometry from the shared side-view shape                     */
  /* ================================================================== */
  /* groups: 0 paint, 1 dark, 2 metal, 3 grip. Units: metres, muzzle along -z, grip at origin. */
  var MI = { paint: 0, dark: 1, metal: 2, grip: 3 };
  Act.weaponGeometry = function (id) {
    var W = RZ.WEAPONS[id], parts = [];
    W.shape.forEach(function (part) {
      var g;
      if (part.c) {
        var c = part.c, len = c[1] - c[0];
        g = new THREE.CylinderGeometry(c[3], c[3], len, 10, 1);
        g.rotateZ(Math.PI / 2);
        g.translate(c[0] + len / 2, c[2], 0);
      } else {
        var sh = new THREE.Shape();
        part.p.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); });
        var t = part.t || 2;
        g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: Math.min(0.3, t * 0.12), bevelSize: 0.18, bevelSegments: 1, curveSegments: 4 });
        g.translate(0, 0, -t / 2);
      }
      if (g.index) { var ng = g.toNonIndexed(); g.dispose(); g = ng; }
      parts.push({ g: g, m: MI[part.m] != null ? MI[part.m] : 1 });
    });
    // merge into one non-indexed geometry with material groups
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
      off += n;
      p.g.dispose();
      if (i === parts.length - 1) geo.addGroup(gStart, off - gStart, gMat);
    });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // cm → m, muzzle from +x to -z
    geo.scale(0.01, 0.01, 0.01);
    geo.rotateY(Math.PI / 2);
    geo.computeBoundingSphere();
    return geo;
  };
  /* muzzle point in weapon-local metres (after rotation): returns [x,y,z] */
  Act.muzzle = function (id) {
    var b = RZ.Art.shapeBounds(RZ.WEAPONS[id].shape), y = 0;
    RZ.WEAPONS[id].shape.forEach(function (p) { if (p.c && p.c[1] >= b[2] - 0.5) y = p.c[2]; });
    if (!y) y = (b[1] + b[3]) / 2 + 2;
    return [0, y * 0.01, -b[2] * 0.01];
  };

  /* ================================================================== */
  /* Fighter model                                                      */
  /* ================================================================== */
  var shared = null;
  Act.initShared = function (track) {
    function box(w, h, d, ty) { var g = track(new THREE.BoxGeometry(w, h, d)); if (ty) g.translate(0, ty, 0); return g; }
    function lam(c) { return track(new THREE.MeshLambertMaterial({ color: c })); }
    shared = {
      track: track,
      g: {
        torso: box(0.44, 0.52, 0.26, 0.27), belt: box(0.4, 0.09, 0.24, 0.02), head: box(0.22, 0.25, 0.24, 0.13),
        helmet: box(0.26, 0.13, 0.28, 0.06), visor: box(0.2, 0.05, 0.04, 0),
        thigh: box(0.16, 0.46, 0.18, -0.23), shin: box(0.14, 0.44, 0.15, -0.22), boot: box(0.15, 0.09, 0.27, -0.045),
        upper: box(0.11, 0.11, 0.3, 0), fore: box(0.1, 0.1, 0.3, 0), pouch: box(0.36, 0.14, 0.08, 0)
      },
      m: {
        vest0: lam('#3e5d79'), vest1: lam('#c4552a'), shirt0: lam('#2f3e4b'), shirt1: lam('#5c3326'), pants: lam('#4b4a40'),
        skin: lam('#c39b77'), boot: lam('#222322'), helmet0: lam('#36495a'), helmet1: lam('#6e3a22'), gun: lam('#2f3133'), visor: lam('#151719')
      },
      wgeo: {}
    };
    return shared;
  };
  Act.disposeShared = function () { shared = null; };
  Act.getWeaponGeo = function (id) {
    if (!shared.wgeo[id]) shared.wgeo[id] = shared.track(Act.weaponGeometry(id));
    return shared.wgeo[id];
  };

  Act.buildModel = function (team) {
    var g = shared.g, m = shared.m, vest = m['vest' + team], shirt = m['shirt' + team];
    function mesh(geo, mat) { var o = new THREE.Mesh(geo, mat); o.castShadow = true; return o; }
    var root = new THREE.Group(); root.rotation.order = 'YXZ';
    var hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
    var legs = [];
    [-0.11, 0.11].forEach(function (x) {
      var hip = new THREE.Group(); hip.position.set(x, 0, 0); hips.add(hip);
      hip.add(mesh(g.thigh, m.pants));
      var knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
      knee.add(mesh(g.shin, m.pants));
      var boot = mesh(g.boot, m.boot); boot.position.set(0, -0.44, -0.05); knee.add(boot);
      legs.push({ hip: hip, knee: knee });
    });
    var torso = new THREE.Group(); hips.add(torso);
    torso.add(mesh(g.torso, vest));
    var belt = mesh(g.belt, m.pants); torso.add(belt);
    var pouch = mesh(g.pouch, shirt); pouch.position.set(0, 0.2, -0.16); torso.add(pouch);
    var neck = new THREE.Group(); neck.position.y = 0.56; torso.add(neck);
    var head = mesh(g.head, m.skin); neck.add(head);
    var helmet = mesh(g.helmet, m['helmet' + team]); helmet.position.y = 0.22; neck.add(helmet);
    var visor = mesh(g.visor, m.visor); visor.position.set(0, 0.16, -0.12); neck.add(visor);
    // aim group at shoulder height: arms + weapon pitch together
    var aim = new THREE.Group(); aim.position.y = 0.44; torso.add(aim);
    function arm(side) {
      var sh = new THREE.Group(); sh.position.set(side * 0.24, 0, 0); aim.add(sh);
      var up = mesh(g.upper, shirt); sh.add(up);
      var fo = mesh(g.fore, shirt); sh.add(fo);
      return { sh: sh, up: up, fo: fo };
    }
    var armR = arm(1), armL = arm(-1);
    var mount = new THREE.Group(); mount.position.set(0.1, -0.06, -0.3); aim.add(mount);
    var gun = new THREE.Mesh(Act.getWeaponGeo('osa'), m.gun); gun.castShadow = true; mount.add(gun);
    var model = { root: root, hips: hips, legs: legs, torso: torso, neck: neck, helmet: helmet, aim: aim, armR: armR, armL: armL, mount: mount, gun: gun, gunId: 'osa' };
    poseArms(model, 'osa');
    return model;
  };

  /* place a limb box between two points in the aim group's space */
  var _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function limb(meshObj, parent, ax, ay, az, bx, by, bz) {
    _a.set(ax, ay, az); _b.set(bx, by, bz);
    meshObj.position.set((ax + bx) / 2 - parent.position.x, (ay + by) / 2 - parent.position.y, (az + bz) / 2 - parent.position.z);
    var len = _a.distanceTo(_b);
    meshObj.scale.set(1, 1, len / 0.3);
    // orient the box's +z along a→b in the parent's space
    var dx = bx - ax, dy = by - ay, dz = bz - az;
    meshObj.rotation.set(0, 0, 0);
    meshObj.rotation.order = 'YXZ';
    meshObj.rotation.y = Math.atan2(dx, dz);
    meshObj.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
  }
  function poseArms(model, wid) {
    var W = RZ.WEAPONS[wid], mp = model.mount.position;
    var grip = [mp.x, mp.y - 0.02, mp.z + 0.02];
    var front = W.hold2 ? [mp.x - 0.02, mp.y - 0.01, mp.z - W.hold2[0] * 0.01] : [mp.x - 0.06, mp.y - 0.04, mp.z + 0.02];
    if (W.kind === 'melee') front = [-0.18, -0.25, -0.05];
    var R = model.armR, L = model.armL;
    var elbowR = [0.26, -0.26, -0.08], elbowL = [-0.2, -0.24, -0.16];
    limb(R.up, R.sh, 0.24, 0, 0, elbowR[0], elbowR[1], elbowR[2]);
    limb(R.fo, R.sh, elbowR[0], elbowR[1], elbowR[2], grip[0], grip[1], grip[2]);
    limb(L.up, L.sh, -0.24, 0, 0, elbowL[0], elbowL[1], elbowL[2]);
    limb(L.fo, L.sh, elbowL[0], elbowL[1], elbowL[2], front[0], front[1], front[2]);
  }
  Act.setModelWeapon = function (model, wid) {
    if (model.gunId === wid) return;
    model.gunId = wid;
    model.gun.geometry = Act.getWeaponGeo(wid);
    if (wid === 'knife') { model.mount.position.set(0.2, -0.22, -0.2); model.gun.rotation.set(-1.2, 0, 0); }
    else { model.mount.position.set(0.1, -0.06, -0.3); model.gun.rotation.set(0, 0, 0); }
    poseArms(model, wid);
  };

  /* per-frame pose from fighter state */
  Act.animate = function (f, dt) {
    var M = f.model; if (!M) return;
    M.root.position.set(f.x, f.y, f.z);
    if (!f.alive) {
      f.deadT += dt;
      var k = Math.min(1, f.deadT / 0.5);
      k = k * k * (3 - 2 * k);
      M.root.rotation.y = f.yaw;
      M.root.rotation.x = -k * 1.42 * f.fallDir;
      M.root.position.y = f.y + k * 0.12;
      M.aim.rotation.x = 0.3 * k;
      return;
    }
    M.root.rotation.x = 0;
    M.root.rotation.y = f.yaw;
    var cr = f.crouchT;
    M.hips.position.y = 0.92 - cr * 0.34;
    var sp = Math.sqrt(f.vx * f.vx + f.vz * f.vz);
    f.animPhase += sp * dt * 2.1;
    var amp = Math.min(1, sp / 4.5) * (0.65 - cr * 0.35);
    var sw = Math.sin(f.animPhase) * amp;
    // legs: crouch folds hips forward and knees back
    for (var i = 0; i < 2; i++) {
      var s = i ? -sw : sw, L = M.legs[i];
      L.hip.rotation.x = s - cr * 1.05;
      L.knee.rotation.x = Math.max(0, -s) * 0.9 + cr * 1.75;
    }
    if (!f.onGround) { M.legs[0].hip.rotation.x -= 0.35; M.legs[0].knee.rotation.x += 0.6; M.legs[1].knee.rotation.x += 0.3; }
    M.torso.rotation.x = -cr * 0.25 - Math.abs(sw) * 0.04;
    M.torso.position.z = cr * 0.06;
    var p = Math.max(-1.1, Math.min(1.1, f.pitch));
    M.aim.rotation.x = p + cr * 0.25;
    M.neck.rotation.x = p * 0.6 + cr * 0.2;
    var kick = f.fireAnim > 0 ? f.fireAnim : 0;
    M.mount.position.z = (f.weaponId() === 'knife' ? -0.2 : -0.3) + kick * 0.04;
    if (f.fireAnim > 0) f.fireAnim -= dt * 8;
    M.helmet.visible = f.helmet;
    Act.setModelWeapon(M, f.weaponId());
  };

  /* ================================================================== */
  /* Bot AI                                                             */
  /* ================================================================== */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
  Act.angDiff = angDiff;
  function yawTo(dx, dz) { return Math.atan2(-dx, -dz); }

  Act.newBrain = function () {
    return {
      path: null, pathI: 0, goal: null, goalKind: '', repathT: 0, lane: null, laneI: 0, holdT: 0, startDelay: 0,
      target: null, reactT: 0, seenT: 0, lastSeen: null, lastSeenT: -99, errY: 0, errP: 0, aimHead: false,
      burstLeft: 0, pauseT: 0, tapT: 0, strafeDir: 1, strafeT: 0, stopShoot: false, crouchFight: false,
      thinkT: Math.random() * 0.15, lastNoise: 0, investigate: null, investT: 0, lookAt: null, cover: null, coverT: 0,
      stuckT: 0, stuckN: 0, lastX: 0, lastZ: 0, unstuckT: 0, unstuckDir: 0, jumpT: 0, sweep: Math.random() * 6, intelT: 0,
      roamT: 0, wantScope: false
    };
  };

  /* called at round start */
  Act.planRound = function (G, f, lane, holdChance) {
    var ai = f.ai;
    var B = Act.newBrain();
    for (var k in B) ai[k] = B[k];
    ai.lane = lane; ai.laneI = 0;
    ai.holdChance = holdChance;
    ai.startDelay = rnd(0, 1.6);
    ai.lastX = f.x; ai.lastZ = f.z;
  };

  /* an enemy perceived this tick */
  function perceive(G, f, D) {
    var ai = f.ai, best = null, bestScore = 1e9, ex = f.x, ey = f.y + f.eyeH(), ez = f.z;
    var fwdYaw = f.yaw;
    for (var i = 0; i < G.fighters.length; i++) {
      var e = G.fighters[i];
      if (!e.alive || e.team === f.team) continue;
      var dx = e.x - ex, dz = e.z - ez, d = Math.sqrt(dx * dx + dz * dz);
      if (d > D.spot) continue;
      var ang = Math.abs(angDiff(yawTo(dx, dz), fwdYaw));
      var tracked = ai.target === e;
      if (!tracked && ang > D.fov / 2 && d > 3.5) continue;
      var head = e.y + e.headY(), chest = e.y + e.chestY();
      var vis = G.world.visible(ex, ey, ez, e.x, head, e.z) || G.world.visible(ex, ey, ez, e.x, chest, e.z);
      if (!vis) continue;
      var score = d * (1 + ang) * (tracked ? 0.6 : 1);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  function setGoal(G, f, x, z, y, kind) {
    var ai = f.ai;
    if (ai.goal && ai.goalKind === kind && Math.abs(ai.goal.x - x) < 0.8 && Math.abs(ai.goal.z - z) < 0.8 && ai.path) return;
    ai.goal = { x: x, y: y == null ? null : y, z: z }; ai.goalKind = kind;
    ai.path = G.world.findPath(f.x, f.z, f.y, x, z, y);
    ai.pathI = ai.path && ai.path.length > 1 ? 1 : 0;
    ai.repathT = 3 + Math.random() * 2;
  }

  /* steer along the current path; returns true while moving */
  function followPath(G, f, dt) {
    var ai = f.ai;
    if (!ai.path || ai.pathI >= ai.path.length) return false;
    ai.repathT -= dt;
    if (ai.repathT <= 0 && ai.goal) { var g = ai.goal; ai.goal = null; setGoal(G, f, g.x, g.z, g.y, ai.goalKind); if (!ai.path) return false; }
    var wp = ai.path[ai.pathI], dx = wp.x - f.x, dz = wp.z - f.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.45 || (d < 1.2 && ai.pathI < ai.path.length - 1 && G.world.lineWalkable(f.x, f.z, ai.path[ai.pathI + 1].x, ai.path[ai.pathI + 1].z))) {
      ai.pathI++;
      if (ai.pathI >= ai.path.length) return false;
      wp = ai.path[ai.pathI]; dx = wp.x - f.x; dz = wp.z - f.z; d = Math.sqrt(dx * dx + dz * dz);
    }
    f.wishX = dx / (d || 1); f.wishZ = dz / (d || 1);
    return true;
  }
  Act.pathDone = function (f) { return !f.ai.path || f.ai.pathI >= f.ai.path.length; };

  /* stuck detection: no progress while wanting to move → repath, hop, sidestep, finally nudge */
  function unstuck(G, f, dt) {
    var ai = f.ai;
    if (ai.unstuckT > 0) {
      ai.unstuckT -= dt;
      var a = ai.unstuckDir;
      f.wishX = Math.cos(a); f.wishZ = Math.sin(a);
      return true;
    }
    ai.stuckT += dt;
    if (ai.stuckT < 0.5) return false;
    var moved = Math.hypot(f.x - ai.lastX, f.z - ai.lastZ);
    ai.lastX = f.x; ai.lastZ = f.z; ai.stuckT = 0;
    var wanting = f.wishX * f.wishX + f.wishZ * f.wishZ > 0.1;
    if (!wanting || moved > 0.25) { ai.stuckN = Math.max(0, ai.stuckN - 1); return false; }
    ai.stuckN++;
    G.stats.stuckEvents++;
    if (ai.stuckN === 2 && ai.goal) { var g = ai.goal; ai.goal = null; setGoal(G, f, g.x, g.z, g.y, ai.goalKind); f.wantJump = true; }
    else if (ai.stuckN === 3 || ai.stuckN === 5) { ai.unstuckT = 0.45; ai.unstuckDir = Math.random() * 6.283; f.wantJump = true; }
    else if (ai.stuckN >= 6) {
      var c = G.world.nearestCell(f.x, f.z, f.y);
      if (c >= 0) { f.x = G.world.cellX(c); f.z = G.world.cellZ(c); f.y = G.world.navH[c] + 0.02; f.vx = f.vz = 0; }
      ai.stuckN = 0; G.stats.unstuckTeleports++;
      if (ai.goal) { var g2 = ai.goal; ai.goal = null; setGoal(G, f, g2.x, g2.z, g2.y, ai.goalKind); }
    }
    return false;
  }

  /* proportional aim with a speed cap; gain sets how tightly the bot follows its intended aim */
  function turnTo(f, yaw, pitch, rate, dt, gain) {
    var g = gain || 14, dy = angDiff(yaw, f.yaw), mx = rate * dt;
    var step = Math.max(-mx, Math.min(mx, dy * Math.min(1, dt * g)));
    if (Math.abs(dy) < mx * 0.5) step = dy * Math.min(1, dt * g * 1.3);
    f.yaw += step;
    var dp = pitch - f.pitch;
    f.pitch += Math.max(-mx, Math.min(mx, dp * Math.min(1, dt * g)));
  }

  /* pick a spot near the bot that the threat cannot see */
  function findCover(G, f, threat) {
    var tx = threat.x, ty = threat.y + threat.eyeH(), tz = threat.z, best = null, bd = 1e9;
    for (var r = 2.5; r <= 7.5; r += 2.5) {
      for (var k = 0; k < 10; k++) {
        var a = (k / 10) * Math.PI * 2 + r, x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
        var c = G.world.cellOf(x, z);
        if (!G.world.cellWalkable(c) || Math.abs(G.world.navH[c] - f.y) > 0.7) continue;
        x = G.world.cellX(c); z = G.world.cellZ(c);
        if (!G.world.lineWalkable(f.x, f.z, x, z)) continue;
        var y = G.world.navH[c] + 1.2;
        if (G.world.visible(tx, ty, tz, x, y, z)) continue;
        // prefer away from the threat
        var away = Math.hypot(x - tx, z - tz) - Math.hypot(f.x - tx, f.z - tz);
        var score = r - away * 0.5;
        if (score < bd) { bd = score; best = { x: x, z: z, y: G.world.navH[c] }; }
      }
      if (best) break;
    }
    return best;
  }

  /* noises (shots, footsteps) and damage alert the bot */
  Act.hear = function (G, f, n) {
    var ai = f.ai;
    if (ai.target) return;
    ai.investigate = { x: n.x + rnd(-1.5, 1.5), z: n.z + rnd(-1.5, 1.5), y: null };
    ai.investT = G.time;
    ai.lookAt = { x: n.x, y: n.y, z: n.z };
  };
  Act.damaged = function (G, f, attacker) {
    var ai = f.ai;
    if (!ai || ai.target === attacker) return;
    ai.lookAt = { x: attacker.x, y: attacker.y + 1.4, z: attacker.z };
    if (!ai.target) { ai.investigate = { x: attacker.x, z: attacker.z, y: null }; ai.investT = G.time; }
    ai.thinkT = Math.min(ai.thinkT, 0.05);
  };

  /* main per-tick brain */
  Act.think = function (G, f, dt) {
    var ai = f.ai, D = G.diff, W = f.weapon(), def = W.def;
    f.wishX = 0; f.wishZ = 0; f.wantWalk = false; f.wantCrouch = false; f.wantFire = false; f.wantAlt = false; f.wantReload = false;
    if (G.phase === 'freeze') {
      ai.sweep += dt * 0.6;
      turnTo(f, f.spawnYaw + Math.sin(ai.sweep) * 0.5, 0, 2, dt);
      return;
    }
    if (G.phase !== 'live') return;
    if (ai.startDelay > 0) { ai.startDelay -= dt; }

    // ---------- perception ----------
    ai.thinkT -= dt;
    if (ai.thinkT <= 0) {
      ai.thinkT = 0.12 + Math.random() * 0.08;
      var seen = perceive(G, f, D);
      if (seen) {
        if (ai.target !== seen) {
          var dist0 = Math.hypot(seen.x - f.x, seen.z - f.z);
          var facing = Math.abs(angDiff(yawTo(seen.x - f.x, seen.z - f.z), f.yaw));
          ai.target = seen;
          ai.reactT = rnd(D.react[0], D.react[1]) * (facing > 0.6 ? 1.35 : 1) * (G.time - ai.lastSeenT < 1.5 ? 0.5 : 1);
          ai.seenT = G.time;
          var e0 = D.err0 * rnd(0.6, 1.25) * (1 + Math.min(1, facing));
          var a = Math.random() * 6.283;
          ai.errY = Math.cos(a) * e0; ai.errP = Math.sin(a) * e0 * 0.6;
          ai.aimHead = Math.random() < D.head;
          ai.burstLeft = 0; ai.pauseT = 0;
          ai.stopShoot = Math.random() < D.stopToShoot || dist0 > 22;
          ai.crouchFight = dist0 > 14 && Math.random() < D.crouch;
          ai.strafeDir = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rnd(0.3, 0.8);
        }
        ai.lastSeen = { x: seen.x, y: seen.y, z: seen.z }; ai.lastSeenT = G.time;
        G.shareIntel(f, seen);
      } else if (ai.target && (!ai.target.alive || G.time - ai.lastSeenT > 0.35)) {
        var lostAlive = ai.target.alive;
        ai.target = null;
        if (lostAlive && ai.lastSeen) { ai.investigate = { x: ai.lastSeen.x, z: ai.lastSeen.z, y: ai.lastSeen.y }; ai.investT = G.time; }
      }
      // hearing
      if (!ai.target) {
        for (var ni = 0; ni < G.noises.length; ni++) {
          var n = G.noises[ni];
          if (n.t <= ai.lastNoise || n.team === f.team) continue;
          var nd = Math.hypot(n.x - f.x, n.z - f.z);
          if (nd < n.r * D.hearing) Act.hear(G, f, n);
        }
        if (G.noises.length) ai.lastNoise = G.noises[G.noises.length - 1].t;
      }
    }

    // ---------- reload / weapon housekeeping ----------
    var best = bestSlot(f);
    if (f.slot !== best && (!hasAmmo(W) || (!ai.target && G.time - ai.lastSeenT > 1.5))) { G.switchSlot(f, best); W = f.weapon(); def = W.def; }
    if (def.kind === 'gun' && (W.mag === 0 || (!ai.target && W.mag < def.mag * 0.45 && G.time - ai.lastSeenT > 2)) && W.reserve > 0) f.wantReload = true;

    var t = ai.target;
    if (t && t.alive) { combat(G, f, t, dt, D); return; }
    ai.wantScope = false;

    // ---------- navigation when not fighting ----------
    if (ai.cover && G.time < ai.coverT) {
      setGoal(G, f, ai.cover.x, ai.cover.z, ai.cover.y, 'cover');
      followPath(G, f, dt);
      lookAround(G, f, dt, D);
      return;
    }
    ai.cover = null;
    if (ai.startDelay > 0) { lookAround(G, f, dt, D); return; }

    if (ai.investigate && G.time - ai.investT < 9) {
      setGoal(G, f, ai.investigate.x, ai.investigate.z, ai.investigate.y, 'invest');
      if (!followPath(G, f, dt) || Math.hypot(f.x - ai.investigate.x, f.z - ai.investigate.z) < 1.5) ai.investigate = null;
      f.wantWalk = D.hearing > 1 && !!ai.goal && Math.hypot(f.x - ai.goal.x, f.z - ai.goal.z) < 8;
    } else if (ai.holdT > 0) {
      ai.holdT -= dt;
    } else if (ai.lane && ai.laneI < ai.lane.length) {
      var lp = ai.lane[ai.laneI];
      setGoal(G, f, lp[0], lp[1], null, 'lane' + ai.laneI);
      var dl = Math.hypot(f.x - lp[0], f.z - lp[1]);
      if (!followPath(G, f, dt) || dl < 2) {
        ai.laneI++;
        if (Math.random() < ai.holdChance && ai.laneI < ai.lane.length) { ai.holdT = rnd(2, 7); ai.holdYaw = f.yaw; }
      }
    } else {
      // hunt: late round intel or roam the enemy half
      ai.roamT -= dt;
      var intel = G.bestIntel(f);
      if (intel) setGoal(G, f, intel.x, intel.z, null, 'intel');
      else if (ai.roamT <= 0 || Act.pathDone(f)) {
        var p = G.roamPoint(f);
        setGoal(G, f, p.x, p.z, p.y, 'roam' + Math.random());
        ai.roamT = rnd(6, 12);
      }
      followPath(G, f, dt);
    }
    unstuck(G, f, dt);
    lookAround(G, f, dt, D);
  };

  function lookAround(G, f, dt, D) {
    var ai = f.ai, yaw, pitch = 0;
    if (ai.lookAt && G.time - ai.investT < 4) {
      yaw = yawTo(ai.lookAt.x - f.x, ai.lookAt.z - f.z);
      pitch = Math.atan2(ai.lookAt.y - (f.y + f.eyeH()), Math.hypot(ai.lookAt.x - f.x, ai.lookAt.z - f.z)) * 0.5;
    } else if (ai.holdT > 0) {
      ai.sweep += dt * 0.8;
      var next = ai.lane && ai.lane[Math.min(ai.laneI, ai.lane.length - 1)];
      yaw = (next ? yawTo(next[0] - f.x, next[1] - f.z) : ai.holdYaw) + Math.sin(ai.sweep) * 0.55;
    } else if (f.wishX || f.wishZ) {
      ai.sweep += dt;
      yaw = yawTo(f.wishX, f.wishZ) + Math.sin(ai.sweep * 0.9) * 0.35;
    } else yaw = f.yaw;
    turnTo(f, yaw, pitch, D.aimSpeed * 0.45, dt);
  }

  function hasAmmo(w) { return w && (w.def.kind === 'melee' || w.mag + w.reserve > 0); }
  function bestSlot(f) {
    if (f.weapons[1] && hasAmmo(f.weapons[1])) return 1;
    if (f.weapons[2] && hasAmmo(f.weapons[2])) return 2;
    return 3;
  }
  /* distance at which a weapon is still worth firing (beyond ×1.6 bots close in instead) */
  var EFF = { osa: 20, shmel: 28, shershen: 22, taran: 11, grom: 48, vihr: 42, igla: 120, knife: 1.8 };

  function combat(G, f, t, dt, D) {
    var ai = f.ai, W = f.weapon(), def = W.def;
    var ex = f.x, ey = f.y + f.eyeH(), ez = f.z;
    var aimY = t.y + (ai.aimHead ? t.headY() : t.chestY() - 0.05);
    var dx = t.x - ex, dz = t.z - ez, dh = Math.sqrt(dx * dx + dz * dz), dist = Math.sqrt(dh * dh + (aimY - ey) * (aimY - ey));
    // close-range: pistol is faster than a reload
    if (f.slot === 1 && W.mag === 0 && dist < 12 && f.weapons[2] && f.weapons[2].mag > 0) { G.switchSlot(f, 2); W = f.weapon(); def = W.def; }
    // aim error: initial flick error that converges, plus a slowly wandering residual and tracking lag
    var since = G.time - ai.seenT;
    var decay = Math.exp(-since / D.converge);
    var tvPerp = (t.vx * dz - t.vz * dx) / (dh || 1);
    var lag = Math.max(-0.06, Math.min(0.06, tvPerp / Math.max(4, dist) * 0.1 * D.track));
    ai.jY = Math.max(-1.4, Math.min(1.4, (ai.jY || 0) + (Math.random() - 0.5) * dt * 9));
    ai.jP = Math.max(-1.4, Math.min(1.4, (ai.jP || 0) + (Math.random() - 0.5) * dt * 9));
    var eY = ai.errY * decay + ai.jY * D.errFloor - lag, eP = ai.errP * decay + ai.jP * D.errFloor * 0.7;
    // feed-forward of the target's angular velocity hides part of the smoothing lag (skill-dependent)
    var omega = tvPerp / Math.max(1, dh);
    var wantYaw = yawTo(dx, dz) + eY + omega * D.ff / D.gain, wantPitch = Math.atan2(aimY - ey, dh) + eP;
    // recoil compensation happens in the fire code (bots counter a fraction of the pattern)
    turnTo(f, wantYaw, wantPitch, D.aimSpeed, dt, D.gain);
    var aimErr = Math.abs(angDiff(wantYaw, f.yaw)) + Math.abs(wantPitch - f.pitch);
    var reacted = G.time - ai.seenT >= ai.reactT;

    // ---------- reload / cover ----------
    var mustReload = def.kind === 'gun' && W.mag === 0 && W.reserve > 0;
    var lowHp = D.retreatHp && f.hp < D.retreatHp && t.hp > f.hp + 10 && dist > 6;
    if ((mustReload || lowHp) && !ai.cover) {
      var cv = findCover(G, f, t);
      if (cv) { ai.cover = cv; ai.coverT = G.time + (mustReload ? def.reload + 0.6 : 2.5); }
    }
    if (mustReload) f.wantReload = true;
    if (ai.cover && G.time < ai.coverT) {
      setGoal(G, f, ai.cover.x, ai.cover.z, ai.cover.y, 'cover');
      if (followPath(G, f, dt)) { unstuck(G, f, dt); return; }
      ai.cover = null;
    } else ai.cover = null;

    // ---------- movement in a fight ----------
    var eff = EFF[def.id] || 20;
    var rush = def.kind === 'melee' || dist > eff * 1.6 || (def.id === 'taran' && dist > 8);
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) {
      ai.strafeT = rnd(0.3, 0.9) / (0.5 + D.strafe); ai.strafeDir = -ai.strafeDir;
      ai.standShoot = Math.random() < (dist > 10 ? 0.5 + D.stopToShoot * 0.5 : D.stopToShoot * 0.5);
    }
    var shootingNow = reacted && aimErr < 0.08 && ai.pauseT <= 0;
    var sx = -dz / (dh || 1), sz = dx / (dh || 1);
    var speed = Math.sqrt(f.vx * f.vx + f.vz * f.vz);
    if (rush) {
      setGoal(G, f, t.x, t.z, t.y, 'rush');
      followPath(G, f, dt);
      if (def.kind !== 'melee') { f.wishX += sx * ai.strafeDir * 0.35; f.wishZ += sz * ai.strafeDir * 0.35; }
      unstuck(G, f, dt);
    } else if (!(ai.standShoot && shootingNow)) {
      if (Math.random() < D.strafe || dist < 12) {
        var px = f.x + sx * ai.strafeDir * 1.2, pz = f.z + sz * ai.strafeDir * 1.2;
        if (!G.world.lineWalkable(f.x, f.z, px, pz)) ai.strafeDir = -ai.strafeDir;
        f.wishX = sx * ai.strafeDir; f.wishZ = sz * ai.strafeDir;
        f.wantWalk = dist > 18 && D.strafe > 0.5;
      }
    }
    if (ai.crouchFight && shootingNow && !rush) { f.wantCrouch = true; f.wishX = f.wishZ = 0; }

    // ---------- trigger ----------
    if (def.scope) ai.wantScope = reacted && speed < 1.5;
    if (!reacted || W.reloadT > 0 || W.drawT > 0) return;
    if (def.kind === 'melee') { if (dist < 1.9) f.wantFire = true; return; }
    if (dist > eff * 1.6) return;
    // disciplined bots wait for the counter-strafe before a long shot
    if (ai.standShoot && speed > 2.2 && dist > 10 && D.stopToShoot >= 0.6) return;
    var tol = Math.max(0.01, Math.atan(0.25 / Math.max(1, dist))) * 1.5;
    if (aimErr > tol) return;
    if (def.mode === 'auto') {
      if (ai.pauseT > 0) { ai.pauseT -= dt; return; }
      if (ai.burstLeft <= 0) {
        var bl = dist > 28 ? rnd(1, 3) : dist > 16 ? rnd(D.burst[0] * 0.6, D.burst[1] * 0.6) : rnd(D.burst[0], D.burst[1]) * (dist < 8 ? 2 : 1);
        ai.burstLeft = Math.max(1, Math.round(bl));
      }
      f.wantFire = true;
      if (f.shotThisTick) {
        ai.burstLeft--;
        if (ai.burstLeft <= 0) ai.pauseT = rnd(D.pause[0], D.pause[1]) * (dist > 20 ? 1.5 : 1);
      }
    } else {
      ai.tapT -= dt;
      if (ai.tapT <= 0 && G.time >= W.next) {
        if (def.scope && !f.scoped) return;
        f.wantFire = true;
        ai.tapT = D.tapDelay + Math.random() * D.tapDelay + dist * 0.01 + (def.spread && def.spread.sprayMax ? W.spray / def.spread.sprayMax * 0.18 : 0);
      }
    }
  }
})();
