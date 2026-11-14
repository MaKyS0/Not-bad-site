/* Рубеж — touch controls (Pointer Events, multi-touch). Each pointerId is tracked on its own:
   left zone = floating joystick, right zone = look, buttons on top. Produces an input state the
   game merges with keyboard/mouse (G.touch) and calls Game.api for view rotation and actions. */
(function () {
  'use strict';
  var RZ = window.RZ;
  var T = (RZ.Touch = { seen: false });
  var $ = function (id) { return document.getElementById(id); };
  function S() { return RZ.Store.data.settings; }

  var state = null, ptrs = {}, attached = false, G = null, layer = null;
  var DEAD = 0.12, WALK = 0.55;

  function fresh() { return { mx: 0, mz: 0, walk: false, fire: false, alt: false, crouch: false, jumpP: false, reloadP: false, autofire: !!S().touchAutofire }; }

  /* auto mode: coarse pointer or a touch already seen */
  T.shouldEnable = function () {
    var m = S().touchMode;
    if (m === 'on') return true;
    if (m === 'off') return false;
    var coarse = false;
    try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = false; }
    return T.seen || coarse;
  };
  // first real touch anywhere: remember it; during a match in auto mode switch the layout on
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    T.seen = true;
    if (RZ.Game && RZ.Game.active && S().touchMode === 'auto' && RZ.Game.enableTouch) RZ.Game.enableTouch();
  }, true);

  T.applySettings = function (st) {
    var el = $('touch'); if (!el) return;
    el.style.setProperty('--t-scale', String(st.touchSize || 1));
    el.classList.toggle('is-mirror', !!st.touchMirror);
    document.body.classList.toggle('touch-mirror', !!st.touchMirror); // lets the HUD killfeed move away from the chips
    if (state) state.autofire = !!st.touchAutofire;
    el.style.setProperty('--t-alpha', String(st.touchAlpha == null ? 1 : st.touchAlpha));
    T.applyLayout(st);
  };

  /* ================================================================== */
  /* Custom layout (from the layout editor)                              */
  /* Each moved control is stored as its centre anchored to the nearest  */
  /* horizontal and vertical screen edge: {ax:'l'|'r', ox:px, ay:'t'|'b', */
  /* oy:px, s:scale}. Px from the nearest edge keeps thumb reach the same */
  /* on wider/taller screens; positions are clamped on screen. The       */
  /* layout is stored un-mirrored; the mirror option flips it.           */
  /* ================================================================== */
  T.CTLS = ['fire', 'aim', 'jump', 'crouch', 'reload', 'swap', 'stick', 'top'];
  T.CTL_NAMES = { fire: 'Огонь', aim: 'Прицел', jump: 'Прыжок', crouch: 'Присесть', reload: 'Перезарядка', swap: 'Смена оружия', stick: 'Джойстик', top: 'Верхние кнопки' };
  /* base diameter factor relative to --t for each control (matches the CSS) */
  T.CTL_K = { fire: 1.5, aim: 1, jump: 1, crouch: 1, reload: 1, swap: 1, stick: 2.2, top: 1 };
  T.ctlElement = function (root, ctl) {
    if (ctl === 'top') return root.querySelector('.t-top');
    if (ctl === 'stick') return root.querySelector('.t-stick');
    return root.querySelector('.t-' + ctl);
  };
  T.validEntry = function (e) {
    return e && (e.ax === 'l' || e.ax === 'r') && (e.ay === 't' || e.ay === 'b') && isFinite(e.ox) && isFinite(e.oy) && isFinite(e.s) && e.s >= 0.4 && e.s <= 2;
  };
  /* entry → centre in px for a W×H screen (mirror flips x) */
  T.entryCenter = function (e, W, H, mirror) {
    var x = e.ax === 'l' ? e.ox : W - e.ox, y = e.ay === 't' ? e.oy : H - e.oy;
    if (mirror) x = W - x;
    return { x: x, y: y };
  };
  /* centre → entry (un-mirrored) */
  T.centerEntry = function (x, y, W, H, mirror, scale) {
    if (mirror) x = W - x;
    return { ax: x < W / 2 ? 'l' : 'r', ox: Math.round(x < W / 2 ? x : W - x), ay: y < H / 2 ? 't' : 'b', oy: Math.round(y < H / 2 ? y : H - y), s: +(+scale).toFixed(2) };
  };
  T.clampCenter = function (c, half, W, H) {
    var m = 4;
    c.x = Math.max(half.x + m, Math.min(W - half.x - m, c.x));
    c.y = Math.max(half.y + m, Math.min(H - half.y - m, c.y));
    return c;
  };
  function ctlScale(ctl) { var L = S().touchLayout || {}, e = L[ctl]; return T.validEntry(e) ? e.s : 1; }
  /* place one control element given its centre; sizes are analytic so hidden controls work too */
  T.placeCtl = function (el, ctl, c, scale, baseT) {
    var t = baseT * scale, size = t * T.CTL_K[ctl];
    el.style.right = 'auto'; el.style.bottom = 'auto';
    if (ctl === 'top') {
      el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
      el.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
      return;
    }
    el.style.setProperty('--t', t + 'px');
    if (ctl === 'stick') { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; el.style.marginRight = '0'; return; }
    el.style.left = (c.x - size / 2) + 'px'; el.style.top = (c.y - size / 2) + 'px';
  };
  T.clearCtl = function (el) {
    ['left', 'top', 'right', 'bottom', 'transform', 'marginRight', 'width', 'height'].forEach(function (k) { el.style[k] = ''; });
    el.style.removeProperty('--t');
  };
  T.halfSize = function (el, ctl, scale, baseT) {
    if (ctl === 'top') { var w = el.offsetWidth || 200, h = el.offsetHeight || 40; return { x: w * scale / 2, y: h * scale / 2 }; }
    var r = baseT * scale * T.CTL_K[ctl] / 2;
    return { x: r, y: r };
  };
  var restStick = null;
  T.applyLayout = function (st) {
    var layer = $('touch'); if (!layer) return;
    st = st || S();
    var L = st.touchLayout || {}, W = window.innerWidth, H = window.innerHeight, baseT = 58 * (st.touchSize || 1);
    restStick = null;
    T.CTLS.forEach(function (ctl) {
      var el = T.ctlElement(layer, ctl), e = L[ctl];
      if (!el) return;
      if (ctl === 'stick' && el.classList.contains('is-on')) { if (T.validEntry(e)) restStick = { e: e }; return; }
      T.clearCtl(el);
      if (!T.validEntry(e)) return;
      var c = T.clampCenter(T.entryCenter(e, W, H, !!st.touchMirror), T.halfSize(el, ctl, e.s, baseT), W, H);
      T.placeCtl(el, ctl, c, e.s, baseT);
      if (ctl === 'stick') restStick = { e: e };
    });
    T.layoutW = W; T.layoutH = H;
  };

  function btnSize() { return 58 * (S().touchSize || 1) * ctlScale('stick'); }
  function local(e) {
    var r = layer.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* ---------- joystick ---------- */
  function stickDown(p, e) {
    var l = local(e), st = $('t-stick');
    p.ox = l.x; p.oy = l.y;
    st.style.left = l.x + 'px'; st.style.top = l.y + 'px';
    // the mirrored CSS anchors the stick with right/margin-right; neutralise them while placed
    st.style.right = 'auto'; st.style.marginRight = '0';
    st.classList.add('is-on');
    stickMove(p, e);
  }
  function stickMove(p, e) {
    var l = local(e), R = btnSize() * 1.1, dx = l.x - p.ox, dy = l.y - p.oy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > R) { dx *= R / d; dy *= R / d; d = R; }
    $('t-knob').style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    var m = d / R, nx = dx / R, ny = dy / R;
    if (m < DEAD) { state.mx = state.mz = 0; state.walk = false; return; }
    // small deflection = quiet walk (speed scales), full deflection = run
    var scale;
    if (m < WALK) { state.walk = true; scale = Math.max(0.45, m / WALK) / m; }
    else { state.walk = false; scale = 1 / m; }
    state.mx = nx * scale; state.mz = -ny * scale;
  }
  function stickUp() {
    var st = $('t-stick');
    st.classList.remove('is-on');
    st.style.left = st.style.top = st.style.right = st.style.marginRight = '';
    $('t-knob').style.transform = '';
    if (restStick) T.applyLayout(S()); // back to the custom resting spot
    state.mx = state.mz = 0; state.walk = false;
  }

  /* ---------- buttons ---------- */
  function press(id, el) {
    var A = RZ.Game.api;
    if (RZ.Audio) RZ.Audio.init();
    switch (id) {
      case 't-fire': state.fire = true; break;
      case 't-aim': state.alt = true; break;
      case 't-jump': state.jumpP = true; break;
      case 't-crouch': state.crouch = !state.crouch; break;
      case 't-reload': state.reloadP = true; break;
      case 't-swap': A.swap(); break;
      case 't-buy': A.toggleBuy(); break;
      case 't-score': A.toggleScore(); T.scoreAt = performance.now(); T.scorePtr = T.curPtr; break;
      case 't-pause': A.pause(); break;
    }
    if (id !== 't-crouch') el.classList.add('is-on');
  }
  function release(id, el) {
    if (id === 't-fire') state.fire = anyRole('fire');
    if (id === 't-aim') state.alt = false;
    if (id !== 't-crouch') el.classList.remove('is-on');
  }
  function anyRole(role) { for (var k in ptrs) if (ptrs[k].role === role) return true; return false; }

  /* ---------- pointer routing ---------- */
  function onDown(e) {
    if (!attached) return;
    e.preventDefault();
    var t = e.target, btn = t.closest && t.closest('.t-btn, .t-chip');
    var p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: e.timeStamp, moved: 0 };
    if (btn) {
      p.role = btn.id === 't-fire' ? 'fire' : 'btn'; p.el = btn;
      ptrs[e.pointerId] = p;
      T.curPtr = e.pointerId;
      press(btn.id, btn);
    } else if (t.id === 't-move') {
      if (anyRole('move')) return; // one stick at a time
      p.role = 'move'; ptrs[e.pointerId] = p; stickDown(p, e);
    } else {
      p.role = 'look'; ptrs[e.pointerId] = p;
    }
    try { (btn || t).setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  }
  function onMove(e) {
    var p = ptrs[e.pointerId]; if (!p) return;
    if (e.cancelable) e.preventDefault();
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
    if (p.role === 'move') stickMove(p, e);
    else if (p.role === 'look' || p.role === 'fire') RZ.Game.api.lookTouch(dx, dy);
  }
  function onUp(e) {
    var p = ptrs[e.pointerId]; if (!p) return;
    delete ptrs[e.pointerId];
    if (p.role === 'move') stickUp();
    else if (p.role === 'fire' || p.role === 'btn') release(p.el.id, p.el);
    else if (p.role === 'look' && e.type === 'pointerup' && p.moved < 16) {
      // tap (no drag) on the look zone: nothing in play, next ally while spectating
      RZ.Game.api.cycleSpec();
    }
  }
  function onScoreTap(e) {
    if (!attached || !G || !G.scoreOn) return;
    // ignore the click produced by the same touch that opened the sheet
    if (e && e.pointerId != null && e.pointerId > 0) { if (e.pointerId === T.scorePtr) return; }
    else if (performance.now() - (T.scoreAt || 0) < 400) return;
    RZ.Game.api.toggleScore();
  }
  function stopTouchScroll(e) { if (attached && e.cancelable && !(e.target.closest && e.target.closest('.overlay'))) e.preventDefault(); }

  T.attach = function (game) {
    G = game; layer = $('touch');
    state = fresh(); ptrs = {}; last = {};
    G.touch = state;
    T.applySettings(S());
    layer.hidden = false;
    document.body.classList.add('is-touch');
    if (!attached) {
      layer.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      $('scoreboard').addEventListener('click', onScoreTap);
      document.addEventListener('touchmove', stopTouchScroll, { passive: false });
      document.addEventListener('gesturestart', stopTouchScroll, { passive: false });
      layer.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      attached = true;
    }
    stickUp();
    $('t-crouch').classList.remove('is-on');
  };
  T.detach = function () {
    if (layer) {
      layer.hidden = true;
      [].forEach.call(layer.querySelectorAll('.is-on'), function (el) { el.classList.remove('is-on'); });
    }
    document.body.classList.remove('is-touch', 'touch-mirror');
    if (attached) {
      layer.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      $('scoreboard').removeEventListener('click', onScoreTap);
      document.removeEventListener('touchmove', stopTouchScroll);
      document.removeEventListener('gesturestart', stopTouchScroll);
      attached = false;
    }
    if (state) stickUp();
    $('rotate').hidden = true;
    ptrs = {}; state = null; G = null;
  };

  /* per-frame: which buttons make sense right now, portrait guard */
  var last = {};
  function set(key, el, fn) { var v = fn(); if (last[key] !== v) { last[key] = v; el(v); } }
  T.update = function (game) {
    if (!attached || !state) return;
    var p = game.player, w = p.weapon(), A = RZ.Game.api;
    set('buy', function (v) { $('t-buy').hidden = !v; }, function () { return game.buyOpen || A.buyAllowed(); });
    set('buyOn', function (v) { $('t-buy').classList.toggle('is-on', v); }, function () { return !!game.buyOpen; });
    set('score', function (v) { $('t-score').classList.toggle('is-on', v); }, function () { return !!game.scoreOn; });
    set('aim', function (v) { $('t-aim').hidden = !v; }, function () { return !!(p.alive && w && (w.def.scope || w.def.kind === 'melee')); });
    set('aimOn', function (v) { $('t-aim').classList.toggle('is-on', v); }, function () { return !!(state.alt || (p.scopedNow && p.scopedNow())); });
    set('crouch', function (v) { $('t-crouch').classList.toggle('is-on', v); }, function () { return state.crouch; });
    set('reload', function (v) { $('t-reload').hidden = !v; }, function () { return !!(w && w.def.kind === 'gun'); });
    if (!p.alive && state.crouch) state.crouch = false;
    if (window.innerWidth !== T.layoutW || window.innerHeight !== T.layoutH) T.applyLayout(S());
    var portrait = window.innerHeight > window.innerWidth;
    game.rotateBlock = portrait && !game.over;
    set('rotate', function (v) { $('rotate').hidden = !v; }, function () { return game.rotateBlock; });
  };
  T.reset = function () { last = {}; };
  T.state = function () { return state; };
  T.pointers = function () { return Object.keys(ptrs).map(function (k) { return { id: +k, role: ptrs[k].role }; }); };
})();
