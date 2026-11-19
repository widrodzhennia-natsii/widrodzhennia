import type {
  CoopMission,
  TeamRoleBlueprint,
  TeamTransportBlueprint,
} from './coop.types';

export const FAMILY_COOP_MISSIONS: CoopMission[] = [
  {
    id: 'coop_rescue_bridge',
    title: 'Місія «Переправа крізь Дніпро»',
    subjectLabel: 'Математика і Логіка',
    difficultyLabel: 'Легкий старт (1–6 кл.)',
    description:
      'Штурман бачить маршрутну схему й обмеження вантажопідйомності, а Пілот керує маневром на пульті.',
    rewardPoints: { collaboration: 6, leadership: 4, energy: 15 },
    steps: [
      {
        id: 'bridge_s1',
        title: 'Етап 1 · Розрахунок часу маршруту',
        navigatorBriefing:
          'Відстань між двома островами — 18 км. Катер іде за течією зі швидкістю 9 км/год, а біля мілини робить зупинку на 30 хвилин (0,5 год).',
        navigatorDiagram: [
          'Старт (0 км)',
          '  Рух 18 км -> Швидкість 9 км/год (2 год)',
          '  Мілина (зупинка 0,5 год) -> Фінішний причал',
        ].join('\n'),
        navigatorStrategyHint:
          'Порадь Пілоту поділити 18 на 9, щоб знайти чистий час руху, а потім додати 0,5 години зупинки.',
        pilotPrompt: 'Який повний час займе переправа до причалу (у годинах, наприклад 2.5)?',
        controlType: 'numeric',
        unit: 'год',
        expectedAnswer: 2.5,
        tolerance: 0.05,
        successReflection: 'Точний розрахунок: 18 / 9 + 0,5 = 2,5 години!',
      },
      {
        id: 'bridge_s2',
        title: 'Етап 2 · Балансування вантажу',
        navigatorBriefing:
          'Понтон витримує максимум 300 кг. На борту вже є обладнання масою 165 кг і рюкзак штурмана — 15 кг.',
        navigatorStrategyHint:
          'Підкажи Пілоту відняти суму 165 + 15 від максимальних 300 кг.',
        pilotPrompt: 'Виставте на регуляторі максимальну масу додаткового вантажу (кг):',
        controlType: 'slider',
        sliderConfig: { min: 40, max: 200, step: 10, unit: 'кг', initial: 60 },
        expectedAnswer: 120,
        tolerance: 0,
        successReflection: 'Ідеальне балансування: 300 − (165 + 15) = 120 кг!',
      },
    ],
  },
  {
    id: 'coop_solar_station',
    title: 'Місія «Автономна станція на даху»',
    subjectLabel: 'Фізика та Енергетика',
    difficultyLabel: 'Середній (5–9 кл.)',
    description:
      'Спільне налаштування сонячної батареї та безпечного резистора без перевантаження акумулятора.',
    rewardPoints: { collaboration: 6, leadership: 5, energy: 20 },
    steps: [
      {
        id: 'solar_s1',
        title: 'Етап 1 · Потужність заряду',
        navigatorBriefing:
          'Сонячна панель видає напругу U = 12 В при силі струму I = 3 А. Формула потужності: P = U · I.',
        navigatorDiagram:
          'Сонце (промені) -> Панель 12 В (I = 3 А) -> Контролер (захист) -> Акумулятор',
        navigatorStrategyHint:
          'Нагадай Пілоту помножити напругу на силу струму (12 · 3).',
        pilotPrompt: 'Яку електричну потужність виробляє панель (у Ватах)?',
        controlType: 'numeric',
        unit: 'Вт',
        expectedAnswer: 36,
        tolerance: 0.1,
        successReflection: 'Правильно: 12 В · 3 А = 36 Вт корисної енергії!',
      },
      {
        id: 'solar_s2',
        title: 'Етап 2 · Кут нахилу панелі',
        navigatorBriefing:
          'Для весняного полудня оптимальний кут нахилу панелі до горизонту становить 45°, що дає максимальний потік світла.',
        navigatorStrategyHint:
          'Скеруй Пілота встановити регулятор рівно на половину прямого кута (45°).',
        pilotPrompt: 'Встановіть кут нахилу сонячної панелі:',
        controlType: 'slider',
        sliderConfig: { min: 15, max: 75, step: 5, unit: '°', initial: 25 },
        expectedAnswer: 45,
        tolerance: 0,
        successReflection: 'Панель зорієнтовано оптимально під 45°!',
      },
    ],
  },
  {
    id: 'coop_cyber_shield',
    title: 'Місія «Кіберщит команди»',
    subjectLabel: 'Кібербезпека та Інформатика',
    difficultyLabel: 'Універсальний (5–11 кл.)',
    description:
      'Штурман розшифровує журнал подій мережі, а Пілот блокує вразливість на пульті захисту.',
    rewardPoints: { collaboration: 5, leadership: 5, energy: 15 },
    steps: [
      {
        id: 'cyber_s1',
        title: 'Етап 1 · Розпізнавання фішингу',
        navigatorBriefing:
          'Надійшов лист із темою «Терміново оновіть пароль від шкільного щоденника», адреса відправника: support@shkola-login-free.xyz.',
        navigatorDiagram: [
          'Лист (терміновий тиск)',
          '  Домен .xyz (не офіційний) -> Ризик крадіжки пароля',
          '  Правильна дія -> Не переходити за посиланням',
        ].join('\n'),
        navigatorStrategyHint:
          'Зверни увагу Пілота на підозрілий сторонній домен та штучну терміновість у листі.',
        pilotPrompt: 'Яку дію має виконати Пілот на пульті безпеки?',
        controlType: 'choices',
        options: [
          'Негайно ввести старий і новий паролі за посиланням',
          'Перевірити офіційний домен закладу і видалити лист без кліків',
          'Переслати лист усім однокласникам для перевірки',
        ],
        expectedAnswer: 'Перевірити офіційний домен закладу і видалити лист без кліків',
        successReflection: 'Загрозу знешкоджено! Офіційні сервіси ніколи не просять пароль через сторонні домени.',
      },
      {
        id: 'cyber_s2',
        title: 'Етап 2 · Надійність двійкового ключа',
        navigatorBriefing:
          'Система перевірки вимагає число, яке у двійковому записі виглядає як 1010 (1·8 + 0·4 + 1·2 + 0·1).',
        navigatorStrategyHint:
          'Підкажи Пілоту скласти степені двійки на позиціях, де стоїть одиниця: 8 + 2.',
        pilotPrompt: 'Введіть десяткове значення двійкового коду 1010:',
        controlType: 'numeric',
        unit: '(10)',
        expectedAnswer: 10,
        tolerance: 0,
        successReflection: 'Доступ відкрито! Двійкове 1010 дорівнює десятковому 10.',
      },
    ],
  },
  {
    id: 'coop_eco_park',
    title: 'Місія «Зелений баланс громади»',
    subjectLabel: 'Екологія і Природознавство',
    difficultyLabel: 'Сімейний квест (3–8 кл.)',
    description:
      'Разом сплануйте відновлення скверу так, щоб вистачило води для поливу й кисню для мешканців.',
    rewardPoints: { collaboration: 6, leadership: 4, energy: 15 },
    steps: [
      {
        id: 'eco_s1',
        title: 'Етап 1 · Джерело поливу',
        navigatorBriefing:
          'Для поливу молодих дерев у суху погоду потрібно збирати дощову воду з дахів у резервуар замість використання питної води з водогону.',
        navigatorStrategyHint:
          'Натякни Пілоту на природний замкнений цикл збору опадів.',
        pilotPrompt: 'Який спосіб поливу скверу найбільш ощадливий і екологічний?',
        controlType: 'choices',
        options: [
          'Лити воду зі шланга опівдні під яскравим сонцем',
          'Збирати дощову воду в резервуар і поливати ввечері під корінь',
          'Заасфальтувати ґрунт навколо стовбурів',
        ],
        expectedAnswer: 'Збирати дощову воду в резервуар і поливати ввечері під корінь',
        successReflection: 'Чудовий вибір! Вечірній прикореневий полив дощовою водою зменшує випаровування.',
      },
      {
        id: 'eco_s2',
        title: 'Етап 2 · Норма висадки дерев',
        navigatorBriefing:
          'На алеї довжиною 30 метрів дерева висаджують кожні 5 метрів, починаючи з самого краю (на 0 м, 5 м, 10 м ... 30 м).',
        navigatorDiagram:
          'Край 0 м -> 5 м -> 10 м -> 15 м -> 20 м -> 25 м -> Край 30 м',
        navigatorStrategyHint:
          'Увага на пастку інтервалів! Порадь Пілоту поділити 30 на 5 і додати 1 початкове дерево.',
        pilotPrompt: 'Скільки саджанців потрібно замовити для алеї?',
        controlType: 'numeric',
        unit: 'шт.',
        expectedAnswer: 7,
        tolerance: 0,
        successReflection: 'Абсолютно вірно: 6 проміжків по 5 м дають 7 дерев!',
      },
    ],
  },
];

export const TEAM_ROLE_BLUEPRINTS: TeamRoleBlueprint[] = [
  {
    role: 'engineer',
    title: 'Інженер',
    icon: '⚙️',
    responsibility: 'Керує інтерактивним симулятором, обчисленнями та збіркою схеми.',
    rotationFocus: 'Точність параметрів і технічна перевірка гіпотези.',
  },
  {
    role: 'navigator',
    title: 'Навігатор',
    icon: '🧭',
    responsibility: 'Тримає умову задачі, карту маршруту й орієнтири команди.',
    rotationFocus: 'Координація етапу та пояснення плану дій словами.',
  },
  {
    role: 'archivist',
    title: 'Архіваріус',
    icon: '📜',
    responsibility: 'Звіряє теорію, офлайн-словник і фіксує висновок у журналі.',
    rotationFocus: 'Доказова аргументація та збереження правил.',
  },
  {
    role: 'economist',
    title: 'Економіст',
    icon: '⚖️',
    responsibility: 'Контролює бюджет підказок, ресурси команди й оцінку ризиків.',
    rotationFocus: 'Ощадливість ходів та збалансована стратегія.',
  },
];

export const TEAM_TRANSPORT_BLUEPRINTS: TeamTransportBlueprint[] = [
  {
    transport: 'pass_and_play',
    title: 'Pass-and-Play (1 пристрій по колу)',
    icon: '🔄',
    summary: 'Чіткий екран передачі ходу з індивідуальною карткою поточної ролі.',
    statusLabel: 'Каркас режиму закладено (Етап 5+)',
  },
  {
    transport: 'projector',
    title: 'Режим класного проектора',
    icon: '📽️',
    summary: 'Спільна умова й симуляція на великому екрані з локальною фіксацією відповідей.',
    statusLabel: 'Спроєктовано у TEAM_COOP_FUTURE_PLAN',
  },
  {
    transport: 'qr_sync',
    title: 'Multi-phone Live Table (QR-синхронізація)',
    icon: '📱',
    summary: 'Компактні офлайн QR-пакети для обміну ходами без центрального сервера.',
    statusLabel: 'Відкладено на детальне опрацювання',
  },
  {
    transport: 'web_bluetooth',
    title: 'Web Bluetooth (Progressive Enhancement)',
    icon: '📡',
    summary: 'Прямий локальний канал між сумісними пристроями в межах класу без інтернету.',
    statusLabel: 'Відкладено на детальне опрацювання',
  },
];
