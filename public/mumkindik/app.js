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

// ---------- Universities ----------
// Requirement cells: [ru, kz] or null when the source gives nothing.
// photo: [Wikimedia Commons file name, author or null], hotlinked through Special:FilePath.
// programs: [code, ru, kz, grants, minScore] — 2025 general grant competition (univision.kz).
export const UNIVERSITIES = [
  {
    name: 'Nazarbayev University', city: ['Астана', 'Астана'], url: 'https://nu.edu.kz/?p=12745',
    photo: ['Nazarbaev University Astana.JPG', 'Кондуктор-контролёр'],
    ielts: ['6.0 (Writing 6.0, остальные разделы от 5.5)', '6.0 (Writing 6.0, қалған бөлімдер 5.5-тен)'],
    sat: ['1240 или ACT 26', '1240 немесе ACT 26'],
    ent: ['85 на английском, матграмотность и чтение от 8 из 10', 'Ағылшын тілінде 85, математикалық және оқу сауаттылығы 10-нан 8'],
    note: [
      'Достаточно одного из результатов: SAT, ACT, ЕНТ, IB (27) или A-level (BBB). Свой экзамен NUET: от 130, по 60 в каждой части. Foundation: IELTS 5.5, SAT 1140 или ЕНТ 75. Для финансовой поддержки требования выше.',
      'Нәтижелердің біреуі жеткілікті: SAT, ACT, ҰБТ, IB (27) немесе A-level (BBB). Өз емтиханы NUET: 130-дан, әр бөлімнен 60. Foundation: IELTS 5.5, SAT 1140 немесе ҰБТ 75. Қаржылай қолдау үшін талаптар жоғары.',
    ],
  },
  {
    name: 'Astana IT University', city: ['Астана', 'Астана'], url: 'https://univision.kz/univ/119-astana-it-university/ball',
    photo: ['Astana IT University — Future of Digital Kazakhstan.jpg', 'Aliaskarov Danial'],
    ielts: null, sat: null,
    ent: ['Проходной на грант в 2025 году: от 70 до 126', '2025 жылы грантқа өту балы: 70-тен 126-ға дейін'],
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
    url: 'https://univision.kz/univ/47-kazahskiy-natsionalnyy-issledovatelskiy-tehnicheskiy-universitet-imeni-k-i-satpaeva/ball',
    ielts: null, sat: null,
    ent: ['Порог 65 как у национального вуза', 'Ұлттық жоғары оқу орны ретінде шекті балл 65'],
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
    name: 'КБТУ', city: ['Алматы', 'Алматы'], url: 'https://the-tech.kz/?p=15681',
    photo: ['Kazakh-British Technical University, Almaty (P1180218).jpg', null],
    ielts: ['5.5, либо TOEFL iBT 46, либо STEP KBTU B1', '5.5, немесе TOEFL iBT 46, немесе STEP KBTU B1'],
    sat: null,
    ent: ['Нужен сертификат ЕНТ, порог уточняйте в приёмной комиссии', 'ҰБТ сертификаты қажет, шекті балды қабылдау комиссиясынан нақтылаңыз'],
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
    name: 'SDU University', city: ['Каскелен', 'Қаскелең'], url: 'https://sdu.edu.kz/?p=38723',
    ielts: ['5.5, каждый раздел от 5.0, либо сертификат SDU Language School B1', '5.5, әр бөлім 5.0-ден, немесе SDU Language School B1 сертификаты'],
    sat: null,
    ent: ['Приём по результатам ЕНТ', 'Қабылдау ҰБТ нәтижесі бойынша'],
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
    url: 'https://bes.media/news/postuplenie-v-kbtu-v-2026-godu-podrobnyy-gid-dlya-abiturientov/',
    photo: ['Main building of KazNU.jpg', null],
    ielts: null, sat: null,
    ent: ['Порог 65 как у национального вуза, на популярные гуманитарные направления от 120', 'Ұлттық жоғары оқу орны ретінде шекті балл 65, танымал гуманитарлық бағыттарға 120-дан'],
    note: ['Платное обучение в 2026 году: от 500 тыс. до 1,9 млн ₸.', '2026 жылы ақылы оқу: 500 мыңнан 1,9 млн ₸-ге дейін.'],
    tableUrl: 'https://univision.kz/univ/50-kazahskiy-natsionalnyy-universitet-imeni-al-farabi/ball',
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
    photo: ['L.N.Gumilyov Eurasian National University.JPG', 'ChelseaFunNumberOne'],
    ielts: null, sat: null,
    ent: ['Порог 65 как у национального вуза', 'Ұлттық жоғары оқу орны ретінде шекті балл 65'],
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
    name: 'МУИТ', city: ['Алматы', 'Алматы'], url: 'https://univision.kz/univ/85-mezhdunarodnyy-universitet-informatsionnyh-tehnologiy/ball',
    ielts: null, sat: null,
    ent: ['Проходной на грант в 2025 году: от 71 до 127', '2025 жылы грантқа өту балы: 71-ден 127-ге дейін'],
    programs: [
      ['B057', 'Информационные технологии', 'Ақпараттық технологиялар', 363, 90],
      ['B058', 'Информационная безопасность', 'Ақпараттық қауіпсіздік', 287, 90],
      ['B157', 'Математическое и компьютерное моделирование', 'Математикалық және компьютерлік модельдеу', 59, 90],
      ['B059', 'Коммуникации и коммуникационные технологии', 'Коммуникациялар және коммуникациялық технологиялар', 14, 71],
      ['B042', 'Журналистика и репортерское дело', 'Журналистика және репортер ісі', 1, 127],
    ],
  },
  {
    name: 'KIMEP University', city: ['Алматы', 'Алматы'], url: 'https://www.kimep.kz/prospective-students/files/2025/08/HowToApplyRusUgradINL.pdf',
    photo: ['KIMEP New Academic Building.jpg', null],
    ielts: ['5.5, каждый раздел от 5.0, для уровня Academic English', 'Academic English деңгейі үшін 5.5, әр бөлім 5.0-ден'],
    sat: null, ent: null,
    note: [
      'С более низким баллом зачисляют на подготовительные уровни английского. Без сертификата сдают внутренний тест KEPT. Онлайн-заявки открываются 15 октября. Данные из памятки для иностранных абитуриентов.',
      'Балл төмен болса, ағылшын тілінің дайындық деңгейлеріне қабылдайды. Сертификат болмаса, ішкі KEPT тесті тапсырылады. Онлайн өтінімдер 15 қазанда ашылады. Деректер шетелдік талапкерлерге арналған жадынамадан алынған.',
    ],
  },
  {
    name: 'Cardiff University Kazakhstan', city: ['Астана', 'Астана'],
    url: 'https://www.gov.kz/uploads/2026/3/30/7699885c1c2362b098c5ce9bcf2fb859_original.23144520.pdf',
    ielts: ['6.5 на первый курс, 6.0 на Foundation, разделы от 5.5', 'Бірінші курсқа 6.5, Foundation-ға 6.0, бөлімдер 5.5-тен'],
    sat: null,
    ent: ['80 для государственного гранта', 'Мемлекеттік грант үшін 80'],
  },
  {
    name: 'Coventry University Kazakhstan', city: ['Астана, Алматы', 'Астана, Алматы'],
    url: 'https://www.gov.kz/uploads/2026/3/30/7699885c1c2362b098c5ce9bcf2fb859_original.23144520.pdf',
    ielts: ['6.0 на грант, 5.0 на платное', 'Грантқа 6.0, ақылы бөлімге 5.0'],
    sat: null,
    ent: ['50 для гранта, на платное ЕНТ не нужен', 'Грант үшін 50, ақылы бөлімге ҰБТ қажет емес'],
    note: ['В Астане для гранта также нужны GPA 4.0 и эссе.', 'Астанада грант үшін GPA 4.0 және эссе де қажет.'],
  },
];

/** Margin over last year's passing score; null when the score is empty or outside 0–140. */
export function fit(score, min) {
  const n = score === '' || score == null ? NaN : Number(score);
  return Number.isFinite(n) && n >= 0 && n <= 140 ? n - min : null;
}

/** Every programme row of every university, optionally one programme group.
 *  With a score: passing rows first (most grants first), then the nearest misses. Without: most grants first. */
export function finderRows(unis, { code, score }) {
  const rows = unis.flatMap((u) => (u.programs || []).filter((p) => !code || p[0] === code).map((p) => ({ u, p, gap: fit(score, p[4]) })));
  return rows.sort((a, b) => {
    if (a.gap === null) return b.p[3] - a.p[3];
    if ((a.gap >= 0) !== (b.gap >= 0)) return a.gap >= 0 ? -1 : 1;
    return a.gap >= 0 ? b.p[3] - a.p[3] : b.gap - a.gap;
  });
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

// ---------- UI (browser only) ----------

const T = {
  ru: {
    locale: 'ru', i: 0,
    lead: 'Куда подать проект и куда поступать в Казахстане: конкурсы и акселераторы с дедлайнами, вузы с требованиями по IELTS, SAT и ЕНТ, гранты по направлениям.',
    navPrograms: 'Конкурсы', navUnis: 'Вузы', navGrants: 'ЕНТ и гранты',
    navProgramsHint: 'куда подать проект', navUnisHint: 'требования, гранты, проходные', navGrantsHint: 'цифры 2026/27',
    hPrograms: 'Конкурсы, гранты и акселераторы',
    pPrograms: 'Наборы 2026 года в основном закрыты. Ближайшие откроются зимой и весной: строки без даты ждут объявления.',
    typeLabel: 'Тип', any: 'Все', competition: 'Конкурс', incubator: 'Инкубатор', accelerator: 'Акселератор', grant: 'Грант',
    stageLabel: 'Моя стадия', stageAny: 'Любая', idea: 'Только идея', mvp: 'Есть MVP', growth: 'Есть выручка',
    prize: 'С призовым фондом', open: 'Только открытый приём', search: 'Поиск по названию',
    today: 'последний день', closed: 'приём закрыт', unknown: 'срок не объявлен', left: 'осталось',
    cal: 'Добавить в календарь', more: 'Условия на сайте', found: 'Найдено',
    empty: 'Под эти фильтры ничего не подходит. Снимите один из них.',
    days: (n) => `${n} ${{ one: 'день', few: 'дня', many: 'дней' }[new Intl.PluralRules('ru').select(n)] || 'дня'}`,
    hUnis: 'Вузы и специальности',
    pUnis: 'Минимальные требования для бакалавриата. Гранты считаются по группам образовательных программ: конкурс идёт на группу, а не на отдельную специальность.',
    ent: 'ЕНТ', noData: 'нет данных', notReq: 'не требуется',
    thCode: 'Код', thProgram: 'Группа программ', thGrants: 'Грантов', thMin: 'Проходной',
    tableCap: 'Общий конкурс 2025 года', source: 'Источник', photoBy: 'Фото',
    hFinder: 'Куда хватит баллов',
    pFinder: 'Введите балл ЕНТ и выберите специальность. Сравниваем с проходными баллами на грант 2025 года: в 2026 году они могли измениться.',
    scoreLabel: 'Мой балл ЕНТ, от 0 до 140', specLabel: 'Специальность', specAny: 'Все специальности',
    thUni: 'Вуз', thYou: 'Ваш результат', enterScore: 'введите балл',
    pass: (n) => (n ? `проходите, запас ${n}` : 'проходите впритык'), fail: (n) => `не хватает ${n}`,
    showAll: (n) => `Показать все строки: ${n}`, showLess: 'Свернуть',
    grantsDetails: (n) => `Гранты по специальностям: ${n}`,
    hGrants: 'ЕНТ и гранты 2026/27',
    pGrants: 'На 2026/27 учебный год выделено 89 457 грантов. Из них 75 371 на бакалавриат, 11 007 на магистратуру и 3 079 на докторантуру. На бакалаврские гранты подали около 127 тысяч заявлений.',
    hDirections: 'Грантов по направлениям',
    directionsNote: 'Госзаказ, объявленный министерством. В итоговом распределении цифры по части направлений ниже.',
    hThresholds: 'Порог ЕНТ для конкурса грантов',
    thresholdsNote: 'Порог только допускает к конкурсу. Реальные проходные в 2026 году: 110–130 на право, международные отношения, психологию и перевод, 90–100 на инженерию и IT в ряде вузов.',
    hEnt: 'Как устроен ЕНТ',
    entFacts: ['120 заданий на 4 часа', 'Максимум 140 баллов', 'Три обязательных предмета и два профильных', 'Средний результат 2026 года: 66 баллов', 'По каждому предмету нужен минимум: от 5 баллов по истории и профильным, от 3 по грамотности чтения и математической'],
    foot: 'Данные собраны из открытых источников в ноябре 2026 года. Перед подачей проверяйте условия на сайте организатора или вуза.',
    sources: 'Источники',
  },
  kz: {
    locale: 'kk', i: 1,
    lead: 'Қазақстанда жобаны қайда тапсыруға және қайда оқуға түсуге болады: мерзімдері бар байқаулар мен акселераторлар, IELTS, SAT және ҰБТ талаптары бар жоғары оқу орындары, бағыттар бойынша гранттар.',
    navPrograms: 'Байқаулар', navUnis: 'ЖОО', navGrants: 'ҰБТ және гранттар',
    navProgramsHint: 'жобаны қайда тапсыру', navUnisHint: 'талаптар, гранттар, өту балдары', navGrantsHint: '2026/27 сандары',
    hPrograms: 'Байқаулар, гранттар және акселераторлар',
    pPrograms: '2026 жылғы қабылдаулардың көбі жабылды. Жақын арадағылары қыста және көктемде ашылады: мерзімі жоқ жолдар хабарландыруды күтуде.',
    typeLabel: 'Түрі', any: 'Барлығы', competition: 'Байқау', incubator: 'Инкубатор', accelerator: 'Акселератор', grant: 'Грант',
    stageLabel: 'Менің кезеңім', stageAny: 'Кез келген', idea: 'Тек идея', mvp: 'MVP бар', growth: 'Табыс бар',
    prize: 'Жүлде қоры бар', open: 'Тек ашық қабылдау', search: 'Атауы бойынша іздеу',
    today: 'соңғы күн', closed: 'қабылдау жабылды', unknown: 'мерзімі жарияланбаған', left: 'қалды',
    cal: 'Күнтізбеге қосу', more: 'Шарттары сайтта', found: 'Табылды',
    empty: 'Бұл сүзгілерге ештеңе сәйкес келмейді. Біреуін алып тастаңыз.',
    days: (n) => `${n} күн`,
    hUnis: 'ЖОО және мамандықтар',
    pUnis: 'Бакалавриатқа қойылатын ең төменгі талаптар. Гранттар білім беру бағдарламаларының топтары бойынша есептеледі: конкурс жеке мамандыққа емес, топқа өтеді.',
    ent: 'ҰБТ', noData: 'дерек жоқ', notReq: 'қажет емес',
    thCode: 'Код', thProgram: 'Бағдарламалар тобы', thGrants: 'Грант саны', thMin: 'Өту балы',
    tableCap: '2025 жылғы жалпы конкурс', source: 'Дереккөз', photoBy: 'Фото',
    hFinder: 'Балым қайда жетеді',
    pFinder: 'ҰБТ балыңызды енгізіп, мамандықты таңдаңыз. 2025 жылғы грантқа өту балдарымен салыстырамыз: 2026 жылы олар өзгеруі мүмкін.',
    scoreLabel: 'Менің ҰБТ балым, 0-ден 140-қа дейін', specLabel: 'Мамандық', specAny: 'Барлық мамандықтар',
    thUni: 'ЖОО', thYou: 'Сіздің нәтижеңіз', enterScore: 'балды енгізіңіз',
    pass: (n) => (n ? `өтесіз, артық ${n} балл` : 'дәл өтесіз'), fail: (n) => `${n} балл жетпейді`,
    showAll: (n) => `Барлық жолды көрсету: ${n}`, showLess: 'Жию',
    grantsDetails: (n) => `Мамандықтар бойынша гранттар: ${n}`,
    hGrants: 'ҰБТ және гранттар 2026/27',
    pGrants: '2026/27 оқу жылына 89 457 грант бөлінді. Оның 75 371-і бакалавриатқа, 11 007-сі магистратураға, 3 079-ы докторантураға. Бакалавриат гранттарына шамамен 127 мың өтініш түсті.',
    hDirections: 'Бағыттар бойынша гранттар',
    directionsNote: 'Министрлік жариялаған мемлекеттік тапсырыс. Қорытынды бөлуде кейбір бағыттар бойынша сандар төмен.',
    hThresholds: 'Грант конкурсына қажет ҰБТ шекті балы',
    thresholdsNote: 'Шекті балл тек конкурсқа жібереді. 2026 жылғы нақты өту балдары: құқық, халықаралық қатынастар, психология және аударма ісіне 110–130, кейбір ЖОО-да инженерия мен IT-ге 90–100.',
    hEnt: 'ҰБТ қалай өтеді',
    entFacts: ['4 сағатқа 120 тапсырма', 'Ең жоғары балл 140', 'Үш міндетті және екі бейіндік пән', '2026 жылғы орташа нәтиже: 66 балл', 'Әр пәннен ең төменгі балл қажет: тарих пен бейіндік пәндерден 5, оқу және математикалық сауаттылықтан 3'],
    foot: 'Деректер 2026 жылғы қарашада ашық дереккөздерден жиналды. Тапсырар алдында шарттарды ұйымдастырушының немесе ЖОО-ның сайтынан тексеріңіз.',
    sources: 'Дереккөздер',
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
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (n) => n.toLocaleString('ru');

  function row(p) {
    const t = T[lang], s = status(p.deadline, today);
    const d = p.deadline && new Date(p.deadline);
    const day = d ? d.toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }).replace('.', '') : '—';
    const state = s.state === 'open' ? (s.days === 0 ? t.today : `${t.days(s.days)} ${t.left}`) : t[s.state];
    const cal = s.state === 'open'
      ? `<a download="${esc(p.name)}.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics(p))}">${t.cal}</a>` : '';
    return `<li class="row ${s.state}">
      <div class="date"><b>${day}</b><span>${d ? d.getFullYear() : ''}</span></div>
      <div class="what">
        <h3>${esc(p.name)}</h3>
        <p class="org">${t[p.type]}, ${esc(p.org)}</p>
        <p>${esc(p[lang])}</p>
        <p class="links"><a href="${esc(p.url)}" target="_blank" rel="noopener">${t.more}</a>${cal}</p>
      </div>
      <div class="side">${p.prize ? `<b class="prize">${esc(p.prize)}</b>` : ''}<span class="state">${state}</span></div>
    </li>`;
  }

  function renderPrograms() {
    const t = T[lang], f = $('#filters');
    const filter = { type: f.type.value, stage: f.stage.value, prize: f.prize.checked, open: f.open.checked, q: f.q.value };
    const list = sortPrograms(PROGRAMS.filter((p) => matches(p, filter, today)), today);
    $('#list').innerHTML = list.map(row).join('') || `<li class="empty">${t.empty}</li>`;
    $('#found').textContent = `${t.found}: ${list.length}`;
  }

  const uid = (u) => `u${UNIVERSITIES.indexOf(u)}`;
  const commons = 'https://commons.wikimedia.org/wiki/';

  function uni(u) {
    const t = T[lang], i = t.i;
    const cell = (label, v) => `<div class="req${v ? '' : ' none'}"><dt>${label}</dt><dd>${v ? esc(v[i]) : t.noData}</dd></div>`;
    // No photo, or the photo fails to load: the poster with the name stays.
    const file = u.photo && encodeURIComponent(u.photo[0].replaceAll(' ', '_'));
    const pic = u.photo ? `<img src="${commons}Special:FilePath/${file}?width=960" alt="${esc(u.name)}" loading="lazy" onerror="this.remove()">
      <figcaption><a href="${commons}File:${file}" target="_blank" rel="noopener">${t.photoBy}: ${esc(u.photo[1] || 'Wikimedia Commons')}${u.photo[1] ? ', Wikimedia Commons' : ''}</a></figcaption>` : '';
    const table = u.programs ? `<details><summary>${t.grantsDetails(u.programs.length)}</summary><table>
      <caption>${t.tableCap}${u.tableUrl ? `, <a href="${esc(u.tableUrl)}" target="_blank" rel="noopener">univision.kz</a>` : ''}</caption>
      <thead><tr><th>${t.thCode}</th><th>${t.thProgram}</th><th class="n">${t.thGrants}</th><th class="n">${t.thMin}</th></tr></thead>
      <tbody>${u.programs.map((p) => `<tr><td>${p[0]}</td><td>${esc(p[1 + i])}</td><td class="n">${num(p[3])}</td><td class="n">${p[4]}</td></tr>`).join('')}</tbody>
    </table></details>` : '';
    return `<article class="uni" id="${uid(u)}">
      <figure><span aria-hidden="true">${esc(u.name)}</span>${pic}</figure>
      <header><h3>${esc(u.name)}</h3><p>${esc(u.city[i])}</p></header>
      <dl>${cell('IELTS', u.ielts)}${cell('SAT', u.sat)}${cell(t.ent, u.ent)}</dl>
      ${u.note ? `<p class="note">${esc(u.note[i])}</p>` : ''}
      ${table}
      <p class="src"><a href="${esc(u.url)}" target="_blank" rel="noopener">${t.source}: ${esc(new URL(u.url).hostname.replace('www.', ''))}</a></p>
    </article>`;
  }

  let showAllRows = false;
  function renderFinder() {
    const t = T[lang], i = t.i, f = $('#finder');
    // Rebuild the specialty list in the current language, keeping the choice.
    const codes = new Map(UNIVERSITIES.flatMap((u) => u.programs || []).map((p) => [p[0], p[1 + i]]));
    const chosen = f.code.value;
    f.code.innerHTML = `<option value="">${t.specAny}</option>` + [...codes].sort((a, b) => a[1].localeCompare(b[1], t.locale))
      .map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
    f.code.value = chosen;
    const rows = finderRows(UNIVERSITIES, { code: f.code.value, score: f.score.value });
    const limit = 10;
    $('#finderBody').innerHTML = rows.slice(0, showAllRows ? rows.length : limit).map(({ u, p, gap }) => `<tr class="${gap === null ? '' : gap >= 0 ? 'pass' : 'fail'}">
      <td>${esc(p[1 + i])} <span class="code">${p[0]}</span></td>
      <td><a href="#${uid(u)}">${esc(u.name)}</a></td>
      <td class="n" data-l="${t.thGrants}">${num(p[3])}</td><td class="n" data-l="${t.thMin}">${p[4]}</td>
      <td class="you">${gap === null ? t.enterScore : gap >= 0 ? t.pass(gap) : t.fail(-gap)}</td></tr>`).join('');
    const more = $('#finderMore');
    more.hidden = rows.length <= limit;
    more.textContent = showAllRows ? t.showLess : t.showAll(rows.length);
  }

  function renderStatic() {
    const t = T[lang], i = t.i;
    // Universities with a photo first, so the grid starts with pictures.
    $('#unis').innerHTML = [...UNIVERSITIES].sort((a, b) => !!b.photo - !!a.photo).map(uni).join('');
    const max = DIRECTIONS[0][2];
    $('#directions').innerHTML = DIRECTIONS.map((d) =>
      `<li><span class="lbl">${esc(d[i])}</span><span class="bar" style="--w:${(d[2] / max * 100).toFixed(1)}%"></span><b>${num(d[2])}</b></li>`).join('');
    $('#thresholds').innerHTML = THRESHOLDS.map((d) => `<li><b>${d[2]}</b><span>${esc(d[i])}</span></li>`).join('');
    $('#entFacts').innerHTML = t.entFacts.map((s) => `<li>${esc(s)}</li>`).join('');
  }

  function applyLang() {
    const t = T[lang];
    document.documentElement.lang = t.locale;
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t[el.dataset.t]; });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    renderPrograms();
    renderStatic();
    renderFinder();
  }

  $('#filters').addEventListener('input', renderPrograms);
  $('#filters').addEventListener('submit', (e) => e.preventDefault());
  $('#finder').addEventListener('input', renderFinder);
  $('#finder').addEventListener('submit', (e) => e.preventDefault());
  $('#finderMore').addEventListener('click', () => { showAllRows = !showAllRows; renderFinder(); });
  // A card opened from the finder shows its grant table straight away.
  addEventListener('hashchange', () => { const d = document.querySelector(`${location.hash || '#x'} details`); if (d) d.open = true; });
  // Highlight the section being read in the menu.
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) document.querySelectorAll('nav a').forEach((a) => a.toggleAttribute('aria-current', a.hash === `#${e.target.id}`));
  }), { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('main section').forEach((sec) => spy.observe(sec));
  document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
    lang = b.dataset.lang; store.set(lang); applyLang();
  }));
  applyLang();
}
