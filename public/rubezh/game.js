/* Рубеж — the match: fighters, movement physics, weapons and damage, rounds and economy,
   first-person camera and view model, HUD, input, and the window.__rubezh debug hook. */
(function () {
  'use strict';
  var RZ = window.RZ, A = RZ.Audio, Act = RZ.Actors, Art = RZ.Art;

  var TICK = 1 / 60, RUN = 6.0, ACC = 62, AIR_ACC = 9, GRAV = 20, JUMP = 6.4, R = 0.3;
  var H_STAND = 1.8, H_CROUCH = 1.25, EYE_STAND = 1.64, EYE_CROUCH = 1.16;
  var FREEZE = 8, ROUND_TIME = 105, POST = 4.5, BUY_WINDOW = 20;

  var Game = (RZ.Game = { active: false });
  var G = null, renderer = null, rendererAA = null, rendererCount = 0, raf = 0;
  var $ = function (id) { return document.getElementById(id); };
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function S() { return RZ.Store.data.settings; }

  /* ================================================================== */
  /* Fighter                                                            */
  /* ================================================================== */
  function newWeapon(id, paint) {
    var def = RZ.WEAPONS[id];
    return { id: id, def: def, mag: def.mag || 0, reserve: def.reserve || 0, next: 0, reloadT: 0, drawT: 0, sprayIdx: 0, lastShot: -9, spray: 0, boltT: 0, paint: paint || null, log: null };
  }
  function Fighter(o) {
    this.id = o.id; this.name = o.name; this.team = o.team; this.isPlayer = !!o.isPlayer;
    this.x = 0; this.y = 0; this.z = 0; this.px = 0; this.py = 0; this.pz = 0; this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0; this.spawnYaw = 0; this.onGround = true; this.crouchT = 0;
    this.hp = 100; this.armor = 0; this.helmet = false; this.alive = false; this.money = RZ.ECON.start;
    this.weapons = { 1: null, 2: null, 3: null }; this.slot = 2; this.prevSlot = 3;
    this.stats = { kills: 0, deaths: 0, hs: 0, dmg: 0, shots: 0, hits: 0 };
    this.deadT = 0; this.fallDir = 1; this.animPhase = 0; this.stepDist = 0; this.punchP = 0; this.punchY = 0;
    this.scoped = false; this.fireAnim = 0; this.meleeT = 0; this.fireHeld = false; this.altHeld = false;
    this.wishX = 0; this.wishZ = 0; this.wantWalk = false; this.wantCrouch = false; this.wantJump = false; this.wantFire = false;
    this.wantAlt = false; this.wantReload = false; this.shotThisTick = false;
    this.ai = Act.newBrain();
  }
  Fighter.prototype.weapon = function () { return this.weapons[this.slot] || this.weapons[2] || this.weapons[3]; };
  Fighter.prototype.weaponId = function () { var w = this.weapon(); return w ? w.id : 'knife'; };
  Fighter.prototype.eyeH = function () { return EYE_STAND - this.crouchT * (EYE_STAND - EYE_CROUCH); };
  Fighter.prototype.headY = function () { return this.eyeH() - 0.02; };
  Fighter.prototype.hipY = function () { return 0.92 - this.crouchT * 0.34; };
  Fighter.prototype.chestY = function () { return this.hipY() + 0.34; };
  Fighter.prototype.height = function () { return H_STAND - this.crouchT * (H_STAND - H_CROUCH); };
  Fighter.prototype.botControlled = function () { return !this.isPlayer || (G && G.autoplay); };
  Fighter.prototype.scopedNow = function () {
    var w = this.weapon();
    return this.scoped && w && w.def.scope && G.time >= w.boltT && w.reloadT <= 0 && w.drawT <= 0;
  };

  /* ================================================================== */
  /* Physics                                                            */
  /* ================================================================== */
  function overlapAt(f, x, y, z, h) { return G.world.overlaps(x - R, y + 0.001, z - R, x + R, y + h, z + R); }

  function moveAxis(f, axis, d, h) {
    if (axis === 0) f.x += d; else f.z += d;
    var hit = overlapAt(f, f.x, f.y, f.z, h);
    if (hit < 0) return;
    // step up onto low ledges (stairs, kerbs); a smaller step works in the air (mantle assist)
    var top = G.world.cb[hit * 6 + 4], rise = top - f.y, maxStep = f.onGround ? 0.46 : 0.34;
    if (rise > 0 && rise <= maxStep && overlapAt(f, f.x, top + 0.002, f.z, h) < 0) { f.y = top + 0.002; return; }
    if (axis === 0) { f.x -= d; f.vx = 0; } else { f.z -= d; f.vz = 0; }
  }

  function physics(f, dt) {
    var w = f.weapon(), mob = w ? w.def.mob : 1, frozen = G.phase === 'freeze';
    // crouch (stand up only with headroom)
    var wantC = f.wantCrouch;
    if (!wantC && f.crouchT > 0 && overlapAt(f, f.x, f.y, f.z, H_STAND) >= 0) wantC = true;
    f.crouchT = clamp(f.crouchT + (wantC ? 1 : -1) * dt * 7, 0, 1);
    var h = f.height();
    var speed = RUN * mob * (f.wantWalk ? 0.52 : 1) * (1 - f.crouchT * 0.64) * (f.scopedNow() ? 0.55 : 1);
    var wx = f.wishX, wz = f.wishZ, wl = Math.sqrt(wx * wx + wz * wz);
    if (frozen || !f.alive) { wx = wz = 0; wl = 0; }
    if (wl > 1) { wx /= wl; wz /= wl; }
    var tx = wx * speed, tz = wz * speed, acc = (f.onGround ? ACC : AIR_ACC) * dt;
    if (f.onGround || wl > 0) {
      var dvx = tx - f.vx, dvz = tz - f.vz, dl = Math.sqrt(dvx * dvx + dvz * dvz);
      if (dl > acc) { dvx *= acc / dl; dvz *= acc / dl; }
      f.vx += dvx; f.vz += dvz;
    }
    // soft separation between fighters
    for (var i = 0; i < G.fighters.length; i++) {
      var o = G.fighters[i];
      if (o === f || !o.alive) continue;
      var sx = f.x - o.x, sz = f.z - o.z, d2 = sx * sx + sz * sz;
      if (d2 < 0.42 && d2 > 1e-6 && Math.abs(f.y - o.y) < 1.5) { var d = Math.sqrt(d2), push = (0.65 - d) * 6 * dt; f.x += sx / d * push; f.z += sz / d * push; }
    }
    if (f.wantJump && f.onGround && !frozen && f.crouchT < 0.5) { f.vy = JUMP; f.onGround = false; }
    f.wantJump = false;
    f.vy -= GRAV * dt;
    var wasGround = f.onGround;
    var mx = f.vx * dt, mz = f.vz * dt, my = f.vy * dt;
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(mz), Math.abs(my)) / 0.15));
    f.onGround = false;
    for (var s = 0; s < n; s++) {
      if (mx) moveAxis(f, 0, mx / n, h);
      if (mz) moveAxis(f, 2, mz / n, h);
      f.y += my / n;
      if (f.y <= 0) { f.y = 0; if (f.vy < 0) f.vy = 0; f.onGround = true; }
      var hit = overlapAt(f, f.x, f.y, f.z, h);
      if (hit >= 0) {
        var cb = G.world.cb;
        if (my <= 0) { f.y = cb[hit * 6 + 4] + 0.001; f.vy = 0; f.onGround = true; }
        else { f.y = cb[hit * 6 + 1] - h - 0.002; f.vy = 0; }
      }
    }
    // stick to the ground when walking down steps
    if (!f.onGround && wasGround && f.vy <= 0) {
      var g = G.world.groundAt(f.x - R, f.z - R, f.x + R, f.z + R, f.y + 0.01);
      if (f.y - g < 0.5) { f.y = g + 0.001; f.vy = 0; f.onGround = true; }
    }
    if (!wasGround && f.onGround && f.isPlayer && f.landV < -6) A.land();
    f.landV = f.vy;
    // safety: never leave the map
    var bd = G.map.bounds;
    if (f.x < bd[0] || f.x > bd[2] || f.z < bd[1] || f.z > bd[3] || f.y < -2) {
      var c = G.world.nearestCell(clamp(f.x, bd[0], bd[2]), clamp(f.z, bd[1], bd[3]));
      if (c >= 0) { f.x = G.world.cellX(c); f.z = G.world.cellZ(c); f.y = G.world.navH[c] + 0.01; f.vx = f.vz = 0; }
    }
    // footsteps (running only; walking and crouching are silent)
    var sp = Math.sqrt(f.vx * f.vx + f.vz * f.vz);
    if (f.onGround && sp > 3.3 && !f.wantWalk && f.crouchT < 0.3) {
      f.stepDist += sp * dt;
      if (f.stepDist > 2.2) {
        f.stepDist = 0;
        if (f.isPlayer && G.cameraOwner === f) A.step(null); else if (G.rendering) A.step({ x: f.x, y: f.y, z: f.z });
        noise(f, 15);
      }
    }
  }

  function noise(f, r) {
    G.noises.push({ x: f.x, y: f.y + 1.2, z: f.z, team: f.team, r: r, t: G.time, id: f.id });
    if (G.noises.length > 40) G.noises.shift();
  }

  /* ================================================================== */
  /* Weapons                                                            */
  /* ================================================================== */
  function switchSlot(f, slot) {
    if (!f.weapons[slot] || slot === f.slot) return;
    var cur = f.weapons[f.slot];
    if (cur) cur.reloadT = 0;
    f.prevSlot = f.slot; f.slot = slot; f.scoped = false;
    var w = f.weapons[slot];
    w.drawT = w.def.draw; w.sprayIdx = 0;
    if (f.isPlayer && !G.autoplay) A.mech('draw');
  }
  function startReload(f) {
    var w = f.weapon();
    if (!w || w.def.kind !== 'gun' || w.reloadT > 0 || w.drawT > 0 || w.mag >= w.def.mag || w.reserve <= 0) return;
    w.reloadT = w.def.reload; f.scoped = false;
    if (f === G.cameraOwner) A.mech(w.def.shellReload ? 'shell' : 'out');
  }
  function updateWeapon(f, dt) {
    var w = f.weapon(); if (!w) return;
    var def = w.def;
    f.shotThisTick = false;
    if (w.drawT > 0) w.drawT -= dt;
    if (w.reloadT > 0) {
      // shotgun: firing interrupts the shell-by-shell reload
      if (def.shellReload && f.wantFire && w.mag > 0 && !f.fireHeld) w.reloadT = 0;
      else {
        w.reloadT -= dt;
        if (w.reloadT <= 0) {
          w.reloadT = 0;
          if (def.shellReload) {
            w.mag++; w.reserve--;
            if (w.mag < def.mag && w.reserve > 0) { w.reloadT = def.reload; if (f === G.cameraOwner) A.mech('shell'); }
            else if (f === G.cameraOwner) A.mech('pump');
          } else {
            var take = Math.min(def.mag - w.mag, w.reserve);
            w.mag += take; w.reserve -= take;
            if (f === G.cameraOwner) A.mech('in', null, w.id);
          }
        }
      }
    }
    if (f.wantReload) startReload(f);
    // scope toggle / heavy knife on alt edge
    if (f.wantAlt && !f.altHeld) {
      if (def.scope && w.reloadT <= 0) f.scoped = !f.scoped;
      else if (def.kind === 'melee' && G.time >= w.next && w.drawT <= 0) melee(f, w, true);
    }
    if (f.botControlled() && def.scope) f.scoped = !!f.ai.wantScope;
    f.altHeld = f.wantAlt;
    if (f.wantFire && w.drawT <= 0 && G.phase !== 'freeze') {
      if (def.kind === 'melee') { if (G.time >= w.next) melee(f, w, false); }
      else if (w.reloadT <= 0 && G.time >= w.next && (def.mode === 'auto' || !f.fireHeld)) fireGun(f, w);
    }
    f.fireHeld = f.wantFire;
    // recovery: random spray growth, pattern index and per-shot kick
    var since = G.time - w.lastShot;
    if (since > def.rate * 1.3) w.spray = Math.max(0, w.spray - dt * (def.spread ? def.spread.sprayMax * 3 + 0.02 : 1));
    if (since > RZ.SPRAY.resetDelay) w.sprayIdx = Math.max(0, w.sprayIdx - dt * RZ.SPRAY.decayRate);
    if (since > 0.06) {
      var rec = (def.recoil ? def.recoil.recover : 6) * dt;
      f.punchP -= f.punchP * Math.min(1, rec); f.punchY -= f.punchY * Math.min(1, rec);
    }
  }

  function calcSpread(f, w, scopedNow) {
    var sp = w.def.spread; if (!sp) return 0;
    var base = scopedNow && sp.scoped != null ? sp.scoped : sp.base;
    var v = Math.sqrt(f.vx * f.vx + f.vz * f.vz), run = RUN * w.def.mob;
    var mv = clamp(v / run, 0, 1);
    var s = base + sp.move * Math.pow(mv, 1.4) + w.spray;
    if (!f.onGround) s += sp.air;
    if (f.crouchT > 0.6) s *= sp.crouch;
    return s;
  }
  Game.calcSpread = function () { return G && G.player ? calcSpread(G.player, G.player.weapon(), G.player.scopedNow()) : 0; };

  /* pattern offset [pitch, yaw] at a fractional index (for the camera kick) */
  function patternAt(def, idx) {
    var P = def.pattern; if (!P || idx <= 0) return null;
    var i = Math.floor(idx), t = idx - i;
    var a = P[Math.min(i, P.length - 1)], b = P[Math.min(i + 1, P.length - 1)];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  var _ray = { t: 0, part: '' }, _hit = { nx: 0, ny: 0, nz: 0, box: -1 };
  /* ray against a fighter's hit volumes (head sphere, torso and leg cylinders) */
  function rayFighter(g, ox, oy, oz, dx, dy, dz, maxT) {
    var cx = g.x - ox, cz = g.z - oz;
    // closest approach in xz to reject quickly
    var dl2 = dx * dx + dz * dz;
    var tc = dl2 > 1e-8 ? (cx * dx + cz * dz) / dl2 : 0;
    var qx = cx - dx * tc, qz = cz - dz * tc;
    if (qx * qx + qz * qz > 0.6 && dl2 > 1e-4) return false;
    var best = maxT, part = '';
    // head
    var hy = g.y + g.headY(), hx = g.x - ox, hz = g.z - oz, hyy = hy - oy;
    var b = hx * dx + hyy * dy + hz * dz, c = hx * hx + hyy * hyy + hz * hz - 0.145 * 0.145, disc = b * b - c;
    if (disc >= 0) { var th = b - Math.sqrt(disc); if (th > 0 && th < best) { best = th; part = 'head'; } }
    // vertical cylinders
    var hip = g.hipY();
    var cyl = [[0.26, g.y + hip, g.y + hip + 0.62, 'body'], [0.2, g.y, g.y + hip, 'legs']];
    for (var i = 0; i < 2; i++) {
      var r = cyl[i][0];
      var a2 = dl2, b2 = -2 * (cx * dx + cz * dz), c2 = cx * cx + cz * cz - r * r;
      if (a2 < 1e-8) continue;
      var dd = b2 * b2 - 4 * a2 * c2;
      if (dd < 0) continue;
      var t = (-b2 - Math.sqrt(dd)) / (2 * a2);
      if (t < 0) continue;
      var y = oy + dy * t;
      if (y < cyl[i][1] || y > cyl[i][2]) continue;
      if (t < best) { best = t; part = cyl[i][3]; }
    }
    if (!part) return false;
    _ray.t = best; _ray.part = part;
    return true;
  }

  function fireGun(f, w) {
    var def = w.def;
    if (w.mag <= 0) {
      if (f === G.cameraOwner) A.dry();
      w.next = G.time + 0.25;
      startReload(f);
      return;
    }
    var scopedNow = f.scopedNow();
    w.mag--; w.next = G.time + def.rate; w.lastShot = G.time;
    f.shotThisTick = true; f.stats.shots++; f.fireAnim = 1;
    if (def.mode === 'bolt') w.boltT = G.time + def.rate;
    var spread = calcSpread(f, w, scopedNow);
    // deterministic spray pattern (automatics) or simple accumulated kick (others)
    var offP, offY, pIdx = -1;
    if (def.pattern) {
      pIdx = Math.min(def.pattern.length - 1, Math.floor(w.sprayIdx));
      var pp = def.pattern[pIdx], sc = f.crouchT > 0.6 ? RZ.SPRAY.crouchScale : 1;
      if (f.botControlled()) sc *= 1 - G.diff.comp;
      offP = pp[0] * sc; offY = pp[1] * sc;
      w.sprayIdx = Math.floor(w.sprayIdx) + 1;
    } else { offP = f.punchP; offY = f.punchY; }
    var baseYaw = f.yaw - offY, basePitch = f.pitch + offP;
    var eyeY = f.y + f.eyeH();
    var range = def.range || 200, pellets = def.pellets || 1;
    var hitAny = false, killed = false, head = false;
    var mz = muzzleWorld(f);
    for (var p = 0; p < pellets; p++) {
      var a = Math.random() * 6.283, rr = def.pelletCone ? spread * Math.sqrt(Math.random()) : spread * Math.random();
      var py = basePitch + Math.sin(a) * rr, yw = baseYaw + Math.cos(a) * rr / Math.max(0.25, Math.cos(basePitch));
      var cp = Math.cos(py), dx = -Math.sin(yw) * cp, dy = Math.sin(py), dz = -Math.cos(yw) * cp;
      if (w.log && p === 0) w.log.push({ i: pIdx, offP: +offP.toFixed(5), offY: +offY.toFixed(5), dirP: py - f.pitch, dirY: f.yaw - yw, spread: spread });
      var res = shootRay(f, f.x, eyeY, f.z, dx, dy, dz, range, def, pellets > 1 && p > 2);
      if (res === 2) killed = true;
      if (res) hitAny = true;
      if (_lastPart === 'head' && res) head = true;
      if (p < 3) G.world.tracer(mz.x, mz.y, mz.z, _end.x, _end.y, _end.z);
    }
    if (!def.pattern) {
      var k = def.recoil.kick * (0.85 + Math.random() * 0.3) * (f.crouchT > 0.6 ? 0.8 : 1);
      if (f.botControlled()) k *= 1 - G.diff.comp * 0.7;
      f.punchP += k; f.punchY += (Math.random() - 0.5) * 2 * def.recoil.yaw;
    }
    if (def.spread) w.spray = Math.min(def.spread.sprayMax, w.spray + def.spread.spray);
    if (hitAny) f.stats.hits++;
    if (f === G.cameraOwner) {
      A.shot(def.sound, null, def.id);
      if (def.kind === 'gun' && def.mode !== 'pump') A.casing(0.3 + Math.random() * 0.15);
      G.vmKick = 1; G.vmFlashT = 0.045;
      if (def.mode === 'bolt' || def.mode === 'pump') setTimeout(function () { if (G && f === G.cameraOwner) A.mech(def.mode === 'bolt' ? 'bolt' : 'pump'); }, 380);
    } else if (G.rendering) A.shot(def.sound, { x: f.x, y: eyeY, z: f.z }, def.id);
    if (f !== G.cameraOwner || !f.alive) G.world.flash(mz.x, mz.y, mz.z, def.pellets > 1 ? 0.7 : 0.45);
    noise(f, def.id === 'osa' ? 32 : 45);
    if (f.isPlayer && hitAny) hitMarker(killed, head);
    if (w.mag === 0 && w.reserve > 0 && f.botControlled()) startReload(f);
  }

  var _end = { x: 0, y: 0, z: 0 }, _lastPart = '';
  /* returns 0 miss, 1 hit, 2 kill */
  function shootRay(f, ox, oy, oz, dx, dy, dz, range, def, quiet) {
    var tW = G.world.raycast(ox, oy, oz, dx, dy, dz, range, _hit);
    var best = tW, victim = null, part = '';
    for (var i = 0; i < G.fighters.length; i++) {
      var g = G.fighters[i];
      if (!g.alive || g.team === f.team) continue;
      if (rayFighter(g, ox, oy, oz, dx, dy, dz, best)) { best = _ray.t; victim = g; part = _ray.part; }
    }
    _end.x = ox + dx * best; _end.y = oy + dy * best; _end.z = oz + dz * best;
    _lastPart = part;
    if (victim) {
      var dmg = def.dmg * Math.pow(def.falloff, best / 10);
      G.world.puff(_end.x, _end.y, _end.z, true);
      return damage(victim, dmg, f, part, def) ? 2 : 1;
    }
    if (tW < range) {
      G.world.decal(_end.x, _end.y, _end.z, _hit.nx, _hit.ny, _hit.nz);
      if (!quiet) G.world.puff(_end.x + _hit.nx * 0.05, _end.y + _hit.ny * 0.05, _end.z + _hit.nz * 0.05, false);
      if (G.rendering && !quiet && Math.random() < 0.6) A.impact({ x: _end.x, y: _end.y, z: _end.z }, false, _hit.box >= 0 ? G.world.colBoxes[_hit.box].mat : null);
    }
    return 0;
  }

  function melee(f, w, heavy) {
    var m = heavy ? w.def.heavy : w.def.fast;
    w.next = G.time + m.time; f.meleeT = heavy ? 1 : 0.6; f.fireAnim = 1;
    G.vmMelee = heavy ? 2 : 1; G.vmMeleeT = 0;
    if (f === G.cameraOwner) A.knife(null, heavy); else if (G.rendering) A.knife({ x: f.x, y: f.y + 1.2, z: f.z }, heavy);
    var ey = f.y + f.eyeH(), hit = null, part = '', bestT = m.range;
    for (var k = -1; k <= 1; k++) {
      var yw = f.yaw + k * 0.16, cp = Math.cos(f.pitch), dx = -Math.sin(yw) * cp, dy = Math.sin(f.pitch), dz = -Math.cos(yw) * cp;
      for (var i = 0; i < G.fighters.length; i++) {
        var g = G.fighters[i];
        if (!g.alive || g.team === f.team) continue;
        if (rayFighter(g, f.x, ey, f.z, dx, dy, dz, bestT)) {
          if (G.world.raycast(f.x, ey, f.z, dx, dy, dz, _ray.t, null) < _ray.t - 0.02) continue;
          bestT = _ray.t; hit = g; part = _ray.part;
        }
      }
    }
    if (hit) {
      // from behind: double damage
      var toV = Math.atan2(-(hit.x - f.x), -(hit.z - f.z)), back = Math.abs(Act.angDiff(toV, hit.yaw)) < 1.0;
      var dmg = m.dmg * (back ? 2 : 1) * (part === 'head' ? 1.3 : 1);
      var killed = damage(hit, dmg, f, 'melee', w.def);
      if (G.rendering) A.impact({ x: hit.x, y: hit.y + 1.2, z: hit.z }, true);
      if (f.isPlayer) hitMarker(killed, false);
      f.stats.hits++;
    }
    f.stats.shots++;
  }

  function damage(v, dmg, att, part, def) {
    if (!v.alive) return false;
    if (v.isPlayer && G.god) return false;
    var d = dmg;
    if (part === 'head') d *= def.head || 1;
    else if (part === 'legs') d *= 0.75;
    var armored = part === 'head' ? v.helmet : part === 'body' && v.armor > 0;
    if (part === 'melee') armored = v.armor > 0;
    var hpD = d;
    if (armored && v.armor > 0) { hpD = d * (def.pen || 0.6); v.armor = Math.max(0, v.armor - (d - hpD) * 0.6); }
    hpD = Math.round(hpD);
    var dealt = Math.min(v.hp, hpD);
    v.hp -= hpD;
    att.stats.dmg += dealt;
    if (v.isPlayer) {
      G.dmgFlash = 0.08; A.hurt();
      v.punchP += 0.02 * Math.min(1, hpD / 40); v.punchY += (Math.random() - 0.5) * 0.02;
    }
    if (v.hp <= 0) { kill(v, att, def.id, part === 'head'); return true; }
    if (v.botControlled()) Act.damaged(G, v, att);
    return false;
  }

  function kill(v, k, wid, head) {
    v.alive = false; v.hp = 0; v.deadT = 0; v.fallDir = Math.random() < 0.7 ? 1 : -0.9; v.scoped = false;
    v.vx = v.vz = 0;
    v.stats.deaths++;
    if (k && k !== v) {
      k.stats.kills++; if (head) k.stats.hs++;
      var rew = RZ.WEAPONS[wid].kind === 'melee' ? 1500 : RZ.WEAPONS[wid].reward || 300;
      k.money = Math.min(RZ.ECON.max, k.money + rew);
      if (k.isPlayer) { G.tokens += RZ.TOKENS.kill + (head ? RZ.TOKENS.head : 0); G.tally.kills++; if (head) G.tally.hs++; }
    }
    if (v.isPlayer) { G.tally.deaths++; onPlayerDeath(k); }
    addFeed(k, v, wid, head);
  }

  /* world-space muzzle for tracers/flash */
  var _mz = { x: 0, y: 0, z: 0 };
  function muzzleWorld(f) {
    var cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), fx = -sy * Math.cos(f.pitch), fz = -cy * Math.cos(f.pitch), fy = Math.sin(f.pitch);
    var rx = cy, rz = -sy, side = f.isPlayer && S().lefty ? -1 : 1;
    var len = f.weaponId() === 'igla' ? 0.95 : f.weapon() && f.weapon().def.slot === 1 ? 0.75 : 0.45;
    _mz.x = f.x + fx * len + rx * 0.13 * side; _mz.y = f.y + f.eyeH() - 0.12 + fy * len; _mz.z = f.z + fz * len + rz * 0.13 * side;
    return _mz;
  }

  /* ================================================================== */
  /* Buying                                                             */
  /* ================================================================== */
  function priceOf(id, f) {
    if (id === 'helmet') return f.armor >= 100 && !f.helmet ? 350 : RZ.ECON.helmet;
    if (RZ.GEAR[id]) return RZ.GEAR[id].price;
    return RZ.WEAPONS[id].price;
  }
  function owned(id, f) {
    if (id === 'armor') return f.armor >= 100;
    if (id === 'helmet') return f.helmet && f.armor >= 100;
    if (id === 'ammo') return false;
    var s = RZ.WEAPONS[id].slot;
    return !!(f.weapons[s] && f.weapons[s].id === id);
  }
  function buy(f, id) {
    if (owned(id, f)) return false;
    var price = priceOf(id, f);
    if (f.money < price) return false;
    f.money -= price;
    if (id === 'armor') f.armor = 100;
    else if (id === 'helmet') { f.armor = 100; f.helmet = true; }
    else if (id === 'ammo') { [1, 2].forEach(function (s) { var w = f.weapons[s]; if (w) w.reserve = w.def.reserve; }); }
    else {
      var def = RZ.WEAPONS[id];
      f.weapons[def.slot] = newWeapon(id, f.isPlayer ? equippedPaint(id) : botPaint(id));
      f.slot = def.slot; f.scoped = false;
      f.weapons[def.slot].drawT = def.draw * 0.5;
    }
    return true;
  }
  function equippedPaint(id) {
    var d = RZ.Store.data, uid = d.equipped[id];
    if (!uid) return null;
    for (var i = 0; i < d.inv.length; i++) if (d.inv[i].uid === uid) return d.inv[i].paint;
    return null;
  }
  function botPaint() { return null; }
  /* bots buy by their own money; a poor team saves (eco) so it can afford rifles next round */
  function botBuy(f, eco) {
    var m = f.money, r = Math.random();
    if (!f.weapons[1] && !(eco && m < 3600)) {
      var choice = null;
      if (m >= 5200 && r < 0.2) choice = 'igla';
      else if (m >= 3600) choice = r < 0.6 ? 'grom' : 'vihr';
      else if (m >= 2950) choice = 'vihr';
      else if (m >= 2000) choice = r < 0.55 ? 'shershen' : 'taran';
      if (choice) buy(f, choice);
    }
    if (eco && !f.weapons[1]) {
      if (f.money >= 2400 && f.armor < 60) buy(f, 'armor');
    } else if (f.money >= 1000 && !f.helmet) buy(f, 'helmet');
    else if (f.money >= 650 && f.armor < 60) buy(f, 'armor');
    if (!f.weapons[1] && f.weapons[2].id === 'osa' && f.money >= (eco ? 2000 : 600) && Math.random() < 0.6) buy(f, 'shmel');
    f.slot = f.weapons[1] ? 1 : 2;
  }
  function teamEco(team) {
    var sum = 0, n = 0, armed = 0;
    G.fighters.forEach(function (f) { if (f.team === team) { sum += f.money; n++; if (f.alive && f.weapons[1]) armed++; } });
    // not a pistol round, team can't afford rifles on average, and few survivors kept guns
    return G.round > 1 && !G.justSwapped && sum / n < 3200 && armed < n / 2;
  }
  function buyAllowed() {
    var p = G.player;
    return p.alive && (G.phase === 'freeze' || (G.phase === 'live' && ROUND_TIME - G.phaseT < BUY_WINDOW));
  }
  function playerBuy(id) {
    if (!G || !buyAllowed()) return;
    if (buy(G.player, id)) { A.ui('buy'); G.player.wantFire = false; renderBuy(); }
    else A.ui('error');
  }

  /* ================================================================== */
  /* Rounds                                                             */
  /* ================================================================== */
  function sideOf(team) { return (team + (G.swapped ? 1 : 0)) % 2; }
  function spawnTeam(team, reset) {
    var side = G.map.spawns[sideOf(team)], pts = side.pts.slice();
    var members = G.fighters.filter(function (f) { return f.team === team; });
    members.forEach(function (f, i) {
      var p = pts[i % pts.length], ox = i >= pts.length ? 0.8 : 0;
      if (!f.alive || reset) {
        f.weapons = { 1: null, 2: newWeapon('osa', f.isPlayer ? equippedPaint('osa') : null), 3: newWeapon('knife', f.isPlayer ? equippedPaint('knife') : null) };
        f.armor = 0; f.helmet = false;
      }
      if (f.isPlayer) {
        // refresh paints in case they changed between matches
        [1, 2, 3].forEach(function (s) { var w = f.weapons[s]; if (w) w.paint = equippedPaint(w.id); });
      }
      f.x = f.px = p[0] + ox; f.z = f.pz = p[1] + ox; f.y = f.py = 0; f.vx = f.vy = f.vz = 0;
      f.yaw = f.spawnYaw = side.yaw; f.pitch = 0; f.crouchT = 0; f.onGround = true;
      f.alive = true; f.hp = 100; f.deadT = 0; f.scoped = false; f.punchP = f.punchY = 0;
      [1, 2, 3].forEach(function (s) { var w = f.weapons[s]; if (w) { w.reloadT = 0; w.drawT = 0; w.sprayIdx = 0; w.spray = 0; w.next = 0; w.boltT = 0; } });
      f.slot = f.weapons[1] ? 1 : 2;
      if (f.model) { f.model.root.visible = true; f.model.root.rotation.x = 0; }
    });
  }
  function planBots() {
    [0, 1].forEach(function (team) {
      var side = sideOf(team), lanes = G.map.lanes;
      var bots = G.fighters.filter(function (f) { return f.team === team && f.botControlled(); });
      var order = lanes.map(function (_, i) { return i; }).sort(function () { return Math.random() - 0.5; });
      bots.forEach(function (f, i) {
        var lane = lanes[order[i % order.length]].slice();
        if (side === 1) lane.reverse();
        Act.planRound(G, f, lane, rnd(0.1, 0.45));
      });
    });
  }

  function startRound() {
    G.round++;
    var played = G.score[0] + G.score[1], reset = false, sub = 'Закупка — ' + RZ.keyLabel(S().keys.buy);
    if (!G.swapped && played >= G.toWin - 1 && G.round > 1) {
      G.swapped = true; reset = true;
      G.fighters.forEach(function (f) { f.money = RZ.ECON.start; f.alive = false; });
      G.lossStreak = [0, 0];
    }
    G.justSwapped = reset;
    var eco = [teamEco(0), teamEco(1)];
    spawnTeam(0, reset); spawnTeam(1, reset);
    G.fighters.forEach(function (f) { if (f.botControlled()) botBuy(f, eco[f.team]); });
    G.ecoLog = (G.ecoLog || []).concat([eco[0] + '/' + eco[1]]);
    planBots();
    G.phase = 'freeze'; G.phaseT = FREEZE;
    G.noises.length = 0; G.intel = [{}, {}]; G.radarT = 0;
    G.spec = null; G.deathT = 0;
    G.cameraOwner = G.player;
    if (G.hud) {
      $('hud').classList.remove('is-dead');
      var title = 'Раунд ' + G.round;
      if (reset) { banner('Смена сторон', 'Деньги и оружие сброшены · ' + title, '', 3); }
      else if (G.score[0] === G.toWin - 1 || G.score[1] === G.toWin - 1) banner(title, 'Матчбол · ' + sub, '', 2.6);
      else banner(title, sub, '', 2.4);
      closeBuy();
    }
  }
  function aliveCount(team) {
    var n = 0;
    for (var i = 0; i < G.fighters.length; i++) if (G.fighters[i].team === team && G.fighters[i].alive) n++;
    return n;
  }
  function endRound(winner, reason) {
    var liveT = ROUND_TIME - G.phaseT;
    G.phase = 'post'; G.phaseT = POST;
    closeBuy();
    var E = RZ.ECON;
    if (winner >= 0) {
      G.score[winner]++;
      var loser = 1 - winner;
      G.fighters.forEach(function (f) {
        if (f.team === winner) f.money = Math.min(E.max, f.money + (reason === 'time' ? E.timeoutWin : E.win));
        else f.money = Math.min(E.max, f.money + Math.min(E.lossMax, E.loss + G.lossStreak[loser] * E.lossStep));
      });
      G.lossStreak[loser]++; G.lossStreak[winner] = 0;
      if (winner === 0) { G.tokens += RZ.TOKENS.round; G.tally.roundsWon++; }
    }
    G.tally.rounds++;
    var us = winner === 0, sub;
    if (winner < 0) sub = 'Поровну выживших — раунд переигрывается';
    else if (reason === 'time') sub = 'Время вышло: ' + (us ? 'у нас больше выживших' : 'у противника больше выживших');
    else sub = us ? 'Группа противника выбыла' : 'Наша группа выбыла';
    sub += ' · ' + G.score[0] + ' : ' + G.score[1];
    if (G.hud) {
      if (winner < 0) { banner('Ничья', sub, '', 3.5); A.sting('draw'); }
      else { banner(us ? 'Раунд за нами' : 'Раунд проигран', sub, us ? 'win' : 'lose', 3.5); A.sting(us ? 'win' : 'lose'); }
    }
    G.matchOver = G.score[0] >= G.toWin || G.score[1] >= G.toWin || G.round >= G.toWin * 2 + 8;
    G.log.push({ round: G.round, winner: winner, side: winner >= 0 ? sideOf(winner) : -1, reason: reason, score: G.score.slice(), t: +liveT.toFixed(1) });
  }

  function tickRound(dt) {
    if (G.sandbox) return; // debug: round flow suspended
    G.phaseT -= dt;
    if (G.phase === 'freeze') {
      if (G.phaseT <= 0) {
        G.phase = 'live'; G.phaseT = ROUND_TIME;
        if (G.hud) { A.sting('start'); banner('В бой', G.map.name + ' · раунд ' + G.round, '', 1.4); }
      }
    } else if (G.phase === 'live') {
      var a0 = aliveCount(0), a1 = aliveCount(1);
      if (a0 === 0 || a1 === 0) endRound(a0 === 0 && a1 === 0 ? -1 : a0 === 0 ? 1 : 0, 'elim');
      else if (G.phaseT <= 0) endRound(a0 === a1 ? -1 : a0 > a1 ? 0 : 1, 'time');
    } else if (G.phase === 'post') {
      if (G.phaseT <= 0) {
        if (G.matchOver) endMatch(); else startRound();
      }
    }
  }

  /* intel shared between teammates; late in the round everyone gets a rough fix */
  function shareIntel(f, e) { G.intel[f.team][e.id] = { x: e.x, z: e.z, t: G.time }; }
  function bestIntel(f) {
    var I = G.intel[f.team], best = null, bd = 1e9, now = G.time;
    for (var k in I) {
      var it = I[k], age = now - it.t;
      var e = G.byId[k];
      if (!e || !e.alive || age > 5) continue;
      var d = Math.hypot(it.x - f.x, it.z - f.z);
      if (d < 32 && d < bd) { bd = d; best = it; }
    }
    if (!best && G.phase === 'live' && ROUND_TIME - G.phaseT > 55) {
      // late round: approximate location of the nearest enemy
      for (var i = 0; i < G.fighters.length; i++) {
        var o = G.fighters[i];
        if (!o.alive || o.team === f.team) continue;
        var dd = Math.hypot(o.x - f.x, o.z - f.z);
        if (dd < bd) { bd = dd; best = { x: o.x + Math.sin(G.time * 0.3 + i) * 3, z: o.z + Math.cos(G.time * 0.3 + i) * 3 }; }
      }
    }
    return best;
  }
  function roamPoint(f) {
    var en = G.map.spawns[1 - sideOf(f.team)].zone, ecx = (en[0] + en[2]) / 2, ecz = (en[1] + en[3]) / 2;
    var best = null, bs = 1e9;
    for (var i = 0; i < 6; i++) {
      var p = G.world.randomCell(Math.random);
      var s = Math.hypot(p.x - ecx, p.z - ecz) * (0.6 + Math.random());
      if (s < bs) { bs = s; best = p; }
    }
    return best;
  }

  /* ================================================================== */
  /* Simulation tick                                                    */
  /* ================================================================== */
  function tick(dt) {
    G.time += dt;
    var i, f;
    for (i = 0; i < G.fighters.length; i++) { f = G.fighters[i]; f.px = f.x; f.py = f.y; f.pz = f.z; }
    var p = G.player;
    if (p.alive) {
      if (G.autoplay) Act.think(G, p, dt);
      else playerInput(p);
    }
    for (i = 0; i < G.fighters.length; i++) {
      f = G.fighters[i];
      if (!f.alive) continue;
      if (!f.isPlayer) Act.think(G, f, dt);
    }
    for (i = 0; i < G.fighters.length; i++) {
      f = G.fighters[i];
      if (!f.alive) { if (f.vy || f.y > 0) { /* corpses settle */ } continue; }
      physics(f, dt);
      updateWeapon(f, dt);
    }
    while (G.noises.length && G.time - G.noises[0].t > 1.5) G.noises.shift();
    tickRound(dt);
    if (!p.alive) G.deathT += dt;
    G.ticks++;
  }

  /* ================================================================== */
  /* Input                                                              */
  /* ================================================================== */
  var keys = {}, mouse = { 0: false, 2: false }, pressed = {};
  var codeToAction = {};
  function rebuildKeymap() {
    codeToAction = {};
    var k = S().keys;
    for (var a in k) codeToAction[k[a]] = a;
    for (var alt in RZ.ALT_KEYS) if (!codeToAction[RZ.ALT_KEYS[alt]]) codeToAction[RZ.ALT_KEYS[alt]] = alt;
  }
  function act(a) { var k = S().keys; return keys[k[a]] || (RZ.ALT_KEYS[a] && codeToAction[RZ.ALT_KEYS[a]] === a && keys[RZ.ALT_KEYS[a]]); }
  function playerInput(f) {
    var T = G.touchMode ? G.touch : null;
    var fw = (act('forward') ? 1 : 0) - (act('back') ? 1 : 0), st = (act('right') ? 1 : 0) - (act('left') ? 1 : 0);
    // touch joystick: analog vector (magnitude < 1 means slower)
    if (T && (T.mx || T.mz)) { fw = T.mz; st = T.mx; }
    var cy = Math.cos(f.yaw), sy = Math.sin(f.yaw);
    var blocked = G.buyOpen || G.over;
    f.wishX = blocked ? 0 : -sy * fw + cy * st; f.wishZ = blocked ? 0 : -cy * fw - sy * st;
    f.wantWalk = !!act('walk') || !!(T && T.walk); f.wantCrouch = !!act('crouch') || !!(T && T.crouch);
    if (pressed.jump) { f.wantJump = true; pressed.jump = false; }
    if (T && T.jumpP) { f.wantJump = true; T.jumpP = false; }
    var looking = G.locked || G.test || G.touchMode || G.dragLook;
    f.wantFire = !blocked && looking && (mouse[0] || !!(T && T.fire));
    f.wantAlt = !blocked && looking && (mouse[2] || !!(T && T.alt));
    f.wantReload = !!pressed.reload || !!(T && T.reloadP); pressed.reload = false;
    if (T) T.reloadP = false;
    if (T && T.autofire && !f.wantFire && !blocked && G.phase !== 'freeze' && autoFireTarget(f)) {
      var w = f.weapon();
      // semi/bolt/pump need separate presses: pulse the trigger
      f.wantFire = w.def.mode === 'auto' || w.def.kind === 'melee' ? true : !f.fireHeld;
    }
  }

  /* touch autofire: is the crosshair ray on a living, visible enemy within the weapon's effective range? */
  var AUTO_RANGE = { osa: 24, shmel: 32, shershen: 26, taran: 13, grom: 55, vihr: 48, igla: 140, knife: 1.9 };
  function autoFireTarget(f) {
    var w = f.weapon(); if (!w) return false;
    if (w.def.kind === 'gun' && (w.reloadT > 0 || (w.mag === 0 && w.reserve === 0))) return false;
    // where the next bullet will go (full pattern offset / kick), so bursts stop when they'd climb off the target
    var op = f.punchP, oy = f.punchY;
    if (w.def.pattern) { var pp = w.def.pattern[Math.min(w.def.pattern.length - 1, Math.floor(w.sprayIdx))]; var sc = f.crouchT > 0.6 ? RZ.SPRAY.crouchScale : 1; op = pp[0] * sc; oy = pp[1] * sc; }
    var py = f.pitch + op, yw = f.yaw - oy;
    var cp = Math.cos(py), dx = -Math.sin(yw) * cp, dy = Math.sin(py), dz = -Math.cos(yw) * cp;
    var ey = f.y + f.eyeH(), range = AUTO_RANGE[w.id] || 30;
    var tW = G.world.raycast(f.x, ey, f.z, dx, dy, dz, range, null);
    for (var i = 0; i < G.fighters.length; i++) {
      var g = G.fighters[i];
      if (!g.alive || g.team === f.team) continue;
      if (rayFighter(g, f.x, ey, f.z, dx, dy, dz, tW)) return true;
    }
    return false;
  }
  /* camera kick currently shown to the player: [pitch, yaw] */
  function viewKick(p, w) {
    var kp = p.punchP, ky = p.punchY;
    if (w && w.def.pattern) { var pa = patternAt(w.def, w.sprayIdx); if (pa) { kp = pa[0] * RZ.SPRAY.viewFrac; ky = pa[1] * RZ.SPRAY.viewFrac; } else { kp = 0; ky = 0; } }
    return [kp, ky];
  }

  function onKeyDown(e) {
    if (!G) return;
    if (document.body.classList.contains('settings-over')) return; // settings screen handles keys
    var a = codeToAction[e.code];
    if (a || e.code === 'Tab' || e.code === 'Space' || (e.ctrlKey && /Key[WSADRQ]/.test(e.code))) e.preventDefault();
    if (e.code === 'Escape') {
      if (G.over) return;
      if (G.buyOpen) { closeBuy(true); return; }
      if (G.paused) { if (performance.now() - G.pauseAt > 350) resume(); return; }
      openPause();
      return;
    }
    if (G.over || G.paused) return;
    // buy menu: number keys buy
    if (G.buyOpen && /^Digit\d$/.test(e.code) && !e.repeat) {
      var n = +e.code.slice(5), id = G.buyKeys[n];
      if (id) playerBuy(id);
      return;
    }
    if (e.repeat && a !== 'forward' && a !== 'back' && a !== 'left' && a !== 'right') { keys[e.code] = true; return; }
    keys[e.code] = true;
    var p = G.player;
    if (!a) return;
    if (a === 'jump') pressed.jump = true;
    else if (a === 'reload') pressed.reload = true;
    else if (a === 'buy') { if (G.buyOpen) closeBuy(true); else openBuy(); }
    else if (a === 'score') showScore(true);
    else if (p.alive && !G.autoplay) {
      if (a === 'primary') switchSlot(p, 1);
      else if (a === 'pistol') switchSlot(p, 2);
      else if (a === 'knife') switchSlot(p, 3);
      else if (a === 'last') switchSlot(p, p.weapons[p.prevSlot] ? p.prevSlot : (p.slot === 3 ? 2 : 3));
    }
  }
  function onKeyUp(e) {
    if (!G) return;
    keys[e.code] = false;
    if (codeToAction[e.code] === 'score') showScore(false);
  }
  function onMouseDown(e) {
    if (!G || G.touchMode || e.target !== G.canvas && e.target !== document.body && e.target.id !== 'hud') return;
    A.init();
    if (!G.locked && needLock() && !G.over && !G.paused && !G.buyOpen) { lockPointer(); return; }
    if (!G.player.alive && G.phase !== 'freeze') { cycleSpec(); return; }
    mouse[e.button] = true;
  }
  function onMouseUp(e) { if (G) mouse[e.button] = false; }
  function onMouseMove(e) {
    if (!G || G.paused || G.over) return;
    if (G.locked) look(e.movementX || 0, e.movementY || 0);
    else if (G.dragLook && !G.touchMode && (e.buttons & 3) && !G.buyOpen) look(e.movementX || 0, e.movementY || 0);
  }
  /* finger look: a full-width swipe turns about 180° at sensitivity 1 */
  function lookTouch(dx, dy) {
    var p = G.player;
    if (!p.alive || G.autoplay || G.paused || G.over) return;
    var s = S(), k = Math.PI / Math.max(320, window.innerWidth) * s.touchSens * (p.scopedNow() ? s.ads * 0.45 : 1);
    p.yaw -= dx * k;
    p.pitch = clamp(p.pitch - dy * k * (s.invert ? -1 : 1), -1.52, 1.52);
    G.swayX += dx * 0.0004; G.swayY += dy * 0.0004;
  }
  /* pointer lock is wanted only for mouse play with the API available */
  function needLock() { return G && !G.test && !G.touchMode && !G.dragLook; }
  function look(mx, my) {
    var p = G.player;
    if (!p.alive || G.autoplay) return;
    var s = S(), k = 0.0011 * s.sens * (p.scopedNow() ? s.ads * 0.45 : 1);
    if (Math.abs(mx) > 400) mx = Math.sign(mx) * 400; // ignore browser jump glitches
    if (Math.abs(my) > 400) my = Math.sign(my) * 400;
    p.yaw -= mx * k;
    p.pitch = clamp(p.pitch - my * k * (s.invert ? -1 : 1), -1.52, 1.52);
    G.swayX += mx * 0.00025; G.swayY += my * 0.00025;
  }
  function onWheel(e) {
    if (!G || !(G.locked || G.dragLook) || G.touchMode || G.paused || !G.player.alive || G.autoplay) return;
    var p = G.player, order = [1, 2, 3], i = order.indexOf(p.slot), dir = e.deltaY > 0 ? 1 : -1;
    for (var k = 1; k <= 3; k++) { var s = order[(i + dir * k + 9) % 3]; if (p.weapons[s]) { switchSlot(p, s); break; } }
  }
  function onLockChange() {
    if (!G) return;
    var was = G.locked;
    G.locked = document.pointerLockElement === G.canvas;
    if (was && !G.locked) G.unlockAt = performance.now();
    if (G.locked) { $('click-to-play').hidden = true; G.expectUnlock = false; }
    else if (was && !G.expectUnlock && !G.paused && !G.over && !G.buyOpen && needLock()) openPause();
    G.expectUnlock = false;
  }
  /* gesture === true: the request came with user activation, so the API itself is refused
     (e.g. a sandboxed frame) — switch to click-and-drag look instead of nagging */
  function onLockError(gesture) {
    if (!G || !needLock()) return;
    var now = performance.now();
    if (G.lastLockFail && now - G.lastLockFail < 150) return; // promise rejection + error event for one request
    G.lastLockFail = now;
    // Chrome refuses a re-lock for ~1 s after the user left it: transient, just show the prompt
    if (G.unlockAt && now - G.unlockAt < 2500) { if (!G.paused && !G.over) $('click-to-play').hidden = G.buyOpen; return; }
    G.lockFails = (G.lockFails || 0) + 1;
    var g = typeof gesture === 'boolean' ? gesture : !!G.lockGesture;
    if (g || G.lockFails >= 2) { enableDragLook(); return; }
    if (!G.paused && !G.over) $('click-to-play').hidden = G.buyOpen;
  }
  function enableDragLook() {
    G.dragLook = true;
    $('click-to-play').hidden = true;
    if (G.hud) { setHint('Мышь не захвачена: обзор — ведите с зажатой кнопкой'); G.hintHold = 5; }
  }
  function onBlur() { keys = {}; mouse[0] = mouse[2] = false; if (G) showScore(false); }
  function onVisibility() { if (document.hidden && G && !G.paused && !G.over && !G.test) openPause(); }
  function onResize() { if (G) resize(); }
  function onContext(e) { if (G) e.preventDefault(); }
  /* desktop guard against an accidental Ctrl+W while crouching; sandboxed frames ignore it (harmless no-op) */
  function onBeforeUnload(e) { if (G && !G.over && !G.test && !G.touchMode) { e.preventDefault(); e.returnValue = ''; } }

  function lockPointer() {
    if (!needLock()) return;
    var gesture = !!(navigator.userActivation && navigator.userActivation.isActive);
    G.lockGesture = gesture;
    if (typeof G.canvas.requestPointerLock !== 'function') { enableDragLook(); return; }
    try {
      var pr = G.canvas.requestPointerLock();
      if (pr && typeof pr.catch === 'function') pr.catch(function () { onLockError(gesture); });
    } catch (err) { onLockError(gesture); }
  }
  function unlockPointer() {
    if (document.pointerLockElement && document.exitPointerLock) { G.expectUnlock = true; try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
  }

  /* ================================================================== */
  /* Overlays                                                           */
  /* ================================================================== */
  function openPause() {
    if (!G || G.over) return;
    G.paused = true; G.pauseAt = performance.now(); closeBuy(); showScore(false);
    keys = {}; mouse[0] = mouse[2] = false;
    $('pause').hidden = false; $('click-to-play').hidden = true;
    unlockPointer();
  }
  function resume() {
    if (!G) return;
    G.paused = false; $('pause').hidden = true;
    G.last = performance.now();
    if (needLock()) { lockPointer(); if (!G.locked && needLock()) $('click-to-play').hidden = false; }
  }
  function openBuy() {
    if (!buyAllowed()) { if (G.hud) { setHint('Закупка закрыта'); G.hintHold = 1.2; } return; }
    G.buyOpen = true; renderBuy(); $('buy').hidden = false;
    unlockPointer();
  }
  function closeBuy(relock) {
    if (!G || !G.buyOpen) return;
    G.buyOpen = false; $('buy').hidden = true;
    if (relock && needLock() && !G.paused) { lockPointer(); }
    if (needLock() && !G.paused && !G.over) setTimeout(function () { if (G && needLock() && !G.locked && !G.paused && !G.over && !G.buyOpen) $('click-to-play').hidden = false; }, 250);
  }
  function buildBuy() {
    var grid = $('buy-grid'); grid.innerHTML = '';
    var n = 1; G.buyKeys = {};
    RZ.BUY_LIST.forEach(function (col) {
      var sec = document.createElement('section'); sec.className = 'buy-col';
      var h = document.createElement('h3'); h.textContent = col.col; sec.appendChild(h);
      col.items.forEach(function (id) {
        var key = n % 10; n++;
        G.buyKeys[key] = id;
        var b = document.createElement('button');
        b.className = 'buy-item'; b.dataset.buy = id;
        var name = RZ.GEAR[id] ? RZ.GEAR[id].name : RZ.WEAPONS[id].name;
        b.innerHTML = '<kbd>' + key + '</kbd><b></b><span></span>';
        b.querySelector('b').textContent = name;
        b.addEventListener('click', function () { playerBuy(id); });
        sec.appendChild(b);
      });
      grid.appendChild(sec);
    });
  }
  function renderBuy() {
    if (!G || !G.hud) return;
    var p = G.player;
    $('buy-money').textContent = RZ.fmt(p.money);
    var items = document.querySelectorAll('#buy-grid .buy-item');
    for (var i = 0; i < items.length; i++) {
      var b = items[i], id = b.dataset.buy, own = owned(id, p), price = priceOf(id, p);
      b.classList.toggle('is-owned', own);
      b.disabled = !own && p.money < price;
      b.querySelector('span').textContent = RZ.fmt(price);
    }
    var left = G.phase === 'freeze' ? G.phaseT + BUY_WINDOW : Math.max(0, BUY_WINDOW - (ROUND_TIME - G.phaseT));
    $('buy-note').textContent = 'Закупка открыта ещё ' + Math.ceil(left) + ' с. ' + (G.touchMode ? 'Коснитесь предмета, чтобы купить.' : 'Цифры — быстрая покупка. Закрыть — ' + RZ.keyLabel(S().keys.buy) + ' или Esc.');
  }
  function showScore(on) {
    if (!G || !G.hud) return;
    G.scoreOn = on;
    $('scoreboard').hidden = !on;
    if (on) renderScore();
  }
  function renderScore() {
    $('sb-title').textContent = 'Счёт ' + G.score[0] + ' : ' + G.score[1];
    $('sb-map').textContent = G.map.name + ' · раунд ' + G.round + ' · ' + G.diff.name;
    var wrap = $('sb-wrap'), html = '';
    [0, 1].forEach(function (team) {
      var list = G.fighters.filter(function (f) { return f.team === team; })
        .sort(function (a, b) { return (b.stats.kills * 2 + b.stats.dmg / 100) - (a.stats.kills * 2 + a.stats.dmg / 100); });
      html += '<table class="sb ' + (team ? 'sb-them' : 'sb-us') + '"><caption>' + (team ? 'Противник' : 'Ваша группа') + ' · ' + G.score[team] +
        '</caption><thead><tr><th>Боец</th><th>Убийства</th><th>Смерти</th><th>Счёт</th></tr></thead><tbody>';
      list.forEach(function (f) {
        var cls = (f.isPlayer ? 'is-me ' : '') + (f.alive ? '' : 'is-dead');
        html += '<tr class="' + cls + '"><td>' + esc(f.name) + '</td><td>' + f.stats.kills + '</td><td>' + f.stats.deaths + '</td><td>' + Math.floor(f.stats.kills * 2 + f.stats.dmg / 100) + '</td></tr>';
      });
      html += '</tbody></table>';
    });
    wrap.innerHTML = html;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var bannerTimer = 0;
  function banner(title, sub, tone, secs) {
    var b = $('banner');
    $('banner-title').textContent = title; $('banner-sub').textContent = sub || '';
    if (tone) b.dataset.tone = tone; else delete b.dataset.tone;
    b.hidden = true; void b.offsetWidth; b.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.hidden = true; }, (secs || 2.5) * 1000);
  }
  function setHint(t) {
    var h = $('hud-hint');
    if (G.hintText === t) return;
    G.hintText = t;
    if (t) { h.textContent = t; h.hidden = false; } else h.hidden = true;
  }
  function hitMarker(kill, head) {
    if (!G.hud) return;
    var h = $('hitmarker');
    h.classList.remove('is-on', 'is-kill'); void h.offsetWidth;
    h.classList.add('is-on'); if (kill) h.classList.add('is-kill');
    if (S().hitsound || head || kill) A.hitConfirm(head, kill);
  }
  function addFeed(k, v, wid, head) {
    if (!G.hud) return;
    var ul = $('killfeed'), li = document.createElement('li');
    if ((k && k.isPlayer) || v.isPlayer) li.className = 'is-mine';
    var kn = k ? (k.isPlayer ? 'Вы' : k.name) : '—';
    li.innerHTML = '<b class="' + (k && k.team === 0 ? 'us' : 'them') + '"></b><span></span>' + (head ? '<i class="hs"></i>' : '') + '<b class="' + (v.team === 0 ? 'us' : 'them') + '"></b>';
    li.children[0].textContent = kn; li.children[1].textContent = RZ.WEAPONS[wid].name;
    li.lastElementChild.textContent = v.isPlayer ? 'Вы' : v.name;
    ul.appendChild(li);
    while (ul.children.length > 6) ul.removeChild(ul.firstChild);
    setTimeout(function () { li.classList.add('is-out'); }, 5000);
    setTimeout(function () { if (li.parentNode) li.parentNode.removeChild(li); }, 5450);
  }

  function onPlayerDeath(killer) {
    G.deathT = 0; G.killer = killer;
    G.player.scoped = false;
    closeBuy();
    if (G.hud) $('hud').classList.add('is-dead');
  }
  function specCandidates() {
    var l = G.fighters.filter(function (f) { return f.team === 0 && f.alive && !f.isPlayer; });
    if (!l.length) l = G.fighters.filter(function (f) { return f.alive && !f.isPlayer; });
    return l;
  }
  function cycleSpec() {
    var l = specCandidates(); if (!l.length) return;
    var i = l.indexOf(G.spec);
    G.spec = l[(i + 1) % l.length];
  }

  /* ================================================================== */
  /* Rendering: camera, view model, HUD                                 */
  /* ================================================================== */
  function ensureRenderer() {
    var q = S().quality, aa = q !== 'low';
    if (renderer && rendererAA !== aa) {
      renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
      renderer = null; rendererCount--;
    }
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: aa, powerPreference: 'high-performance' });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      renderer.autoClear = false;
      rendererAA = aa; rendererCount++;
    }
    return renderer;
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight, q = S().quality;
    var pr = Math.min(window.devicePixelRatio || 1, q === 'low' ? 1 : q === 'medium' ? 1.5 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    G.cam.aspect = w / h; G.vmCam.aspect = w / h;
    applyFov();
  }
  function baseVfov() {
    var hf = S().fov * Math.PI / 180, asp = G.cam.aspect || 1.6;
    return 2 * Math.atan(Math.tan(hf / 2) / asp) * 180 / Math.PI;
  }
  function applyFov() {
    var v = baseVfov(), p = G.player, w = p.weapon();
    G.cam.fov = p.alive && p.scopedNow() ? v / w.def.zoom : v;
    G.cam.updateProjectionMatrix();
    G.vmCam.fov = 60; G.vmCam.updateProjectionMatrix();
  }

  /* --- view model --- */
  function vmMaterials() {
    if (G.vmMats) return G.vmMats;
    var tr = G.world.track.bind(G.world);
    G.vmMats = {
      dark: tr(new THREE.MeshLambertMaterial({ color: '#26292b' })), metal: tr(new THREE.MeshLambertMaterial({ color: '#8a9196' })),
      grip: tr(new THREE.MeshLambertMaterial({ color: '#2c2b28' })), sleeve: tr(new THREE.MeshLambertMaterial({ color: '#3a536b' })),
      glove: tr(new THREE.MeshLambertMaterial({ color: '#6a5340' })), paint: {}
    };
    return G.vmMats;
  }
  function paintMat(wid, paint) {
    var M = vmMaterials(), key = Art.swatchKey(wid, paint);
    if (M.paint[key]) return M.paint[key];
    var tex = new THREE.CanvasTexture(Art.swatch(key));
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1 / Art.SWATCH_CM * 1.4, 1 / Art.SWATCH_CM * 1.4);
    G.world.track(tex);
    M.paint[key] = G.world.track(new THREE.MeshLambertMaterial({ map: tex }));
    return M.paint[key];
  }
  function vmLimb(group, geo, mat, a, b) {
    var m = new THREE.Mesh(geo, mat), dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(dx, dz); m.rotation.x = -Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));
    m.scale.set(1, 1, len);
    group.add(m);
  }
  function buildVm(wid, paint) {
    var key = wid + '|' + (paint || ''), M = vmMaterials();
    G.vmCache = G.vmCache || {};
    if (G.vmCache[key]) return G.vmCache[key];
    var W = RZ.WEAPONS[wid], grp = new THREE.Group();
    var geo = Act.getWeaponGeo(wid);
    var gun = new THREE.Mesh(geo, [paintMat(wid, paint), M.dark, M.metal, M.grip]);
    grp.add(gun);
    if (!G.vmLimbGeo) {
      G.vmLimbGeo = G.world.track(RZ.Models ? RZ.Models.vmLimbGeo() : new THREE.BoxGeometry(0.075, 0.075, 1));
      G.vmHandGeo = G.world.track(RZ.Models ? RZ.Models.vmHandGeo() : new THREE.BoxGeometry(0.05, 0.07, 0.09));
    }
    var LG = G.vmLimbGeo, HG = G.vmHandGeo;
    var grip = [0, -0.04, 0.01];
    if (wid === 'knife') {
      gun.rotation.set(0.25, 0, 0);
      vmLimb(grp, LG, M.sleeve, [0.06, -0.3, 0.32], [0.01, -0.03, 0.06]);
    } else {
      vmLimb(grp, LG, M.sleeve, [0.09, -0.32, 0.36], [0.012, -0.05, 0.04]);
      var front = W.hold2 ? [0, W.hold2[1] * 0.01 - 0.035, -W.hold2[0] * 0.01] : [0.004, -0.088, 0.012];
      vmLimb(grp, LG, M.sleeve, [-0.2, -0.32, 0.3], [front[0] - 0.02, front[1] - 0.02, front[2] + 0.06]);
      var hl = new THREE.Mesh(HG, M.glove); hl.position.set(front[0] - 0.012, front[1], front[2] + 0.02); grp.add(hl);
    }
    var hr = new THREE.Mesh(HG, M.glove); hr.position.set(grip[0] + 0.012, grip[1], grip[2] + 0.02); grp.add(hr);
    // muzzle flash sprite
    var mz = Act.muzzle(wid);
    if (!G.vmFlashMat) G.vmFlashMat = G.world.track(new THREE.SpriteMaterial({ map: G.world.texture(Art.sprite('flash')), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    var fl = new THREE.Sprite(G.vmFlashMat); fl.position.set(mz[0], mz[1], mz[2] - 0.04); fl.scale.set(0.16, 0.16, 0.16); fl.visible = false;
    grp.add(fl);
    var pose = W.slot === 1 ? [0.135, -0.15, -0.36] : W.slot === 2 ? [0.15, -0.15, -0.5] : [0.17, -0.17, -0.42];
    var entry = { group: grp, flash: fl, pose: pose, wid: wid };
    G.vmCache[key] = entry;
    return entry;
  }
  function updateVm(dt) {
    var p = G.player, w = p.weapon();
    var vis = p.alive && G.cameraOwner === p && !p.scopedNow() && w;
    G.vmRoot.visible = !!vis;
    if (!vis) return;
    var e = buildVm(w.id, w.paint);
    if (G.vmCur !== e) {
      if (G.vmCur) G.vmRoot.remove(G.vmCur.group);
      G.vmRoot.add(e.group); G.vmCur = e;
    }
    var def = w.def, sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
    G.bob += sp * dt * 1.55;
    var bk = p.onGround ? Math.min(1, sp / 5) : 0.2;
    var lefty = S().lefty ? -1 : 1;
    G.swayX *= Math.exp(-dt * 9); G.swayY *= Math.exp(-dt * 9);
    G.vmKick *= Math.exp(-dt * 16);
    var x = e.pose[0] + Math.sin(G.bob) * 0.012 * bk - clamp(G.swayX, -0.04, 0.04);
    var y = e.pose[1] - Math.abs(Math.cos(G.bob)) * 0.01 * bk + clamp(G.swayY, -0.04, 0.04) - p.crouchT * 0.01 + (p.onGround ? 0 : 0.012);
    var z = e.pose[2] + G.vmKick * (def.slot === 1 ? 0.05 : 0.035);
    var rx = G.vmKick * (def.mode === 'auto' ? 0.04 : 0.12), ry = 0, rz = 0;
    if (w.reloadT > 0 && def.kind === 'gun') {
      var t = def.shellReload ? 0.5 : 1 - w.reloadT / def.reload, d = Math.sin(clamp(t, 0, 1) * Math.PI);
      if (def.shellReload) d = 0.55;
      rx -= 0.45 * d; y -= 0.07 * d; rz += 0.35 * d; x -= 0.03 * d;
    }
    if (w.drawT > 0) { var dd = clamp(w.drawT / def.draw, 0, 1); y -= 0.22 * dd; rx -= 0.7 * dd; }
    if (def.kind === 'melee' && G.vmMelee) {
      G.vmMeleeT += dt;
      var dur = G.vmMelee === 2 ? 0.45 : 0.28, k = G.vmMeleeT / dur;
      if (k >= 1) G.vmMelee = 0;
      else {
        var s = Math.sin(k * Math.PI);
        if (G.vmMelee === 2) { z -= 0.16 * s; rx -= 0.3 * s; }
        else { x -= 0.16 * s; ry += 1.0 * s; rz += 0.5 * s; z -= 0.05 * s; }
      }
    }
    G.vmRoot.position.set(x * lefty, y, z);
    G.vmRoot.rotation.set(rx, ry * lefty, rz * lefty);
    G.vmRoot.scale.x = lefty;
    if (G.vmFlashT > 0) { G.vmFlashT -= dt; e.flash.visible = true; e.flash.material.rotation = Math.random() * 6; }
    else e.flash.visible = false;
  }

  var _v3 = null;
  function updateCamera(alpha, dt) {
    var p = G.player, cam = G.cam;
    if (p.alive || G.deathT < 1.3) {
      var ix = p.px + (p.x - p.px) * alpha, iy = p.py + (p.y - p.py) * alpha, iz = p.pz + (p.z - p.pz) * alpha;
      var eh = p.alive ? p.eyeH() : Math.max(0.35, p.eyeH() - G.deathT * 1.2);
      cam.position.set(ix, iy + eh, iz);
      var vk = viewKick(p, p.weapon());
      cam.rotation.set(p.pitch + vk[0], p.yaw - vk[1], p.alive ? 0 : Math.min(0.5, G.deathT * 0.6), 'YXZ');
      G.cameraOwner = p;
    } else {
      // spectate a living ally (third-person chase)
      if (!G.spec || !G.spec.alive) { var l = specCandidates(); G.spec = l.length ? l[0] : null; }
      var t = G.spec;
      G.cameraOwner = null;
      if (t) {
        // over-the-shoulder chase camera, pulled in when a wall is behind
        var tx = t.px + (t.x - t.px) * alpha, ty = t.py + (t.y - t.py) * alpha + t.eyeH() + 0.45, tz = t.pz + (t.z - t.pz) * alpha;
        var sp = t.pitch * 0.5 - 0.16, cp = Math.cos(sp), fx = -Math.sin(t.yaw) * cp, fy = Math.sin(sp), fz = -Math.cos(t.yaw) * cp;
        var sx = Math.cos(t.yaw) * 0.45, sz = -Math.sin(t.yaw) * 0.45;
        var back = G.world.raycast(tx + sx, ty, tz + sz, -fx, -fy, -fz, 3.4, null) - 0.3;
        back = Math.max(0.5, back);
        cam.position.set(tx + sx - fx * back, ty - fy * back, tz + sz - fz * back);
        cam.rotation.set(sp, t.yaw, 0, 'YXZ');
      }
    }
    if (!_v3) _v3 = new THREE.Vector3();
    A.setListener(cam.position.x, cam.position.y, cam.position.z, cam.rotation.y);
  }

  function hudSet(key, el, val, prop) {
    if (G.hudCache[key] === val) return;
    G.hudCache[key] = val;
    if (prop === 'style') el.style.setProperty('--v', val);
    else if (prop === 'class') { /* handled by caller */ }
    else el.textContent = val;
  }
  function updateHud(dt) {
    var p = G.player, w = p.weapon(), H = G.hudEls;
    var hp = Math.max(0, Math.ceil(p.hp)), ar = Math.ceil(p.armor);
    hudSet('hp', H.hp, String(hp)); hudSet('hpb', H.hpBar, (hp / 100).toFixed(3), 'style');
    hudSet('ar', H.ar, String(ar)); hudSet('arb', H.arBar, (ar / 100).toFixed(3), 'style');
    H.hpWrap.classList.toggle('is-low', hp <= 25);
    H.arWrap.classList.toggle('is-low', ar > 0 && ar <= 20);
    hudSet('money', H.money, RZ.fmt(p.money));
    if (w) {
      var melee = w.def.kind === 'melee';
      hudSet('mag', H.mag, melee ? '—' : String(w.mag));
      hudSet('res', H.res, melee ? '' : (w.reloadT > 0 ? 'перезарядка' : String(w.reserve)));
      H.ammo.classList.toggle('is-low', !melee && w.mag <= Math.ceil(w.def.mag * 0.2));
      hudSet('wname', H.wname, w.def.name + (w.paint && RZ.PAINT_BY_ID[w.paint] ? ' · «' + RZ.PAINT_BY_ID[w.paint].name + '»' : ''));
    }
    // slots
    var sk = [1, 2, 3].map(function (s) { var x = p.weapons[s]; return x ? s + ':' + x.id : ''; }).join(',') + '|' + p.slot;
    if (G.hudCache.slots !== sk) {
      G.hudCache.slots = sk;
      var html = '', binds = S().keys, kk = { 1: binds.primary, 2: binds.pistol, 3: binds.knife };
      [1, 2, 3].forEach(function (s) {
        var x = p.weapons[s]; if (!x) return;
        html += '<li' + (s === p.slot ? ' class="is-active"' : '') + '><kbd>' + esc(RZ.keyLabel(kk[s])) + '</kbd>' + esc(x.def.name) + '</li>';
      });
      H.slots.innerHTML = html;
    }
    hudSet('s0', H.s0, String(G.score[0])); hudSet('s1', H.s1, String(G.score[1]));
    var t = G.phase === 'freeze' ? G.phaseT : G.phase === 'live' ? G.phaseT : 0;
    t = Math.max(0, Math.ceil(t));
    hudSet('timer', H.timer, Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2));
    H.timer.classList.toggle('is-low', G.phase === 'live' && G.phaseT < 10);
    hudSet('round', H.round, G.phase === 'freeze' ? 'Подготовка · раунд ' + G.round : 'Раунд ' + G.round);
    // pips
    for (var team = 0; team < 2; team++) {
      var sig = 0, n = 0;
      for (var fi = 0; fi < G.fighters.length; fi++) { var ff = G.fighters[fi]; if (ff.team !== team) continue; sig = sig * 2 + (ff.alive ? 1 : 0) + 0; n++; }
      sig = sig * 16 + n;
      if (G.hudCache['pips' + team] === sig) continue;
      G.hudCache['pips' + team] = sig;
      var html2 = '';
      for (fi = 0; fi < G.fighters.length; fi++) { ff = G.fighters[fi]; if (ff.team === team) html2 += ff.alive ? '<i></i>' : '<i class="is-dead"></i>'; }
      (team ? H.pipsThem : H.pipsUs).innerHTML = html2;
    }
    // hint line
    G.hintHold = Math.max(0, (G.hintHold || 0) - dt);
    if (G.hintHold <= 0) {
      var hint = null;
      if (!p.alive) {
        hint = G.spec ? 'Наблюдение: ' + G.spec.name + (G.touchMode ? ' · касание — следующий' : ' · клик — следующий') : 'Вы выбыли до конца раунда';
      } else if (buyAllowed() && !G.buyOpen) hint = G.touchMode ? 'Закупка открыта — кнопка «Закупка»' : RZ.keyLabel(S().keys.buy) + ' — закупка';
      else if (w && w.def.kind === 'gun' && w.mag === 0 && w.reserve === 0) hint = G.touchMode ? 'Патроны кончились — смените оружие' : 'Патроны кончились — ' + RZ.keyLabel(S().keys.pistol) + ' пистолет, ' + RZ.keyLabel(S().keys.knife) + ' нож';
      else if (G.phase === 'post') hint = G.matchOver ? 'Матч окончен' : 'Следующий раунд через ' + Math.ceil(G.phaseT) + ' с';
      if (G.autoplay) hint = (hint ? hint + ' · ' : '') + 'автопилот';
      setHint(hint);
    }
    // crosshair, scope
    var scoped = p.alive && p.scopedNow();
    H.scope.hidden = !scoped;
    var hideCh = !p.alive || (w && w.def.scope);
    H.cross.classList.toggle('is-hidden', !!hideCh);
    if (S().chDynamic && w && p.alive) {
      var spr = calcSpread(p, w, scoped) - (w.def.spread ? (scoped && w.def.spread.scoped != null ? w.def.spread.scoped : w.def.spread.base) : 0);
      var px = Math.tan(spr) / Math.tan(G.cam.fov * Math.PI / 360) * (window.innerHeight / 2);
      var pv = Math.min(60, px).toFixed(1) + 'px';
      if (G.hudCache.spread !== pv) { G.hudCache.spread = pv; H.cross.style.setProperty('--ch-spread', pv); }
    } else if (G.hudCache.spread !== '0px') { G.hudCache.spread = '0px'; H.cross.style.setProperty('--ch-spread', '0px'); }
    // damage vignette
    if (G.dmgFlash > 0) { G.dmgFlash -= dt; H.damage.classList.add('is-on'); }
    else H.damage.classList.remove('is-on');
    if (G.buyOpen) { if (!buyAllowed()) closeBuy(); else if ((G.buyT = (G.buyT || 0) + dt) > 0.25) { G.buyT = 0; renderBuy(); } }
    if (G.scoreOn) { G.sbT = (G.sbT || 0) + dt; if (G.sbT > 0.3) { G.sbT = 0; renderScore(); } }
    // fps
    G.fpsN++; G.fpsT += dt;
    if (G.fpsT >= 0.5) { G.fps = Math.round(G.fpsN / G.fpsT); G.fpsN = 0; G.fpsT = 0; if (S().fps) H.fps.textContent = G.fps + ' к/с'; }
    H.fps.hidden = !S().fps;
  }

  function render(dt) {
    var alpha = clamp(G.acc / TICK, 0, 1);
    updateCamera(alpha, dt);
    for (var i = 0; i < G.fighters.length; i++) {
      var f = G.fighters[i];
      if (!f.model) continue;
      var x = f.x, y = f.y, z = f.z;
      f.x = f.px + (x - f.px) * alpha; f.y = f.py + (y - f.py) * alpha; f.z = f.pz + (z - f.pz) * alpha;
      Act.animate(f, G.paused ? 0 : dt);
      f.x = x; f.y = y; f.z = z;
      f.model.root.visible = !(f === G.cameraOwner && f.alive);
    }
    if (!G.paused) G.world.updateFx(dt);
    updateVm(dt);
    applyFov();
    renderer.clear();
    renderer.render(G.world.scene, G.cam);
    G.mainCalls = renderer.info.render.calls; G.mainTris = renderer.info.render.triangles;
    if (G.vmRoot.visible) { renderer.clearDepth(); renderer.render(G.vmScene, G.vmCam); }
    updateHud(dt);
  }

  function frame(now) {
    if (!G) return;
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.1, Math.max(0, (now - G.last) / 1000));
    G.last = now;
    if (document.hidden) return;
    if (G.touchMode && RZ.Touch) RZ.Touch.update(G, dt);
    if (!G.paused && !G.frozen && !G.rotateBlock) {
      G.acc += dt * G.timeScale;
      var n = 0;
      while (G.acc >= TICK && n < 10) { tick(TICK); G.acc -= TICK; n++; }
      if (n >= 10) G.acc = 0;
    }
    G.rendering = true;
    render(dt);
  }

  /* ================================================================== */
  /* Match lifecycle                                                    */
  /* ================================================================== */
  Game.start = function (opts) {
    if (G) Game.stop();
    opts = opts || {};
    var st = S(), map = RZ.getMap(opts.map || 'sklad');
    rebuildKeymap();
    A.init();
    A.setVolumes(st.vol, st.volSfx, st.volUi);
    document.body.dataset.mode = 'game';
    $('game').hidden = false;
    ['buy', 'scoreboard', 'pause', 'matchend', 'click-to-play', 'banner', 'scope'].forEach(function (id) { $(id).hidden = true; });
    $('killfeed').innerHTML = '';
    $('hud').classList.remove('is-dead');
    ensureRenderer();
    var aniso = renderer.capabilities.getMaxAnisotropy ? Math.min(st.quality === 'high' ? 8 : st.quality === 'medium' ? 4 : 1, renderer.capabilities.getMaxAnisotropy()) : 1;
    var world = new RZ.World(map, { quality: st.quality, shadows: st.shadows, anisotropy: aniso });
    G = {
      opts: opts, map: map, world: world, canvas: $('view'), fighters: [], byId: {}, time: 0, ticks: 0, acc: 0, last: performance.now(),
      phase: 'freeze', phaseT: FREEZE, round: 0, score: [0, 0], toWin: opts.rounds || 8, swapped: false, lossStreak: [0, 0],
      diff: RZ.DIFFICULTY[opts.difficulty || 'normal'], noises: [], intel: [{}, {}], tokens: 0, log: [],
      tally: { kills: 0, deaths: 0, hs: 0, rounds: 0, roundsWon: 0 }, stats: { stuckEvents: 0, unstuckTeleports: 0 },
      paused: false, over: false, frozen: false, locked: false, test: !!(opts.test || Game.testMode), god: false, autoplay: !!opts.autoplay,
      timeScale: 1, buyOpen: false, hud: true, hudCache: {}, swayX: 0, swayY: 0, bob: 0, vmKick: 0, vmFlashT: 0, dmgFlash: 0,
      fps: 0, fpsN: 0, fpsT: 0, rendering: false, shareIntel: shareIntel, bestIntel: bestIntel, roamPoint: roamPoint,
      switchSlot: switchSlot
    };
    Game.G = G;
    G.touchMode = !!(RZ.Touch && RZ.Touch.shouldEnable());
    Act.initShared(world.track.bind(world));
    // fighters
    var n = opts.team || 5;
    var usNames = RZ.BOT_NAMES_US.slice().sort(function () { return Math.random() - 0.5; });
    var themNames = RZ.BOT_NAMES_THEM.slice().sort(function () { return Math.random() - 0.5; });
    var id = 0;
    var player = new Fighter({ id: id++, name: RZ.Store.data.callsign || 'Новичок', team: 0, isPlayer: true });
    G.player = player; G.fighters.push(player);
    for (var i = 1; i < n; i++) G.fighters.push(new Fighter({ id: id++, name: usNames[i - 1], team: 0 }));
    for (i = 0; i < n; i++) G.fighters.push(new Fighter({ id: id++, name: themNames[i], team: 1 }));
    G.fighters.forEach(function (f) {
      G.byId[f.id] = f;
      f.model = Act.buildModel(f.team);
      world.scene.add(f.model.root);
    });
    // cameras and view model scene
    G.cam = new THREE.PerspectiveCamera(70, 1.6, 0.05, 600);
    G.vmCam = new THREE.PerspectiveCamera(54, 1.6, 0.01, 10);
    G.vmScene = new THREE.Scene();
    G.vmScene.add(new THREE.HemisphereLight('#eef3f6', '#6c6458', 2.2));
    var vd = new THREE.DirectionalLight('#fff3df', 2.4); vd.position.set(0.5, 1, 0.3); G.vmScene.add(vd);
    G.vmRoot = new THREE.Group(); G.vmScene.add(G.vmRoot);
    buildBuy();
    // touch: a close button in the sheet (the chip is under the overlay) and tap-outside-to-close
    var head = document.querySelector('#buy .sheet-head');
    if (!$('buy-close')) {
      var bc = document.createElement('button'); bc.className = 'btn buy-close'; bc.id = 'buy-close'; bc.textContent = 'Закрыть';
      bc.addEventListener('click', function () { if (G) closeBuy(); });
      head.appendChild(bc);
      $('buy').addEventListener('click', function (e) { if (G && G.touchMode && e.target === $('buy')) closeBuy(); });
    }
    G.hudEls = {
      hp: $('hud-health'), hpBar: $('hud-health-bar'), ar: $('hud-armor'), arBar: $('hud-armor-bar'),
      hpWrap: $('hud-health').parentNode, arWrap: $('hud-armor').parentNode, money: $('hud-money'),
      mag: $('hud-ammo-mag'), res: $('hud-ammo-reserve'), ammo: $('hud-ammo-mag').parentNode, wname: $('hud-weapon'),
      slots: $('hud-slots'), s0: $('hud-score-us'), s1: $('hud-score-them'), timer: $('hud-timer'), round: $('hud-round'),
      pipsUs: $('hud-alive-us'), pipsThem: $('hud-alive-them'), scope: $('scope'), cross: $('crosshair'), damage: $('damage'), fps: $('fps')
    };
    Game.applySettings();
    resize();
    // listeners
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    document.addEventListener('visibilitychange', onVisibility);
    Game.active = true;
    startRound();
    if (G.touchMode) touchOn();
    else if (needLock()) { lockPointer(); setTimeout(function () { if (G && needLock() && !G.locked && !G.paused && !G.over) $('click-to-play').hidden = false; }, 400); }
    raf = requestAnimationFrame(frame);
  };

  function removeListeners() {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('contextmenu', onContext);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('pointerlockchange', onLockChange);
    document.removeEventListener('pointerlockerror', onLockError);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  Game.stop = function () {
    if (!G) return;
    cancelAnimationFrame(raf);
    removeListeners();
    if (document.pointerLockElement && document.exitPointerLock) { G.expectUnlock = true; try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
    if (G.touchMode && RZ.Touch) RZ.Touch.detach();
    if (G.wentFullscreen && document.fullscreenElement && document.exitFullscreen) { try { var xf = document.exitFullscreen(); if (xf && xf.catch) xf.catch(function () {}); } catch (e) { /* ignore */ } }
    $('rotate').hidden = true;
    clearTimeout(bannerTimer);
    G.world.dispose();
    Act.disposeShared();
    if (renderer) { renderer.renderLists.dispose(); renderer.clear(); }
    keys = {}; mouse[0] = mouse[2] = false;
    G = null; Game.G = null; Game.active = false;
    $('game').hidden = true;
    document.body.dataset.mode = 'menu';
    document.body.classList.remove('settings-over');
  };

  function result() {
    return G.score[0] > G.score[1] ? 'win' : G.score[0] < G.score[1] ? 'lose' : 'draw';
  }
  function endMatch() {
    if (G.over) return;
    G.over = true; G.frozen = true;
    closeBuy(); showScore(false);
    var res = result();
    var bonus = RZ.TOKENS.played + (res === 'win' ? RZ.TOKENS.match : 0);
    G.tokens += bonus;
    var p = G.player, s = p.stats;
    var data = { result: res, us: G.score[0], them: G.score[1], map: G.map.id, tokens: G.tokens, kills: s.kills, deaths: s.deaths, hs: s.hs };
    if (RZ.UI && RZ.UI.onMatchEnd) RZ.UI.onMatchEnd(data);
    G.endData = data;
    if (G.hud) {
      A.sting(res === 'win' ? 'match' : 'lose');
      var stamp = $('end-stamp');
      stamp.dataset.result = res; stamp.textContent = res === 'win' ? 'Победа' : res === 'lose' ? 'Поражение' : 'Ничья';
      $('end-score').textContent = G.score[0] + ' : ' + G.score[1];
      var acc = s.shots ? Math.round(s.hits / s.shots * 100) + '%' : '—';
      var cells = [['Убийства', s.kills], ['Смерти', s.deaths], ['В голову', s.hs], ['Точность', acc], ['Урон', Math.round(s.dmg)], ['Раунды', G.tally.roundsWon + ' из ' + G.tally.rounds]];
      $('end-tally').innerHTML = cells.map(function (c) { return '<div><dt>' + c[0] + '</dt><dd>' + c[1] + '</dd></div>'; }).join('');
      $('end-reward').textContent = '+' + RZ.fmt(G.tokens);
      $('matchend').hidden = false; $('click-to-play').hidden = true; $('pause').hidden = true;
      unlockPointer();
    }
  }

  Game.quit = function () {
    if (!G) return;
    if (!G.over && RZ.UI && RZ.UI.onMatchEnd) {
      RZ.UI.onMatchEnd({ result: 'quit', us: G.score[0], them: G.score[1], map: G.map.id, tokens: G.tokens, kills: G.player.stats.kills, deaths: G.player.stats.deaths, hs: G.player.stats.hs });
    }
    Game.stop();
  };
  Game.again = function () {
    var o = G ? G.opts : {};
    Game.stop();
    Game.start(o);
  };
  Game.lock = function () { if (G && G.dragLook) { $('click-to-play').hidden = true; return; } lockPointer(); };

  /* ---- touch mode ---- */
  function touchOn() {
    G.touchMode = true;
    $('click-to-play').hidden = true;
    unlockPointer();
    RZ.Touch.attach(G);
    // try fullscreen + landscape; both may be refused (sandbox, desktop, iOS) — ignore
    try {
      var el = document.documentElement, rf = el.requestFullscreen || el.webkitRequestFullscreen;
      var lockOri = function () {
        try { if (screen.orientation && screen.orientation.lock) { var lp = screen.orientation.lock('landscape'); if (lp && lp.catch) lp.catch(function () {}); } } catch (e) { /* ignore */ }
      };
      if (rf && !document.fullscreenElement) {
        var fp = rf.call(el);
        G.wentFullscreen = true;
        if (fp && fp.then) fp.then(lockOri, function () { G.wentFullscreen = false; });
        else lockOri();
      } else lockOri();
    } catch (e) { /* ignore */ }
  }
  /* auto mode: the first touch during a match switches to the touch layout */
  Game.enableTouch = function () { if (G && !G.touchMode && !G.over) touchOn(); };
  Game.api = {
    get G() { return G; },
    lookTouch: function (dx, dy) { if (G) lookTouch(dx, dy); },
    swap: function () {
      if (!G || !G.player.alive || G.autoplay) return;
      var p = G.player;
      for (var k = 1; k <= 3; k++) { var sl = ((p.slot - 1 + k) % 3) + 1; if (p.weapons[sl]) { switchSlot(p, sl); return; } }
    },
    toggleBuy: function () { if (!G) return; if (G.buyOpen) closeBuy(); else openBuy(); },
    toggleScore: function () { if (G) showScore(!G.scoreOn); },
    pause: function () { openPause(); },
    cycleSpec: function () { if (G && !G.player.alive) cycleSpec(); },
    buyAllowed: function () { return !!G && buyAllowed(); }
  };
  Game.isPaused = function () { return !!(G && G.paused); };
  Game.resume = function () { resume(); };

  /* settings changed in the menu (also while paused) */
  Game.applySettings = function () {
    var st = S(), root = document.documentElement;
    var vars = { '--ch-color': st.chColor, '--ch-size': st.chSize + 'px', '--ch-gap': st.chGap + 'px', '--ch-thick': st.chThick + 'px' };
    // .crosshair declares its own defaults, so set the values on the elements as well as on :root
    var els = [root].concat([].slice.call(document.querySelectorAll('.crosshair')));
    els.forEach(function (el) { for (var k in vars) el.style.setProperty(k, vars[k]); });
    [].slice.call(document.querySelectorAll('.crosshair')).forEach(function (el) { el.classList.toggle('has-dot', !!st.chDot); });
    A.setVolumes(st.vol, st.volSfx, st.volUi);
    if (RZ.Touch) RZ.Touch.applySettings(st);
    if (!G) return;
    rebuildKeymap();
    G.hudCache = {};
    if (renderer) {
      resize();
      var sh = !!st.shadows;
      if (G.world.sun && G.world.sun.castShadow !== sh) { G.world.sun.castShadow = sh; }
    }
  };

  /* ================================================================== */
  /* Debug / test hook                                                  */
  /* ================================================================== */
  function snapshot() {
    if (!G) return { mode: document.body.dataset.mode, active: false, renderers: rendererCount };
    var p = G.player, w = p.weapon();
    return {
      mode: document.body.dataset.mode, active: true, map: G.map.id, phase: G.phase, phaseT: +G.phaseT.toFixed(2), round: G.round,
      score: G.score.slice(), toWin: G.toWin, alive: [aliveCount(0), aliveCount(1)], over: G.over, paused: G.paused, time: +G.time.toFixed(2),
      tokens: G.tokens, swapped: G.swapped, fps: G.fps, log: G.log.slice(), stats: Object.assign({}, G.stats), tally: Object.assign({}, G.tally),
      player: { hp: p.hp, armor: p.armor, money: p.money, alive: p.alive, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, weapon: w && w.id, mag: w && w.mag, reserve: w && w.reserve, slot: p.slot, scoped: p.scopedNow(), crouch: p.crouchT, onGround: p.onGround, kills: p.stats.kills },
      fighters: G.fighters.map(function (f) { return { id: f.id, name: f.name, team: f.team, alive: f.alive, x: +f.x.toFixed(2), y: +f.y.toFixed(2), z: +f.z.toFixed(2), hp: f.hp, weapon: f.weaponId(), money: f.money, kills: f.stats.kills, shots: f.stats.shots, hits: f.stats.hits, target: f.ai && f.ai.target ? f.ai.target.id : null }; }),
      buyOpen: G.buyOpen, locked: G.locked, renderers: rendererCount,
      memory: renderer ? { mainCalls: G.mainCalls, mainTris: G.mainTris, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, calls: renderer.info.render.calls, programs: renderer.info.programs ? renderer.info.programs.length : 0 } : null
    };
  }
  window.__rubezh = {
    state: snapshot,
    start: function (o) { o = o || {}; o.test = o.test !== false; Game.start(o); return snapshot(); },
    test: function (on) { Game.testMode = on !== false; if (G) G.test = Game.testMode; },
    god: function (on) { if (G) G.god = on !== false; },
    autoplay: function (on) { if (G) { G.autoplay = on !== false; if (G.autoplay) planBots(); } },
    timeScale: function (s) { if (G) G.timeScale = s; },
    /* suspend round flow (phase timers, round end) for isolated mechanics tests */
    sandbox: function (on) { if (G) { G.sandbox = on !== false; if (G.sandbox) { G.phase = 'live'; G.phaseT = 99; } } },
    /* run the simulation synchronously for `sec` seconds (no rendering) */
    step: function (sec) {
      if (!G) return null;
      var n = Math.round(sec / TICK), wasR = G.rendering;
      G.rendering = false;
      for (var i = 0; i < n && G && !G.over; i++) tick(TICK);
      if (G) G.rendering = wasR;
      return snapshot();
    },
    /* force a phase change (e.g. skip the freeze time) */
    skip: function () { if (G) G.phaseT = 0.01; },
    render: function () { if (G) { render(0.016); } },
    key: function (code, down) { (down === false ? onKeyUp : onKeyDown)({ code: code, preventDefault: function () {}, repeat: false, ctrlKey: false }); },
    mouse: function (btn, down) { mouse[btn] = down !== false; },
    look: function (dx, dy) { if (G) { var l = G.locked; G.locked = true; look(dx, dy); G.locked = l; } },
    setAim: function (yaw, pitch) { if (G) { G.player.yaw = yaw; G.player.pitch = pitch; } },
    give: function (id) { if (G) { var p = G.player, d = RZ.WEAPONS[id]; p.weapons[d.slot] = newWeapon(id, equippedPaint(id)); p.slot = d.slot; } },
    teleport: function (x, z, y) { if (G) { var p = G.player; p.x = p.px = x; p.z = p.pz = z; p.y = p.py = y || 0; } },
    pause: function () { openPause(); }, resume: function () { resume(); },
    buy: function (id) { playerBuy(id); },
    openBuy: function () { if (G) openBuy(); },
    showScore: function (on) { showScore(on !== false); },
    endMatch: function () { if (G) { G.matchOver = true; endMatch(); } },
    pattern: function (id) { var d = RZ.WEAPONS[id]; return d && d.pattern ? d.pattern.map(function (p) { return p.slice(); }) : null; },
    /* fires a full magazine from a standstill and returns per-shot offsets (deterministic part + actual direction) */
    sprayTest: function (id) {
      if (!G) return null;
      var p = G.player, d = RZ.WEAPONS[id];
      var keep = { phase: G.phase, phaseT: G.phaseT, god: G.god, alive: p.alive, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, ap: G.autoplay };
      G.phase = 'live'; G.phaseT = 99; G.god = true; G.autoplay = false; p.alive = true;
      p.weapons[d.slot] = newWeapon(id, null); p.slot = d.slot;
      var w = p.weapons[d.slot]; w.log = []; w.reserve = 0;
      p.vx = p.vz = 0; p.crouchT = 0; p.yaw = 0; p.pitch = 0;
      var hud = G.hud; G.hud = false; var rr = G.rendering; G.rendering = false;
      var others = G.fighters.filter(function (f) { return f !== p && f.alive; });
      others.forEach(function (f) { f.alive = false; f._tmp = true; });
      for (var i = 0; i < 400 && w.mag > 0; i++) {
        p.wantFire = true; p.wishX = p.wishZ = 0;
        G.time += TICK; updateWeapon(p, TICK);
        p.vx = p.vz = 0;
      }
      others.forEach(function (f) { if (f._tmp) { f.alive = true; delete f._tmp; } });
      var log = w.log; w.log = null;
      p.wantFire = false;
      G.phase = keep.phase; G.phaseT = keep.phaseT; G.god = keep.god; G.autoplay = keep.ap; G.hud = hud; G.rendering = rr;
      p.yaw = keep.yaw; p.pitch = keep.pitch;
      return log;
    },
    renderers: function () { return rendererCount; },
    /* recorded-sample status: decode counts/durations and per-sample play counters (synth fallbacks too) */
    audio: function () {
      var d = A.debug;
      return { state: A.state(), ready: d.ready, total: d.total, decoded: d.decoded, failed: d.failed.slice(), durations: A.sampleInfo(),
        plays: Object.assign({}, d.plays), synth: Object.assign({}, d.synth) };
    }
  };
})();
