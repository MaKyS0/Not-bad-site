/* Page logic: scroll-driven camera, explore mode, mass calculator. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  document.documentElement.classList.add('js');

  const canvas = $('#bg');
  let bh = null;
  try { bh = window.BlackHole && window.BlackHole.init(canvas); } catch (e) { console.error(e); }
  if (!bh) document.body.classList.add('nogl');

  // ------------------------------------------------------------------ reveal on scroll
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }), { threshold: 0.18 })
    : null;
  $$('.reveal').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

  // ------------------------------------------------------------------ scroll-driven camera
  const frames = $$('[data-cam]').map((el) => ({ el, v: el.dataset.cam.trim().split(/\s+/).map(Number), y: 0 }));
  const smooth = (t) => t * t * (3 - 2 * t);
  const portrait = () => innerWidth < 820 || innerHeight > innerWidth * 1.1;
  let explore = false, queued = false;

  function measure() {
    frames.forEach((f) => { const r = f.el.getBoundingClientRect(); f.y = r.top + scrollY + r.height / 2; });
    update();
  }
  function update() {
    queued = false;
    if (!bh || explore || !frames.length) return;
    const c = scrollY + innerHeight / 2;
    let a = frames[0], b = frames[0], t = 0;
    if (c >= frames[frames.length - 1].y) a = b = frames[frames.length - 1];
    else if (c > frames[0].y) {
      for (let i = 0; i < frames.length - 1; i++) {
        if (c < frames[i + 1].y) { a = frames[i]; b = frames[i + 1]; t = smooth((c - a.y) / (b.y - a.y)); break; }
      }
    }
    const v = a.v.map((x, i) => x + (b.v[i] - x) * t);
    const p = portrait();
    // portrait: hole in the upper part of the screen, slightly farther away
    bh.scroll = { yaw: v[0], pitch: v[1], dist: v[2] * (p ? 1.12 : 1), sx: p ? 0 : v[3], sy: p ? 0.34 + v[4] * 0.5 : v[4] };
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
  measure();

  // ------------------------------------------------------------------ explore mode
  const back = $('#back');
  function setExplore(on) {
    if (!bh || on === explore) return;
    explore = on;
    document.body.classList.toggle('explore', on);
    document.documentElement.classList.toggle('lock', on);
    ['main', '.nav', '.foot'].forEach((q) => { $(q).inert = on; });
    bh.setMode(on ? 'explore' : 'scroll');
    if (!on) update();
    (on ? back : $('[data-explore]')).focus({ preventScroll: true });
  }
  $$('[data-explore]').forEach((b) => b.addEventListener('click', () => setExplore(true)));
  back.addEventListener('click', () => setExplore(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && explore) setExplore(false); });

  if (bh) {
    const toggle = (id, fn) => {
      const btn = $(id);
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(on));
        fn(on);
      });
    };
    toggle('#rotate', (on) => bh.setAutoRotate(on));
    toggle('#disk', (on) => bh.setDisk(on));
    toggle('#bloom', (on) => bh.setBloom(on));
    $('#quality').addEventListener('change', (e) => bh.setQuality(e.target.value));
    $('#reset').addEventListener('click', () => bh.reset());
    const stat = $('#stat');
    bh.onStat = (s) => { if (explore) stat.textContent = s; };
    const fs = $('#full');
    if (!document.documentElement.requestFullscreen) fs.hidden = true;
    fs.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    });
  }

  // ------------------------------------------------------------------ mass calculator
  const SUN_RS_KM = 2.953;          // Schwarzschild radius of one solar mass
  const EARTH_MASS = 3.003e-6;      // in solar masses
  const AU_KM = 1.496e8, SUN_R_KM = 695700, EARTH_R_KM = 6371;
  const nf = new Intl.NumberFormat('ru-RU', { maximumSignificantDigits: 3 });

  const fmtMass = (m) => {
    if (m < 0.05) return `${nf.format(m / EARTH_MASS)} M⊕`;
    if (m >= 1e9) return `${nf.format(m / 1e9)} млрд M☉`;
    if (m >= 1e6) return `${nf.format(m / 1e6)} млн M☉`;
    if (m >= 1e4) return `${nf.format(m / 1e3)} тыс. M☉`;
    return `${nf.format(m)} M☉`;
  };
  const fmtLen = (km) => {
    if (km < 1e-3) return `${nf.format(km * 1e6)} мм`;
    if (km < 1) return `${nf.format(km * 1e3)} м`;
    if (km < 1e6) return `${nf.format(km)} км`;
    if (km < 4.5e7) return `${nf.format(km / 1e6)} млн км`;
    return `${nf.format(km / AU_KM)} а.е.`;
  };
  const note = (km, m) => {
    if (km >= AU_KM) {
      return `Орбита Земли — 1 а.е., Нептуна — около 30 а.е.` + (km > 30 * AU_KM ? ' Такой горизонт вместил бы всю Солнечную систему.' : '');
    }
    if (km >= SUN_R_KM * 0.1) return `≈ ${nf.format(km / SUN_R_KM)} радиуса Солнца.`;
    if (km >= EARTH_R_KM * 0.05) return `≈ ${nf.format(km / EARTH_R_KM)} радиуса Земли.`;
    if (Math.abs(Math.log10(m / EARTH_MASS)) < 0.05) return 'Чтобы Земля стала чёрной дырой, её пришлось бы сжать до шарика размером с вишню.';
    return 'Вся эта масса сжата в шар такого радиуса.';
  };

  const slider = $('#mass');
  let exact = null;                 // a preset's exact mass (the slider only has 0.01 steps in log10)
  function renderCalc() {
    const m = exact ?? Math.pow(10, parseFloat(slider.value));
    const km = SUN_RS_KM * m;
    $('#mass-out').textContent = fmtMass(m);
    $('#r-out').textContent = fmtLen(km);
    $('#r-note').textContent = note(km, m);
    $$('.presets button').forEach((b) => {
      b.setAttribute('aria-pressed', String(parseFloat(b.dataset.m) === m));
    });
  }
  slider.addEventListener('input', () => { exact = null; renderCalc(); });
  $$('.presets button').forEach((b) => b.addEventListener('click', () => {
    exact = parseFloat(b.dataset.m);
    slider.value = Math.log10(exact).toFixed(2);
    renderCalc();
  }));
  renderCalc();
})();
