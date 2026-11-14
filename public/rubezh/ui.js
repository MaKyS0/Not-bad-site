/* Рубеж — menu: persistence, navigation, bullet holes, play/arsenal/cases/settings screens,
   and the glue to the game overlays. Boots the page. */
(function () {
  'use strict';
  var RZ = window.RZ, A = RZ.Audio, Art = RZ.Art;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'rubezh.v1';

  /* ================================================================== */
  /* Store                                                              */
  /* ================================================================== */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function defaults() {
    return {
      v: 1, settings: clone(RZ.DEFAULT_SETTINGS), callsign: 'Новичок', balance: RZ.TOKENS.start,
      inv: [], equipped: {}, seq: 1, stats: { matches: 0, wins: 0, kills: 0, deaths: 0, cases: 0 }, last: null,
      ui: { map: 'sklad', difficulty: 'normal', rounds: 8, team: 5, weapon: 'grom', crate: 'poligon', pane: 'mouse' }
    };
  }
  function sanitize(d) {
    var def = defaults();
    if (!d || typeof d !== 'object') return def;
    var out = def;
    if (d.settings && typeof d.settings === 'object') {
      for (var k in def.settings) if (k !== 'keys' && typeof d.settings[k] === typeof def.settings[k]) out.settings[k] = d.settings[k];
      if (d.settings.keys && typeof d.settings.keys === 'object') for (var a in def.settings.keys) if (typeof d.settings.keys[a] === 'string') out.settings.keys[a] = d.settings.keys[a];
    }
    if (typeof d.callsign === 'string' && d.callsign.trim()) out.callsign = d.callsign.slice(0, 14);
    if (typeof d.balance === 'number' && isFinite(d.balance) && d.balance >= 0) out.balance = Math.floor(d.balance);
    if (Array.isArray(d.inv)) out.inv = d.inv.filter(function (it) { return it && typeof it.uid === 'number' && RZ.PAINT_BY_ID[it.paint]; });
    if (d.equipped && typeof d.equipped === 'object') for (var w in d.equipped) if (RZ.WEAPONS[w] && out.inv.some(function (it) { return it.uid === d.equipped[w]; })) out.equipped[w] = d.equipped[w];
    out.seq = Math.max(typeof d.seq === 'number' ? d.seq : 1, out.inv.reduce(function (m, it) { return Math.max(m, it.uid + 1); }, 1));
    if (d.stats && typeof d.stats === 'object') for (var s in def.stats) if (typeof d.stats[s] === 'number') out.stats[s] = d.stats[s];
    if (d.last && typeof d.last === 'object') out.last = d.last;
    if (d.ui && typeof d.ui === 'object') for (var u in def.ui) if (typeof d.ui[u] === typeof def.ui[u]) out.ui[u] = d.ui[u];
    if (RZ.MAP_IDS.indexOf(out.ui.map) < 0) out.ui.map = 'sklad';
    if (!RZ.WEAPONS[out.ui.weapon]) out.ui.weapon = 'grom';
    return out;
  }
  var Store = (RZ.Store = { data: null });
  Store.load = function () {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    var parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    Store.data = sanitize(parsed);
  };
  var saveTimer = 0;
  Store.save = function (now) {
    clearTimeout(saveTimer);
    var write = function () { try { window.localStorage.setItem(KEY, JSON.stringify(Store.data)); } catch (e) { /* storage unavailable */ } };
    if (now) write(); else saveTimer = setTimeout(write, 150);
  };
  function D() { return Store.data; }

  /* ================================================================== */
  /* Small helpers                                                      */
  /* ================================================================== */
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  var toastT = 0;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.hidden = true; }, 2400);
  }
  RZ.toast = toast;
  function setBalance() { $('balance').textContent = RZ.fmt(D().balance); }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function itemCard(paint, opts) {
    var tpl = $('tpl-item').content.firstElementChild.cloneNode(true);
    tpl.dataset.rarity = paint.rarity;
    var W = RZ.WEAPONS[paint.weapon];
    tpl.querySelector('.item-name').textContent = '«' + paint.name + '»';
    tpl.querySelector('.item-meta').textContent = (opts && opts.meta) || (W.name + ' · ' + RZ.RARITY[paint.rarity].name);
    Art.drawWeapon(tpl.querySelector('.item-art'), paint.weapon, paint.id, { pad: 0.07 });
    return tpl;
  }

  /* ================================================================== */
  /* Navigation and menu chrome                                         */
  /* ================================================================== */
  var current = 'home';
  function goto(name) {
    if (document.body.classList.contains('settings-over') && name !== 'settings') { closeSettingsOver(); return; }
    var scr = $('screen-' + name); if (!scr) return;
    [].forEach.call(document.querySelectorAll('.screen'), function (s) { s.classList.toggle('is-active', s === scr); });
    [].forEach.call(document.querySelectorAll('.tab'), function (t) {
      if (t.dataset.goto === name) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    current = name;
    $('menu').scrollTop = 0;
    if (name === 'arsenal') renderArsenal();
    if (name === 'cases') renderCases();
    if (name === 'play') renderMaps();
  }
  RZ.UI = { goto: goto, toast: toast };

  var holes = [];
  function onMenuClick(e) {
    var t = e.target;
    var go = t.closest && t.closest('[data-goto]');
    if (go) goto(go.dataset.goto);
    if (e.detail === 0) return; // keyboard activation: no hole
    if (t.matches && t.matches('input[type="range"]')) return;
    if (t.closest && t.closest('#layout')) return; // the layout editor is a full-screen tool, no holes there
    var menu = $('menu'), rect = menu.getBoundingClientRect(), box = $('holes');
    box.style.bottom = 'auto';
    box.style.height = menu.scrollHeight + 'px';
    var h = document.createElement('i');
    h.className = 'hole';
    var x = e.clientX - rect.left + menu.scrollLeft, y = e.clientY - rect.top + menu.scrollTop;
    h.style.left = x + 'px'; h.style.top = y + 'px';
    h.style.setProperty('--s', (0.8 + Math.random() * 0.6).toFixed(2));
    h.style.setProperty('--a', Math.round(Math.random() * 360) + 'deg');
    box.appendChild(h); holes.push(h);
    while (holes.length > 14) { var o = holes.shift(); if (o.parentNode) o.parentNode.removeChild(o); }
    A.init();
    A.ui('shot');
  }

  /* ================================================================== */
  /* Home                                                               */
  /* ================================================================== */
  function renderHome() {
    var L = D().last, el = $('home-last');
    if (!L) { el.textContent = 'Матчей пока нет. Первый даст стартовые жетоны.'; return; }
    var map = RZ.getMap(L.map), res = L.result === 'win' ? 'победа' : L.result === 'lose' ? 'поражение' : L.result === 'draw' ? 'ничья' : 'не доигран,';
    el.textContent = 'Последний матч: ' + res + ' ' + L.us + ' : ' + L.them + ' ' + map.where + ', +' + RZ.fmt(L.tokens) + ' ' + plural(L.tokens, 'жетон', 'жетона', 'жетонов');
  }

  /* ================================================================== */
  /* Play                                                               */
  /* ================================================================== */
  var mapsBuilt = false;
  function renderMaps() {
    var list = $('map-list');
    if (!mapsBuilt) {
      mapsBuilt = true;
      RZ.MAP_IDS.forEach(function (id) {
        var m = RZ.getMap(id), b = document.createElement('button');
        b.className = 'map-card'; b.dataset.map = id;
        b.innerHTML = '<canvas class="map-art" width="320" height="200"></canvas><b class="map-name"></b><span class="map-note"></span>';
        b.querySelector('.map-name').textContent = m.name;
        b.querySelector('.map-note').textContent = m.note;
        Art.drawMinimap(b.querySelector('canvas'), m);
        b.addEventListener('click', function () { D().ui.map = id; Store.save(); renderMaps(); });
        list.appendChild(b);
      });
    }
    [].forEach.call(list.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.map === D().ui.map)); });
  }
  function initPlay() {
    var u = D().ui;
    function bindRadio(name, key, num) {
      [].forEach.call(document.querySelectorAll('input[name="' + name + '"]'), function (r) {
        r.checked = String(u[key]) === r.value;
        r.addEventListener('change', function () { if (r.checked) { u[key] = num ? +r.value : r.value; Store.save(); } });
      });
    }
    bindRadio('difficulty', 'difficulty'); bindRadio('rounds', 'rounds', true); bindRadio('team', 'team', true);
    $('btn-start').addEventListener('click', function () {
      A.init();
      RZ.Game.start({ map: u.map, difficulty: u.difficulty, rounds: u.rounds, team: u.team });
    });
  }

  /* ================================================================== */
  /* Arsenal                                                            */
  /* ================================================================== */
  function equippedPaintId(wid) {
    var uid = D().equipped[wid]; if (!uid) return null;
    var it = D().inv.filter(function (x) { return x.uid === uid; })[0];
    return it ? it.paint : null;
  }
  var gunsBuilt = false;
  function renderArsenal() {
    var list = $('gun-list'), sel = D().ui.weapon;
    if (!gunsBuilt) {
      gunsBuilt = true;
      RZ.WEAPON_ORDER.forEach(function (id) {
        var b = document.createElement('button');
        b.className = 'gun'; b.dataset.weapon = id;
        b.innerHTML = '<canvas class="gun-art" width="200" height="80"></canvas><b></b><span></span>';
        b.querySelector('b').textContent = RZ.WEAPONS[id].name;
        b.addEventListener('click', function () { D().ui.weapon = id; Store.save(); renderArsenal(); });
        list.appendChild(b);
      });
    }
    [].forEach.call(list.children, function (b) {
      var id = b.dataset.weapon, W = RZ.WEAPONS[id], pid = equippedPaintId(id);
      b.setAttribute('aria-pressed', String(id === sel));
      b.querySelector('span').textContent = W.cls + ' · ' + (pid ? '«' + RZ.PAINT_BY_ID[pid].name + '»' : 'без раскраски');
      Art.drawWeapon(b.querySelector('canvas'), id, pid, { pad: 0.06 });
    });
    var W = RZ.WEAPONS[sel], pid = equippedPaintId(sel);
    Art.drawWeapon($('gun-preview'), sel, pid, { pad: 0.1, shadow: true });
    $('gun-name').textContent = W.name;
    var price = W.price ? 'Цена в закупке: ' + RZ.fmt(W.price) + '.' : sel === 'knife' ? 'Всегда с собой.' : '';
    if (sel === 'osa') price = 'Выдаётся в начале каждой жизни.';
    $('gun-desc').textContent = W.desc + ' ' + price;
    var st = [['Урон', W.ui.dmg], ['Темп', W.ui.rate], ['Точность', W.ui.acc], ['Отдача', W.ui.recoil], ['Подвижность', W.ui.mob]];
    $('gun-stats').innerHTML = st.map(function (s) { return '<div class="stat"><span>' + s[0] + '</span><i style="--v:' + s[1].toFixed(2) + '"></i></div>'; }).join('');
    // owned paints for this weapon
    var skins = $('skin-list'); skins.innerHTML = '';
    var own = D().inv.filter(function (it) { return RZ.PAINT_BY_ID[it.paint].weapon === sel; })
      .sort(function (a, b) { return RZ.PAINT_BY_ID[b.paint].rarity - RZ.PAINT_BY_ID[a.paint].rarity || a.uid - b.uid; });
    own.forEach(function (it) {
      var p = RZ.PAINT_BY_ID[it.paint], card = itemCard(p, { meta: RZ.RARITY[p.rarity].name });
      card.dataset.uid = it.uid;
      card.setAttribute('aria-pressed', String(D().equipped[sel] === it.uid));
      card.addEventListener('click', function () {
        if (D().equipped[sel] === it.uid) delete D().equipped[sel]; else D().equipped[sel] = it.uid;
        Store.save(); A.ui('click'); renderArsenal();
      });
      skins.appendChild(card);
    });
    $('skin-count').textContent = own.length ? String(own.length) : '';
    $('skin-empty').hidden = own.length > 0;
  }

  /* ================================================================== */
  /* Cases                                                              */
  /* ================================================================== */
  var cratesBuilt = false, spinning = false, lastDrop = null;
  function crateById(id) { return RZ.CASES.filter(function (c) { return c.id === id; })[0] || RZ.CASES[0]; }
  function renderCases() {
    var list = $('crate-list');
    if (!cratesBuilt) {
      cratesBuilt = true;
      RZ.CASES.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'crate'; b.dataset.case = c.id;
        b.innerHTML = '<span class="crate-box"><i></i></span><b class="crate-name"></b><span class="crate-price"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.2"/><circle cx="10" cy="10" r="3.2"/></svg><span></span></span>';
        b.querySelector('.crate-box').style.setProperty('--tape', c.tape);
        b.querySelector('.crate-name').textContent = c.name;
        b.querySelector('.crate-price span').textContent = RZ.fmt(c.price);
        b.addEventListener('click', function () { if (spinning) return; D().ui.crate = c.id; Store.save(); renderCases(); });
        list.appendChild(b);
      });
    }
    var c = crateById(D().ui.crate);
    [].forEach.call(list.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.case === c.id)); });
    var cont = $('crate-contents'); cont.innerHTML = '';
    c.items.map(function (id) { return RZ.PAINT_BY_ID[id]; })
      .sort(function (a, b) { return b.rarity - a.rarity; })
      .forEach(function (p) { var card = itemCard(p); card.tabIndex = -1; cont.appendChild(card); });
    var odds = $('crate-odds'); odds.innerHTML = '';
    Object.keys(c.odds).forEach(function (r) {
      var li = document.createElement('li'); li.dataset.rarity = r;
      li.innerHTML = '<span></span><b></b>';
      li.firstChild.textContent = RZ.RARITY[r].name; li.lastChild.textContent = c.odds[r] + '%';
      odds.appendChild(li);
    });
    $('open-price').textContent = RZ.fmt(c.price);
    $('btn-open').disabled = spinning;
  }
  function roll(c) {
    var total = 0, r;
    for (r in c.odds) total += c.odds[r];
    var x = Math.random() * total, rar = null;
    for (r in c.odds) { x -= c.odds[r]; if (x <= 0) { rar = +r; break; } }
    if (rar == null) rar = +Object.keys(c.odds)[0];
    var pool = c.items.filter(function (id) { return RZ.PAINT_BY_ID[id].rarity === rar; });
    if (!pool.length) pool = c.items;
    return RZ.PAINT_BY_ID[pool[(Math.random() * pool.length) | 0]];
  }
  function drumItem(p) {
    var d = document.createElement('div');
    d.className = 'drum-item'; d.dataset.rarity = p.rarity;
    // .drum-item redeclares --rar after the [data-rarity] rules, so set it inline
    d.style.setProperty('--rar', 'var(--r' + p.rarity + ')');
    d.innerHTML = '<canvas width="300" height="120"></canvas><div><b></b><span></span></div>';
    d.querySelector('b').textContent = '«' + p.name + '»';
    d.querySelector('span').textContent = RZ.WEAPONS[p.weapon].name + ' · ' + RZ.RARITY[p.rarity].name;
    Art.drawWeapon(d.querySelector('canvas'), p.weapon, p.id, { pad: 0.06 });
    return d;
  }
  function openCase() {
    if (spinning) return;
    A.init();
    var c = crateById(D().ui.crate);
    if (D().balance < c.price) {
      var need = c.price - D().balance;
      toast('Не хватает жетонов: нужно ещё ' + RZ.fmt(need));
      $('open-note').textContent = 'Жетоны дают за убийства, выигранные раунды и победу в матче.';
      A.ui('error');
      return;
    }
    D().balance -= c.price; D().stats.cases++;
    Store.save(true); setBalance();
    var prize = roll(c), N = 50, win = 45;
    var strip = $('drum-strip'), drum = $('drum');
    strip.innerHTML = '';
    for (var i = 0; i < N; i++) strip.appendChild(drumItem(i === win ? prize : roll(c)));
    drum.classList.remove('is-empty');
    // narrow screens stack the drum below the contents list: bring it into view for the spin
    var dr = drum.getBoundingClientRect();
    if (dr.top < 0 || dr.bottom > window.innerHeight) {
      try { drum.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }); } catch (e) { drum.scrollIntoView(); }
    }
    $('drop').hidden = true; $('btn-sell').hidden = true; $('btn-equip').hidden = true;
    $('open-note').textContent = '';
    spinning = true; $('btn-open').disabled = true;
    var H = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--drum-h')) || 96;
    var jitter = (Math.random() - 0.5) * 0.7 * H;
    var target = -(win - 1) * H + jitter, finalY = -(win - 1) * H;
    var dur = reducedMotion() ? 1200 : 5200, t0 = performance.now(), lastIdx = 0;
    strip.style.transform = 'translateY(0px)';
    function step(now) {
      var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 4);
      var y = target * e;
      strip.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      var idx = Math.floor((H * 1.5 - y) / H);
      if (idx !== lastIdx) { lastIdx = idx; A.ui('tick'); }
      if (t < 1) requestAnimationFrame(step);
      else settle();
    }
    function settle() {
      var t1 = performance.now(), from = target;
      (function s2(now) {
        var k = Math.min(1, (now - t1) / 260), y = from + (finalY - from) * (1 - Math.pow(1 - k, 3));
        strip.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
        if (k < 1) requestAnimationFrame(s2); else reveal(prize);
      })(t1);
    }
    requestAnimationFrame(step);
  }
  function reveal(p) {
    spinning = false; $('btn-open').disabled = false;
    var it = { uid: D().seq++, paint: p.id, t: Date.now() };
    D().inv.push(it); Store.save(true);
    lastDrop = it;
    Art.drawWeapon($('drop-art'), p.weapon, p.id, { pad: 0.08, shadow: true });
    var st = $('drop-stamp');
    st.dataset.rarity = p.rarity; st.style.setProperty('--rar', 'var(--r' + p.rarity + ')');
    st.textContent = RZ.RARITY[p.rarity].name;
    // restart the stamp animation
    st.style.animation = 'none'; void st.offsetWidth; st.style.animation = '';
    $('drop-name').textContent = RZ.WEAPONS[p.weapon].name + ' «' + p.name + '»';
    var dup = D().inv.filter(function (x) { return x.paint === p.id; }).length;
    $('drop-meta').textContent = RZ.WEAPONS[p.weapon].cls + ' · ' + RZ.RARITY[p.rarity].name + (dup > 1 ? ' · уже есть: ' + (dup - 1) : '') + ' · в арсенале';
    $('drop').hidden = false;
    $('sell-price').textContent = RZ.fmt(RZ.RARITY[p.rarity].sell);
    $('btn-sell').hidden = false; $('btn-sell').disabled = false;
    var be = $('btn-equip'); be.hidden = false; be.disabled = false; be.textContent = 'Надеть';
    $('open-note').textContent = 'Раскраска добавлена в арсенал.';
    A.ui('reveal', p.rarity);
  }
  function sellDrop() {
    if (!lastDrop || spinning) return;
    var it = lastDrop, p = RZ.PAINT_BY_ID[it.paint], val = RZ.RARITY[p.rarity].sell;
    D().inv = D().inv.filter(function (x) { return x.uid !== it.uid; });
    if (D().equipped[p.weapon] === it.uid) delete D().equipped[p.weapon];
    D().balance += val; Store.save(true); setBalance();
    lastDrop = null;
    $('btn-sell').hidden = true; $('btn-equip').hidden = true;
    $('open-note').textContent = 'Продано за ' + RZ.fmt(val) + ' ' + plural(val, 'жетон', 'жетона', 'жетонов') + '.';
    A.ui('coin');
  }
  function equipDrop() {
    if (!lastDrop || spinning) return;
    var p = RZ.PAINT_BY_ID[lastDrop.paint];
    D().equipped[p.weapon] = lastDrop.uid; Store.save(true);
    var be = $('btn-equip'); be.textContent = 'Надето'; be.disabled = true;
    $('open-note').textContent = '«' + p.name + '» теперь на оружии «' + RZ.WEAPONS[p.weapon].name + '».';
    A.ui('click');
  }

  /* ================================================================== */
  /* Settings                                                           */
  /* ================================================================== */
  var CONTROLS = [
    ['set-sens', 'sens', 'range', function (v) { return v.toFixed(2); }],
    ['set-ads', 'ads', 'range', function (v) { return v.toFixed(2); }],
    ['set-invert', 'invert', 'check'],
    ['set-ch-color', 'chColor', 'color'],
    ['set-ch-size', 'chSize', 'range', String], ['set-ch-gap', 'chGap', 'range', String], ['set-ch-thick', 'chThick', 'range', String],
    ['set-ch-dot', 'chDot', 'check'], ['set-ch-dynamic', 'chDynamic', 'check'],
    ['set-fov', 'fov', 'range', String], ['set-quality', 'quality', 'select'],
    ['set-shadows', 'shadows', 'check'], ['set-fps', 'fps', 'check'], ['set-lefty', 'lefty', 'check'],
    ['set-vol', 'vol', 'range', function (v) { return String(Math.round(v * 100)); }],
    ['set-vol-sfx', 'volSfx', 'range', function (v) { return String(Math.round(v * 100)); }],
    ['set-vol-ui', 'volUi', 'range', function (v) { return String(Math.round(v * 100)); }],
    ['set-hitsound', 'hitsound', 'check'],
    ['set-touch-mode', 'touchMode', 'select'],
    ['set-touch-sens', 'touchSens', 'range', function (v) { return v.toFixed(2); }],
    ['set-touch-size', 'touchSize', 'range', function (v) { return v.toFixed(2); }],
    ['set-touch-autofire', 'touchAutofire', 'check'], ['set-touch-mirror', 'touchMirror', 'check']
  ];
  function outputFor(id) { return document.querySelector('output[for="' + id + '"]'); }
  function syncSettings() {
    var s = D().settings;
    CONTROLS.forEach(function (c) {
      var el = $(c[0]); if (!el) return;
      if (c[2] === 'check') el.checked = !!s[c[1]];
      else el.value = s[c[1]];
      var o = outputFor(c[0]); if (o && c[3]) o.textContent = c[3](+s[c[1]]);
    });
    renderKeybinds();
    RZ.Game.applySettings();
  }
  function initSettings() {
    CONTROLS.forEach(function (c) {
      var el = $(c[0]); if (!el) return;
      var ev = c[2] === 'range' || c[2] === 'color' ? 'input' : 'change';
      el.addEventListener(ev, function () {
        var s = D().settings, v;
        if (c[2] === 'check') v = el.checked;
        else if (c[2] === 'range') v = +el.value;
        else v = el.value;
        s[c[1]] = v;
        var o = outputFor(c[0]); if (o && c[3]) o.textContent = c[3](v);
        Store.save();
        RZ.Game.applySettings();
      });
    });
    [].forEach.call(document.querySelectorAll('.set-tabs [role="tab"]'), function (t) {
      t.addEventListener('click', function () { selectPane(t.dataset.pane); });
    });
    selectPane(D().ui.pane || 'mouse');
    $('btn-reset-settings').addEventListener('click', function () {
      D().settings = clone(RZ.DEFAULT_SETTINGS); Store.save(true); syncSettings(); toast('Настройки сброшены');
    });
    // two-step confirmation in the page (confirm() is unavailable in sandboxed frames)
    var wipeBtn = $('btn-wipe'), wipeLabel = wipeBtn.textContent, wipeTimer = 0;
    function disarmWipe() { clearTimeout(wipeTimer); wipeBtn.classList.remove('is-armed'); wipeBtn.textContent = wipeLabel; delete wipeBtn.dataset.armed; }
    wipeBtn.addEventListener('click', function () {
      if (!wipeBtn.dataset.armed) {
        wipeBtn.dataset.armed = '1'; wipeBtn.classList.add('is-armed'); wipeBtn.textContent = 'Точно стереть?';
        toast('Нажмите ещё раз, чтобы стереть жетоны, раскраски и настройки');
        wipeTimer = setTimeout(disarmWipe, 4000);
        return;
      }
      disarmWipe();
      var keepUi = D().ui.pane;
      Store.data = defaults(); Store.data.ui.pane = keepUi; Store.save(true);
      $('callsign').value = D().callsign;
      setBalance(); syncSettings(); renderHome();
      toast('Прогресс стёрт');
    });
  }
  function selectPane(name) {
    [].forEach.call(document.querySelectorAll('.set-tabs [role="tab"]'), function (t) { t.setAttribute('aria-selected', String(t.dataset.pane === name)); });
    [].forEach.call(document.querySelectorAll('.pane'), function (p) { p.classList.toggle('is-active', p.id === 'pane-' + name); });
    D().ui.pane = name; Store.save();
  }
  var listening = null;
  function renderKeybinds() {
    var box = $('keybinds'), keys = D().settings.keys;
    box.innerHTML = '';
    RZ.ACTIONS.forEach(function (a) {
      var row = document.createElement('div'); row.className = 'row';
      var sp = document.createElement('span'); sp.textContent = a[1];
      var b = document.createElement('button'); b.className = 'keybind'; b.dataset.action = a[0];
      var label = RZ.keyLabel(keys[a[0]]);
      if (RZ.ALT_KEYS[a[0]] && !Object.keys(keys).some(function (k) { return keys[k] === RZ.ALT_KEYS[a[0]]; })) label += ' / ' + RZ.keyLabel(RZ.ALT_KEYS[a[0]]);
      b.textContent = label;
      b.addEventListener('click', function (e) { e.stopPropagation(); startListen(b); });
      row.appendChild(sp); row.appendChild(b); box.appendChild(row);
    });
  }
  function startListen(b) {
    if (listening) listening.classList.remove('is-listening');
    listening = b; b.classList.add('is-listening'); b.textContent = '';
  }
  function stopListen() { if (listening) { listening = null; renderKeybinds(); } }
  function onKeyCapture(e) {
    if (RZ.Layout && RZ.Layout.isOpen()) {
      if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); RZ.Layout.close(); }
      return;
    }
    if (listening) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') { stopListen(); return; }
      var act = listening.dataset.action, keys = D().settings.keys, old = keys[act];
      for (var k in keys) if (k !== act && keys[k] === e.code) keys[k] = old; // swap
      keys[act] = e.code;
      Store.save(); stopListen(); RZ.Game.applySettings(); A.ui('click');
      return;
    }
    if (e.code === 'Escape' && document.body.classList.contains('settings-over')) { e.preventDefault(); e.stopImmediatePropagation(); closeSettingsOver(); }
  }

  /* settings opened from the pause menu */
  function openSettingsOver() {
    document.body.classList.add('settings-over');
    goto('settings');
    var foot = document.querySelector('.set-foot'), back = $('btn-back-game');
    if (!back) {
      back = document.createElement('button'); back.className = 'btn btn-go'; back.id = 'btn-back-game'; back.textContent = 'Назад в игру';
      back.addEventListener('click', function (e) { e.stopPropagation(); closeSettingsOver(); });
      foot.insertBefore(back, foot.firstChild);
    }
    back.hidden = false;
  }
  function closeSettingsOver() {
    document.body.classList.remove('settings-over');
    var back = $('btn-back-game'); if (back) back.hidden = true;
    stopListen();
  }
  RZ.UI.openSettingsOver = openSettingsOver;
  RZ.UI.closeSettingsOver = closeSettingsOver;

  /* ================================================================== */
  /* Match results → tokens and history                                 */
  /* ================================================================== */
  RZ.UI.onMatchEnd = function (r) {
    var d = D();
    d.balance += r.tokens;
    d.stats.matches++; if (r.result === 'win') d.stats.wins++;
    d.stats.kills += r.kills; d.stats.deaths += r.deaths;
    d.last = { result: r.result, us: r.us, them: r.them, map: r.map, tokens: r.tokens, t: Date.now() };
    Store.save(true);
    setBalance(); renderHome();
  };

  function initGameButtons() {
    $('btn-resume').addEventListener('click', function () { RZ.Game.resume(); });
    $('btn-pause-settings').addEventListener('click', function () { openSettingsOver(); });
    $('btn-quit').addEventListener('click', function () { RZ.Game.quit(); goto('home'); });
    $('btn-lock').addEventListener('click', function () { RZ.Game.lock(); });
    $('btn-again').addEventListener('click', function () { RZ.Game.again(); });
    $('btn-end-cases').addEventListener('click', function () { RZ.Game.stop(); goto('cases'); });
    $('btn-end-menu').addEventListener('click', function () { RZ.Game.stop(); goto('home'); });
  }

  /* ================================================================== */
  /* Boot                                                               */
  /* ================================================================== */
  function boot() {
    // the host may strip attributes from <body>: make sure the mode hook exists
    if (!document.body.dataset.mode) document.body.dataset.mode = 'menu';
    Store.load();
    var cs = $('callsign');
    cs.value = D().callsign;
    cs.addEventListener('input', function () { D().callsign = cs.value.trim().slice(0, 14) || 'Новичок'; Store.save(); });
    cs.addEventListener('blur', function () { cs.value = D().callsign; });
    cs.addEventListener('keydown', function (e) { if (e.key === 'Enter') cs.blur(); });
    setBalance();
    renderHome();
    $('menu').addEventListener('click', onMenuClick);
    window.addEventListener('keydown', onKeyCapture, true);
    document.addEventListener('click', function (e) { if (listening && !e.target.classList.contains('keybind')) stopListen(); });
    var unlockAudio = function () { A.init(); };
    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);
    initPlay(); initSettings(); initGameButtons();
    syncSettings();
    $('btn-open').addEventListener('click', openCase);
    $('btn-sell').addEventListener('click', sellDrop);
    $('btn-equip').addEventListener('click', equipDrop);
    $('drum').classList.add('is-empty');
    renderMaps();
    goto('home');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
