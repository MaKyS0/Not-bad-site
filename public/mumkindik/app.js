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
  const next = new Date(Date.parse(p.end || p.deadline) + 864e5).toISOString().slice(0, 10).replaceAll('-', '');
  const esc = (s) => s.replace(/[\\;,]/g, '\\$&');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mumkindik//KZ', 'BEGIN:VEVENT',
    `UID:${d}-${encodeURIComponent(p.name)}@mumkindik`, `DTSTAMP:${d}T000000Z`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc(p.end ? p.name : 'Дедлайн: ' + p.name)}`, `URL:${p.url}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Deadline', 'TRIGGER:-P3D', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

// ---------- Universities ----------
// Requirement cells: [value, ru detail, kz detail] or null when the source gives nothing.
// photo: [Wikimedia Commons file name, author or null], hotlinked through Special:FilePath.
// programs: [code, ru, kz, grants, minScore] — 2025 general grant competition (univision.kz).
export const UNIVERSITIES = [
  {
    name: 'Nazarbayev University', city: ['Астана', 'Астана'], url: 'https://nu.edu.kz/?p=12745',
    fee: ['15 000 $ в год (2026/27)', 'жылына 15 000 $ (2026/27)'],
    ielts: ['6.0', 'Writing 6.0, остальные от 5.5', 'Writing 6.0, қалғандары 5.5-тен'],
    sat: ['1240', 'или ACT 26', 'немесе ACT 26'],
    ent: ['85', 'на английском, грамотность от 8 из 10', 'ағылшын тілінде, сауаттылық 10-нан 8'],
    photo: ['Nazarbaev University Astana.JPG', 'Кондуктор-контролёр'],
    note: [
      'Достаточно одного из результатов: SAT, ACT, ЕНТ, IB (27) или A-level (BBB). Свой экзамен NUET: от 130, по 60 в каждой части. Foundation: IELTS 5.5, SAT 1140 или ЕНТ 75. Для финансовой поддержки требования выше.',
      'Нәтижелердің біреуі жеткілікті: SAT, ACT, ҰБТ, IB (27) немесе A-level (BBB). Өз емтиханы NUET: 130-дан, әр бөлімнен 60. Foundation: IELTS 5.5, SAT 1140 немесе ҰБТ 75. Қаржылай қолдау үшін талаптар жоғары.',
    ],
  },
  {
    name: 'Astana IT University', city: ['Астана', 'Астана'], url: 'https://admission.astanait.edu.kz/',
    fee: ['2,5 млн ₸ в год (2026/27)', 'жылына 2,5 млн ₸ (2026/27)'],
    ielts: ['5.5', 'освобождает от английского в тесте AET; с 6.0 скидка 20%', 'AET тестіндегі ағылшын тілінен босатады; 6.0-ден 20% жеңілдік'],
    sat: ['—', 'принимают, переводят в баллы ЕНТ', 'қабылданады, ҰБТ балына аударылады'],
    ent: ['80', 'платное, на грант 70 или 85; плюс экзамен AET', 'ақылы, грантқа 70 немесе 85; оған қоса AET емтиханы'],
    photo: ['Astana IT University — Future of Digital Kazakhstan.jpg', 'Aliaskarov Danial'],
    tableUrl: 'https://univision.kz/univ/119-astana-it-university/ball',
    programs: [
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 1347, 80],
      ['B058', 'Информационная безопасность', 'Ақпараттық қауіпсіздік', 858, 85],
      ['B063', 'Электротехника и автоматизация', 'Электр техникасы және автоматтандыру', 298, 75],
      ['B059', 'Коммуникации и коммуникационные технологии', 'Коммуникациялар және коммуникациялық технологиялар', 234, 70],
      ['B044', 'Менеджмент и управление', 'Менеджмент және басқару', 9, 99],
      ['B042', 'Журналистика и репортерское дело', 'Журналистика және репортер ісі', 9, 126],
    ],
  },
  {
    name: 'Satbayev University', city: ['Алматы', 'Алматы'],
    ielts: null,
    sat: null,
    ent: ['80', 'порог вуза на грант и платное', 'ЖОО шегі: грант пен ақылы'],
    fee: ['1,0–1,3 млн ₸ в год', 'жылына 1,0–1,3 млн ₸'],
    url: 'https://bes.media/news/postuplenie-v-satbayev-university-v-2026-podrobnyy-gid-dlya-abiturientov/',
    tableUrl: 'https://univision.kz/univ/47-kazahskiy-natsionalnyy-issledovatelskiy-tehnicheskiy-universitet-imeni-k-i-satpaeva/ball',
    programs: [
      ['B058', 'Информационная безопасность', 'Ақпараттық қауіпсіздік', 354, 85],
      ['B052', 'Наука о земле', 'Жер туралы ғылым', 288, 72],
      ['B071', 'Горное дело и добыча полезных ископаемых', 'Тау-кен ісі және пайдалы қазбаларды өндіру', 267, 65],
      ['B074', 'Градостроительство и гражданское строительство', 'Қала құрылысы және азаматтық құрылыс', 231, 72],
      ['B063', 'Электротехника и автоматизация', 'Электр техникасы және автоматтандыру', 134, 74],
      ['B062', 'Электротехника и электроэнергетика', 'Электр техникасы және энергетика', 107, 65],
      ['B064', 'Механика и металлообработка', 'Механика және металл өңдеу', 99, 65],
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 94, 75],
      ['B073', 'Архитектура', 'Сәулет', 93, 89],
    ],
  },
  {
    name: 'КБТУ', city: ['Алматы', 'Алматы'], url: 'https://kbtu.edu.kz/ru/shkoly/shkola-informatsionnykh-tekhnologij-i-inzhenerii/bakalavriat-shkoly-informatsionnykh-tekhnologij',
    ielts: ['5.5', 'или TOEFL iBT 46; без сертификата внутренний тест вуза', 'немесе TOEFL iBT 46; сертификат болмаса, ЖОО-ның ішкі тесті'],
    sat: null,
    ent: ['—', 'приём по баллам ЕНТ, порог у программы свой', 'ҰБТ балы бойынша, шегі бағдарламаға байланысты'],
    photo: ['Kazakh-British Technical University, Almaty (P1180218).jpg', null],
    fee: ['1,8–3 млн ₸ в год', 'жылына 1,8–3 млн ₸'],
    note: [
      'Школа IT и инженерии: бакалавриат 50 000 ₸ за кредит. В 2026 году открыты Game Development и Data Science and AI.',
      'IT және инженерия мектебі: бакалавриат бір кредитке 50 000 ₸. 2026 жылы Game Development және Data Science and AI ашылды.',
    ],
    tableUrl: 'https://univision.kz/univ/63-kazahstansko-britanskiy-tehnicheskiy-universitet/ball',
    programs: [
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 800, 110],
      ['B071', 'Горное дело и добыча полезных ископаемых', 'Тау-кен ісі және пайдалы қазбаларды өндіру', 538, 75],
      ['B063', 'Электротехника и автоматизация', 'Электр техникасы және автоматтандыру', 305, 110],
      ['B061', 'Материаловедение и технологии', 'Материалтану және технологиялар', 97, 76],
      ['B046', 'Финансы, экономика, банковское и страховое дело', 'Қаржы, экономика, банк және сақтандыру ісі', 95, 116],
      ['B060', 'Химическая инженерия и процессы', 'Химиялық инженерия және процестер', 54, 86],
      ['B066', 'Морской транспорт и технологии', 'Теңіз көлігі және технологиялары', 34, 70],
      ['B044', 'Менеджмент и управление', 'Менеджмент және басқару', 27, 117],
      ['B047', 'Маркетинг и реклама', 'Маркетинг және жарнама', 9, 115],
    ],
  },
  {
    name: 'SDU University', city: ['Каскелен', 'Қаскелең'], url: 'https://sdu.edu.kz/en/admission-3-2/',
    fee: ['1,2–2,4 млн ₸ в год (2026)', 'жылына 1,2–2,4 млн ₸ (2026)'],
    ielts: ['5.5', 'разделы от 5.0; освобождает от теста на уровень', 'бөлімдер 5.0-ден; деңгейді анықтау тестінен босатады'],
    sat: null,
    ent: ['—', 'приём по результатам ЕНТ', 'қабылдау ҰБТ нәтижесі бойынша'],
    tableUrl: 'https://univision.kz/univ/104-universitet-imeni-suleymana-demirelya/ball',
    programs: [
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 285, 120],
      ['B036', 'Переводческое дело', 'Аударма ісі', 75, 121],
      ['B018', 'Подготовка учителей иностранного языка', 'Шет тілі мұғалімдерін даярлау', 72, 130],
      ['B046', 'Финансы, экономика, банковское и страховое дело', 'Қаржы, экономика, банк және сақтандыру ісі', 70, 108],
      ['B010', 'Подготовка учителей физики', 'Физика мұғалімдерін даярлау', 65, 110],
      ['B016', 'Подготовка учителей казахского языка и литературы', 'Қазақ тілі мен әдебиеті мұғалімдерін даярлау', 63, 125],
      ['B009', 'Подготовка учителей математики', 'Математика мұғалімдерін даярлау', 56, 125],
      ['B055', 'Математика и статистика', 'Математика және статистика', 56, 120],
      ['B140', 'Международные отношения и дипломатия', 'Халықаралық қатынастар және дипломатия', 49, 110],
    ],
  },
  {
    name: 'КазНУ им. аль-Фараби', city: ['Алматы', 'Алматы'],
    fee: ['0,5–1,9 млн ₸ в год (2026/27)', 'жылына 0,5–1,9 млн ₸ (2026/27)'],
    ielts: null,
    sat: null,
    ent: ['65', 'порог национального вуза', 'ұлттық ЖОО шегі'],
    url: 'https://univision.kz/univ/50-kazahskiy-natsionalnyy-universitet-imeni-al-farabi/ball',
    photo: ['Main building of KazNU.jpg', null],
    programs: [
      ['B050', 'Биологические и смежные науки', 'Биологиялық және сабақтас ғылымдар', 551, 81],
      ['B052', 'Наука о земле', 'Жер туралы ғылым', 400, 75],
      ['B054', 'Физика', 'Физика', 268, 70],
      ['B053', 'Химия', 'Химия', 236, 80],
      ['B055', 'Математика и статистика', 'Математика және статистика', 205, 95],
      ['B075', 'Кадастр и землеустройство', 'Кадастр және жерге орналастыру', 150, 100],
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 115, 90],
      ['B037', 'Филология', 'Филология', 97, 118],
      ['B068', 'Производство продуктов питания', 'Азық-түлік өнімдерінің өндірісі', 90, 70],
    ],
  },
  {
    name: 'ЕНУ им. Л. Н. Гумилёва', city: ['Астана', 'Астана'], url: 'https://univision.kz/univ/23-evraziyskiy-natsionalnyy-universitet-im-l-n-gumileva/ball',
    fee: ['1,6–1,9 млн ₸ в год (2026/27)', 'жылына 1,6–1,9 млн ₸ (2026/27)'],
    ielts: null,
    sat: null,
    ent: ['65', 'порог национального вуза', 'ұлттық ЖОО шегі'],
    photo: ['L.N.Gumilyov Eurasian National University.JPG', 'ChelseaFunNumberOne'],
    programs: [
      ['B074', 'Градостроительство и гражданское строительство', 'Қала құрылысы және азаматтық құрылыс', 182, 100],
      ['B016', 'Подготовка учителей казахского языка и литературы', 'Қазақ тілі мен әдебиеті мұғалімдерін даярлау', 138, 120],
      ['B091', 'Туризм', 'Туризм', 124, 115],
      ['B009', 'Подготовка учителей математики', 'Математика мұғалімдерін даярлау', 114, 120],
      ['B053', 'Химия', 'Химия', 112, 95],
      ['B055', 'Математика и статистика', 'Математика және статистика', 106, 105],
      ['B040', 'Политология', 'Саясаттану', 103, 113],
      ['B018', 'Подготовка учителей иностранного языка', 'Шет тілі мұғалімдерін даярлау', 99, 125],
      ['B062', 'Электротехника и электроэнергетика', 'Электр техникасы және энергетика', 97, 95],
    ],
  },
  {
    name: 'МУИТ', city: ['Алматы', 'Алматы'], url: 'https://iitu.edu.kz/ru/applicants/bachelor/',
    fee: ['1,08–1,41 млн ₸ в год (2025/26)', 'жылына 1,08–1,41 млн ₸ (2025/26)'],
    ielts: ['5.0', 'освобождает от теста по английскому', 'ағылшын тілі тестінен босатады'],
    sat: null,
    ent: ['50', 'платное; на грант проходной 71–127 (2025)', 'ақылы; грантқа өту балы 71–127 (2025)'],
    tableUrl: 'https://univision.kz/univ/85-mezhdunarodnyy-universitet-informatsionnyh-tehnologiy/ball',
    programs: [
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 363, 90],
      ['B058', 'Информационная безопасность', 'Ақпараттық қауіпсіздік', 287, 90],
      ['B157', 'Математическое и компьютерное моделирование', 'Математикалық және компьютерлік модельдеу', 59, 90],
      ['B059', 'Коммуникации и коммуникационные технологии', 'Коммуникациялар және коммуникациялық технологиялар', 14, 71],
      ['B042', 'Журналистика и репортерское дело', 'Журналистика және репортер ісі', 1, 127],
    ],
  },
  {
    name: 'КазНМУ им. Асфендиярова', city: ['Алматы', 'Алматы'],
    fee: ['0,6–2,1 млн ₸ в год (2026/27)', 'жылына 0,6–2,1 млн ₸ (2026/27)'],
    ielts: null,
    sat: null,
    ent: ['70', 'порог для здравоохранения', 'денсаулық сақтау шегі'],
    url: 'https://univision.kz/univ/48-kazahskiy-natsionalnyy-meditsinskiy-universitet-imeni-s-d-asfendiyarova/ball',
    programs: [
      ['BM086', 'Медицина', 'Медицина', 134, 124],
      ['B072', 'Технология фармацевтического производства', 'Фармацевтикалық өндіріс технологиясы', 108, 75],
      ['BM088', 'Педиатрия', 'Педиатрия', 81, 113],
      ['BM089', 'Медико-профилактическое дело', 'Медициналық-профилактикалық іс', 24, 102],
      ['B085', 'Фармация', 'Фармация', 11, 112],
      ['B084', 'Сестринское дело', 'Мейіргер ісі', 2, 100],
    ],
  },
  {
    name: 'КазНПУ им. Абая', city: ['Алматы', 'Алматы'],
    fee: ['0,99–1,24 млн ₸ в год (2026/27)', 'жылына 0,99–1,24 млн ₸ (2026/27)'],
    ielts: null,
    sat: null,
    ent: ['75', 'порог для педагогики, остальные 65', 'педагогика шегі, қалғандары 65'],
    url: 'https://univision.kz/univ/55-kazahskiy-natsionalnyy-pedagogicheskiy-universitet-imeni-abaya/ball',
    programs: [
      ['B053', 'Химия', 'Химия', 533, 70],
      ['B055', 'Математика и статистика', 'Математика және статистика', 334, 82],
      ['B054', 'Физика', 'Физика', 194, 65],
      ['B009', 'Подготовка учителей математики', 'Математика мұғалімдерін даярлау', 177, 106],
      ['B020', 'Специальная педагогика', 'Арнайы педагогика', 150, 85],
      ['B050', 'Биологические и смежные науки', 'Биологиялық және сабақтас ғылымдар', 132, 81],
      ['B011', 'Подготовка учителей информатики', 'Информатика мұғалімдерін даярлау', 116, 75],
    ],
  },
  {
    name: 'Narxoz University', city: ['Алматы', 'Алматы'],
    fee: ['45 700–52 555 ₸ за кредит (2026/27), в год обычно 60 кредитов', 'бір кредит 45 700–52 555 ₸ (2026/27), жылына әдетте 60 кредит'],
    ielts: ['5.5', 'для программ двойного диплома', 'қос диплом бағдарламалары үшін'],
    sat: ['—', 'принимают, переводят в баллы ЕНТ', 'қабылданады, ҰБТ балына аударылады'],
    ent: ['50', 'общий порог конкурса грантов', 'грант конкурсының жалпы шегі'],
    url: 'https://portal.narxoz.kz/media/student_files/Admission_Rules_in_the_NJSC_Narxoz_University_of_applicants.pdf',
    tableUrl: 'https://univision.kz/univ/107-universitet-narhoz/ball',
    programs: [
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 183, 105],
      ['B055', 'Математика и статистика', 'Математика және статистика', 126, 100],
      ['B058', 'Информационная безопасность', 'Ақпараттық қауіпсіздік', 111, 100],
      ['B091', 'Туризм', 'Туризм', 90, 100],
      ['B090', 'Социальная работа', 'Әлеуметтік жұмыс', 87, 72],
      ['B093', 'Ресторанное дело и гостиничный бизнес', 'Мейрамхана ісі және қонақүй бизнесі', 71, 103],
      ['B046', 'Финансы, экономика, банковское и страховое дело', 'Қаржы, экономика, банк және сақтандыру ісі', 63, 103],
    ],
  },
  {
    name: 'АУЭС', city: ['Алматы', 'Алматы'],
    fee: ['1,26–1,68 млн ₸ в год (2026/27)', 'жылына 1,26–1,68 млн ₸ (2026/27)'],
    ielts: null,
    sat: null,
    ent: ['50', 'общий порог конкурса грантов', 'грант конкурсының жалпы шегі'],
    url: 'https://univision.kz/univ/9-almatinskiy-universitet-energetiki-i-svyazi/ball',
    programs: [
      ['B058', 'Информационная безопасность', 'Ақпараттық қауіпсіздік', 872, 71],
      ['B162', 'Теплоэнергетика', 'Жылу энергетикасы', 200, 50],
      ['B064', 'Механика и металлообработка', 'Механика және металл өңдеу', 185, 52],
      ['B062', 'Электротехника и электроэнергетика', 'Электр техникасы және энергетика', 117, 56],
      ['B059', 'Коммуникации и коммуникационные технологии', 'Коммуникациялар және коммуникациялық технологиялар', 59, 52],
      ['B063', 'Электротехника и автоматизация', 'Электр техникасы және автоматтандыру', 44, 78],
      ['B065', 'Транспортная техника и технологии', 'Көлік техникасы және технологиялары', 37, 51],
    ],
  },
  {
    name: 'Карагандинский университет им. Букетова', city: ['Караганда', 'Қарағанды'],
    fee: ['0,77–0,81 млн ₸ в год (2025/26)', 'жылына 0,77–0,81 млн ₸ (2025/26)'],
    ielts: null,
    sat: null,
    ent: null,
    url: 'https://univision.kz/univ/69-karagandinskiy-gosudarstvennyy-universitet-imeni-akademika-e-buketova/ball',
    programs: [
      ['B053', 'Химия', 'Химия', 114, 70],
      ['B052', 'Наука о земле', 'Жер туралы ғылым', 68, 72],
      ['B054', 'Физика', 'Физика', 64, 65],
      ['B072', 'Технология фармацевтического производства', 'Фармацевтикалық өндіріс технологиясы', 30, 66],
      ['B050', 'Биологические и смежные науки', 'Биологиялық және сабақтас ғылымдар', 29, 82],
      ['B051', 'Окружающая среда', 'Қоршаған орта', 28, 74],
      ['B020', 'Специальная педагогика', 'Арнайы педагогика', 25, 88],
    ],
  },
  {
    name: 'KIMEP University', city: ['Алматы', 'Алматы'], url: 'https://www.kimep.kz/prospective-students/kz/admission/high-school-graduates/',
    fee: ['4,9–5,9 млн ₸ в год (2026/27)', 'жылына 4,9–5,9 млн ₸ (2026/27)'],
    ielts: ['5.5', 'разделы от 5.0, уровень Academic English', 'бөлімдер 5.0-ден, Academic English деңгейі'],
    sat: null,
    ent: ['50', 'общий порог, по предметам от 5', 'жалпы шек, пәндерден 5-тен'],
    photo: ['KIMEP New Academic Building.jpg', null],
    note: [
      'С более низким баллом зачисляют на подготовительные уровни английского. Без сертификата сдают внутренний тест KEPT. Онлайн-заявки открываются 15 октября.',
      'Балл төмен болса, ағылшын тілінің дайындық деңгейлеріне қабылдайды. Сертификат болмаса, ішкі KEPT тесті тапсырылады. Онлайн өтінімдер 15 қазанда ашылады.',
    ],
  },
  {
    name: 'Cardiff University Kazakhstan', city: ['Астана', 'Астана'],
    fee: ['16 000 $ в год (2026)', 'жылына 16 000 $ (2026)'],
    ielts: ['6.5', '1 курс, Foundation 6.0, разделы от 5.5', '1-курс, Foundation 6.0, бөлімдер 5.5-тен'],
    sat: null,
    ent: ['80', 'для госгранта', 'мемлекеттік грант үшін'],
    url: 'https://www.gov.kz/uploads/2026/3/30/7699885c1c2362b098c5ce9bcf2fb859_original.23144520.pdf',
  },
  {
    name: 'Coventry University Kazakhstan', city: ['Астана, Алматы', 'Астана, Алматы'],
    fee: ['11 400 £ в год при оплате сразу (2026)', 'бірден төлегенде жылына 11 400 £ (2026)'],
    ielts: ['6.0', 'на грант, платное 5.0', 'грантқа, ақылы 5.0'],
    sat: null,
    ent: ['50', 'для гранта, платное без ЕНТ', 'грант үшін, ақылы ҰБТ-сыз'],
    url: 'https://www.gov.kz/uploads/2026/3/30/7699885c1c2362b098c5ce9bcf2fb859_original.23144520.pdf',
    note: ['В Астане для гранта также нужны GPA 4.0 и эссе.', 'Астанада грант үшін GPA 4.0 және эссе де қажет.'],
  },
];

// ---------- Study abroad ----------
// The destinations Kazakh applicants ask about most. Text cells are [ru, kz]; null = the sources give nothing.
// way: grant = a state scholarship with places for Kazakhstan, free = no tuition in the local language, paid.
// unis: [name, city ru, city kz, place in QS World University Rankings 2027, official site], best place first.
export const ABROAD = [
  {
    id: 'ru',
    name: ['Россия', 'Ресей'], way: 'grant', students: ['свыше 60 тыс. казахстанцев', '60 мыңнан астам қазақстандық'],
    free: ['Квота Россотрудничества: 800 бюджетных мест в 2026 году, от бакалавриата до аспирантуры', 'Россотрудничество квотасы: 2026 жылы 800 бюджеттік орын, бакалавриаттан аспирантураға дейін'],
    need: ['Заявка на education-in-russia.com, затем тест, конкурс аттестатов и собеседование в представительстве Россотрудничества', 'education-in-russia.com сайтында өтінім, содан кейін Россотрудничество өкілдігінде тест, аттестаттар байқауы және сұхбат'],
    cost: ['Платно, например в ВШЭ: от 490 тыс. до 1,1 млн ₽ в год (2026/27)', 'Ақылы, мысалы ЖЭМ-де: жылына 490 мың ₽-ден 1,1 млн ₽-ге дейін (2026/27)'],
    when: ['Заявки на квоту открываются в сентябре, отбор ведёт представительство Россотрудничества в Астане', 'Квотаға өтінім қыркүйекте ашылады, іріктеуді Астанадағы Россотрудничество өкілдігі жүргізеді'],
    urls: ['https://www.lada.kz/kazakhstan-news/155786-rossiia-vydelila-800-besplatnykh-mest-dlia-kazakhstanskikh-studentov-kak-postupit-v-vuzy.html', 'https://informburo.kz/novosti/obrazovanie-bez-granic-pocemu-studenty-iz-kazaxstana-vybiraiut-rossiiskie-universitety', 'https://www.hse.ru/ba/bba/pay'],
    unis: [
      ['МГУ им. М. В. Ломоносова', 'Москва', 'Мәскеу', '115', 'https://www.msu.ru/'],
      ['МГТУ им. Н. Э. Баумана', 'Москва', 'Мәскеу', '318', 'https://bmstu.ru/'],
      ['РУДН', 'Москва', 'Мәскеу', '359', 'https://www.rudn.ru/'],
      ['СПбГУ', 'Санкт-Петербург', 'Санкт-Петербург', '390', 'https://spbu.ru/'],
      ['НИУ ВШЭ', 'Москва', 'Мәскеу', '423', 'https://www.hse.ru/'],
      ['Казанский федеральный университет', 'Казань', 'Қазан', '468', 'https://kpfu.ru/'],
      ['Новосибирский государственный университет', 'Новосибирск', 'Новосібір', '488', 'https://www.nsu.ru/'],
    ],
  },
  {
    id: 'cn',
    name: ['Китай', 'Қытай'], way: 'grant', students: null,
    free: ['Стипендия правительства КНР: 73 гранта на 2026/27 год. Покрывает обучение, общежитие, страховку и ежемесячную стипендию', 'ҚХР үкіметінің стипендиясы: 2026/27 жылға 73 грант. Оқуды, жатақхананы, сақтандыруды және ай сайынғы стипендияны жабады'],
    need: ['Регистрация на сайте CSC; для бакалавриата с 2026 года тест CSCA', 'CSC сайтында тіркелу; бакалавриат үшін 2026 жылдан CSCA тесті'],
    cost: ['Без гранта обучение 3 000–7 000 $ в год', 'Грантсыз оқу жылына 3 000–7 000 $'],
    when: ['На 2026/27 год документы принимали с 21 января по 18 февраля', '2026/27 жылға құжаттар 21 қаңтар – 18 ақпан аралығында қабылданды'],
    urls: ['https://bolashak.gov.kz/en/acceptance-documents', 'https://inbusiness.kz/ru/news/kazahstan-voshel-v-mirovuyu-desyatku-po-eksportu-studentov'],
    unis: [
      ['Peking University', 'Пекин', 'Бейжің', '13', 'https://english.pku.edu.cn/'],
      ['Tsinghua University', 'Пекин', 'Бейжің', '14', 'https://www.tsinghua.edu.cn/en/'],
      ['Fudan University', 'Шанхай', 'Шанхай', '26', 'https://www.fudan.edu.cn/en/'],
      ['Shanghai Jiao Tong University', 'Шанхай', 'Шанхай', '36', 'https://en.sjtu.edu.cn/'],
      ['Zhejiang University', 'Ханчжоу', 'Ханчжоу', '47', 'https://www.zju.edu.cn/english/'],
      ['Nanjing University', 'Нанкин', 'Нанкин', '=90', 'https://www.nju.edu.cn/en/'],
    ],
  },
  {
    id: 'tr',
    name: ['Турция', 'Түркия'], way: 'grant', students: null,
    free: ['Türkiye Bursları: обучение, общежитие, страховка, стипендия и год курсов турецкого', 'Türkiye Bursları: оқу, жатақхана, сақтандыру, стипендия және бір жыл түрік тілі курсы'],
    need: ['Средний балл от 70% (медицина от 90%), возраст до 21 года', 'Орташа балл 70%-дан (медицина 90%-дан), жасы 21-ге дейін'],
    cost: ['Без стипендии в госвузах 1 000–5 000 $ в год', 'Стипендиясыз мемлекеттік ЖОО-да жылына 1 000–5 000 $'],
    when: ['Каждый год с 10 января по 20 февраля', 'Жыл сайын 10 қаңтар – 20 ақпан'],
    urls: ['https://www.turkiyeburslari.gov.tr/calendar', 'https://www.turkiyeburslari.gov.tr/bursprogramlari', 'https://inbusiness.kz/ru/news/kazahstan-voshel-v-mirovuyu-desyatku-po-eksportu-studentov'],
    unis: [
      ['Istanbul Technical University', 'Стамбул', 'Стамбұл', '279', 'https://www.itu.edu.tr/en'],
      ['Middle East Technical University', 'Анкара', 'Анкара', '305', 'https://www.metu.edu.tr/'],
      ['Koç University', 'Стамбул', 'Стамбұл', '329', 'https://www.ku.edu.tr/en/'],
      ['Boğaziçi University', 'Стамбул', 'Стамбұл', '345', 'https://www.bogazici.edu.tr/'],
      ['Sabancı University', 'Стамбул', 'Стамбұл', '357', 'https://www.sabanciuniv.edu/en'],
      ['Bilkent University', 'Анкара', 'Анкара', '454', 'https://www.bilkent.edu.tr/'],
    ],
  },
  {
    id: 'kr',
    name: ['Южная Корея', 'Оңтүстік Корея'], way: 'grant', students: ['около 1 000 казахстанцев', 'шамамен 1 000 қазақстандық'],
    free: ['GKS: 286 стипендий на бакалавриат на весь мир в 2027 году. Обучение, перелёт и ежемесячное пособие', 'GKS: 2027 жылы бүкіл әлемге бакалавриатқа 286 стипендия. Оқу, ұшу билеті және ай сайынғы жәрдемақы'],
    need: ['Возраст до 25 лет. Первый год учат корейский, с TOPIK 5–6 от него освобождают', 'Жасы 25-ке дейін. Бірінші жылы корей тілі оқытылады, TOPIK 5–6 болса, одан босатады'],
    cost: ['Без стипендии обучение 4 000–8 000 $ в год', 'Стипендиясыз оқу жылына 4 000–8 000 $'],
    when: ['Набор на 2027 год: через посольство с 15 сентября 2026 года, через вузы до ноября', '2027 жылға қабылдау: елшілік арқылы 2026 жылғы 15 қыркүйектен, ЖОО арқылы қарашаға дейін'],
    urls: ['https://www.koreajoongangdaily.com/korea/gksu-2027-what-international-students-need-to-know-before-applying/12878569', 'https://el.kz/ru/kuda-postupat-za-granitsey-v-2026-strany-tseny-i-riski_400046459/'],
    unis: [
      ['Seoul National University', 'Сеул', 'Сеул', '38', 'https://en.snu.ac.kr/'],
      ['Yonsei University', 'Сеул', 'Сеул', '42', 'https://www.yonsei.ac.kr/en_sc/'],
      ['Korea University', 'Сеул', 'Сеул', '=52', 'https://www.korea.edu/'],
      ['KAIST', 'Тэджон', 'Тэджон', '65', 'https://www.kaist.ac.kr/en/'],
      ['POSTECH', 'Пхохан', 'Пхохан', '106', 'https://www.postech.ac.kr/eng/'],
    ],
  },
  {
    id: 'hu',
    name: ['Венгрия', 'Венгрия'], way: 'grant', students: null,
    free: ['Stipendium Hungaricum: 250 грантов в год для Казахстана, из них 110 на бакалавриат. Обучение, жильё, страховка и стипендия', 'Stipendium Hungaricum: Қазақстанға жылына 250 грант, оның 110-ы бакалавриатқа. Оқу, тұрғын үй, сақтандыру және стипендия'],
    need: ['Обучение на английском или венгерском', 'Оқу ағылшын немесе венгр тілінде'],
    cost: null,
    when: ['На 2026/27 год заявки принимали до 15 января 2026 года', '2026/27 жылға өтінімдер 2026 жылғы 15 қаңтарға дейін қабылданды'],
    urls: ['https://bolashak.gov.kz/grant-granting-countries', 'https://weproject.media/articles/detail/250-kazakhstantsev-smogut-uchitsya-v-vengrii-v-2026-godu-trebovaniya-kvoty-i-sroki-podachi/'],
    unis: [
      ['Eötvös Loránd University (ELTE)', 'Будапешт', 'Будапешт', '595', 'https://www.elte.hu/en'],
      ['University of Debrecen', 'Дебрецен', 'Дебрецен', '600', 'https://unideb.hu/en'],
      ['University of Szeged', 'Сегед', 'Сегед', '633', 'https://u-szeged.hu/english'],
    ],
  },
  {
    id: 'de',
    name: ['Германия', 'Германия'], way: 'free', students: null,
    free: ['В государственных вузах обучение бесплатное, семестровый взнос 150–350 €', 'Мемлекеттік ЖОО-да оқу тегін, семестрлік жарна 150–350 €'],
    need: ['Немецкий B2–C1. После 11 классов обычно нужен год в штудиенколлеге', 'Неміс тілі B2–C1. 11 сыныптан кейін әдетте штудиенколлегте бір жыл оқу қажет'],
    cost: ['Жизнь 900–1 200 € в месяц', 'Тұру айына 900–1 200 €'],
    when: null,
    urls: ['https://el.kz/ru/kuda-postupat-za-granitsey-v-2026-strany-tseny-i-riski_400046459/', 'https://www.unipage.net/ru/studienkollegs_germany'],
    unis: [
      ['Technical University of Munich (TUM)', 'Мюнхен', 'Мюнхен', '25', 'https://www.tum.de/en/'],
      ['LMU Munich', 'Мюнхен', 'Мюнхен', '61', 'https://www.lmu.de/en/'],
      ['Heidelberg University', 'Гейдельберг', 'Гейдельберг', '86', 'https://www.uni-heidelberg.de/en'],
      ['Freie Universität Berlin', 'Берлин', 'Берлин', '=98', 'https://www.fu-berlin.de/en/'],
      ['RWTH Aachen University', 'Ахен', 'Ахен', '104', 'https://www.rwth-aachen.de/'],
      ['Karlsruhe Institute of Technology (KIT)', 'Карлсруэ', 'Карлсруэ', '110', 'https://www.kit.edu/english/'],
    ],
  },
  {
    id: 'cz',
    name: ['Чехия', 'Чехия'], way: 'free', students: null,
    free: ['В государственных вузах бесплатно, если учиться на чешском', 'Мемлекеттік ЖОО-да чех тілінде оқысаңыз, тегін'],
    need: ['Чешский язык, на него уходит время до поступления', 'Чех тілі, оны түсуге дейін үйренуге уақыт кетеді'],
    cost: ['На английском 8 000–15 000 € в год. Жизнь 600–900 € в месяц', 'Ағылшын тілінде жылына 8 000–15 000 €. Тұру айына 600–900 €'],
    when: null,
    urls: ['https://el.kz/ru/kuda-postupat-za-granitsey-v-2026-strany-tseny-i-riski_400046459/'],
    unis: [
      ['Charles University', 'Прага', 'Прага', '273', 'https://cuni.cz/'],
      ['Czech Technical University in Prague', 'Прага', 'Прага', '432', 'https://www.cvut.cz/en'],
      ['Masaryk University', 'Брно', 'Брно', '454', 'https://www.muni.cz/en'],
      ['Brno University of Technology', 'Брно', 'Брно', '588', 'https://www.vut.cz/en'],
    ],
  },
  {
    id: 'us',
    name: ['США', 'АҚШ'], way: 'paid', students: null,
    free: null,
    need: ['Для сильных программ обычно IELTS 7.0', 'Мықты бағдарламаларға әдетте IELTS 7.0'],
    cost: ['В среднем 85–92 тыс. $ в год вместе с проживанием. Первые два года дешевле в community college', 'Тұруды қосқанда орта есеппен жылына 85–92 мың $. Алғашқы екі жыл community college-де арзанырақ'],
    when: null,
    urls: ['https://inbusiness.kz/ru/news/kazahstan-voshel-v-mirovuyu-desyatku-po-eksportu-studentov', 'https://el.kz/ru/kuda-postupat-za-granitsey-v-2026-strany-tseny-i-riski_400046459/'],
    unis: [
      ['Massachusetts Institute of Technology (MIT)', 'Кембридж, Массачусетс', 'Кембридж, Массачусетс', '1', 'https://www.mit.edu/'],
      ['Stanford University', 'Стэнфорд', 'Стэнфорд', '=2', 'https://www.stanford.edu/'],
      ['Harvard University', 'Кембридж, Массачусетс', 'Кембридж, Массачусетс', '5', 'https://www.harvard.edu/'],
      ['California Institute of Technology (Caltech)', 'Пасадена', 'Пасадена', '7', 'https://www.caltech.edu/'],
      ['University of Pennsylvania', 'Филадельфия', 'Филадельфия', '15', 'https://www.upenn.edu/'],
      ['Yale University', 'Нью-Хейвен', 'Нью-Хейвен', '16', 'https://www.yale.edu/'],
    ],
  },
  {
    id: 'uk',
    name: ['Великобритания', 'Ұлыбритания'], way: 'paid', students: null,
    free: ['Стипендия Chevening рассчитана на магистратуру', 'Chevening стипендиясы магистратураға арналған'],
    need: null,
    cost: ['Обучение и жизнь вместе от 40 тыс. £ в год', 'Оқу мен тұру бірге жылына 40 мың £-тен'],
    when: null,
    urls: ['https://el.kz/ru/kuda-postupat-za-granitsey-v-2026-strany-tseny-i-riski_400046459/', 'https://bes.media/amp/posolstvo-velikobritanii-nazvalo-daty-priema-zayavok-na-stipendiyu-chevening-dlya-kazahstantsev/'],
    unis: [
      ['Imperial College London', 'Лондон', 'Лондон', '=2', 'https://www.imperial.ac.uk/'],
      ['University of Oxford', 'Оксфорд', 'Оксфорд', '4', 'https://www.ox.ac.uk/'],
      ['University of Cambridge', 'Кембридж', 'Кембридж', '6', 'https://www.cam.ac.uk/'],
      ['University College London (UCL)', 'Лондон', 'Лондон', '=8', 'https://www.ucl.ac.uk/'],
      ['University of Edinburgh', 'Эдинбург', 'Эдинбург', '35', 'https://www.ed.ac.uk/'],
      ['King’s College London', 'Лондон', 'Лондон', '37', 'https://www.kcl.ac.uk/'],
      ['University of Manchester', 'Манчестер', 'Манчестер', '=40', 'https://www.manchester.ac.uk/'],
    ],
  },
];

// Headline numbers: [ru value, kz value, ru label, kz label] (UNESCO; the minister's figures of June 2024).
export const ABROAD_FACTS = [
  ['91,2 тыс.', '91,2 мың', 'казахстанцев учатся за рубежом', 'қазақстандық шетелде оқиды'],
  ['9-е место', '9-орын', 'в мире по числу студентов за рубежом', 'шетелдегі студенттер саны бойынша әлемде'],
  ['60 тыс.+', '60 мың+', 'из них в России', 'оның ішінде Ресейде'],
  ['1 000', '1 000', 'в Южной Корее, ещё около 450 в Гонконге', 'Оңтүстік Кореяда, тағы 450-дей Гонконгта'],
];

// Smaller intergovernmental grants for 2026/27: [grants, ru, kz] (bolashak.gov.kz).
export const OTHER_GRANTS = [
  ['100', 'Таджикистан', 'Тәжікстан'],
  ['20', 'Узбекистан', 'Өзбекстан'],
  ['12', 'Азербайджан', 'Әзербайжан'],
  ['10', 'Кыргызстан', 'Қырғызстан'],
  ['3', 'Вьетнам', 'Вьетнам'],
];

// Applicant's calendar for 2027: [start, end, kind, approx, ru, kz, ru note, kz note].
// ENT windows follow the standing schedule; approx = dates of the 2026 campaign, the 2027 ones are not announced yet.
export const CALENDAR = [
  ['2027-01-10', '2027-02-10', 'paid', false, 'Январское ЕНТ', 'Қаңтардағы ҰБТ', '', ''],
  ['2027-01-10', '2027-02-20', 'abroad', false, 'Турция: заявки на Türkiye Bursları', 'Түркия: Türkiye Bursları өтінімдері', 'Приём идёт каждый год в эти даты', 'Қабылдау жыл сайын осы күндері өтеді'],
  ['2027-01-15', '2027-01-15', 'abroad', true, 'Венгрия: последний день подачи на Stipendium Hungaricum', 'Венгрия: Stipendium Hungaricum-ға өтінім берудің соңғы күні', '', ''],
  ['2027-01-21', '2027-02-18', 'abroad', true, 'Китай: документы на стипендию правительства КНР', 'Қытай: ҚХР үкіметінің стипендиясына құжаттар', 'Через eGov или Центр международных программ', 'eGov немесе Халықаралық бағдарламалар орталығы арқылы'],
  ['2027-03-01', '2027-04-06', 'paid', false, 'Мартовское ЕНТ', 'Наурыздағы ҰБТ', '', ''],
  ['2027-04-11', '2027-04-25', 'grant', true, 'Регистрация на основное ЕНТ', 'Негізгі ҰБТ-ға тіркелу', 'Через сайт НЦТ, можно записаться на две попытки', 'ҰТО сайты арқылы, екі талпынысқа жазылуға болады'],
  ['2027-05-10', '2027-07-10', 'grant', false, 'Основное ЕНТ', 'Негізгі ҰБТ', 'Две попытки, в конкурс идёт лучший результат', 'Екі талпыныс, конкурсқа үздік нәтиже өтеді'],
  ['2027-07-13', '2027-07-20', 'grant', true, 'Подача заявлений на грант', 'Грантқа өтініш беру', 'До четырёх вузов и четырёх групп программ', 'Төрт ЖОО мен төрт бағдарламалар тобына дейін'],
  ['2027-08-10', '2027-08-20', 'paid', false, 'Августовское ЕНТ', 'Тамыздағы ҰБТ', '', ''],
];

// Own month names: Chrome ships no Kazakh date data and prints "M01 10" for the 'kk' locale.
const MONTHS = [
  ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
];
/** "2027-01-10" as "10 января" / "10 қаңтар" (i: 0 ru, 1 kz), with the year when asked. */
export function dateText(iso, i, year = false) {
  const [y, m, d] = iso.split('-').map(Number), s = `${d} ${MONTHS[i][m - 1]}`;
  return !year ? s : i ? `${y} жылғы ${s}` : `${s} ${y} г.`;
}

/** Where today sits against a date range: before it (days until the start), inside it, or after it. */
export function phase(start, end, today) {
  if (today < start) return { state: 'future', days: Math.round((Date.parse(start) - Date.parse(today)) / 864e5) };
  return { state: today > end ? 'past' : 'now', days: 0 };
}

/** Finder state kept in the address so a result can be sent to someone:
 *  "#finder?score=95&pair=mi" for the ENT, "#finder?mode=tests&ielts=6.5&sat=1300" for IELTS and SAT. */
const STATE_KEYS = ['score', 'pair', 'code', 'mode', 'ielts', 'sat', 'where'];
export function parseState(hash) {
  const [tab, query = ''] = hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  return { tab, ...Object.fromEntries(STATE_KEYS.map((k) => [k, q.get(k) || ''])) };
}
export function buildHash({ tab, ...state }) {
  const q = new URLSearchParams(STATE_KEYS.filter((k) => state[k]).map((k) => [k, state[k]])).toString();
  return `#${tab}${q ? `?${q}` : ''}`;
}

/** Margin over a minimum; null when the score is empty or outside 0–top (140 for the ENT, 9 for IELTS, 1600 for SAT). */
export function fit(score, min, top = 140) {
  const n = score === '' || score == null ? NaN : Number(score);
  return Number.isFinite(n) && n >= 0 && n <= top ? n - min : null;
}

// ENT profile-subject pairs and the programme groups they open: [id, ru, kz, codes] (univision.kz).
// Medicine is listed there as B086–B089; university tables use the BM0xx codes for the same programmes.
export const PAIRS = [
  ['mi', 'Математика и информатика', 'Математика және информатика', 'B011 B057 B058 B158'],
  ['mf', 'Математика и физика', 'Математика және физика', 'B009 B010 B054 B055 B056 B059 B061 B062 B063 B064 B065 B066 B067 B069 B070 B071 B074 B076 B081 B082 B094 B097 B167 B183'],
  ['mg', 'Математика и география', 'Математика және география', 'B038 B044 B045 B046 B047 B048 B052 B075 B095 B145'],
  ['bc', 'Биология и химия', 'Биология және химия', 'B012 B013 B050 B053 B068 B072 B077 B078 B080 B083 B084 B085 B086 B087 B088 B089 BM086 BM088 BM089'],
  ['cf', 'Химия и физика', 'Химия және физика', 'B060'],
  ['bg', 'Биология и география', 'Биология және география', 'B001 B002 B003 B019 B020 B041 B051 B079 B090'],
  ['fh', 'Иностранный язык и всемирная история', 'Шет тілі және дүниежүзі тарихы', 'B018 B035 B036 B039 B040 B135 B140'],
  ['gf', 'География и иностранный язык', 'География және шет тілі', 'B091 B093'],
  ['hl', 'Всемирная история и основы права', 'Дүниежүзі тарихы және құқық негіздері', 'B049 B096'],
  ['hg', 'Всемирная история и география', 'Дүниежүзі тарихы және география', 'B008 B014 B015 B032 B034 B134'],
  ['kk', 'Казахский язык и литература', 'Қазақ тілі мен әдебиеті', 'B016'],
  ['rr', 'Русский язык и литература', 'Орыс тілі мен әдебиеті', 'B017'],
  ['kr', 'Казахский или русский язык и литература', 'Қазақ немесе орыс тілі мен әдебиеті', 'B037 B043'],
  ['cr', 'Творческий экзамен', 'Шығармашылық емтихан', 'B004 B005 B006 B007 B021 B022 B023 B024 B025 B026 B027 B028 B029 B030 B031 B033 B042 B073 B092'],
];

/** The pair of profile subjects a programme group needs, or undefined when the source lists none. */
export const pairOf = (code) => PAIRS.find((x) => x[3].split(' ').includes(code));

/** Grants and passing-score range across a university's listed programme groups; null without a table. */
export function summary(u) {
  if (!u.programs) return null;
  const scores = u.programs.map((x) => x[4]);
  return { grants: u.programs.reduce((n, x) => n + x[3], 0), min: Math.min(...scores), max: Math.max(...scores) };
}

/** Every programme row of every university, optionally one programme group or one subject pair.
 *  With a score: passing rows first (most grants first), then the nearest misses. Without: most grants first. */
export function finderRows(unis, { code, score, pair }) {
  const rows = unis.flatMap((u) => (u.programs || []).filter((p) => (!code || p[0] === code) && (!pair || pairOf(p[0])?.[0] === pair)).map((p) => ({ u, p, gap: fit(score, p[4]) })));
  return rows.sort((a, b) => {
    if (a.gap === null) return b.p[3] - a.p[3];
    if ((a.gap >= 0) !== (b.gap >= 0)) return a.gap >= 0 ? -1 : 1;
    return a.gap >= 0 ? b.p[3] - a.p[3] : b.gap - a.gap;
  });
}

// The year of the grant competition the passing scores come from.
// Checked on 16 November 2026: univision.kz still shows the 2025 tables, the 2026 results exist only as lists of winners.
export const SCORES_YEAR = 2025;

// IELTS and SAT minimums of foreign universities by name: { ielts, sat, ieltsNote, satNote }, from their own admission pages.
// A university that is not here publishes no minimum we could confirm.
const NOTE = {
  noBar: ['порог не публикуют', 'шегі жарияланбайды'],
  noTest: ['тест по английскому не обязателен', 'ағылшын тілі тесті міндетті емес'],
  satReq: ['SAT или ACT обязателен, порога нет', 'SAT немесе ACT міндетті, шегі жоқ'],
  satExtra: ['по желанию, порога нет', 'қалауыңызша, шегі жоқ'],
};
export const ABROAD_TESTS = {
  'Massachusetts Institute of Technology (MIT)': { ielts: 7, ieltsNote: ['рекомендуют 7.5; тест желателен, но не обязателен', 'ұсынылатыны 7.5; тест міндетті емес, бірақ қалаулы'], satNote: NOTE.satReq, url: 'https://mitadmissions.org/apply/firstyear/tests-scores/' },
  'Stanford University': { ieltsNote: NOTE.noTest, satNote: NOTE.satReq, url: 'https://admission.stanford.edu/apply/international/index.html' },
  'Harvard University': { ieltsNote: NOTE.noTest, satNote: NOTE.satReq, url: 'https://college.harvard.edu/admissions/apply/international-applicants' },
  'California Institute of Technology (Caltech)': { ielts: 7, ieltsNote: ['не ниже 7 в каждом разделе', 'әр бөлімнен кемінде 7'], satNote: NOTE.satReq, url: 'https://www.admissions.caltech.edu/apply/first-year-applicants/international-applicants' },
  'University of Pennsylvania': { ieltsNote: NOTE.noBar, satNote: NOTE.satReq, url: 'https://admissions.upenn.edu/how-to-apply/international-applicants/guidelines' },
  'Yale University': { ieltsNote: ['порога нет, у поступивших обычно от 7', 'шегі жоқ, түскендерде әдетте 7-ден'], satNote: NOTE.satReq, url: 'https://admissions.yale.edu/standardized-testing' },
  'Imperial College London': { ielts: 6.5, ieltsNote: ['разделы от 6.0; на части программ 7.0', 'бөлімдер 6.0-ден; кейбір бағдарламаларда 7.0'], sat: 1460, satNote: ['вместе с тремя AP на 5, 5 и 4', 'үш AP-мен бірге: 5, 5 және 4'], url: 'https://www.imperial.ac.uk/study/apply/english-language/' },
  'University of Oxford': { ielts: 7.5, ieltsNote: ['разделы от 7.0', 'бөлімдер 7.0-ден'], url: 'https://www.ox.ac.uk/admissions/undergraduate/applying-to-oxford/for-international-students/ELR' },
  'University of Cambridge': { ielts: 7.5, ieltsNote: ['разделы от 7.0; одного аттестата мало, нужны A-level, IB или AP', 'бөлімдер 7.0-ден; аттестат жеткіліксіз, A-level, IB немесе AP қажет'], url: 'https://www.undergraduate.study.cam.ac.uk/apply/before/entry-requirements' },
  'University College London (UCL)': { ielts: 6.5, ieltsNote: ['от 6.5 до 7.5 по программам', 'бағдарламаға қарай 6.5-тен 7.5-ке дейін'], url: 'https://www.ucl.ac.uk/study/current-students/academic-manual/chapters/chapter-1-student-recruitment-and-admissions/section-2-entrance-requirements' },
  'University of Edinburgh': { ieltsNote: ['зависит от программы; с обычным аттестатом нужен Foundation', 'бағдарламаға байланысты; кәдімгі аттестатпен Foundation қажет'], url: 'https://www.ed.ac.uk/studying/international/country/asia/central-west-asia/kazakhstan' },
  'King’s College London': { ielts: 6.5, ieltsNote: ['от 6.5 до 7.5 по программам; при 6.5 разделы от 6.0', 'бағдарламаға қарай 6.5-тен 7.5-ке дейін; 6.5 болса, бөлімдер 6.0-ден'], url: 'https://www.kcl.ac.uk/study/undergraduate/how-to-apply/english-language-requirements' },
  'University of Manchester': { ieltsNote: ['с обычным аттестатом нужен Foundation', 'кәдімгі аттестатпен Foundation қажет'], url: 'https://www.manchester.ac.uk/study/international/country-specific-information/kazakhstan/entry-requirements/' },
  'Peking University': { ieltsNote: ['учат на китайском, HSK 6', 'қытай тілінде оқытады, HSK 6'], sat: 1400, satNote: ['и три AP от 4: приём без экзаменов вуза', 'және үш AP 4-тен: ЖОО емтихандарынсыз қабылдау'], url: 'https://isd.pku.edu.cn/en/detail.php?id=816' },
  'Tsinghua University': { ieltsNote: ['IELTS или TOEFL нужен, порог не публикуют', 'IELTS немесе TOEFL қажет, шегі жарияланбайды'], satNote: NOTE.satExtra, url: 'https://international.join-tsinghua.edu.cn/Admission1/Eligibility.htm' },
  'Fudan University': { ielts: 6.5, ieltsNote: ['программы на английском, набор 2026 года', 'ағылшын тіліндегі бағдарламалар, 2026 жылғы қабылдау'], url: 'https://iso.fudan.edu.cn/_upload/article/files/bc/ed/37f712cb4e3f8316f4ec2ebc4ba2/6c9fce5d-d137-4934-b484-1c4630f18aa5.pdf' },
  'Shanghai Jiao Tong University': { ielts: 6, ieltsNote: ['программы на английском; не нужен при SAT EBRW от 650', 'ағылшын тіліндегі бағдарламалар; SAT EBRW 650-ден болса, қажет емес'], satNote: NOTE.satExtra, url: 'https://gc.sjtu.edu.cn/admission/international-undergraduate-admission/application-requirements/' },
  'Zhejiang University': { ielts: 6, ieltsNote: ['медицина и биоинженерия; Global Communication 6.5', 'медицина мен биоинженерия; Global Communication 6.5'], satNote: NOTE.satExtra, url: 'https://iczu.zju.edu.cn/_upload/article/files/e7/8c/1be7b2df433fb9427df707571d84/f8f1cb33-05a5-4fec-a602-3eac6caf8e14.pdf' },
  'Nanjing University': { ieltsNote: ['учат на китайском, HSK 5', 'қытай тілінде оқытады, HSK 5'], satNote: NOTE.satExtra, url: 'https://hwxy.nju.edu.cn/English/StudyatNJU/Admissions/BachelorsPrograms/index.html' },
  'Yonsei University': { ieltsNote: ['на английском только колледж UIC; порог не публикуют', 'ағылшын тілінде тек UIC колледжі; шегі жарияланбайды'], satNote: NOTE.satExtra, url: 'https://uic.yonsei.ac.kr/admission.php?mid=m04_02_02' },
  'Korea University': { ieltsNote: NOTE.noBar, satNote: NOTE.satExtra, url: 'https://oia.korea.ac.kr/_res/oia/etc/Application_Guide_for_Spring_2026_Freshman(ENG).pdf' },
  'LMU Munich': { ieltsNote: ['учат на немецком: DSH-2 или TestDaF 4×4', 'неміс тілінде оқытады: DSH-2 немесе TestDaF 4×4'], url: 'https://www.lmu.de/en/study/degree-students/prerequisites/german-proficiency/' },
  'Heidelberg University': { ieltsNote: ['учат на немецком: DSH-2', 'неміс тілінде оқытады: DSH-2'], url: 'https://www.uni-heidelberg.de/en/study/advisory-services/learning-languages/language-requirements-for-international-students' },
  'Freie Universität Berlin': { ielts: 7, ieltsNote: ['North American Studies, единственный бакалавриат на английском; Writing от 6.0', 'North American Studies, ағылшын тіліндегі жалғыз бакалавриат; Writing 6.0-ден'], url: 'https://www.sprachenzentrum.fu-berlin.de/en/sprachtests/sprachtests_fuer_Studienbewerber/englisch/index.html' },
  'RWTH Aachen University': { ieltsNote: ['бакалавриата на английском нет, нужен немецкий C1', 'ағылшын тілінде бакалавриат жоқ, неміс тілі C1 қажет'], url: 'https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/zugangsvoraussetzungen/zugangsvoraussetzung-fuer-den-bachelor-un/~drar/zugangsvoraussetzungen-fuer-internationa/?lidx=1' },
  'Karlsruhe Institute of Technology (KIT)': { ielts: 6.5, ieltsNote: ['Mechanical Engineering International; разделы от 5.5', 'Mechanical Engineering International; бөлімдер 5.5-тен'], sat: 1200, satNote: ['или ACT 24, или TestAS: вступительный тест этой программы', 'немесе ACT 24, немесе TestAS: осы бағдарламаның кіру тесті'], url: 'https://www.sle.kit.edu/english/vorstudium/bachelor-mechanical-engineering-international.php' },
  'Boğaziçi University': { ielts: 6.5, ieltsNote: ['освобождает от подготовительного года английского; Writing от 6.5', 'ағылшын тілінің дайындық жылынан босатады; Writing 6.5-тен'], sat: 1300, satNote: ['для большинства программ; у части программ свой порог', 'бағдарламалардың көбіне; кейбір бағдарламаларда өз шегі бар'], url: 'https://intl.bogazici.edu.tr/node/100023029' },
  'Bilkent University': { ielts: 6.5, ieltsNote: ['разделы от 5.5; или TOEFL iBT 87', 'бөлімдер 5.5-тен; немесе TOEFL iBT 87'], sat: 1000, satNote: ['это минимум, приёма он не гарантирует', 'бұл ең төменгі шек, қабылдауға кепілдік бермейді'], url: 'https://w3.bilkent.edu.tr/international/how-to-apply' },
  'Sabancı University': { sat: 1100, satNote: ['Superscore не принимают', 'Superscore қабылданбайды'], url: 'https://iro.sabanciuniv.edu/en/required-examdiploma-list' },
  'KAIST': { ielts: 6.5, ieltsNote: ['рекомендуемый балл; сам тест (IELTS, TOEFL и др.) обязателен; гид приёма 2027', 'ұсынылатын балл; тесттің өзі (IELTS, TOEFL т.б.) міндетті; 2027 қабылдау нұсқаулығы'], satNote: ['нужен один из SAT, AP или IB, порога нет', 'SAT, AP немесе IB-дің бірі қажет, шегі жоқ'], url: 'https://admission.kaist.ac.kr/intl-undergraduate/' },
  'POSTECH': { ieltsNote: NOTE.noBar, satNote: ['принимают, порог не публикуют', 'қабылдайды, шегі жарияланбайды'], url: 'https://adm-iu.postech.ac.kr/user/comm/board/7699dd106cb84b2e26748d3db5e78de6/index.do' },
  'МГУ им. М. В. Ломоносова': { ieltsNote: ['не нужен: учат на русском', 'қажет емес: орыс тілінде оқытады'], satNote: ['не нужен: ЕГЭ, экзамены вуза или отбор по квоте', 'қажет емес: БМЕ, ЖОО емтихандары немесе квота іріктеуі'], url: 'https://education-in-russia.com/' },
  'МГТУ им. Н. Э. Баумана': { ieltsNote: ['не нужен: учат на русском', 'қажет емес: орыс тілінде оқытады'], satNote: ['не нужен: ЕГЭ, экзамены вуза или отбор по квоте', 'қажет емес: БМЕ, ЖОО емтихандары немесе квота іріктеуі'], url: 'https://education-in-russia.com/' },
  'РУДН': { ieltsNote: ['не нужен: учат на русском', 'қажет емес: орыс тілінде оқытады'], satNote: ['не нужен: ЕГЭ, экзамены вуза или отбор по квоте', 'қажет емес: БМЕ, ЖОО емтихандары немесе квота іріктеуі'], url: 'https://education-in-russia.com/' },
  'СПбГУ': { ieltsNote: ['не нужен: учат на русском', 'қажет емес: орыс тілінде оқытады'], satNote: ['не нужен: ЕГЭ, экзамены вуза или отбор по квоте', 'қажет емес: БМЕ, ЖОО емтихандары немесе квота іріктеуі'], url: 'https://education-in-russia.com/' },
  'НИУ ВШЭ': { ieltsNote: ['не нужен: учат на русском', 'қажет емес: орыс тілінде оқытады'], satNote: ['не нужен: ЕГЭ, экзамены вуза или отбор по квоте', 'қажет емес: БМЕ, ЖОО емтихандары немесе квота іріктеуі'], url: 'https://education-in-russia.com/' },
  'Казанский федеральный университет': { ieltsNote: ['не нужен: учат на русском', 'қажет емес: орыс тілінде оқытады'], satNote: ['не нужен: ЕГЭ, экзамены вуза или отбор по квоте', 'қажет емес: БМЕ, ЖОО емтихандары немесе квота іріктеуі'], url: 'https://education-in-russia.com/' },
  'Новосибирский государственный университет': { ieltsNote: ['не нужен: учат на русском', 'қажет емес: орыс тілінде оқытады'], satNote: ['не нужен: ЕГЭ, экзамены вуза или отбор по квоте', 'қажет емес: БМЕ, ЖОО емтихандары немесе квота іріктеуі'], url: 'https://education-in-russia.com/' },
  'Middle East Technical University': { sat: 1200, satNote: ['Math от 700 для инженерных, архитектурных и естественно-научных программ; список вуза от января 2024 года', 'инженерлік, сәулет және жаратылыстану бағдарламаларына Math 700-ден; ЖОО тізімі 2024 жылғы қаңтардан'], url: 'https://iso.metu.edu.tr/en/system/files/odtu_iso_requirements.pdf' },
  'Koç University': { ieltsNote: ['в списке принимаемых тестов IELTS нет: нужен TOEFL iBT 80, Writing от 20', 'қабылданатын тесттер тізімінде IELTS жоқ: TOEFL iBT 80, Writing 20-дан қажет'], sat: 1200, satNote: ['от 1200 до 1450 по факультетам: инженерный 1300, право 1420, медицина 1450; страница набора 2024 года', 'факультетке қарай 1200-ден 1450-ге дейін: инженерлік 1300, құқық 1420, медицина 1450; 2024 жылғы қабылдау беті'], url: 'https://international.ku.edu.tr/?p=3948' },
  'Seoul National University': { ielts: 6, ieltsNote: ['или TOEFL iBT 80; из FAQ вуза, обновлён в 2021 году', 'немесе TOEFL iBT 80; ЖОО FAQ-ынан, 2021 жылы жаңартылған'], url: 'https://en-cdn.snu.ac.kr/admission/overview/faq/admission' },
  'Technical University of Munich (TUM)': { ieltsNote: ['на шести программах, включая Aerospace, сертификат английского не нужен: язык проверяют на отборе', 'алты бағдарламада, соның ішінде Aerospace, ағылшын тілі сертификаты қажет емес: тіл іріктеуде тексеріледі'], url: 'https://www.tum.de/en/studies/application/application-info-portal/admission-requirements/language-certificates' },
  'Brno University of Technology': { ieltsNote: ['программа Entrepreneurship: устный вступительный экзамен на английском, балл IELTS не указан', 'Entrepreneurship бағдарламасы: ағылшын тілінде ауызша кіру емтиханы, IELTS балы көрсетілмеген'], url: 'https://www.vut.cz/en/board/internal-legislation-fbm/-d305666/rules-of-admissions-and-conditions-for-admission-to-study-in-bachelor-and-master-programmes-taught-in-english-for-the-academick-year-2026-2027-p317353' },
  'Charles University': { ielts: 6.5, ieltsNote: ['факультет математики и физики; на других факультетах свои условия', 'математика және физика факультеті; басқа факультеттерде өз шарттары'], sat: 1250, satNote: ['тот же факультет; Math от 720', 'сол факультет; Math 720-дан'], url: 'https://www.mff.cuni.cz/en/admissions/admission-requirements-for-bachelor-s-programmes-in-english/2026-2027' },
  'Czech Technical University in Prague': { ielts: 5.5, ieltsNote: ['факультет информационных технологий; на других факультетах свои условия', 'ақпараттық технологиялар факультеті; басқа факультеттерде өз шарттары'], url: 'https://fit.cvut.cz/en/applicants/admissions-procedure' },
  'Masaryk University': { ielts: 6.5, ieltsNote: ['факультет экономики; разделы от 6.0', 'экономика факультеті; бөлімдер 6.0-ден'], url: 'https://www.econ.muni.cz/en/admissions/bachelor-studies/application-requirements' },
  'Eötvös Loránd University (ELTE)': { ielts: 6, ieltsNote: ['программа International Business Economics; на других свои условия', 'International Business Economics бағдарламасы; басқаларында өз шарттары'], url: 'https://apply.elte.hu/courses/course/311-ba-international-business-economics' },
  'University of Debrecen': { ieltsNote: ['нужен сертификат уровня B2, балл IELTS не указан', 'B2 деңгейіндегі сертификат қажет, IELTS балы көрсетілмеген'], url: 'https://edu.unideb.hu/p/application-procedure' },
  'University of Szeged': { ieltsNote: ['Business Administration: нужен экзамен уровня B2', 'Business Administration: B2 деңгейіндегі емтихан қажет'], url: 'https://apply.u-szeged.hu/en_GB/courses/course/230-bsc-business-administration-and-management' },
};

/** Everyone who publishes an IELTS or SAT minimum, Kazakh and foreign, as one list for the finder. */
export function testList() {
  const n = (v) => (v && /^\d+(\.\d+)?$/.test(v[0]) ? Number(v[0]) : null);
  const home = UNIVERSITIES.map((u, k) => ({
    name: u.name, place: u.city, href: `#u${k}`, abroad: false,
    ielts: n(u.ielts), sat: n(u.sat), ieltsNote: u.ielts && u.ielts.slice(1), satNote: u.sat && u.sat.slice(1),
  }));
  const away = ABROAD.flatMap((c) => c.unis.map((u) => ({
    name: u[0], place: [`${c.name[0]}, ${u[1]}`, `${c.name[1]}, ${u[2]}`], href: `#abroad-${c.id}`, abroad: true,
    ielts: null, sat: null, ieltsNote: null, satNote: null, ...ABROAD_TESTS[u[0]],
  })));
  return [...home, ...away].filter((x) => x.ielts !== null || x.sat !== null);
}

/** Rows for the IELTS/SAT finder. A place is compared only on the tests both sides have a number for.
 *  With a score typed: places where it is enough first (the most demanding first), then the nearest misses.
 *  Nothing typed: the whole list, lowest IELTS minimum first. */
export function testRows(list, { ielts, sat, where }) {
  const typed = fit(ielts, 0, 9) !== null || fit(sat, 0, 1600) !== null;
  const rows = list.filter((x) => !where || (where === 'abroad') === x.abroad).map((x) => {
    const gi = x.ielts === null ? null : fit(ielts, x.ielts, 9), gs = x.sat === null ? null : fit(sat, x.sat, 1600);
    // How far below the bar: a half band of IELTS and ten SAT points count as one step each.
    const short = Math.max(0, -(gi ?? 0)) * 2 + Math.max(0, -(gs ?? 0)) / 10;
    return { x, gi, gs, short, state: gi === null && gs === null ? null : short ? 'fail' : 'pass' };
  });
  if (!typed) return rows.sort((a, b) => (a.x.ielts ?? 99) - (b.x.ielts ?? 99) || (a.x.sat ?? 9999) - (b.x.sat ?? 9999));
  return rows.filter((r) => r.state).sort((a, b) => a.short - b.short || (b.x.ielts ?? -1) - (a.x.ielts ?? -1) || (b.x.sat ?? -1) - (a.x.sat ?? -1));
}

// ---------- Freshness ----------
// What period each block of data covers, when it was last checked against its sources, and the sources themselves.
export const FRESH = [
  {
    id: 'req', checked: '2026-11-15',
    name: ['Требования вузов Казахстана', 'Қазақстан ЖОО-ларының талаптары'],
    period: ['приём 2026/27, источник указан в карточке вуза', '2026/27 қабылдау, дереккөз ЖОО карточкасында көрсетілген'],
    urls: [],
  },
  {
    id: 'fees', checked: '2026-11-17',
    name: ['Стоимость обучения в вузах Казахстана', 'Қазақстан ЖОО-ларындағы оқу ақысы'],
    period: ['2026/27, где вуз ещё не опубликовал цену, указан прошлый год; часть цифр из обзоров СМИ', '2026/27, ЖОО бағаны әлі жарияламаса, өткен жыл көрсетілген; кейбір сандар БАҚ шолуларынан'],
    urls: ['https://bes.media/news/skolko-stoit-obuchenie-v-natsionalnyh-vuzah-kazahstana/', 'https://kz.kursiv.media/kk/2026-07-13/almatydaghy-universitetter-2026-2027-zhylgha-oqu-aqysyn-zhariyalady/', 'https://bes.media/news/skolko-stoit-vysshee-obrazovanie-v-kazahstane/', 'https://univision.kz/univ/85-mezhdunarodnyy-universitet-informatsionnyh-tehnologiy/price'],
  },
  {
    id: 'scores', checked: '2026-11-17',
    name: ['Гранты и проходные баллы', 'Гранттар мен өту балдары'],
    period: [`конкурс ${SCORES_YEAR} года, таблиц за 2026 год на univision ещё нет`, `${SCORES_YEAR} жылғы конкурс, 2026 жылғы кестелер univision-да әлі жоқ`],
    urls: ['https://univision.kz/'],
  },
  {
    id: 'order', checked: '2026-11-15',
    name: ['Госзаказ, пороги ЕНТ и квоты', 'Мемлекеттік тапсырыс, ҰБТ шектері және квоталар'],
    period: ['2026/27 учебный год', '2026/27 оқу жылы'],
    urls: ['https://rntb.kz/ru/obem-gosudarstvennogo-obrazovatelnogo-zakaza-na-2026-2027-uchebnyj-god/', 'https://np.kz/news/obshhestvo/obrazovanie/schastlivchiki-i-otverzhennye', 'https://bes.media/news/zavershilas-registratsiya-na-osnovnoe-ent-2026-ebcafe/'],
  },
  {
    id: 'calendar', checked: '2026-11-16',
    name: ['Календарь ЕНТ и подачи на грант', 'ҰБТ және грантқа өтініш күнтізбесі'],
    period: ['2027 год, регистрация и подача по датам 2026 года', '2027 жыл, тіркелу мен өтініш 2026 жылғы күндер бойынша'],
    urls: ['https://edutest.kz/', 'https://www.zakon.kz/obshestvo/6514002-osnovnoe-ent-po-itogam-kotorogo-mozhno-podat-na-grant-vse-chto-vazhno-znat.html', 'https://www.invisionu.education/blog-ru/granty-na-obuchenie-v-2026-2027-v-kazahstane'],
  },
  {
    id: 'abroad', checked: '2026-11-16',
    name: ['Учёба за рубежом: стипендии и расходы', 'Шетелде оқу: стипендиялар мен шығын'],
    period: ['наборы 2026/27 и 2027 года', '2026/27 және 2027 жылғы қабылдаулар'],
    urls: ['https://bolashak.gov.kz/en/acceptance-documents', 'https://inbusiness.kz/ru/news/kazahstan-voshel-v-mirovuyu-desyatku-po-eksportu-studentov', 'https://el.kz/ru/kuda-postupat-za-granitsey-v-2026-strany-tseny-i-riski_400046459/'],
  },
  {
    id: 'qs', checked: '2026-11-16',
    name: ['Рейтинг зарубежных вузов', 'Шетел ЖОО-ларының рейтингі'],
    period: ['QS World University Rankings 2027, вышел в июне 2026 года', 'QS World University Rankings 2027, 2026 жылғы маусымда шықты'],
    urls: ['https://www.topuniversities.com/world-university-rankings'],
  },
  {
    id: 'tests', checked: '2026-11-16',
    name: ['IELTS и SAT в зарубежных вузах', 'Шетел ЖОО-ларындағы IELTS және SAT'],
    period: ['приём 2026 и 2027 годов, с сайтов самих вузов; если страница вуза старше, год указан в примечании', '2026 және 2027 жылғы қабылдау, ЖОО-лардың өз сайттарынан; ЖОО беті ескірек болса, жылы ескертпеде көрсетілген'],
    urls: [],
  },
  {
    id: 'programs', checked: '2026-11-15',
    name: ['Конкурсы для IT-проектов', 'IT-жобаларға арналған байқаулар'],
    period: ['наборы 2026 года', '2026 жылғы қабылдаулар'],
    urls: ['https://astanahub.com/'],
  },
];

/** How old a check is: fresh for 90 days, then "aging", after 180 days "stale". */
export function freshness(checked, today) {
  const days = Math.round((Date.parse(today) - Date.parse(checked)) / 864e5);
  return { days, state: days > 180 ? 'stale' : days > 90 ? 'aging' : 'fresh' };
}

// State order 2026/27 as announced by the ministry: [ru, kz, grants].
export const DIRECTIONS = [
  ['Инженерия, производство и строительство', 'Инженерия, өндіріс және құрылыс', 19250],
  ['Педагогические науки', 'Педагогикалық ғылымдар', 13738],
  ['Информационно-коммуникационные технологии', 'Ақпараттық-коммуникациялық технологиялар', 11662],
  ['Естественные науки и математика', 'Жаратылыстану ғылымдары және математика', 9363],
  ['Сельское хозяйство', 'Ауыл шаруашылығы', 3145],
  ['Здравоохранение', 'Денсаулық сақтау', 2700],
];

// Minimum ENT score to enter the grant competition, 2026: [ru, kz, score].
export const THRESHOLDS = [
  ['Педагогика и право', 'Педагогика және құқық', 75],
  ['Здравоохранение', 'Денсаулық сақтау', 70],
  ['Национальные вузы', 'Ұлттық жоғары оқу орындары', 65],
  ['Остальные вузы', 'Қалған жоғары оқу орындары', 50],
  ['Сельское хозяйство и ветеринария', 'Ауыл шаруашылығы және ветеринария', 50],
];

// Grants set aside by quota in 2026/27: [value, ru, kz] (np.kz).
export const QUOTAS = [
  ['2 180', 'по программе «Серпін»', '«Серпін» бағдарламасы бойынша'],
  ['2 500', 'молодёжи западных регионов', 'батыс өңірлердің жастарына'],
  ['3 190', 'в филиалах зарубежных вузов', 'шетелдік ЖОО филиалдарында'],
  ['1 816', 'отслужившим срочную службу', 'мерзімді әскери қызмет өткергендерге'],
  ['2 392', 'гранты акиматов', 'әкімдіктердің гранттары'],
];

// How the ENT works: [value, ru, kz].
export const ENT_FACTS = [
  ['120', 'заданий', 'тапсырма'],
  ['4 ч', 'на весь тест', 'бүкіл тестке (4 сағат)'],
  ['140', 'максимум баллов', 'ең жоғары балл'],
  ['3 + 2', 'обязательных и профильных предмета', 'міндетті және бейіндік пән'],
  ['66', 'средний балл 2026 года', '2026 жылғы орташа балл'],
];

// ---------- UI (browser only) ----------

export const T = {
  ru: {
    locale: 'ru', i: 0,
    tabHome: 'Главная', tabPrograms: 'Календарь', tabUnis: 'Вузы', tabFinder: 'Подбор по баллу', tabGrants: 'ЕНТ и гранты', tabAbroad: 'За рубежом',
    h1: 'Куда поступить и куда подать проект в Казахстане',
    lead: 'Вузы, гранты и IT-конкурсы в одном месте.',
    scoreLabel: 'Мой балл ЕНТ', scoreGo: 'Показать, куда хватит', scoreHint: 'от 0 до 140',
    tileProgramsD: 'Даты ЕНТ, подачи на грант и конкурсы', tileUnisD: 'Требования IELTS, SAT и ЕНТ, фото, гранты',
    tileFinderD: 'ЕНТ, IELTS и SAT: куда хватит вашего балла', tileGrantsD: 'Сколько грантов и какие пороги',
    statGrants: 'грантов на бакалавриат в 2026/27', statUnis: 'вузов с требованиями', statPrograms: 'конкурсов для проектов', statRows: 'специальностей с проходными',
    tileAbroadD: 'Страны, стипендии, язык и расходы',
    hAbroad: 'Учёба за рубежом',
    pAbroad: 'Куда чаще всего уезжают казахстанцы и как там учиться бесплатно. Условия меняются каждый год, перед подачей сверяйтесь с источником.',
    ways: { grant: 'есть стипендия', free: 'бесплатно на языке страны', paid: 'платно' },
    aFree: 'Бесплатно', aNeed: 'Что нужно', aCost: 'Расходы', aWhen: 'Когда',
    aUnis: (n) => `Университеты: ${n}`, aBack: 'Все страны', hUnisOf: 'Университеты', thRank: 'Место в QS 2027',
    rankNote: 'Вузы страны с самыми высокими местами в мировом рейтинге QS World University Rankings 2027. Стипендии и квоты к этому списку не привязаны: условия приёма смотрите на сайте вуза и программы.',
    aFactsSrc: 'Число студентов: ЮНЕСКО и слова министра науки и высшего образования, июнь 2024 года.',
    hOther: 'Ещё межправительственные гранты 2026/27',
    otherNote: 'Конкурс проводит Центр международных программ. После учёбы по такому гранту, включая китайский и венгерский, нужно вернуться и год отработать в Казахстане.',
    hBolashak: '«Болашак» для выпускников школ',
    pBolashak: 'В программе снова есть бакалавриат: в 2026 году выделили 20 стипендий для победителей и призёров международных олимпиад и конкурсов научных проектов. Документы принимали с 16 марта по 16 октября через eGov.',
    hCalendar: 'Календарь абитуриента 2027',
    pCalendar: 'Сроки ЕНТ по действующему расписанию. Точные даты на 2027 год объявит Национальный центр тестирования.',
    calNow: 'идёт сейчас', calPast: 'прошло', calIn: (d) => `через ${d}`, approx: 'по датам 2026 года',
    kinds: { grant: 'для гранта', paid: 'для платного', abroad: 'за рубеж' },
    mineLabel: 'Только мой список', saveRow: 'В мой список', mineEmpty: 'В списке пусто. Отметьте строки звёздочкой.',
    copyLink: 'Скопировать ссылку на этот подбор', copied: 'Ссылка скопирована', copyFail: 'Скопируйте ссылку из адресной строки',
    hPrograms: 'Конкурсы для IT-проектов', pPrograms: 'Наборы 2026 года в основном закрыты, следующие ждём зимой и весной.',
    typeLabel: 'Тип', any: 'Все', competition: 'Конкурс', incubator: 'Инкубатор', accelerator: 'Акселератор', grant: 'Грант',
    stageLabel: 'Моя стадия', stageAny: 'Любая', idea: 'Только идея', mvp: 'Есть MVP', growth: 'Есть выручка',
    needs: { idea: 'можно с идеей', mvp: 'нужен MVP', growth: 'нужна выручка' },
    prize: 'С призовым фондом', open: 'Только открытый приём', search: 'Поиск',
    today: 'последний день', closed: 'приём закрыт', unknown: 'срок не объявлен', left: 'осталось', until: 'до',
    cal: 'В календарь', more: 'Условия', found: 'Найдено',
    empty: 'Под эти фильтры ничего не подходит. Снимите один из них.',
    days: (n) => `${n} ${{ one: 'день', few: 'дня', many: 'дней' }[new Intl.PluralRules('ru').select(n)] || 'дня'}`,
    hUnis: 'Вузы', pUnis: 'Минимальные требования для бакалавриата.', cityAll: 'Все города',
    ent: 'ЕНТ', noData: 'нет данных', details: 'Подробнее',
    thCode: 'Код', thProgram: 'Специальность', thGrants: 'Грантов', thMin: 'Проходной',
    tableCap: (y) => `Общий конкурс ${y} года`, source: 'Источник', photoBy: 'Фото',
    grantsDetails: (n) => `Гранты по специальностям: ${n}`,
    hFinder: 'Куда хватит баллов', pFinder: (y) => `Сравниваем с проходными на грант ${y} года. В следующем наборе они могут измениться.`,
    modeEnt: 'По ЕНТ', modeTests: 'По IELTS и SAT',
    pTests: 'Введите IELTS и SAT: покажем вузы Казахстана и зарубежья, где такого балла хватает. Порог у вуза общий, на отдельных программах он выше.',
    ieltsLabel: 'Мой IELTS', satLabel: 'Мой SAT', whereLabel: 'Где учиться', whereAny: 'Везде', whereKz: 'В Казахстане', whereAbroad: 'За рубежом',
    enough: 'хватает',
    hCompareC: 'Сравнение стран', cmpWay: 'Как учиться', cmpStudents: 'Казахстанцев учится', cmpTop: 'Лучший вуз в QS 2027', cmpIelts: 'IELTS в вузах списка',
    testsNote: 'IELTS и SAT: общий минимум для бакалавриата с сайта вуза, на отдельных программах он выше.',
    hData: 'Актуальность данных',
    pData: 'К какому периоду относится каждая цифра и когда её сверяли с источником. Если с проверки прошло больше 90 дней, строка помечается.',
    checkedOn: (d) => `проверено ${d}`, freshState: { fresh: 'проверено недавно', aging: 'пора перепроверить', stale: 'могло устареть' },
    freshMore: 'Все данные и источники', dataReport: 'Нашли расхождение с источником?',
    specLabel: 'Специальность', specAny: 'Все специальности', pairLabel: 'Профильные предметы', pairAny: 'Любые',
    fee: 'Платно', compare: 'Сравнить', hCompare: 'Сравнение вузов', cmpClear: 'Очистить', cmpMax: 'Сравнить можно не больше трёх.',
    cmpPicked: (n) => `Выбрано ${n} из 3`, cmpShow: 'Показать сравнение',
    cityLabel: 'Город', cmpGrants: (y) => `Грантов в таблице, ${y}`, cmpRange: (y) => `Проходные, ${y}`,
    hQuotas: 'Квоты', quotasNote: 'Победители международных олимпиад и крупных спортивных соревнований получают грант вне конкурса.',
    report: 'Сообщить об ошибке', updated: (d) => `Обновлено ${d}`, thUni: 'Вуз', thYou: 'Ваш результат', enterScore: 'введите балл',
    pass: (n) => (n ? `проходите, запас ${n}` : 'проходите впритык'), fail: (n) => `не хватает ${n}`,
    showAll: (n) => `Показать все строки: ${n}`, showLess: 'Свернуть',
    hGrants: 'ЕНТ и гранты 2026/27',
    gTotal: 'грантов всего', gBach: 'бакалавриат', gMaster: 'магистратура', gPhd: 'докторантура',
    hDirections: 'Гранты по направлениям', directionsNote: 'Госзаказ, объявленный министерством. В итоговом распределении часть цифр ниже.',
    hThresholds: 'Порог ЕНТ для конкурса грантов', thresholdsNote: 'Порог только допускает к конкурсу. Реальные проходные 2026 года: 110–130 на право и международные отношения, 90–100 на инженерию и IT.',
    hEnt: 'Как устроен ЕНТ',
    foot: 'Данные из открытых источников. Перед подачей проверяйте условия на сайте вуза или организатора.',
  },
  kz: {
    locale: 'kk', i: 1,
    tabHome: 'Басты бет', tabPrograms: 'Күнтізбе', tabUnis: 'ЖОО', tabFinder: 'Балл бойынша таңдау', tabGrants: 'ҰБТ және гранттар', tabAbroad: 'Шетелде',
    h1: 'Қазақстанда қайда түсуге және жобаны қайда тапсыруға болады',
    lead: 'ЖОО, гранттар және IT-байқаулар бір жерде.',
    scoreLabel: 'Менің ҰБТ балым', scoreGo: 'Қайда жететінін көрсету', scoreHint: '0-ден 140-қа дейін',
    tileProgramsD: 'ҰБТ, грантқа өтініш және байқау мерзімдері', tileUnisD: 'IELTS, SAT және ҰБТ талаптары, фото, гранттар',
    tileFinderD: 'ҰБТ, IELTS және SAT: балыңыз қайда жетеді', tileGrantsD: 'Грант саны мен шекті балдар',
    statGrants: '2026/27 бакалавриат гранты', statUnis: 'талаптары бар ЖОО', statPrograms: 'байқау мен бағдарлама', statRows: 'өту балы бар мамандық',
    tileAbroadD: 'Елдер, стипендиялар, тіл және шығын',
    hAbroad: 'Шетелде оқу',
    pAbroad: 'Қазақстандықтар қайда жиі кетеді және онда қалай тегін оқуға болады. Шарттар жыл сайын өзгереді, тапсырар алдында дереккөзден тексеріңіз.',
    ways: { grant: 'стипендия бар', free: 'ел тілінде тегін', paid: 'ақылы' },
    aFree: 'Тегін', aNeed: 'Не қажет', aCost: 'Шығын', aWhen: 'Қашан',
    aUnis: (n) => `Университеттер: ${n}`, aBack: 'Барлық ел', hUnisOf: 'Университеттер', thRank: 'QS 2027 орны',
    rankNote: 'QS World University Rankings 2027 әлемдік рейтингінде елдің ең жоғары орын алған ЖОО-лары. Стипендиялар мен квоталар бұл тізімге байланбаған: қабылдау шарттарын ЖОО мен бағдарлама сайтынан қараңыз.',
    aFactsSrc: 'Студенттер саны: ЮНЕСКО және ғылым және жоғары білім министрінің сөзі, 2024 жылғы маусым.',
    hOther: 'Тағы да үкіметаралық гранттар 2026/27',
    otherNote: 'Конкурсты Халықаралық бағдарламалар орталығы өткізеді. Мұндай грантпен, соның ішінде Қытай мен Венгрия грантымен оқығаннан кейін елге оралып, Қазақстанда бір жыл жұмыс істеу қажет.',
    hBolashak: 'Мектеп түлектеріне арналған «Болашақ»',
    pBolashak: 'Бағдарламада қайтадан бакалавриат бар: 2026 жылы халықаралық олимпиадалар мен ғылыми жобалар байқауларының жеңімпаздары мен жүлдегерлеріне 20 стипендия бөлінді. Құжаттар 16 наурыз – 16 қазан аралығында eGov арқылы қабылданды.',
    hCalendar: 'Талапкер күнтізбесі 2027',
    pCalendar: 'ҰБТ мерзімдері қолданыстағы кесте бойынша. 2027 жылғы нақты күндерді Ұлттық тестілеу орталығы жариялайды.',
    calNow: 'қазір өтіп жатыр', calPast: 'өтті', calIn: (d) => `${d} кейін`, approx: '2026 жылғы күндер бойынша',
    kinds: { grant: 'грант үшін', paid: 'ақылы бөлім үшін', abroad: 'шетел' },
    mineLabel: 'Тек менің тізімім', saveRow: 'Тізіміме қосу', mineEmpty: 'Тізім бос. Жолдарды жұлдызшамен белгілеңіз.',
    copyLink: 'Осы таңдаудың сілтемесін көшіру', copied: 'Сілтеме көшірілді', copyFail: 'Сілтемені мекенжай жолынан көшіріңіз',
    hPrograms: 'IT-жобаларға арналған байқаулар', pPrograms: '2026 жылғы қабылдаулардың көбі жабылды, келесілері қыста және көктемде.',
    typeLabel: 'Түрі', any: 'Барлығы', competition: 'Байқау', incubator: 'Инкубатор', accelerator: 'Акселератор', grant: 'Грант',
    stageLabel: 'Менің кезеңім', stageAny: 'Кез келген', idea: 'Тек идея', mvp: 'MVP бар', growth: 'Табыс бар',
    needs: { idea: 'идеямен болады', mvp: 'MVP қажет', growth: 'табыс қажет' },
    prize: 'Жүлде қоры бар', open: 'Тек ашық қабылдау', search: 'Іздеу',
    today: 'соңғы күн', closed: 'қабылдау жабылды', unknown: 'мерзімі жарияланбаған', left: 'қалды', until: 'дейін',
    cal: 'Күнтізбеге', more: 'Шарттары', found: 'Табылды',
    empty: 'Бұл сүзгілерге ештеңе сәйкес келмейді. Біреуін алып тастаңыз.',
    days: (n) => `${n} күн`,
    hUnis: 'ЖОО', pUnis: 'Бакалавриатқа қойылатын ең төменгі талаптар.', cityAll: 'Барлық қала',
    ent: 'ҰБТ', noData: 'дерек жоқ', details: 'Толығырақ',
    thCode: 'Код', thProgram: 'Мамандық', thGrants: 'Грант саны', thMin: 'Өту балы',
    tableCap: (y) => `${y} жылғы жалпы конкурс`, source: 'Дереккөз', photoBy: 'Фото',
    grantsDetails: (n) => `Мамандықтар бойынша гранттар: ${n}`,
    hFinder: 'Балым қайда жетеді', pFinder: (y) => `${y} жылғы грантқа өту балдарымен салыстырамыз. Келесі қабылдауда олар өзгеруі мүмкін.`,
    modeEnt: 'ҰБТ бойынша', modeTests: 'IELTS және SAT бойынша',
    pTests: 'IELTS пен SAT балыңызды енгізіңіз: осы балл жететін Қазақстан мен шетел ЖОО-ларын көрсетеміз. Бұл ЖОО-ның жалпы шегі, жекелеген бағдарламаларда ол жоғары.',
    ieltsLabel: 'Менің IELTS балым', satLabel: 'Менің SAT балым', whereLabel: 'Қайда оқу', whereAny: 'Барлық жерде', whereKz: 'Қазақстанда', whereAbroad: 'Шетелде',
    enough: 'жетеді',
    hCompareC: 'Елдерді салыстыру', cmpWay: 'Қалай оқуға болады', cmpStudents: 'Оқитын қазақстандықтар', cmpTop: 'QS 2027 бойынша үздік ЖОО', cmpIelts: 'Тізімдегі ЖОО-лардағы IELTS',
    testsNote: 'IELTS және SAT: ЖОО сайтындағы бакалавриаттың жалпы ең төменгі шегі, жекелеген бағдарламаларда ол жоғары.',
    hData: 'Деректердің өзектілігі',
    pData: 'Әр дерек қай кезеңге жатады және дереккөзбен қашан салыстырылды. Тексерілгеннен бері 90 күннен асса, жол белгіленеді.',
    checkedOn: (d) => `тексерілген күні: ${d}`, freshState: { fresh: 'жақында тексерілді', aging: 'қайта тексеру керек', stale: 'ескірген болуы мүмкін' },
    freshMore: 'Барлық дерек пен дереккөздер', dataReport: 'Дереккөзден айырмашылық таптыңыз ба?',
    specLabel: 'Мамандық', specAny: 'Барлық мамандықтар', pairLabel: 'Бейіндік пәндер', pairAny: 'Кез келген',
    fee: 'Ақылы', compare: 'Салыстыру', hCompare: 'ЖОО-ларды салыстыру', cmpClear: 'Тазарту', cmpMax: 'Үшеуден артық салыстыруға болмайды.',
    cmpPicked: (n) => `3-тен ${n} таңдалды`, cmpShow: 'Салыстыруды көрсету',
    cityLabel: 'Қала', cmpGrants: (y) => `Кестедегі грант саны, ${y}`, cmpRange: (y) => `Өту балдары, ${y}`,
    hQuotas: 'Квоталар', quotasNote: 'Халықаралық олимпиадалар мен ірі спорт жарыстарының жеңімпаздары грантты конкурстан тыс алады.',
    report: 'Қате туралы хабарлау', updated: (d) => `Жаңартылған күні: ${d}.`, thUni: 'ЖОО', thYou: 'Сіздің нәтижеңіз', enterScore: 'балды енгізіңіз',
    pass: (n) => (n ? `өтесіз, артық ${n} балл` : 'дәл өтесіз'), fail: (n) => `${n} балл жетпейді`,
    showAll: (n) => `Барлық жолды көрсету: ${n}`, showLess: 'Жию',
    hGrants: 'ҰБТ және гранттар 2026/27',
    gTotal: 'барлық грант', gBach: 'бакалавриат', gMaster: 'магистратура', gPhd: 'докторантура',
    hDirections: 'Бағыттар бойынша гранттар', directionsNote: 'Министрлік жариялаған мемлекеттік тапсырыс. Қорытынды бөлуде кейбір сандар төмен.',
    hThresholds: 'Грант конкурсына қажет ҰБТ шекті балы', thresholdsNote: 'Шекті балл тек конкурсқа жібереді. 2026 жылғы нақты өту балдары: құқық пен халықаралық қатынастарға 110–130, инженерия мен IT-ге 90–100.',
    hEnt: 'ҰБТ қалай өтеді',
    foot: 'Деректер ашық дереккөздерден алынған. Тапсырар алдында шарттарды ЖОО-ның немесе ұйымдастырушының сайтынан тексеріңіз.',
  },
};

if (typeof document !== 'undefined') {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const store = {
    get: () => { try { return localStorage.getItem('mumkindik-lang'); } catch { return null; } },
    set: (v) => { try { localStorage.setItem('mumkindik-lang', v); } catch { /* private mode */ } },
  };
  let lang = store.get() === 'kz' ? 'kz' : 'ru';
  const now = new Date();
  const today = new Date(now - now.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); // local date
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (n) => n.toLocaleString('ru');
  const uid = (u) => `u${UNIVERSITIES.indexOf(u)}`;
  const commons = 'https://commons.wikimedia.org/wiki/';
  const allRows = UNIVERSITIES.reduce((n, u) => n + (u.programs || []).length, 0);
  const host = (u) => new URL(u).hostname.replace('www.', '');
  // Numbers, ranges and their currency sign stay on one line.
  const glue = (x) => esc(x).replace(/(\d) (?=[\d$€£])/g, '$1\u00a0').replace(/(\d)–(?=\d)/g, '$1–\u2060');

  // ----- programmes -----
  function programCard(p) {
    const t = T[lang], s = status(p.deadline, today);
    const date = p.deadline && dateText(p.deadline, t.i, true);
    const state = s.state === 'open' ? (s.days === 0 ? t.today : `${t.left} ${t.days(s.days)}, ${t.until} ${date}`)
      : s.state === 'closed' ? `${t.closed} ${date}` : t.unknown;
    const cal = s.state === 'open'
      ? `<a download="${esc(p.name)}.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics(p))}">${t.cal}</a>` : '';
    return `<li class="card prog">
      <p class="chips"><span class="chip">${t[p.type]}</span><span class="chip">${t.needs[p.stage]}</span>${p.prize ? `<span class="chip money">${esc(p.prize)}</span>` : ''}</p>
      <h3>${esc(p.name)}</h3>
      <p class="org">${esc(p.org)}</p>
      <p class="desc">${esc(p[lang])}</p>
      <p class="foot"><span class="state ${s.state}">${state}</span><span class="links">${cal}<a href="${esc(p.url)}" target="_blank" rel="noopener">${t.more}</a></span></p>
    </li>`;
  }

  function renderPrograms() {
    const t = T[lang], f = $('#filters');
    const filter = { type: f.type.value, stage: f.stage.value, prize: f.prize.checked, open: f.open.checked, q: f.q.value };
    const list = sortPrograms(PROGRAMS.filter((p) => matches(p, filter, today)), today);
    $('#list').innerHTML = list.map(programCard).join('') || `<li class="empty">${t.empty}</li>`;
    $('#found').textContent = `${t.found}: ${list.length}`;
  }

  // ----- universities -----
  let city = '';
  // Comparison, shared by universities and countries: a table above the cards and a bar at the bottom of the screen.
  function compareBox(box, bar, title, heads, rows, full) {
    const t = T[lang];
    box.hidden = bar.hidden = !heads.length;
    box.innerHTML = `<div class="cmphead"><h3>${title}</h3><button type="button" class="ghost" data-clear>${t.cmpClear}</button></div>
      <table><thead><tr><th></th>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([k, vs]) => `<tr><th>${k}</th>${vs.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    // The table sits above the cards, so the bar says what is picked and leads to it.
    bar.innerHTML = `<span role="status">${full ? t.cmpMax : t.cmpPicked(heads.length)}</span><button type="button" class="btn" data-show>${t.cmpShow}</button>`;
  }
  // Tick up to three cards; a fourth tick is refused with a note.
  function comparing(grid, box, bar, attr, picked, render, redraw) {
    grid.addEventListener('change', (e) => {
      if (!e.target.matches(`[data-${attr}]`)) return;
      const key = e.target.dataset[attr], full = e.target.checked && picked.size >= 3;
      if (full) e.target.checked = false; else if (e.target.checked) picked.add(key); else picked.delete(key);
      render(full);
    });
    box.addEventListener('click', (e) => { if (e.target.matches('[data-clear]')) { picked.clear(); redraw(); } });
    bar.addEventListener('click', (e) => { if (e.target.matches('[data-show]')) box.scrollIntoView({ block: 'center' }); });
  }

  const picked = new Set(); // indexes of the universities chosen for comparison, kept as strings
  function renderCompare(full) {
    const t = T[lang], i = t.i, us = [...picked].map((n) => UNIVERSITIES[n]);
    const val = (v) => (v ? `<b>${esc(v[0])}</b> ${esc(v[1 + i])}` : t.noData);
    const sum = us.map(summary);
    compareBox($('#compare'), $('#cmpBar'), t.hCompare, us.map((u) => `<a href="#${uid(u)}">${esc(u.name)}</a>`), [
      [t.cityLabel, us.map((u) => esc(u.city[i]))],
      ['IELTS', us.map((u) => val(u.ielts))], ['SAT', us.map((u) => val(u.sat))], [t.ent, us.map((u) => val(u.ent))],
      [t.fee, us.map((u) => (u.fee ? esc(u.fee[i]) : t.noData))],
      [t.cmpGrants(SCORES_YEAR), sum.map((x) => (x ? `<b>${num(x.grants)}</b>` : t.noData))],
      [t.cmpRange(SCORES_YEAR), sum.map((x) => (x ? `${x.min}–${x.max}` : t.noData))],
    ], full);
  }
  function uni(u) {
    const t = T[lang], i = t.i;
    const req = (label, v) => `<div class="req${v ? '' : ' none'}"><dt>${label}</dt><dd><b>${v ? esc(v[0]) : '—'}</b><span>${v ? esc(v[1 + i]) : t.noData}</span></dd></div>`;
    // No photo, or the photo fails to load: the card simply starts with the name.
    const file = u.photo && encodeURIComponent(u.photo[0].replaceAll(' ', '_'));
    const pic = u.photo ? `<figure><img src="${commons}Special:FilePath/${file}?width=960" alt="${esc(u.name)}" loading="lazy" onerror="this.closest('figure').remove()">
      <figcaption><a href="${commons}File:${file}" target="_blank" rel="noopener">${t.photoBy}: ${esc(u.photo[1] || 'Wikimedia Commons')}${u.photo[1] ? ', Wikimedia Commons' : ''}</a></figcaption></figure>` : '';
    const table = u.programs ? `<details><summary>${t.grantsDetails(u.programs.length)}</summary><table>
      <caption>${t.tableCap(SCORES_YEAR)}${u.tableUrl ? `, <a href="${esc(u.tableUrl)}" target="_blank" rel="noopener">univision.kz</a>` : ''}</caption>
      <thead><tr><th>${t.thProgram}</th><th class="n">${t.thGrants}</th><th class="n">${t.thMin}</th></tr></thead>
      <tbody>${u.programs.map((p) => `<tr><td>${esc(p[1 + i])}</td><td class="n">${num(p[3])}</td><td class="n">${p[4]}</td></tr>`).join('')}</tbody>
    </table></details>` : '';
    const note = u.note ? `<details><summary>${t.details}</summary><p>${esc(u.note[i])}</p></details>` : '';
    return `<article class="card uni" id="${uid(u)}">
      ${pic}
      <div class="pad">
        <header><h3>${esc(u.name)}</h3><p>${esc(u.city[i])}</p></header>
        <dl>${req('IELTS', u.ielts)}${req('SAT', u.sat)}${req(t.ent, u.ent)}</dl>
        ${u.fee ? `<p class="fee">${t.fee}: <b>${esc(u.fee[i])}</b></p>` : ''}
        ${table}${note}
        <label class="check cmp"><input type="checkbox" data-cmp="${UNIVERSITIES.indexOf(u)}"${picked.has(String(UNIVERSITIES.indexOf(u))) ? ' checked' : ''}><span>${t.compare}</span></label>
        <p class="src"><a href="${esc(u.url)}" target="_blank" rel="noopener">${t.source}: ${esc(new URL(u.url).hostname.replace('www.', ''))}</a></p>
      </div>
    </article>`;
  }

  function renderUnis() {
    const t = T[lang], i = t.i;
    const cities = [...new Set(UNIVERSITIES.flatMap((u) => u.city[0].split(', ')))];
    const label = (c) => UNIVERSITIES.find((u) => u.city[0] === c)?.city[i] || c;
    $('#cities').innerHTML = ['', ...cities].map((c) =>
      `<button type="button" data-city="${esc(c)}" aria-pressed="${c === city}">${c ? esc(label(c)) : t.cityAll}</button>`).join('');
    // Universities with a photo first, so the grid starts with pictures.
    $('#uniGrid').innerHTML = UNIVERSITIES.filter((u) => !city || u.city[0].includes(city))
      .sort((a, b) => !!b.photo - !!a.photo).map(uni).join('');
    renderCompare();
  }

  // ----- freshness: the period the numbers cover and the date they were checked -----
  function fresh(el, ids) {
    const t = T[lang], i = t.i;
    el.innerHTML = ids.split(' ').map((id) => {
      const d = FRESH.find((x) => x.id === id), s = freshness(d.checked, today).state;
      return `<span class="f is-${s}">${esc(d.name[i])}: ${esc(d.period[i])}, ${t.checkedOn(dateText(d.checked, i, true))}${s === 'fresh' ? '' : `, ${t.freshState[s]}`}</span>`;
    }).join('') + `<a href="#data">${t.freshMore}</a>`;
  }
  function renderFresh() {
    const t = T[lang], i = t.i;
    $$('[data-fresh]').forEach((el) => fresh(el, el.dataset.fresh));
    $('#freshList').innerHTML = FRESH.map((d) => {
      const s = freshness(d.checked, today).state;
      return `<li class="ev">
        <div class="when"><b>${dateText(d.checked, i, true)}</b><span class="f is-${s}">${t.freshState[s]}</span></div>
        <div class="what"><h3>${esc(d.name[i])}</h3><p>${esc(d.period[i])}</p></div>
        <div class="links srcs">${d.urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join('')}</div>
      </li>`;
    }).join('');
    $('#updated').textContent = t.updated(dateText(FRESH.map((d) => d.checked).sort().pop(), i, true));
  }

  // ----- finder: an ENT score against passing scores, or IELTS and SAT against the universities' minimums -----
  let mode = 'ent';
  let showAllRows = false;
  let currentTab = 'home';
  // "My list": starred rows of both finders, kept in this browser only.
  const rowKey = ({ u, p }) => `${u.name}|${p[0]}`;
  const saved = new Set((() => { try { return JSON.parse(localStorage.getItem('mumkindik-list')) || []; } catch { return []; } })());
  const keepSaved = () => { try { localStorage.setItem('mumkindik-list', JSON.stringify([...saved])); } catch { /* private mode: the list lives until the tab closes */ } };
  const star = (key) => `<td class="n s"><button type="button" class="star" data-save="${esc(key)}" aria-pressed="${saved.has(key)}" aria-label="${T[lang].saveRow}" title="${T[lang].saveRow}">${saved.has(key) ? '★' : '☆'}</button></td>`;
  const tests = testList();
  // A minimum with its caveat under it: the IELTS/SAT finder and the country pages draw it the same way.
  const bar = (min, note, digits) => `<b>${min == null ? '—' : min.toFixed(digits)}</b>${note ? `<span class="pair">${esc(note[T[lang].i])}</span>` : ''}`;
  function renderFinder() {
    const t = T[lang], i = t.i, f = $('#finderForm'), g = $('#testsForm'), ent = mode === 'ent';
    f.hidden = $('#entTable').hidden = !ent;
    g.hidden = $('#testsTable').hidden = ent;
    $$('#finderMode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#finderSub').textContent = ent ? t.pFinder(SCORES_YEAR) : t.pTests;
    fresh($('#finderFresh'), ent ? 'scores' : 'req tests');
    // Rebuild the specialty list in the current language, keeping the choice.
    const codes = new Map(UNIVERSITIES.flatMap((u) => u.programs || []).map((p) => [p[0], p[1 + i]]));
    const chosen = f.code.value;
    f.code.innerHTML = `<option value="">${t.specAny}</option>` + [...codes].sort((a, b) => a[1].localeCompare(b[1], t.locale))
      .map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
    f.code.value = chosen;
    // Only pairs that open at least one listed programme group.
    const used = new Set(UNIVERSITIES.flatMap((u) => u.programs || []).map((p) => pairOf(p[0])?.[0]));
    const chosenPair = f.pair.value;
    f.pair.innerHTML = `<option value="">${t.pairAny}</option>` + PAIRS.filter((x) => used.has(x[0])).map((x) => `<option value="${x[0]}">${esc(x[1 + i])}</option>`).join('');
    f.pair.value = chosenPair;
    const limit = 12, cut = (rows) => rows.slice(0, showAllRows ? rows.length : limit);
    const none = (mine) => `<tr><td colspan="6" class="none">${mine ? t.mineEmpty : t.empty}</td></tr>`;
    let total;
    if (ent) {
      const rows = finderRows(UNIVERSITIES, { code: f.code.value, score: f.score.value, pair: f.pair.value })
        .filter((r) => !f.mine.checked || saved.has(rowKey(r)));
      total = rows.length;
      $('#finderBody').innerHTML = cut(rows).map(({ u, p, gap }) => `<tr class="${gap === null ? '' : gap >= 0 ? 'pass' : 'fail'}">
        <td>${esc(p[1 + i])}${pairOf(p[0]) ? `<span class="pair">${esc(pairOf(p[0])[1 + i])}</span>` : ''}</td>
        <td><a href="#${uid(u)}">${esc(u.name)}</a></td>
        <td class="n" data-l="${t.thGrants}">${num(p[3])}</td><td class="n" data-l="${t.thMin}">${p[4]}</td>
        <td class="wide"><span class="you">${gap === null ? t.enterScore : gap >= 0 ? t.pass(gap) : t.fail(-gap)}</span></td>
        ${star(rowKey({ u, p }))}</tr>`).join('') || none(f.mine.checked);
    } else {
      const rows = testRows(tests, { ielts: g.ielts.value, sat: g.sat.value, where: g.where.value })
        .filter((r) => !g.mine.checked || saved.has(`uni|${r.x.name}`));
      total = rows.length;
      const r1 = (n) => Math.round(n * 10) / 10;
      const verdict = ({ gi, gs, state }) => (!state ? t.enterScore : state === 'pass' ? t.enough
        : [gi < 0 && `IELTS: ${t.fail(r1(-gi))}`, gs < 0 && `SAT: ${t.fail(-gs)}`].filter(Boolean).join(', '));
      $('#testsBody').innerHTML = cut(rows).map((r) => `<tr class="${r.state || ''}">
        <td><a href="${r.x.href}">${esc(r.x.name)}</a><span class="pair">${esc(r.x.place[i])}</span></td>
        <td data-l="IELTS">${bar(r.x.ielts, r.x.ieltsNote, 1)}</td><td data-l="SAT">${bar(r.x.sat, r.x.satNote, 0)}</td>
        <td class="wide"><span class="you">${verdict(r)}</span></td>
        ${star(`uni|${r.x.name}`)}</tr>`).join('') || none(g.mine.checked);
    }
    const more = $('#finderMore');
    more.hidden = total <= limit;
    more.textContent = showAllRows ? t.showLess : t.showAll(total);
    $('#copyNote').textContent = '';
    // Keep the address in step with the form, so the link in the bar is the link to this result.
    if (currentTab === 'finder') history.replaceState(null, '', buildHash(ent
      ? { tab: 'finder', score: f.score.value, pair: f.pair.value, code: f.code.value }
      : { tab: 'finder', mode: 'tests', ielts: g.ielts.value, sat: g.sat.value, where: g.where.value }));
  }

  // ----- calendar -----
  function renderCalendar() {
    const t = T[lang], i = t.i;
    const fmt = (d) => dateText(d, i);
    $('#calendar').innerHTML = CALENDAR.map(([start, end, kind, approx, ru, kz, nru, nkz]) => {
      const ph = phase(start, end, today), name = [ru, kz][i], note = [nru, nkz][i];
      const when = ph.state === 'now' ? t.calNow : ph.state === 'past' ? t.calPast : t.calIn(t.days(ph.days));
      const cal = ph.state === 'past' ? '' : `<a download="${esc(name)}.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics({ name, deadline: start, end, url: location.href.split('#')[0] }))}">${t.cal}</a>`;
      return `<li class="ev ${ph.state}">
        <div class="when"><b>${start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`}</b><span>${when}</span></div>
        <div class="what"><h3>${esc(name)}</h3>${note ? `<p>${esc(note)}</p>` : ''}
          <p class="chips"><span class="chip${kind === 'grant' ? ' money' : ''}">${t.kinds[kind]}</span>${approx ? `<span class="chip">${t.approx}</span>` : ''}</p></div>
        <div class="links">${cal}</div>
      </li>`;
    }).join('');
  }

  // ----- abroad -----
  function countryFacts(c) {
    const t = T[lang], i = t.i;
    const row = (label, v) => (v ? `<div><dt>${label}</dt><dd>${glue(v[i])}</dd></div>` : '');
    return `<p class="chips"><span class="chip${c.way === 'grant' ? ' money' : ''}">${t.ways[c.way]}</span>${c.students ? `<span class="chip">${esc(c.students[i])}</span>` : ''}</p>
      <h3><a href="#abroad-${c.id}">${esc(c.name[i])}</a></h3>
      <dl class="rows">${row(t.aFree, c.free)}${row(t.aNeed, c.need)}${row(t.aCost, c.cost)}${row(t.aWhen, c.when)}</dl>
      <p class="src">${t.source}: ${c.urls.filter((u, n, all) => all.findIndex((x) => host(x) === host(u)) === n).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join(', ')}</p>`;
  }
  function renderAbroad() {
    const t = T[lang], i = t.i;
    $('#abroadFacts').innerHTML = ABROAD_FACTS.map((f) => `<li><b>${f[i]}</b><span>${esc(f[2 + i])}</span></li>`).join('');
    $('#abroadGrid').innerHTML = ABROAD.map((c) => `<article class="card abroad">${countryFacts(c)}
      <div class="cardfoot"><a class="ghost more" href="#abroad-${c.id}">${t.aUnis(c.unis.length)}</a>
        <label class="check cmp"><input type="checkbox" data-cmpc="${c.id}"${pickedC.has(c.id) ? ' checked' : ''}><span>${t.compare}</span></label></div>
    </article>`).join('');
    $('#otherGrants').innerHTML = OTHER_GRANTS.map((d) => `<li><b>${d[0]}</b><span>${esc(d[1 + i])}</span></li>`).join('');
    renderCompareC();
    if (country) renderCountry();
  }
  const pickedC = new Set(); // ids of the countries chosen for comparison
  function renderCompareC(full) {
    const t = T[lang], i = t.i, cs = [...pickedC].map((id) => ABROAD.find((c) => c.id === id));
    const cell = (v) => (v ? glue(v[i]) : '—');
    // Lowest and highest IELTS minimum among the country's listed universities.
    const band = (c) => {
      const v = c.unis.map((u) => ABROAD_TESTS[u[0]]?.ielts).filter((x) => x != null);
      return v.length ? [...new Set([Math.min(...v), Math.max(...v)])].map((x) => x.toFixed(1)).join('–') : t.noData;
    };
    compareBox($('#compareC'), $('#cmpBarC'), t.hCompareC, cs.map((c) => `<a href="#abroad-${c.id}">${esc(c.name[i])}</a>`), [
      [t.cmpWay, cs.map((c) => t.ways[c.way])],
      [t.aFree, cs.map((c) => cell(c.free))], [t.aNeed, cs.map((c) => cell(c.need))],
      [t.aCost, cs.map((c) => cell(c.cost))], [t.aWhen, cs.map((c) => cell(c.when))],
      [t.cmpStudents, cs.map((c) => (c.students ? esc(c.students[i]) : t.noData))],
      [t.cmpTop, cs.map((c) => `${esc(c.unis[0][0])}, ${esc(c.unis[0][3])}`)],
      [t.cmpIelts, cs.map(band)],
    ], full);
  }

  // One country: its conditions and its universities. Opens from a card, address "#abroad-ru".
  let country = null;
  function renderCountry() {
    const t = T[lang], i = t.i, c = country;
    // IELTS and SAT columns appear once at least one university of the country has them.
    const has = c.unis.some((u) => ABROAD_TESTS[u[0]]);
    const cell = (r, k, digits) => (r && (r[k] != null || r[`${k}Note`]) ? bar(r[k], r[`${k}Note`], digits) : `<span class="nodata">${t.noData}</span>`);
    const row = (u) => {
      const r = ABROAD_TESTS[u[0]];
      return `<tr><td><a href="${esc(u[4])}" target="_blank" rel="noopener">${esc(u[0])}</a><span class="city">${esc(u[1 + i])}${r?.url ? `, <a href="${esc(r.url)}" target="_blank" rel="noopener">${t.source.toLowerCase()}</a>` : ''}</span></td>
        ${has ? `<td data-l="IELTS">${cell(r, 'ielts', 1)}</td><td data-l="SAT">${cell(r, 'sat', 0)}</td>` : ''}<td class="n" data-l="QS 2027">${esc(u[3])}</td></tr>`;
    };
    $('#country').innerHTML = `<p class="back"><a href="#abroad">${t.aBack}</a></p>
      <h2>${esc(c.name[i])}</h2>
      <p class="fresh" id="countryFresh"></p>
      <div class="cols country${has ? ' wide' : ''}">
        <div class="card abroad">${countryFacts(c)}</div>
        <div class="card box">
          <h3>${t.hUnisOf}</h3>
          <table class="unilist${has ? ' stack' : ''}"><thead><tr><th>${t.thUni}</th>${has ? '<th>IELTS</th><th>SAT</th>' : ''}<th class="n">${t.thRank}</th></tr></thead>
          <tbody>${c.unis.map(row).join('')}</tbody></table>
          <p class="small">${has ? `${t.testsNote} ` : ''}${t.rankNote}</p>
          <p class="src"><a href="https://www.topuniversities.com/world-university-rankings" target="_blank" rel="noopener">topuniversities.com</a></p>
        </div>
      </div>`;
    fresh($('#countryFresh'), has ? 'qs tests' : 'abroad qs');
  }

  // ----- grants -----
  function renderGrants() {
    const i = T[lang].i, max = DIRECTIONS[0][2];
    $('#directions').innerHTML = DIRECTIONS.map((d) =>
      `<li><span class="lbl">${esc(d[i])}</span><span class="bar" style="--w:${(d[2] / max * 100).toFixed(1)}%"></span><b>${num(d[2])}</b></li>`).join('');
    $('#thresholds').innerHTML = THRESHOLDS.map((d) => `<li><b>${d[2]}</b><span>${esc(d[i])}</span></li>`).join('');
    $('#quotas').innerHTML = QUOTAS.map((d) => `<li><b>${d[0]}</b><span>${esc(d[1 + i])}</span></li>`).join('');
    $('#entFacts').innerHTML = ENT_FACTS.map((d) => `<li><b>${d[0]}</b><span>${esc(d[1 + i])}</span></li>`).join('');
  }

  // ----- tabs: one panel on screen, the address keeps the tab -----
  const TABS = ['home', 'calendar', 'unis', 'finder', 'grants', 'abroad'];
  function route() {
    const st = parseState(location.hash), h = st.tab, isCard = /^u\d+$/.test(h);
    // A card hidden by the city filter: drop the filter so the link still lands on it.
    if (isCard && !document.getElementById(h) && city) { city = ''; renderUnis(); }
    const target = isCard && document.getElementById(h);
    // "#programs" is the old name of the calendar tab; old links keep working.
    country = ABROAD.find((c) => h === `abroad-${c.id}`) || null;
    const tab = target ? 'unis' : country ? 'abroad' : h === 'programs' ? 'calendar' : TABS.includes(h) || h === 'data' ? h : 'home';
    currentTab = tab;
    if (country) renderCountry();
    // A country page is its own screen inside the "abroad" tab.
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== (country ? 'country' : tab); });
    $$('nav a').forEach((a) => a.toggleAttribute('aria-current', a.hash === `#${tab}`));
    if (tab === 'finder') {
      // A shared link picks the finder and fills its form; a plain "#finder" keeps what is already typed.
      const f = $('#finderForm'), g = $('#testsForm');
      if (st.mode === 'tests' || st.ielts || st.sat) { mode = 'tests'; g.ielts.value = st.ielts; g.sat.value = st.sat; g.where.value = st.where; }
      else if (st.score || st.pair || st.code) { mode = 'ent'; f.score.value = st.score; f.pair.value = st.pair; f.code.value = st.code; }
      renderFinder();
    }
    if (target) { target.querySelector('details')?.setAttribute('open', ''); target.scrollIntoView(); } else scrollTo(0, 0);
  }

  function applyLang() {
    const t = T[lang];
    document.documentElement.lang = t.locale;
    $$('[data-t]').forEach((el) => { el.textContent = t[el.dataset.t]; });
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('#statRows').textContent = allRows;
    $('#statUnis').textContent = UNIVERSITIES.length;
    $('#statPrograms').textContent = PROGRAMS.length;
    renderPrograms(); renderUnis(); renderFinder(); renderGrants(); renderCalendar(); renderAbroad(); renderFresh();
  }

  $('#filters').addEventListener('input', renderPrograms);
  $('#finderForm').addEventListener('input', renderFinder);
  $('#testsForm').addEventListener('input', renderFinder);
  $('#finderMode').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) { mode = b.dataset.mode; showAllRows = false; renderFinder(); } });
  $$('form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));
  $('#finderMore').addEventListener('click', () => { showAllRows = !showAllRows; renderFinder(); });
  $('.results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-save]');
    if (!b) return;
    if (saved.has(b.dataset.save)) saved.delete(b.dataset.save); else saved.add(b.dataset.save);
    keepSaved(); renderFinder();
  });
  $('#copyLink').addEventListener('click', async () => {
    const t = T[lang];
    try { await navigator.clipboard.writeText(location.href); $('#copyNote').textContent = t.copied; } catch { $('#copyNote').textContent = t.copyFail; }
  });
  comparing($('#uniGrid'), $('#compare'), $('#cmpBar'), 'cmp', picked, renderCompare, renderUnis);
  comparing($('#abroadGrid'), $('#compareC'), $('#cmpBarC'), 'cmpc', pickedC, renderCompareC, renderAbroad);
  $('#cities').addEventListener('click', (e) => { const b = e.target.closest('[data-city]'); if (b) { city = b.dataset.city; renderUnis(); } });
  // The score typed on the home screen opens the finder already filled in.
  $('#quick').addEventListener('submit', () => { mode = 'ent'; $('#finderForm').score.value = $('#quick').score.value; renderFinder(); location.hash = 'finder'; });
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; store.set(lang); applyLang(); }));
  addEventListener('hashchange', route);
  applyLang();
  route();
}
