import { db, StoredGlossaryTerm, StoredSrsCard } from '../core/storage/db';
import { ContentLoaderService } from './contentLoaderService';
import { stripInlineMarkup } from '../core/utils/stripInlineMarkup';

export type GlossaryCategory = StoredGlossaryTerm['category'];

const BASE_GLOSSARY_SEEDS: Array<Omit<StoredGlossaryTerm, 'updatedAt'>> = [
  {
    id: 'math_perimeter_rect',
    term: 'Периметр прямокутника (P)',
    subjectId: 'math',
    category: 'formula',
    summary: 'Сума довжин усіх чотирьох сторін прямокутника: P = 2 · (a + b).',
    example: 'Якщо a = 8 м, b = 5 м, то P = 2 · (8 + 5) = 26 м.',
    feynmanPrompt: 'Поясніть так, ніби треба обійти город або обшити рамку по краю.',
    keywords: 'периметр прямокутник сторони рамка сума',
  },
  {
    id: 'math_area_rect',
    term: 'Площа прямокутника (S)',
    subjectId: 'math',
    category: 'formula',
    summary: 'Величина поверхні всередині фігури: S = a · b (вимірюється у квадратних одиницях: см², м²).',
    example: 'Якщо a = 8 м, b = 5 м, то S = 8 · 5 = 40 м².',
    feynmanPrompt: 'Уявіть плитку 1×1 м: скільки таких квадратів поміститься всередині?',
    keywords: 'площа квадратні метри добуток a b',
  },
  {
    id: 'math_speed_distance',
    term: 'Шлях, швидкість і час (S = v · t)',
    subjectId: 'math',
    category: 'formula',
    summary: 'Пряма задача: S = v · t. Обернені задачі: v = S / t (швидкість), t = S / v (час руху).',
    example: 'За 3 год зі швидкістю 60 км/год авто проїде S = 60 · 3 = 180 км.',
    feynmanPrompt: 'Як знаючи відстань і час у дорозі, обчислити швидкість?',
    keywords: 'шлях відстань швидкість час рух обернена',
  },
  {
    id: 'math_units_length',
    term: 'Співвідношення одиниць довжини',
    subjectId: 'math',
    category: 'rule',
    summary: '1 км = 1000 м · 1 м = 10 дм = 100 см · 1 см = 10 мм.',
    example: '4 м 80 см = 4 · 100 + 80 = 480 см.',
    feynmanPrompt: 'Чому перед додаванням усі виміри зводять до однієї одиниці?',
    keywords: 'метр сантиметр міліметр кілометр переведення',
  },
  {
    id: 'ukr_ortho_e_i',
    term: 'Ненаголошені [е] та [и] в корені слова',
    subjectId: 'ukrainian',
    category: 'orthogram',
    summary: 'Щоб перевірити сумнівний ненаголошений [е] чи [и] в корені, доберіть спільнокореневе слово або змініть форму так, щоб звук опинився під наголосом.',
    example: 'з[и]мо́вий ← зи́ми; з[е]ле́ний ← зе́лень; с[е]ло́ ← се́ла.',
    feynmanPrompt: 'Назвіть перевірне слово для «весняний» або «зимовий» і поясніть чому.',
    keywords: 'орфограма ненаголошені е и зимовий зелений правопис корінь',
  },
  {
    id: 'ukr_ortho_apostrophe',
    term: 'Апостроф після губних (б, п, в, м, ф) та р',
    subjectId: 'ukrainian',
    category: 'orthogram',
    summary: 'Апостроф ставиться перед я, ю, є, ї після б, п, в, м, ф, р, якщо немає попереднього кореневого приголосного (крім р).',
    example: 'м’ята, під’їзд, вір’я, черв’як (але: свято, морквяний).',
    feynmanPrompt: 'Чому у слові «м’ята» є апостроф, а в слові «свято» — ні?',
    keywords: 'апостроф губні роздільна вимова свято мята',
  },
  {
    id: 'ukr_syntax_base',
    term: 'Граматична основа речення (Підмет і Присудок)',
    subjectId: 'ukrainian',
    category: 'rule',
    summary: 'Підмет (хто? що?) називає виконавця дії, підкреслюється однією суцільною лінією (═). Присудок (що робить? яким є?) — двома лініями (══).',
    example: 'Сонячний ранок (хто/що?) тихо будить (що робить?) місто.',
    feynmanPrompt: 'Знайдіть у простому реченні головну пару слів без якої воно розсиплеться.',
    keywords: 'підмет присудок члени речення означення додаток обставина',
  },
  {
    id: 'ukr_morphemes',
    term: 'Будова слова (Префікс · Корінь · Суфікс · Закінчення)',
    subjectId: 'ukrainian',
    category: 'term',
    summary: 'Закінчення (змінна частина слова), основа (усе крім закінчення), корінь (спільна частина споріднених слів), префікс (перед коренем), суфікс (після кореня).',
    example: 'при-кордон-н-ий: префікс при-, корінь -кордон-, суфікс -н-, закінчення -ий.',
    feynmanPrompt: 'З чого починають розбір слова за будовою: із закінчення чи з префікса?',
    keywords: 'морфема префікс корінь суфікс закінчення основа',
  },
  {
    id: 'hist_khortytsia_1556',
    term: 'Хортицький замок Дмитра Вишневецького (1556)',
    subjectId: 'history',
    category: 'term',
    summary: 'У 1556 році князь Дмитро Вишневецький (Байда) заснував на острові Мала Хортиця перше козацьке дерево-земляне укріплення — прототип Запорозької Січі.',
    example: 'Січень 1557 р. — 24-денна успішна оборона проти війська хана Девлет-Ґерая.',
    feynmanPrompt: 'Чому саме острів на Дніпрі був вигідним місцем для оборонної засіки?',
    keywords: 'хортиця вишневецький байда січ 1556 1557 козаки',
  },
  {
    id: 'phys_ohm_law',
    term: 'Закон Ома для ділянки кола (I = U / R)',
    subjectId: 'physics',
    category: 'formula',
    summary: 'Сила струму I прямо пропорційна напрузі U й обернено пропорційна опору R: I = U / R, звідси U = I · R та R = U / I.',
    example: 'При напрузі 12 В і опорі 4 Ом сила струму I = 12 / 4 = 3 А.',
    feynmanPrompt: 'Що станеться зі струмом, якщо напругу залишити незмінною, а опір подвоїти?',
    keywords: 'ом струм напруга опір коло',
  },
  {
    id: 'science_photosynthesis',
    term: 'Фотосинтез і газообмін рослин',
    subjectId: 'science',
    category: 'term',
    summary: 'Зелені рослини на світлі з вуглекислого газу (CO₂) та води утворюють органічні речовини (глюкозу) й виділяють кисень (O₂).',
    example: 'Хлорофіл у листках поглинає сонячну енергію для живлення рослини.',
    feynmanPrompt: 'Які три ресурси потрібні листку, щоб запустити «фабрику їжі»?',
    keywords: 'фотосинтез хлорофіл кисень рослина природа',
  },
  {
    id: 'info_binary',
    term: 'Двійкова система та 1 байт = 8 біт',
    subjectId: 'informatics',
    category: 'rule',
    summary: 'Комп’ютер зберігає інформацію у вигляді бітів (0 або 1). Послідовність із 8 бітів утворює 1 байт (2⁸ = 256 значень).',
    example: 'Число 13 у двійковій системі: 8 + 4 + 1 → 1101₂.',
    feynmanPrompt: 'Скільки різних станів можна закодувати 3 лампочками (3 бітами)?',
    keywords: 'біт байт двійкова система кодування',
  },
  {
    id: 'cyber_2fa',
    term: 'Двофакторна автентифікація (2FA) та фішинг',
    subjectId: 'cybersecurity',
    category: 'rule',
    summary: '2FA вимагає два незалежні підтвердження: пароль (те, що ви знаєте) + одноразовий код або ключ (те, що маєте). Фішинг — підроблені листи/сайти для викрадення даних.',
    example: 'Завжди перевіряйте домен сайту перед введенням пароля.',
    feynmanPrompt: 'Чому одного навіть складного пароля інколи замало без 2FA?',
    keywords: 'кібербезпека фішинг пароль 2fa домен',
  },
  {
    id: 'music_intervals',
    term: 'Музичні інтервали (Прима — Октава)',
    subjectId: 'music',
    category: 'term',
    summary: 'Інтервал — відстань між двома звуками за висотою: прима (1), секунда (2), терція (3), кварта (4), квінта (5), секста (6), септима (7), октава (8).',
    example: 'Від ноти До (C) до Соль (G) — чиста квінта (ч.5).',
    feynmanPrompt: 'Чим відрізняється квінта (5 ступенів) від октави (8 ступенів)?',
    keywords: 'інтервал квінта октава терція ноти лад',
  },
  {
    id: 'art_itten_colors',
    term: 'Кольорове коло Іттена та контрасти',
    subjectId: 'art',
    category: 'term',
    summary: 'Первинні кольори: червоний, жовтий, синій. Змішуючи їх парами, отримуємо вторинні (помаранчевий, зелений, фіолетовий). Протилежні в колі — комплементарні.',
    example: 'Синій та помаранчевий підсилюють виразність одне одного.',
    feynmanPrompt: 'Які три кольори неможливо отримати змішуванням інших фарб?',
    keywords: 'іттен колір первинні контраст перспектива',
  },
];

let seededOnce = false;

function extractDynamicCurriculumTerms(): Array<Omit<StoredGlossaryTerm, 'updatedAt'>> {
  const extracted: Array<Omit<StoredGlossaryTerm, 'updatedAt'>> = [];
  const grades = ContentLoaderService.getGrades();
  const seenIds = new Set<string>(BASE_GLOSSARY_SEEDS.map((s) => s.id));

  for (const grade of grades) {
    if (!grade.subjects.length) continue;
    for (const subj of grade.subjects) {
      const catId = subj.subjectCategory || subj.id;
      for (const ch of subj.chapters) {
        const blocks = ContentLoaderService.getPipelineForChapter(ch.id, subj.id) || [];
        for (const blk of blocks) {
          const blkType = String(blk.type);
          if (blkType === 'block_theory_rule' || blkType === 'theory') {
            const termId = `dyn_${ch.id}_${blk.id}`;
            if (seenIds.has(termId)) continue;
            seenIds.add(termId);
            const rawSummary =
              (blk as any).ruleSummary || (blk as any).summary || (blk as any).text || '';
            const cleanSummary = stripInlineMarkup(rawSummary).slice(0, 260);
            if (!cleanSummary && !(blk as any).formulaText) continue;

            extracted.push({
              id: termId,
              term: (blk as any).title || ch.title,
              subjectId: catId,
              category: (blk as any).formulaText ? 'formula' : 'rule',
              summary: [cleanSummary, (blk as any).formulaText].filter(Boolean).join(' · '),
              example: Array.isArray((blk as any).stepByStepBreakdown)
                ? stripInlineMarkup((blk as any).stepByStepBreakdown[0] || '')
                : undefined,
              feynmanPrompt: `Поясніть правило «${(blk as any).title || ch.title}» простими словами без підглядання у конспект.`,
              keywords: `${ch.title} ${(blk as any).title || ''} ${(blk as any).formulaText || ''}`.toLowerCase(),
            });
          }
        }
      }
    }
  }

  return extracted;
}

export class OfflineGlossaryService {
  public static async ensureIndexed(): Promise<StoredGlossaryTerm[]> {
    const now = Date.now();
    const seeds = [...BASE_GLOSSARY_SEEDS, ...extractDynamicCurriculumTerms()].map((item) => ({
      ...item,
      updatedAt: now,
    }));

    if (!seededOnce) {
      seededOnce = true;
      try {
        await db.upsertGlossaryTerms(seeds);
      } catch {
        // Fallback smoothly to in-memory seeds if IndexedDB unavailable
      }
    }

    try {
      const stored = await db.getAllGlossaryTerms();
      if (stored.length > 0) return stored;
    } catch {
      // Fallback
    }
    return seeds;
  }

  public static async searchTerms(
    query: string,
    subjectFilter: string = 'all',
    categoryFilter: GlossaryCategory | 'all' = 'all'
  ): Promise<StoredGlossaryTerm[]> {
    const all = await this.ensureIndexed();
    const q = query.trim().toLowerCase();
    const normalizedSubj = subjectFilter.replace(/^grade_\d+_/, '').toLowerCase();

    return all.filter((entry) => {
      if (normalizedSubj && normalizedSubj !== 'all' && entry.subjectId.toLowerCase() !== normalizedSubj) {
        return false;
      }
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = `${entry.term} ${entry.summary} ${entry.example || ''} ${entry.keywords || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  public static async getSrsQueue(): Promise<StoredSrsCard[]> {
    try {
      return await db.getAllSrsCards();
    } catch {
      return [];
    }
  }

  public static async scheduleSrsCard(params: {
    term: StoredGlossaryTerm;
    intervalDays: 1 | 3 | 7;
    feynmanNote: string;
    checklistDoneCount: number;
  }): Promise<StoredSrsCard> {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const existingList = await this.getSrsQueue();
    const prev = existingList.find((c) => c.termId === params.term.id);

    const nextCard: StoredSrsCard = {
      id: prev?.id || `srs_${params.term.id}`,
      termId: params.term.id,
      termTitle: params.term.term,
      subjectId: params.term.subjectId,
      intervalDays: params.intervalDays,
      repetitions: (prev?.repetitions || 0) + 1,
      feynmanNote: params.feynmanNote.trim(),
      checklistDoneCount: params.checklistDoneCount,
      lastReviewedAt: now,
      nextReviewAt: now + params.intervalDays * dayMs,
    };

    try {
      await db.upsertSrsCard(nextCard);
    } catch {
      // Safe fallback
    }
    return nextCard;
  }
}
