// Мүмкіндік — data + logic + UI in one module. No build step, no dependencies.
// Pure functions are exported and checked by tests/mumkindik.check.mjs.

// stage = minimum project stage the programme expects: idea < mvp < growth.
// deadline = last known application deadline (ISO) or null if not announced.
export const PROGRAMS = [
  {
    name: 'Startup Garage', org: 'Astana Hub', type: 'incubator', stage: 'idea', deadline: '2026-07-31',
    prize: null,
    ru: 'Интенсивная инкубационная программа для начинающих IT-стартапов. Наборы идут потоками.',
    kz: 'Жаңа бастаған IT-стартаптарға арналған қарқынды инкубациялық бағдарлама. Қабылдау лек-легімен өтеді.',
    url: 'https://astanahub.com/ru/article/ot-idei-do-pervykh-prodazh-astana-hub-otkryl-nabor-v-novyi-potok-startup-garage',
  },
  {
    name: 'Tech Incubator', org: 'Astana Hub', type: 'incubator', stage: 'idea', deadline: '2026-09-03',
    prize: null,
    ru: '14 недель, 40 сессий, 3 трека. Очно в Астане, онлайн между сессиями.',
    kz: '14 апта, 40 сессия, 3 трек. Астанада бетпе-бет, сессиялар арасында онлайн.',
    url: 'https://astanahub.com/ru/l/techIncubator2026',
  },
  {
    name: 'Digital Qazaqstan Battle', org: 'Astana Hub', type: 'competition', stage: 'mvp', deadline: '2026-02-22',
    prize: '19 млн ₸',
    ru: 'Национальный стартап-баттл: региональные отборы и финал на форуме Digital Qazaqstan.',
    kz: 'Ұлттық стартап-баттл: өңірлік іріктеулер және Digital Qazaqstan форумындағы финал.',
    url: 'https://the-tech.kz/startoval-priem-zayavok-na-naczionalnyj-startap-batl-digital-qazaqstan-battle/',
  },
  {
    name: 'alem.ai battle', org: 'alem.ai', type: 'competition', stage: 'idea', deadline: null,
    prize: '25 млн ₸',
    ru: 'Национальный конкурс в сфере искусственного интеллекта.',
    kz: 'Жасанды интеллект саласындағы ұлттық байқау.',
    url: 'https://kazpravda.kz/n/v-kazahstane-startoval-natsionalnyy-konkurs-alemai-battle/',
  },
  {
    name: 'Astana Hub Battle', org: 'Astana Hub', type: 'competition', stage: 'mvp', deadline: null,
    prize: '$100 000',
    ru: 'Международная стартап-битва перед инвесторами в рамках AI & Digital Bridge.',
    kz: 'AI & Digital Bridge аясында инвесторлар алдындағы халықаралық стартап-шайқас.',
    url: 'https://bizmedia.kz/2026-08-28-astana-hub-battle-2026-otkryt-priem-zayavok-na-glavnuyu-startap-bitvu-goda/',
  },
  {
    name: 'AI’preneurs', org: 'Astana Hub', type: 'accelerator', stage: 'idea', deadline: '2026-03-27',
    prize: null,
    ru: 'Акселератор AI-стартапов: менторы, воркшопы, трекинг, инфраструктура Astana Hub.',
    kz: 'AI-стартаптар акселераторы: менторлар, воркшоптар, трекинг, Astana Hub инфрақұрылымы.',
    url: 'https://astanahub.com/ru/article/aipreneurs-2026-startoval-priem-zaiavok-na-chetvertyi-potok-akseleratora-ai-startapov',
  },
  {
    name: 'Hero Training', org: 'Draper University', type: 'accelerator', stage: 'idea', deadline: '2026-03-07',
    prize: null,
    ru: 'Международный акселератор Draper University для основателей из Центральной Азии и Кавказа.',
    kz: 'Орталық Азия мен Кавказ негізін қалаушыларына арналған Draper University халықаралық акселераторы.',
    url: 'https://www.gov.kz/memleket/entities/maidd/press/news/details/1174697?lang=ru',
  },
  {
    name: 'Big Sky SEA Hub', org: 'Astana Hub', type: 'accelerator', stage: 'growth', deadline: '2026-08-24',
    prize: null,
    ru: 'Для быстрорастущих стартапов Центральной Азии, которые выходят на рынок Юго-Восточной Азии.',
    kz: 'Оңтүстік-Шығыс Азия нарығына шығатын Орталық Азияның жылдам өсіп келе жатқан стартаптарына.',
    url: 'https://astanahub.com/ru/article/astana-hub-otkryvaet-priem-zaiavok-na-programmu-big-sky-sea-hub-dlia-startapov-tsentralnoi-azii-v-iugo',
  },
  {
    name: 'Digital Startups Scale Up', org: 'Astana Hub · Tumar · IT Park Uzbekistan', type: 'accelerator', stage: 'growth', deadline: null,
    prize: null,
    ru: 'Международная акселерация в Дубае для стартапов Центральной Азии.',
    kz: 'Орталық Азия стартаптарына арналған Дубайдағы халықаралық акселерация.',
    url: 'https://astanahub.com/ru/article/astana-hub-otkryvaet-priem-zaiavok-na-vtoroi-potok-programmy-digital-startups-scale-up',
  },
  {
    name: 'Central Eurasia Market Entry', org: 'Astana Hub · Almaty Hub', type: 'accelerator', stage: 'growth', deadline: null,
    prize: null,
    ru: 'Акселерация в Алматы для зрелых стартапов, готовых масштабироваться.',
    kz: 'Масштабталуға дайын жетілген стартаптарға арналған Алматыдағы акселерация.',
    url: 'https://astanahub.com/ru/article/otkroite-novye-vozmozhnosti-v-tsentralnoi-evrazii-astana-hub-priglashaet-mezhdunarodnye-startapy-k-mas',
  },
  {
    name: 'Zhas Kasipker', org: 'Abai University', type: 'competition', stage: 'idea', deadline: '2026-04-15',
    prize: null,
    ru: 'Конкурс стартап-проектов для сотрудников Abai University до 40 лет.',
    kz: 'Abai University-дің 40 жасқа дейінгі қызметкерлеріне арналған стартап-жобалар байқауы.',
    url: 'https://abai.university/en/news/obieiavliaetsia-konkurs-startup-proektov-zas-kasipker-abai-university-2g81H',
  },
  {
    name: 'Гранты LitTech', org: 'QazaqCreative', type: 'grant', stage: 'idea', deadline: '2026-09-28',
    prize: '10 × 5 млн ₸',
    ru: 'Гранты для литературных и LitTech-проектов. Заявка на казахском или русском.',
    kz: 'Әдеби және LitTech жобаларына арналған гранттар. Өтінім қазақ немесе орыс тілінде.',
    url: 'https://weproject.media/articles/detail/10-grantov-po-5-millionov-tenge-v-kazakhstane-startoval-konkurs-dlya-literaturnykh-i-littech-proekto/',
  },
];

const STAGES = ['idea', 'mvp', 'growth'];

/** today: 'YYYY-MM-DD'. Returns {state: 'open'|'unknown'|'closed', days}. Deadline day itself is still open. */
export function status(deadline, today) {
  if (!deadline) return { state: 'unknown', days: null };
  const days = Math.round((Date.parse(deadline) - Date.parse(today)) / 864e5);
  return { state: days >= 0 ? 'open' : 'closed', days };
}

/** f: {type, stage, prize, open, q}; empty/false values mean "any". */
export function matches(p, f, today) {
  if (f.type && p.type !== f.type) return false;
  // A project at stage X fits programmes that expect X or earlier.
  if (f.stage && STAGES.indexOf(p.stage) > STAGES.indexOf(f.stage)) return false;
  if (f.prize && !p.prize) return false;
  if (f.open && status(p.deadline, today).state !== 'open') return false;
  const q = (f.q || '').trim().toLowerCase();
  return !q || [p.name, p.org, p.ru, p.kz].some((s) => s.toLowerCase().includes(q));
}

/** Open (soonest first) → date unknown → closed (most recent first). */
export function sortPrograms(list, today) {
  const rank = { open: 0, unknown: 1, closed: 2 };
  return [...list].sort((a, b) => {
    const sa = status(a.deadline, today), sb = status(b.deadline, today);
    if (sa.state !== sb.state) return rank[sa.state] - rank[sb.state];
    return sa.state === 'open' ? sa.days - sb.days : sb.days - sa.days;
  });
}

/** All-day calendar event on the deadline with a reminder 3 days before. */
export function ics(p) {
  const d = p.deadline.replaceAll('-', '');
  const next = new Date(Date.parse(p.deadline) + 864e5).toISOString().slice(0, 10).replaceAll('-', '');
  const esc = (s) => s.replace(/[\\;,]/g, '\\$&');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mumkindik//KZ', 'BEGIN:VEVENT',
    `UID:${d}-${encodeURIComponent(p.name)}@mumkindik`, `DTSTAMP:${d}T000000Z`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc('Дедлайн: ' + p.name)}`, `URL:${p.url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Deadline', 'TRIGGER:-P3D', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

// ---------- UI (browser only) ----------

const T = {
  ru: {
    tagline: 'Все IT-конкурсы, гранты и акселераторы Казахстана — в одном месте, с дедлайнами.',
    any: 'Все', competition: 'Конкурс', incubator: 'Инкубатор', accelerator: 'Акселератор', grant: 'Грант',
    typeLabel: 'Тип', stageLabel: 'Моя стадия', stageAny: 'Любая', idea: 'Только идея', mvp: 'Есть MVP', growth: 'Есть выручка',
    prize: 'С призовым фондом', open: 'Только открытый приём', search: 'Поиск по названию…',
    today: 'Последний день подачи', closed: 'Приём закрыт', unknown: 'Срок не объявлен',
    wait: 'Ждите следующий набор', until: 'до', cal: 'В календарь', more: 'Подробнее',
    empty: 'Ничего не найдено. Ослабьте фильтры.', found: 'Найдено',
    note: 'Данные собраны из открытых источников. Условия и сроки проверяйте на сайте организатора.',
    days: (n) => `${n} ${{ one: 'день', few: 'дня', many: 'дней' }[new Intl.PluralRules('ru').select(n)] || 'дня'}`,
    left: 'осталось', locale: 'ru',
  },
  kz: {
    tagline: 'Қазақстандағы барлық IT-байқаулар, гранттар мен акселераторлар — бір жерде, мерзімдерімен.',
    any: 'Барлығы', competition: 'Байқау', incubator: 'Инкубатор', accelerator: 'Акселератор', grant: 'Грант',
    typeLabel: 'Түрі', stageLabel: 'Менің кезеңім', stageAny: 'Кез келген', idea: 'Тек идея', mvp: 'MVP бар', growth: 'Табыс бар',
    prize: 'Жүлде қоры бар', open: 'Тек ашық қабылдау', search: 'Атауы бойынша іздеу…',
    today: 'Өтінім берудің соңғы күні', closed: 'Қабылдау жабылды', unknown: 'Мерзімі жарияланбаған',
    wait: 'Келесі қабылдауды күтіңіз', until: 'дейін', cal: 'Күнтізбеге', more: 'Толығырақ',
    empty: 'Ештеңе табылмады. Сүзгілерді жеңілдетіңіз.', found: 'Табылды',
    note: 'Деректер ашық дереккөздерден жиналған. Шарттар мен мерзімдерді ұйымдастырушының сайтынан тексеріңіз.',
    days: (n) => `${n} күн`,
    left: 'қалды', locale: 'kk',
  },
};

if (typeof document !== 'undefined') {
  const $ = (s) => document.querySelector(s);
  const store = {
    get: () => { try { return localStorage.getItem('mumkindik-lang'); } catch { return null; } },
    set: (v) => { try { localStorage.setItem('mumkindik-lang', v); } catch { /* private mode */ } },
  };
  let lang = store.get() === 'kz' ? 'kz' : 'ru';
  const now = new Date();
  const today = new Date(now - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); // local date
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function card(p) {
    const t = T[lang], s = status(p.deadline, today);
    const date = p.deadline && new Date(p.deadline).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });
    const big = s.state === 'open' ? (s.days === 0 ? '!' : s.days) : s.state === 'closed' ? '×' : '?';
    const line = s.state === 'open'
      ? (s.days === 0 ? t.today : `${t.days(s.days)} ${t.left} · ${t.until} ${date}`)
      : s.state === 'closed' ? `${t.closed} ${date}. ${t.wait}` : `${t.unknown}. ${t.wait}`;
    const cal = s.state === 'open'
      ? `<a class="btn" download="${esc(p.name)}.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics(p))}">${t.cal}</a>` : '';
    return `<li class="card ${s.state}">
      <div class="count" aria-hidden="true">${big}</div>
      <div class="body">
        <p class="meta"><span class="tag">${t[p.type]}</span> ${esc(p.org)}${p.prize ? ` · <b>${esc(p.prize)}</b>` : ''}</p>
        <h2>${esc(p.name)}</h2>
        <p>${esc(p[lang])}</p>
        <p class="when">${line}</p>
        <p class="actions"><a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">${t.more} ↗</a>${cal}</p>
      </div></li>`;
  }

  function render() {
    const t = T[lang], f = $('#filters');
    const filter = { type: f.type.value, stage: f.stage.value, prize: f.prize.checked, open: f.open.checked, q: f.q.value };
    const list = sortPrograms(PROGRAMS.filter((p) => matches(p, filter, today)), today);
    $('#list').innerHTML = list.map(card).join('') || `<li class="empty">${t.empty}</li>`;
    $('#found').textContent = `${t.found}: ${list.length}`;
  }

  function applyLang() {
    const t = T[lang];
    document.documentElement.lang = t.locale;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t[el.dataset.t]; });
    $('#q').placeholder = t.search;
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    render();
  }

  $('#filters').addEventListener('input', render);
  $('#filters').addEventListener('submit', (e) => e.preventDefault());
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang; store.set(lang); applyLang();
  }));
  applyLang();
}
