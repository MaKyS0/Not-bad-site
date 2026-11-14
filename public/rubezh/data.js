/* Рубеж — static game data: weapons, paints, cases, settings defaults, names.
   Classic script: everything hangs off the global RZ namespace. */
(function () {
  'use strict';
  var RZ = (window.RZ = window.RZ || {});

  /* ------------------------------------------------------------------ */
  /* Rarities                                                            */
  /* ------------------------------------------------------------------ */
  RZ.RARITY = {
    1: { name: 'Серийная', sell: 40 },
    2: { name: 'Заводская', sell: 90 },
    3: { name: 'Штучная', sell: 200 },
    4: { name: 'Трофейная', sell: 450 },
    5: { name: 'Легендарная', sell: 1100 }
  };

  /* ------------------------------------------------------------------ */
  /* Weapons                                                             */
  /* shape: side-view parts in centimetres, muzzle towards +x, origin at  */
  /* the firing hand. Used by the 2D renderer AND extruded for 3D.        */
  /*   {p:[[x,y]...], t:thickness, m:'paint'|'dark'|'metal'|'grip'}      */
  /*   {c:[x0,x1,y,r], m:...}  — cylinder along the barrel axis          */
  /* spread values are half-angles in radians.                            */
  /* ------------------------------------------------------------------ */
  var W = {};

  W.knife = {
    id: 'knife', name: 'Нож', cls: 'Нож', slot: 3, kind: 'melee', price: 0, mob: 1.0, draw: 0.35,
    desc: 'Короткий клинок с резиновой рукоятью. ЛКМ — быстрый взмах, ПКМ — тяжёлый укол. Бегать с ним быстрее всего.',
    fast: { dmg: 34, range: 1.9, time: 0.42 }, heavy: { dmg: 70, range: 1.65, time: 1.0 },
    ui: { dmg: 0.45, rate: 0.5, acc: 1, recoil: 0, mob: 1 },
    sound: 'knife',
    hold: [0, 0], hold2: null,
    shape: [
      { p: [[-12, -1.6], [0, -1.8], [0, 1.8], [-12, 1.5], [-13, 0]], t: 2.4, m: 'paint' },
      { p: [[0, -2.8], [1.2, -2.8], [1.2, 2.8], [0, 2.8]], t: 2.8, m: 'dark' },
      { p: [[1.2, -1.4], [15, -1.2], [20, 0.8], [17, 1.6], [1.2, 1.6]], t: 0.5, m: 'metal' },
      { p: [[-13.2, -0.9], [-12, -0.9], [-12, 0.9], [-13.2, 0.9]], t: 2.6, m: 'dark' }
    ]
  };

  W.osa = {
    id: 'osa', name: 'Оса', cls: 'Пистолет', slot: 2, kind: 'gun', mode: 'semi', price: 200,
    desc: 'Лёгкий служебный пистолет. Выдаётся бесплатно, быстро стреляет и прощает ошибки в беге.',
    dmg: 27, pellets: 1, rate: 0.15, mag: 12, reserve: 36, reload: 2.0, pen: 0.5, falloff: 0.86, head: 3.8,
    spread: { base: 0.006, move: 0.035, air: 0.12, spray: 0.012, sprayMax: 0.04, crouch: 0.75 },
    recoil: { kick: 0.018, yaw: 0.006, recover: 7 },
    mob: 1.0, draw: 0.45, sound: 'pistol', reward: 300,
    ui: { dmg: 0.27, rate: 0.62, acc: 0.6, recoil: 0.25, mob: 0.98 },
    hold: [0, 0], hold2: null,
    shape: [
      { p: [[-4.5, 2], [13.5, 2], [13.5, 6.2], [-4, 6.2], [-4.5, 5.4]], t: 2.6, m: 'paint' },
      { p: [[-3.5, 2.2], [12, 2.2], [12, 0.5], [3, 0.5], [1.5, -0.6], [-2.5, -0.6]], t: 2.4, m: 'dark' },
      { p: [[-4.3, 1.2], [1.8, 1.2], [0.6, -11], [-5.6, -11], [-6, -9.5], [-4.6, -1]], t: 2.9, m: 'grip' },
      { p: [[0.5, 0.4], [4.5, 0.4], [4.5, -2.8], [0.5, -2.8], [0.5, -2.1], [3.8, -2.1], [3.8, -0.2], [0.5, -0.2]], t: 1.0, m: 'dark' },
      { c: [13.5, 14.6, 4.2, 0.65], m: 'metal' },
      { p: [[11.5, 6.2], [12.6, 6.2], [12.6, 6.9], [11.5, 6.9]], t: 0.6, m: 'dark' }
    ],
    details: [[0, 4.6, 8, 4.6], [-2.5, 2.8, -2.5, 5.6], [-1.8, 2.8, -1.8, 5.6], [-1.1, 2.8, -1.1, 5.6]]
  };

  W.shmel = {
    id: 'shmel', name: 'Шмель', cls: 'Тяжёлый пистолет', slot: 2, kind: 'gun', mode: 'semi', price: 600,
    desc: 'Крупнокалиберный пистолет с компенсатором. Медленный, но пробивает броню и валит в голову с одного выстрела.',
    dmg: 54, pellets: 1, rate: 0.32, mag: 7, reserve: 28, reload: 2.3, pen: 0.72, falloff: 0.88, head: 4,
    spread: { base: 0.005, move: 0.05, air: 0.15, spray: 0.03, sprayMax: 0.07, crouch: 0.75 },
    recoil: { kick: 0.045, yaw: 0.012, recover: 5.5 },
    mob: 0.97, draw: 0.55, sound: 'heavy', reward: 300,
    ui: { dmg: 0.54, rate: 0.32, acc: 0.68, recoil: 0.7, mob: 0.94 },
    hold: [0, 0], hold2: null,
    shape: [
      { p: [[-5, 2], [17, 2], [17, 7.6], [-4.6, 7.6], [-5.4, 6.4]], t: 3.0, m: 'paint' },
      { p: [[17, 2.6], [21, 2.6], [21, 7.2], [17, 7.2]], t: 2.8, m: 'dark' },
      { p: [[-4.2, 2.2], [15, 2.2], [15, 0.2], [3.6, 0.2], [2, -1], [-3, -1]], t: 2.8, m: 'dark' },
      { p: [[-4.6, 1.4], [2.2, 1.4], [1, -12.5], [-6.6, -12.5], [-7, -10.5], [-5.2, -1]], t: 3.3, m: 'grip' },
      { p: [[0.6, 0.2], [5, 0.2], [5, -3.2], [0.6, -3.2], [0.6, -2.4], [4.2, -2.4], [4.2, -0.5], [0.6, -0.5]], t: 1.1, m: 'dark' },
      { p: [[-4.6, 7.6], [-3.2, 7.6], [-3.2, 8.6], [-4.6, 8.6]], t: 1, m: 'dark' }
    ],
    details: [[18, 4, 20, 4], [18, 5.6, 20, 5.6], [-3, 3, -3, 6.8], [-2, 3, -2, 6.8], [-1, 3, -1, 6.8], [2, 5, 14, 5]]
  };

  W.shershen = {
    id: 'shershen', name: 'Шершень', cls: 'Пистолет-пулемёт', slot: 1, kind: 'gun', mode: 'auto', price: 1200,
    desc: 'Компактный пистолет-пулемёт с бешеным темпом. Хорош в коридорах и на бегу, на дальней дистанции теряет урон.',
    dmg: 25, pellets: 1, rate: 0.072, mag: 30, reserve: 120, reload: 2.3, pen: 0.55, falloff: 0.8, head: 3.6,
    spread: { base: 0.009, move: 0.018, air: 0.1, spray: 0.004, sprayMax: 0.045, crouch: 0.8 },
    recoil: { kick: 0.009, yaw: 0.006, recover: 8 },
    mob: 0.96, draw: 0.5, sound: 'smg', reward: 600,
    ui: { dmg: 0.25, rate: 0.95, acc: 0.42, recoil: 0.3, mob: 0.92 },
    hold: [0, 0], hold2: [14, -1],
    shape: [
      { p: [[-9, 0], [21, 0], [21, 7], [-6, 7], [-9, 5]], t: 3.6, m: 'paint' },
      { c: [21, 29, 4.2, 1.1], m: 'dark' },
      { c: [29, 31, 4.2, 1.5], m: 'metal' },
      { p: [[3, 0], [7, 0], [6.5, -15], [2.5, -15]], t: 2.4, m: 'dark' },
      { p: [[-5.5, 0.5], [-0.5, 0.5], [-1.5, -9], [-6.5, -9]], t: 3.0, m: 'grip' },
      { p: [[-31, 4.5], [-9, 4.5], [-9, 6], [-31, 6]], t: 1.0, m: 'dark' },
      { p: [[-31, -3], [-29.5, -3], [-29.5, 6], [-31, 6]], t: 3.2, m: 'dark' },
      { p: [[-30, -3], [-9, 2], [-9, 3.2], [-30, -1.6]], t: 1.0, m: 'dark' },
      { p: [[-4, 7], [16, 7], [16, 8.2], [-4, 8.2]], t: 1.6, m: 'dark' }
    ],
    details: [[8, 2, 18, 2], [8, 3.4, 18, 3.4], [8, 4.8, 18, 4.8], [-3, 6, 1, 6]]
  };

  W.taran = {
    id: 'taran', name: 'Таран', cls: 'Дробовик', slot: 1, kind: 'gun', mode: 'pump', price: 1300, shellReload: true,
    desc: 'Помповый дробовик. В упор решает всё одним выстрелом, на двадцати метрах — уже почти ничего. Заряжается по патрону.',
    dmg: 16, pellets: 9, rate: 0.88, mag: 6, reserve: 24, reload: 0.52, pen: 0.6, falloff: 0.55, head: 2, range: 45,
    spread: { base: 0.05, move: 0.02, air: 0.05, spray: 0, sprayMax: 0, crouch: 0.9 }, pelletCone: true,
    recoil: { kick: 0.07, yaw: 0.015, recover: 5 },
    mob: 0.92, draw: 0.6, sound: 'shotgun', reward: 900,
    ui: { dmg: 0.95, rate: 0.15, acc: 0.15, recoil: 0.85, mob: 0.84 },
    hold: [0, 0], hold2: [30, -1],
    shape: [
      { p: [[-10, 0], [20, 0], [20, 7], [-8, 7.4], [-10, 6]], t: 3.8, m: 'paint' },
      { c: [20, 60, 5, 1.3], m: 'dark' },
      { c: [18, 52, 1.8, 1.2], m: 'dark' },
      { p: [[24, -0.6], [41, -0.6], [41, 3.6], [24, 3.6]], t: 4.0, m: 'grip' },
      { p: [[-10, 6], [-44, 3], [-45, -5], [-41, -6], [-20, -1.5], [-10, 0]], t: 3.6, m: 'paint' },
      { p: [[-9, 0.6], [-4, 0.6], [-6, -8], [-11.5, -8], [-12, -3]], t: 3.0, m: 'grip' },
      { p: [[-45.5, 3.4], [-43.5, 3.2], [-44.6, -5.4], [-46.4, -5]], t: 3.8, m: 'dark' },
      { p: [[56, 6.3], [57.5, 6.3], [57.5, 7.4], [56, 7.4]], t: 0.8, m: 'metal' }
    ],
    details: [[26, 0.6, 39, 0.6], [26, 1.6, 39, 1.6], [26, 2.6, 39, 2.6], [-6, 3.5, 16, 3.5]]
  };

  W.grom = {
    id: 'grom', name: 'Гром', cls: 'Автомат', slot: 1, kind: 'gun', mode: 'auto', price: 2900,
    desc: 'Тяжёлый штурмовой автомат. Мощный патрон, убивает в голову через шлем, но уводит вверх при долгой очереди.',
    dmg: 35, pellets: 1, rate: 0.1, mag: 30, reserve: 90, reload: 2.5, pen: 0.78, falloff: 0.95, head: 4,
    spread: { base: 0.003, move: 0.085, air: 0.16, spray: 0.0065, sprayMax: 0.06, crouch: 0.7 },
    recoil: { kick: 0.0165, yaw: 0.009, recover: 6 },
    mob: 0.86, draw: 0.7, sound: 'rifle', reward: 300,
    ui: { dmg: 0.7, rate: 0.72, acc: 0.78, recoil: 0.78, mob: 0.66 },
    hold: [0, 0], hold2: [30, 1],
    shape: [
      { p: [[-12, 0], [22, 0], [22, 8], [-12, 8]], t: 4.0, m: 'paint' },
      { p: [[22, 1], [44, 1.5], [44, 7.4], [22, 7.6]], t: 4.4, m: 'paint' },
      { c: [44, 58, 5, 0.9], m: 'dark' },
      { c: [56, 61, 5, 1.4], m: 'metal' },
      { p: [[4, 0], [10, 0], [12.5, -9], [13.5, -16], [8, -17], [6, -9]], t: 2.8, m: 'dark' },
      { p: [[-8, 0.5], [-3, 0.5], [-4.6, -10], [-10, -10]], t: 3.0, m: 'grip' },
      { p: [[-12, 1], [-12, 8], [-38, 6.5], [-41, 6], [-41, -4], [-37, -4], [-25, -0.5]], t: 3.8, m: 'paint' },
      { p: [[-41.8, 6.2], [-40, 6.2], [-40, -4.2], [-41.8, -4.2]], t: 3.8, m: 'dark' },
      { p: [[-10, 8], [30, 8], [30, 9.4], [-10, 9.4]], t: 2.2, m: 'dark' },
      { p: [[40, 7.4], [42, 7.4], [42, 11], [40, 11]], t: 1.2, m: 'dark' }
    ],
    details: [[25, 3, 41, 3.3], [25, 5, 41, 5.2], [-9, 4, 18, 4], [14, 1, 14, 7], [-30, 2, -14, 4]]
  };

  W.vihr = {
    id: 'vihr', name: 'Вихрь', cls: 'Карабин', slot: 1, kind: 'gun', mode: 'auto', price: 2300,
    desc: 'Компоновка «булл-пап»: короткий, лёгкий и скорострельный. Мягкая отдача и предсказуемая очередь, урон чуть ниже.',
    dmg: 30, pellets: 1, rate: 0.085, mag: 30, reserve: 90, reload: 2.2, pen: 0.7, falloff: 0.93, head: 4,
    spread: { base: 0.0035, move: 0.065, air: 0.15, spray: 0.0045, sprayMax: 0.045, crouch: 0.7 },
    recoil: { kick: 0.0115, yaw: 0.006, recover: 7 },
    mob: 0.9, draw: 0.6, sound: 'carbine', reward: 300,
    ui: { dmg: 0.6, rate: 0.85, acc: 0.82, recoil: 0.5, mob: 0.74 },
    hold: [0, 0], hold2: [16, -1],
    shape: [
      { p: [[-34, -2], [18, -2], [20, 3], [20, 8], [-30, 8], [-34, 5]], t: 4.6, m: 'paint' },
      { c: [20, 34, 4.5, 0.85], m: 'dark' },
      { c: [33, 37, 4.5, 1.3], m: 'metal' },
      { p: [[-24, -2], [-18, -2], [-16, -13], [-22, -13.5]], t: 2.6, m: 'dark' },
      { p: [[-3, -2], [2, -2], [0.5, -10.5], [-4.5, -10.5]], t: 3.0, m: 'grip' },
      { p: [[-12, 8], [12, 8], [12, 12], [10, 12], [10, 9.4], [-10, 9.4], [-10, 12], [-12, 12]], t: 1.8, m: 'dark' },
      { p: [[-35, -2.4], [-33, -2.4], [-33, 8.4], [-35, 8.4]], t: 4.6, m: 'dark' },
      { p: [[2, -2], [18, -2], [18, -4], [2, -4]], t: 3.2, m: 'grip' }
    ],
    details: [[-28, 3, -6, 3], [4, 5.6, 17, 5.6], [-10, 1, -10, 7], [6, 1, 6, 7]]
  };

  W.igla = {
    id: 'igla', name: 'Игла', cls: 'Снайперская винтовка', slot: 1, kind: 'gun', mode: 'bolt', price: 4500, scope: true,
    desc: 'Продольно-скользящий затвор и прицел ×4 (ПКМ). Один выстрел в корпус — почти всегда выбывание. Без прицела бесполезна.',
    dmg: 118, pellets: 1, rate: 1.35, mag: 5, reserve: 20, reload: 3.0, pen: 0.97, falloff: 0.99, head: 2.5,
    spread: { base: 0.07, scoped: 0.0007, move: 0.12, air: 0.2, spray: 0, sprayMax: 0, crouch: 0.8 },
    recoil: { kick: 0.06, yaw: 0.006, recover: 4 },
    mob: 0.8, draw: 0.9, sound: 'sniper', reward: 100, zoom: 4.2,
    ui: { dmg: 1, rate: 0.08, acc: 1, recoil: 0.9, mob: 0.52 },
    hold: [0, 0], hold2: [24, -1],
    shape: [
      { p: [[-6, 0], [26, 0], [26, 6], [-6, 6]], t: 3.6, m: 'paint' },
      { c: [26, 76, 3.6, 0.95], m: 'dark' },
      { c: [72, 78, 3.6, 1.35], m: 'metal' },
      { p: [[-6, 0], [-6, 5], [-14, 5], [-46, 4], [-48, 3], [-48, -8], [-44, -8.5], [-30, -3], [-18, -3], [-15, -7], [-9, -7.5], [-8, -0.5]], t: 3.6, m: 'paint' },
      { p: [[2, 0], [40, 0.6], [40, 3.6], [26, 3.6], [26, 0]], t: 3.8, m: 'paint' },
      { c: [-5, 21, 10.4, 1.9], m: 'dark' },
      { c: [-8, -4, 10.4, 2.5], m: 'dark' },
      { c: [18, 23, 10.4, 2.8], m: 'dark' },
      { p: [[1, 6], [3, 6], [3, 8.6], [1, 8.6]], t: 1.6, m: 'dark' },
      { p: [[13, 6], [15, 6], [15, 8.6], [13, 8.6]], t: 1.6, m: 'dark' },
      { p: [[-2, 4], [-1, 4], [-3, 0.5], [-5.4, 0.2], [-5.4, -1.2], [-2.2, -0.8], [0, 3.4]], t: 4.6, m: 'metal' },
      { p: [[8, 0], [13, 0], [12.6, -4], [8.4, -4]], t: 2.4, m: 'dark' },
      { p: [[-48.6, 3.4], [-46.8, 3.4], [-46.8, -8.6], [-48.6, -8.6]], t: 3.8, m: 'dark' }
    ],
    details: [[-40, -1, -20, 0], [4, 3, 24, 3], [28, 2, 38, 2.2]]
  };

  RZ.WEAPONS = W;
  RZ.WEAPON_ORDER = ['knife', 'osa', 'shmel', 'shershen', 'taran', 'grom', 'vihr', 'igla'];
  RZ.SLOT_LABEL = { 1: 'Основное', 2: 'Пистолет', 3: 'Нож' };

  /* ------------------------------------------------------------------ */
  /* Paints                                                              */
  /* pattern: {t:type, c:[colours], s:scale, a:angle(deg)}               */
  /* types: plain, stripes, camo, chevron, grid, splatter, gradient, hex,*/
  /*        digital, topo, marble, rings                                 */
  /* ------------------------------------------------------------------ */
  function P(id, weapon, name, rarity, t, c, s, a) {
    return { id: id, weapon: weapon, name: name, rarity: rarity, pattern: { t: t, c: c, s: s || 1, a: a || 0 } };
  }
  RZ.PAINTS = [
    // knife
    P('k-karton', 'knife', 'Картон', 1, 'grid', ['#b99b63', '#8f7444', '#d1b57e'], 1.2),
    P('k-inei', 'knife', 'Иней', 3, 'marble', ['#e8eef2', '#9fb6c6', '#5d7a8f'], 1),
    P('k-zarevo', 'knife', 'Зарево', 5, 'gradient', ['#ffcf3a', '#e2421b', '#4a0c22'], 1, 30),
    P('k-gudron', 'knife', 'Гудрон', 2, 'splatter', ['#262422', '#4c4740', '#8a8070'], 1),
    // osa
    P('o-shifer', 'osa', 'Шифер', 1, 'stripes', ['#6d7378', '#5a6065'], 0.6, 90),
    P('o-ohra', 'osa', 'Охра', 1, 'plain', ['#b98a3b', '#9c722c']),
    P('o-brusnika', 'osa', 'Брусника', 2, 'camo', ['#7b1e2c', '#b23a48', '#3f1018', '#d97b84'], 1),
    P('o-razmetka', 'osa', 'Разметка', 3, 'chevron', ['#f0c419', '#1c1a17'], 1),
    P('o-yantar', 'osa', 'Янтарь', 4, 'marble', ['#f6b73c', '#b8661a', '#5c2a08'], 1),
    // shmel
    P('s-glina', 'shmel', 'Глина', 1, 'splatter', ['#9c6b4a', '#7a4f33', '#c18b65'], 1),
    P('s-pepel', 'shmel', 'Пепел', 2, 'digital', ['#9a9a96', '#5f5f5c', '#cfcfc9', '#3a3a38'], 1),
    P('s-kobalt', 'shmel', 'Кобальт', 3, 'hex', ['#1d3f9e', '#2f62d8', '#0d1c4a'], 1),
    P('s-pozolota', 'shmel', 'Позолота', 5, 'topo', ['#2a1d08', '#d7a531', '#f4dc8a'], 1),
    // shershen
    P('h-karton', 'shershen', 'Картон', 1, 'grid', ['#c2a56c', '#9d8350', '#ad9260'], 1),
    P('h-polyn', 'shershen', 'Полынь', 2, 'camo', ['#7d8a62', '#5b6646', '#a8b38a', '#3d4530'], 1),
    P('h-tel', 'shershen', 'Тельняшка', 2, 'stripes', ['#f2f0ea', '#203a78'], 0.5, 0),
    P('h-sota', 'shershen', 'Сота', 3, 'hex', ['#f0b429', '#7a4e00', '#2b1a00'], 1.2),
    P('h-sumerki', 'shershen', 'Сумерки', 4, 'gradient', ['#2b1d52', '#6c3a8f', '#e28a5a'], 1, 0),
    // taran
    P('t-rzhavchina', 'taran', 'Ржавчина', 1, 'splatter', ['#7a3a1c', '#a65326', '#4b2412', '#c2773f'], 1.2),
    P('t-beton', 'taran', 'Бетон', 1, 'marble', ['#a9a7a0', '#88867f', '#c4c2bb'], 1.4),
    P('t-cheremuha', 'taran', 'Черёмуха', 3, 'splatter', ['#f2eef2', '#2a2a2e', '#b9b6c4'], 0.8),
    P('t-mishen', 'taran', 'Мишень', 4, 'rings', ['#efe6cf', '#17140f', '#d2351a'], 1),
    // grom
    P('g-surik', 'grom', 'Сурик', 1, 'plain', ['#9b3a22', '#7f2d19']),
    P('g-listopad', 'grom', 'Листопад', 2, 'camo', ['#a45a1f', '#6e3a14', '#d18b3a', '#3c2010'], 1),
    P('g-inei', 'grom', 'Иней', 3, 'digital', ['#e9f0f4', '#a8bccb', '#6e8aa0', '#3e5466'], 1),
    P('g-chertezh', 'grom', 'Чертёж', 4, 'grid', ['#1e4f9e', '#d6e4ff', '#3a6cc0'], 0.8),
    P('g-polyarnaya', 'grom', 'Полярная ночь', 5, 'topo', ['#08121f', '#3de0b5', '#7a5cff'], 1),
    // vihr
    P('v-mazut', 'vihr', 'Мазут', 1, 'marble', ['#2b2a28', '#45423d', '#1a1918'], 1),
    P('v-priboy', 'vihr', 'Прибой', 2, 'stripes', ['#2c6f8a', '#a7d4df', '#173d4e'], 0.8, 35),
    P('v-razmetka', 'vihr', 'Разметка', 3, 'chevron', ['#e8e2d0', '#d2351a'], 1.1),
    P('v-malahit', 'vihr', 'Малахит', 4, 'topo', ['#0d4d3a', '#3faa7c', '#0a2a20'], 0.8),
    // igla
    P('i-polyn', 'igla', 'Полынь', 1, 'camo', ['#8a8d6a', '#666a4d', '#b0b28e', '#4a4c38'], 1.3),
    P('i-nazhdak', 'igla', 'Наждак', 2, 'splatter', ['#c8b48a', '#a28d63', '#e1d3b2'], 0.6),
    P('i-lednik', 'igla', 'Ледник', 3, 'gradient', ['#e8f6ff', '#86c3e6', '#2f6f9c'], 1, 90),
    P('i-kuporos', 'igla', 'Купорос', 4, 'hex', ['#147d8c', '#3fc4d0', '#073840'], 0.9),
    P('i-zhest', 'igla', 'Жесть', 5, 'chevron', ['#c9ccd0', '#1c1f22'], 0.7)
  ];
  RZ.PAINT_BY_ID = {};
  RZ.PAINTS.forEach(function (p) { RZ.PAINT_BY_ID[p.id] = p; });

  /* factory finish when no paint is equipped */
  RZ.FACTORY = {
    knife: { t: 'plain', c: ['#2c2e2f', '#232425'] },
    osa: { t: 'plain', c: ['#3a3d3f', '#2e3133'] },
    shmel: { t: 'plain', c: ['#4a4d4f', '#3a3c3e'] },
    shershen: { t: 'plain', c: ['#3d4236', '#30342a'] },
    taran: { t: 'plain', c: ['#5a4632', '#463627'] },
    grom: { t: 'plain', c: ['#3b3f41', '#2f3234'] },
    vihr: { t: 'plain', c: ['#5b5a4c', '#48473c'] },
    igla: { t: 'plain', c: ['#4f5444', '#3e4236'] }
  };

  /* ------------------------------------------------------------------ */
  /* Cases                                                               */
  /* ------------------------------------------------------------------ */
  RZ.CASES = [
    {
      id: 'poligon', name: 'Ящик «Полигон»', price: 250, tape: '#d8371b',
      odds: { 1: 62, 2: 26, 3: 10, 4: 2 },
      items: ['k-karton', 'o-shifer', 'o-ohra', 'o-brusnika', 's-glina', 's-pepel', 'h-karton', 'h-polyn', 'h-tel',
        't-rzhavchina', 't-beton', 'g-surik', 'g-listopad', 'v-mazut', 'i-polyn', 'o-razmetka', 'h-sota', 'g-inei', 'h-sumerki']
    },
    {
      id: 'arsenal', name: 'Ящик «Арсенал»', price: 450, tape: '#2a55c4',
      odds: { 1: 38, 2: 34, 3: 19, 4: 8, 5: 1 },
      items: ['o-ohra', 't-beton', 'v-mazut', 'k-gudron', 'h-tel', 'v-priboy', 'i-nazhdak', 'g-listopad',
        'k-inei', 's-kobalt', 't-cheremuha', 'v-razmetka', 'i-lednik', 'o-yantar', 'g-chertezh', 'v-malahit', 'g-polyarnaya']
    },
    {
      id: 'trofei', name: 'Ящик «Трофей»', price: 800, tape: '#b87600',
      odds: { 2: 40, 3: 34, 4: 19, 5: 7 },
      items: ['k-gudron', 's-pepel', 'v-priboy', 'i-nazhdak', 'o-razmetka', 'k-inei', 'g-inei', 'i-lednik', 'h-sota',
        'h-sumerki', 't-mishen', 'i-kuporos', 'o-yantar', 'k-zarevo', 's-pozolota', 'i-zhest', 'g-polyarnaya']
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Input actions and settings                                          */
  /* ------------------------------------------------------------------ */
  RZ.ACTIONS = [
    ['forward', 'Вперёд', 'KeyW'], ['back', 'Назад', 'KeyS'], ['left', 'Влево', 'KeyA'], ['right', 'Вправо', 'KeyD'],
    ['jump', 'Прыжок', 'Space'], ['crouch', 'Присесть', 'ControlLeft'], ['walk', 'Шаг (тихо)', 'ShiftLeft'],
    ['reload', 'Перезарядка', 'KeyR'], ['buy', 'Закупка', 'KeyB'], ['score', 'Таблица', 'Tab'],
    ['primary', 'Основное оружие', 'Digit1'], ['pistol', 'Пистолет', 'Digit2'], ['knife', 'Нож', 'Digit3'],
    ['last', 'Предыдущее оружие', 'KeyQ']
  ];
  /* secondary key that also works for an action if not bound elsewhere */
  RZ.ALT_KEYS = { crouch: 'KeyC' };

  RZ.DEFAULT_SETTINGS = {
    sens: 1.2, ads: 0.6, invert: false,
    chColor: '#ffffff', chSize: 8, chGap: 4, chThick: 2, chDot: false, chDynamic: true,
    fov: 80, quality: 'medium', shadows: true, fps: false, lefty: false,
    vol: 0.7, volSfx: 0.9, volUi: 0.5, hitsound: true,
    keys: (function () { var k = {}; RZ.ACTIONS.forEach(function (a) { k[a[0]] = a[2]; }); return k; })()
  };

  RZ.KEY_NAMES = {
    Space: 'Пробел', ShiftLeft: 'Левый Shift', ShiftRight: 'Правый Shift', ControlLeft: 'Левый Ctrl', ControlRight: 'Правый Ctrl',
    AltLeft: 'Левый Alt', AltRight: 'Правый Alt', Tab: 'Tab', CapsLock: 'Caps Lock', Enter: 'Enter', Backspace: 'Backspace',
    Backquote: 'Ё', Minus: '−', Equal: '=', BracketLeft: 'Х', BracketRight: 'Ъ', Semicolon: 'Ж', Quote: 'Э', Comma: 'Б',
    Period: 'Ю', Slash: '/', Backslash: '\\', ArrowUp: 'Стрелка вверх', ArrowDown: 'Стрелка вниз', ArrowLeft: 'Стрелка влево',
    ArrowRight: 'Стрелка вправо', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'Page Up',
    PageDown: 'Page Down', MetaLeft: 'Win', MetaRight: 'Win', ContextMenu: 'Меню', NumpadEnter: 'Num Enter'
  };
  RZ.keyLabel = function (code) {
    if (!code) return '—';
    if (RZ.KEY_NAMES[code]) return RZ.KEY_NAMES[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
    if (/^F\d+$/.test(code)) return code;
    return code;
  };

  /* ------------------------------------------------------------------ */
  /* Bots                                                                */
  /* ------------------------------------------------------------------ */
  RZ.BOT_NAMES_US = ['Кремень', 'Ясень', 'Сокол', 'Броня', 'Север', 'Липа', 'Гранит', 'Ворон'];
  RZ.BOT_NAMES_THEM = ['Шатун', 'Клык', 'Рысь', 'Сыч', 'Бурелом', 'Хмурый', 'Жиган', 'Колун', 'Сажа', 'Овраг'];

  /* Difficulty profiles. Angles in radians, times in seconds. */
  RZ.DIFFICULTY = {
    easy: {
      name: 'Курсанты', react: [0.55, 0.85], aimSpeed: 3.2, err0: 0.13, errFloor: 0.022, converge: 0.75,
      head: 0.08, comp: 0.25, fov: 1.6, spot: 42, hearing: 0.75, strafe: 0.25, burst: [4, 9], pause: [0.35, 0.7],
      stopToShoot: 0.3, crouch: 0.05, retreatHp: 0, tapDelay: 0.22
    },
    normal: {
      name: 'Бойцы', react: [0.3, 0.46], aimSpeed: 6.5, err0: 0.08, errFloor: 0.012, converge: 0.5,
      head: 0.22, comp: 0.6, fov: 1.9, spot: 60, hearing: 1, strafe: 0.6, burst: [3, 7], pause: [0.2, 0.45],
      stopToShoot: 0.6, crouch: 0.15, retreatHp: 30, tapDelay: 0.1
    },
    hard: {
      name: 'Ветераны', react: [0.17, 0.27], aimSpeed: 11, err0: 0.05, errFloor: 0.006, converge: 0.32,
      head: 0.42, comp: 0.88, fov: 2.2, spot: 75, hearing: 1.25, strafe: 0.9, burst: [3, 6], pause: [0.12, 0.3],
      stopToShoot: 0.9, crouch: 0.25, retreatHp: 40, tapDelay: 0.04
    }
  };

  /* Economy (in-match money) */
  RZ.ECON = {
    start: 800, max: 16000, win: 3250, loss: 1400, lossStep: 500, lossMax: 3400, timeoutWin: 3000,
    armor: 650, helmet: 1000, ammo: 100
  };
  /* Meta tokens */
  RZ.TOKENS = { kill: 15, head: 5, round: 20, match: 150, played: 40, start: 600 };

  RZ.BUY_LIST = [
    { col: 'Пистолеты', items: ['osa', 'shmel'] },
    { col: 'Основное', items: ['shershen', 'taran', 'vihr', 'grom', 'igla'] },
    { col: 'Снаряжение', items: ['armor', 'helmet', 'ammo'] }
  ];
  RZ.GEAR = {
    armor: { name: 'Бронежилет', price: RZ.ECON.armor },
    helmet: { name: 'Бронежилет + шлем', price: RZ.ECON.helmet },
    ammo: { name: 'Патроны', price: RZ.ECON.ammo }
  };

  RZ.fmt = function (n) {
    n = Math.round(n);
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (n < 0 ? '−' : '') + s;
  };
})();
