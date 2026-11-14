/* Рубеж — WebAudio synthesis. No samples: every sound is noise + oscillators.
   Positional sounds use distance attenuation, a distance low-pass and stereo pan. */
(function () {
  'use strict';
  var RZ = window.RZ;
  var A = (RZ.Audio = {});
  var ctx = null, master, sfxBus, uiBus, noiseBuf, voices = 0;
  var vol = { all: 0.7, sfx: 0.9, ui: 0.5 };
  var L = { x: 0, y: 0, z: 0, yaw: 0 };

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.15;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    uiBus = ctx.createGain(); uiBus.connect(master);
    var len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    apply();
  };
  function apply() {
    if (!ctx) return;
    master.gain.value = vol.all;
    sfxBus.gain.value = vol.sfx;
    uiBus.gain.value = vol.ui;
  }
  A.setVolumes = function (all, sfx, ui) { vol.all = all; vol.sfx = sfx; vol.ui = ui; apply(); };
  A.ready = function () { return !!ctx && ctx.state === 'running'; };
  A.setListener = function (x, y, z, yaw) { L.x = x; L.y = y; L.z = z; L.yaw = yaw; };

  /* ---------- building blocks ---------- */
  function track(node, dur) {
    voices++;
    setTimeout(function () { voices--; }, (dur + 0.1) * 1000);
    return node;
  }
  /* output chain for a sound: returns the input node */
  function out(bus, pos, gain) {
    var g = ctx.createGain(), node = g;
    g.gain.value = gain;
    if (pos) {
      var dx = pos.x - L.x, dy = (pos.y || 0) - L.y, dz = pos.z - L.z;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var att = 1 / (1 + Math.pow(dist / 9, 1.35));
      g.gain.value = gain * att;
      // listener right vector for yaw (camera looks along -z at yaw 0)
      var rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
      var pan = dist > 0.3 ? (dx * rx + dz * rz) / dist : 0;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 18000 * Math.exp(-dist / 22));
      if (ctx.createStereoPanner) {
        var p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.85, Math.min(0.85, pan * 0.85));
        g.connect(lp); lp.connect(p); p.connect(bus);
      } else { g.connect(lp); lp.connect(bus); }
    } else g.connect(bus);
    return node;
  }
  function noise(dest, t, dur, type, freq, q, peak, decay, rate) {
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.playbackRate.value = rate || 1;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5, dur);
    return f;
  }
  function tone(dest, t, type, f0, f1, peak, decay, attack) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + decay + 0.05);
  }
  function ok() { return ctx && ctx.state === 'running' && voices < 56; }

  /* ---------- weapons ---------- */
  var SHOT = {
    pistol: { lp: 4200, dec: 0.13, th: [170, 60], thd: 0.09, g: 0.75, crack: 0.25 },
    heavy: { lp: 2700, dec: 0.24, th: [115, 38], thd: 0.14, g: 1.0, crack: 0.45 },
    smg: { lp: 5200, dec: 0.075, th: [200, 80], thd: 0.06, g: 0.55, crack: 0.2 },
    shotgun: { lp: 1700, dec: 0.38, th: [85, 32], thd: 0.2, g: 1.15, crack: 0.3 },
    rifle: { lp: 3600, dec: 0.17, th: [125, 44], thd: 0.11, g: 0.9, crack: 0.5 },
    carbine: { lp: 4400, dec: 0.12, th: [150, 58], thd: 0.08, g: 0.75, crack: 0.38 },
    sniper: { lp: 3000, dec: 0.5, th: [72, 28], thd: 0.22, g: 1.25, crack: 0.8, tail: true }
  };
  A.shot = function (kind, pos) {
    if (!ok()) return;
    if (kind === 'knife') { A.knife(pos); return; }
    var p = SHOT[kind] || SHOT.pistol, t = ctx.currentTime;
    var far = pos ? Math.hypot(pos.x - L.x, pos.z - L.z) : 0;
    var dest = out(sfxBus, pos, p.g * (pos ? 1.1 : 0.8));
    noise(dest, t, p.dec + 0.05, 'lowpass', p.lp * (far > 25 ? 0.6 : 1), 0.8, 0.9, p.dec, 0.9 + Math.random() * 0.2);
    if (p.crack) noise(dest, t, 0.04, 'highpass', 2500, 0.7, p.crack, 0.035, 1.2);
    tone(dest, t, 'triangle', p.th[0] * (0.95 + Math.random() * 0.1), p.th[1], 0.8, p.thd);
    if (p.tail || far > 18) noise(dest, t + 0.05, 0.6, 'lowpass', 900, 0.5, p.tail ? 0.35 : 0.15, p.tail ? 0.7 : 0.4, 0.6);
    track(dest, p.dec + 0.8);
  };
  A.knife = function (pos) {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, pos, 0.45);
    var f = noise(dest, t, 0.2, 'bandpass', 900, 2.5, 0.8, 0.17, 1);
    f.frequency.exponentialRampToValueAtTime(3800, t + 0.15);
    track(dest, 0.3);
  };
  A.dry = function () {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, null, 0.3);
    tone(dest, t, 'square', 1800, 1500, 0.3, 0.025); track(dest, 0.1);
  };
  /* reload: kind 'out' (mag out), 'in' (mag in), 'bolt', 'shell', 'pump' */
  A.mech = function (kind, pos) {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, pos, 0.5);
    if (kind === 'out') { noise(dest, t, 0.06, 'bandpass', 2200, 3, 0.6, 0.05); tone(dest, t, 'square', 700, 400, 0.15, 0.04); }
    else if (kind === 'in') { noise(dest, t, 0.05, 'bandpass', 3000, 4, 0.8, 0.04); tone(dest, t + 0.01, 'square', 1100, 600, 0.2, 0.03); noise(dest, t + 0.07, 0.04, 'bandpass', 4200, 5, 0.5, 0.03); }
    else if (kind === 'bolt' || kind === 'pump') {
      noise(dest, t, 0.08, 'bandpass', kind === 'pump' ? 1300 : 2600, 2, 0.7, 0.07);
      noise(dest, t + 0.16, 0.08, 'bandpass', kind === 'pump' ? 1700 : 3400, 3, 0.8, 0.06);
    } else if (kind === 'shell') { noise(dest, t, 0.05, 'bandpass', 2000, 3, 0.6, 0.05); tone(dest, t, 'triangle', 500, 300, 0.2, 0.05); }
    else if (kind === 'draw') { noise(dest, t, 0.1, 'bandpass', 1600, 2, 0.35, 0.09); }
    track(dest, 0.4);
  };
  A.step = function (pos, soft) {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, pos, pos ? 0.55 : 0.22);
    noise(dest, t, 0.08, 'lowpass', soft ? 500 : 900 + Math.random() * 300, 1, 0.8, 0.07, 0.7 + Math.random() * 0.3);
    tone(dest, t, 'sine', 90 + Math.random() * 30, 50, 0.35, 0.06);
    track(dest, 0.15);
  };
  A.land = function () {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, null, 0.35);
    noise(dest, t, 0.1, 'lowpass', 600, 1, 0.9, 0.1, 0.6); tone(dest, t, 'sine', 70, 40, 0.5, 0.1); track(dest, 0.2);
  };
  /* player got hit */
  A.hurt = function () {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, null, 0.55);
    noise(dest, t, 0.12, 'lowpass', 700, 1, 0.9, 0.12, 0.5); tone(dest, t, 'sine', 140, 60, 0.6, 0.14); track(dest, 0.2);
  };
  /* feedback when the player hits someone */
  A.hitConfirm = function (head, kill) {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, null, 0.4);
    if (head) { tone(dest, t, 'sine', 1900, 1900, 0.5, 0.35); tone(dest, t, 'sine', 3800, 3800, 0.15, 0.2); }
    else tone(dest, t, 'square', 2400, 1800, 0.12, 0.03);
    if (kill) tone(dest, t + 0.05, 'triangle', 660, 660, 0.3, 0.25);
    track(dest, 0.4);
  };
  A.impact = function (pos, flesh) {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(sfxBus, pos, flesh ? 0.5 : 0.25);
    if (flesh) { noise(dest, t, 0.06, 'lowpass', 900, 1, 0.8, 0.06, 0.6); }
    else noise(dest, t, 0.05, 'bandpass', 3200 + Math.random() * 1500, 2, 0.6, 0.04);
    track(dest, 0.1);
  };

  /* ---------- stingers ---------- */
  A.sting = function (kind) {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(uiBus, null, 0.55), seq;
    if (kind === 'start') seq = [[440, 0], [660, 0.12]];
    else if (kind === 'win') seq = [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.32]];
    else if (kind === 'lose') seq = [[440, 0], [392, 0.14], [311, 0.3]];
    else if (kind === 'draw') seq = [[440, 0], [440, 0.18]];
    else if (kind === 'match') seq = [[392, 0], [523, 0.14], [659, 0.28], [784, 0.42], [1046, 0.6]];
    else seq = [[600, 0]];
    seq.forEach(function (n) {
      tone(dest, t + n[1], 'triangle', n[0], n[0], 0.45, 0.34);
      tone(dest, t + n[1], 'sine', n[0] * 2, n[0] * 2, 0.12, 0.25);
    });
    track(dest, 1.2);
  };

  /* ---------- menu ---------- */
  A.ui = function (kind, arg) {
    if (!ok()) return;
    var t = ctx.currentTime, dest = out(uiBus, null, 0.6);
    if (kind === 'click') tone(dest, t, 'square', 900, 500, 0.12, 0.03);
    else if (kind === 'tick') { tone(dest, t, 'square', 1500, 900, 0.18, 0.018); noise(dest, t, 0.02, 'highpass', 3000, 1, 0.2, 0.015); }
    else if (kind === 'shot') {
      // muffled shot behind paper
      noise(dest, t, 0.2, 'lowpass', 1100, 0.8, 0.9, 0.16, 0.8);
      tone(dest, t, 'triangle', 120, 40, 0.7, 0.12);
    } else if (kind === 'error') { tone(dest, t, 'square', 220, 180, 0.2, 0.12); tone(dest, t + 0.13, 'square', 180, 150, 0.2, 0.14); }
    else if (kind === 'buy') { tone(dest, t, 'triangle', 880, 880, 0.3, 0.08); tone(dest, t + 0.06, 'triangle', 1320, 1320, 0.25, 0.1); }
    else if (kind === 'coin') { tone(dest, t, 'sine', 1300, 1300, 0.3, 0.1); tone(dest, t + 0.07, 'sine', 1750, 1750, 0.25, 0.18); }
    else if (kind === 'reveal') {
      var r = arg || 1, base = [392, 440, 523, 587, 659][r - 1];
      for (var i = 0; i < r + 1; i++) tone(dest, t + i * 0.09, 'triangle', base * Math.pow(1.26, i), base * Math.pow(1.26, i), 0.4, 0.4);
      noise(dest, t, 0.3, 'highpass', 5000, 0.5, 0.15 * r, 0.3);
    }
    track(dest, 1);
  };
})();
