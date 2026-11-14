/* Рубеж — touch button layout editor (#layout overlay). Shows copies of every touch control at their
   current spots; drag to move, tap to pick and resize, one opacity slider for all. Saves into
   settings.touchLayout via RZ.Touch's resolution-independent anchors (see touch.js). */
(function () {
  'use strict';
  var RZ = window.RZ;
  var E = (RZ.Layout = {});
  var $ = function (id) { return document.getElementById(id); };
  function S() { return RZ.Store.data.settings; }

  var stage, bar, copies = {}, cur = {}, defs = {}, touched = {}, picked = null, drag = null, barDrag = null;
  var W = 0, H = 0, baseT = 58, mirror = false, alpha = 1, open = false;

  function T() { return RZ.Touch; }

  function stripIds(el) {
    el.removeAttribute('id');
    [].forEach.call(el.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); });
    el.hidden = false;
    [].forEach.call(el.querySelectorAll('[hidden]'), function (x) { x.hidden = false; });
    el.classList.remove('is-on');
    [].forEach.call(el.querySelectorAll('.is-on'), function (x) { x.classList.remove('is-on'); });
    el.removeAttribute('style');
    [].forEach.call(el.querySelectorAll('[style]'), function (x) { x.removeAttribute('style'); });
  }

  function place(ctl) {
    var el = copies[ctl], c = cur[ctl];
    T().clearCtl(el);
    var half = T().halfSize(el, ctl, c.s, baseT);
    T().clampCenter(c, half, W, H);
    T().placeCtl(el, ctl, c, c.s, baseT);
  }

  E.isOpen = function () { return open; };
  /* work: optional unsaved {layout, alpha} to restore (after a resize/rotation) */
  E.open = function (work) {
    var st = S(), Tm = T(); if (!Tm) return;
    open = true;
    stage = $('layout-stage'); bar = document.querySelector('#layout .layout-bar');
    $('layout').hidden = false;
    W = window.innerWidth; H = window.innerHeight;
    baseT = 58 * (st.touchSize || 1); mirror = !!st.touchMirror;
    alpha = work ? work.alpha : st.touchAlpha == null ? 1 : st.touchAlpha;
    stage.style.setProperty('--t-scale', String(st.touchSize || 1));
    stage.style.setProperty('--t-alpha', String(alpha));
    stage.innerHTML = ''; copies = {}; cur = {}; defs = {}; touched = {}; picked = null;
    var src = $('touch');
    Tm.CTLS.forEach(function (ctl) {
      var el = Tm.ctlElement(src, ctl).cloneNode(true);
      stripIds(el);
      el.dataset.ctl = ctl;
      el.setAttribute('aria-label', Tm.CTL_NAMES[ctl]);
      stage.appendChild(el);
      copies[ctl] = el;
    });
    // default spots straight from the CSS (stage uses the same classes, un-mirrored)
    Tm.CTLS.forEach(function (ctl) {
      var r = copies[ctl].getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      defs[ctl] = { x: mirror ? W - x : x, y: y };
    });
    var L = work ? work.layout : st.touchLayout || {};
    Tm.CTLS.forEach(function (ctl) {
      var e = L[ctl];
      if (Tm.validEntry(e)) { var c = Tm.entryCenter(e, W, H, mirror); cur[ctl] = { x: c.x, y: c.y, s: e.s }; touched[ctl] = true; }
      else cur[ctl] = { x: defs[ctl].x, y: defs[ctl].y, s: 1 };
      place(ctl);
    });
    $('layout-opacity').value = alpha;
    resetBar();
    avoidBar();
    pick(null);
  };

  function pick(ctl) {
    if (picked && copies[picked]) copies[picked].classList.remove('is-picked');
    picked = ctl;
    var size = $('layout-size'), out = $('layout-picked');
    if (!ctl) { size.disabled = true; size.value = 1; out.textContent = '— кнопка не выбрана'; return; }
    copies[ctl].classList.add('is-picked');
    size.disabled = false; size.value = cur[ctl].s;
    out.textContent = '— ' + T().CTL_NAMES[ctl] + ', ×' + (+cur[ctl].s).toFixed(2);
  }

  /* the panel must never hide a control: drag it by its title, or it jumps aside automatically */
  function resetBar() { bar.style.left = ''; bar.style.top = ''; bar.style.transform = ''; }
  /* move the panel to the candidate spot that covers the fewest controls (current spot wins ties) */
  function avoidBar() {
    var r = bar.getBoundingClientRect(), bw = r.width, bh = r.height;
    var rects = Object.keys(copies).map(function (k) { return copies[k].getBoundingClientRect(); });
    function hits(cx, cy) {
      var l = cx - bw / 2 - 8, t = cy - bh / 2 - 8, rr = cx + bw / 2 + 8, bb = cy + bh / 2 + 8, n = 0;
      rects.forEach(function (q) { if (q.right > l && q.left < rr && q.bottom > t && q.top < bb) n++; });
      return n;
    }
    var curX = r.left + bw / 2, curY = r.top + bh / 2, best = { x: curX, y: curY, n: hits(curX, curY) };
    if (!best.n) return;
    var xs = [W / 2, W * 0.27, W * 0.73, bw / 2 + 6, W - bw / 2 - 6], ys = [H / 2, bh / 2 + 6, H - bh / 2 - 6];
    xs.forEach(function (x) {
      x = Math.max(bw / 2, Math.min(W - bw / 2, x));
      ys.forEach(function (y) { y = Math.max(bh / 2, Math.min(H - bh / 2, y)); var n = hits(x, y); if (n < best.n) best = { x: x, y: y, n: n }; });
    });
    bar.style.transform = 'translate(-50%, -50%)';
    bar.style.left = best.x + 'px'; bar.style.top = best.y + 'px';
  }

  function onDown(e) {
    if (!open) return;
    var t = e.target;
    if (t.closest('.layout-bar')) {
      if (t.closest('.layout-bar > b')) {
        e.preventDefault();
        var r = bar.getBoundingClientRect();
        barDrag = { id: e.pointerId, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
        try { t.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
      }
      return;
    }
    var el = t.closest('[data-ctl]');
    if (!el || !stage.contains(el)) { pick(null); return; }
    e.preventDefault();
    var ctl = el.dataset.ctl;
    pick(ctl);
    drag = { id: e.pointerId, ctl: ctl, dx: e.clientX - cur[ctl].x, dy: e.clientY - cur[ctl].y, moved: 0, sx: e.clientX, sy: e.clientY };
    el.classList.add('is-drag');
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
  }
  function onMove(e) {
    if (barDrag && e.pointerId === barDrag.id) {
      e.preventDefault();
      var r = bar.getBoundingClientRect(), hw = r.width / 2, hh = r.height / 2;
      bar.style.transform = 'translate(-50%, -50%)';
      bar.style.left = Math.max(hw, Math.min(W - hw, e.clientX - barDrag.dx)) + 'px';
      bar.style.top = Math.max(hh, Math.min(H - hh, e.clientY - barDrag.dy)) + 'px';
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy));
    if (drag.moved < 4) return;
    var c = cur[drag.ctl];
    c.x = e.clientX - drag.dx; c.y = e.clientY - drag.dy;
    place(drag.ctl);
    touched[drag.ctl] = true;
  }
  function onUp(e) {
    if (barDrag && e.pointerId === barDrag.id) { barDrag = null; return; }
    if (!drag || e.pointerId !== drag.id) return;
    copies[drag.ctl].classList.remove('is-drag');
    drag = null;
    avoidBar();
  }

  E.reset = function () {
    touched = {};
    T().CTLS.forEach(function (ctl) { cur[ctl] = { x: defs[ctl].x, y: defs[ctl].y, s: 1 }; place(ctl); });
    alpha = 1; $('layout-opacity').value = 1; stage.style.setProperty('--t-alpha', '1');
    resetBar(); pick(null);
  };
  function currentLayout() {
    var L = {};
    T().CTLS.forEach(function (ctl) {
      if (touched[ctl]) L[ctl] = T().centerEntry(cur[ctl].x, cur[ctl].y, W, H, mirror, cur[ctl].s);
    });
    return L;
  }
  E.done = function () {
    if (!open) return;
    var L = currentLayout();
    var st = S();
    st.touchLayout = L; st.touchAlpha = alpha;
    RZ.Store.save(true);
    E.close();
    if (RZ.Game) RZ.Game.applySettings();
    if (RZ.toast) RZ.toast('Расстановка кнопок сохранена');
  };
  E.close = function () {
    open = false; drag = null; barDrag = null;
    $('layout').hidden = true;
    if (stage) stage.innerHTML = '';
  };
  E.layoutState = function () { return { cur: JSON.parse(JSON.stringify(cur)), touched: Object.keys(touched), picked: picked, alpha: alpha }; };

  /* buttons on the panel: act on a touch pointerup that began on the button (some touch sequences
     after a drag never get a synthesised click), and on click for mouse/keyboard */
  function tapButton(el, fn) {
    var downId = null, lastTouch = 0;
    el.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') downId = e.pointerId; });
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'touch' || e.pointerId !== downId) return;
      downId = null; lastTouch = performance.now(); fn();
    });
    el.addEventListener('pointercancel', function () { downId = null; });
    el.addEventListener('click', function () { if (performance.now() - lastTouch > 600) fn(); });
  }

  function init() {
    var root = $('layout'); if (!root) return;
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    $('layout-size').addEventListener('input', function () {
      if (!picked) return;
      cur[picked].s = +this.value; touched[picked] = true;
      place(picked); pick(picked);
      avoidBar();
    });
    $('layout-opacity').addEventListener('input', function () { alpha = +this.value; stage.style.setProperty('--t-alpha', String(alpha)); });
    tapButton($('layout-reset'), function () { E.reset(); });
    tapButton($('layout-done'), function () { E.done(); });
    $('btn-layout').addEventListener('click', function () { E.open(); });
    window.addEventListener('resize', function () { if (open && (window.innerWidth !== W || window.innerHeight !== H)) E.open({ layout: currentLayout(), alpha: alpha }); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
