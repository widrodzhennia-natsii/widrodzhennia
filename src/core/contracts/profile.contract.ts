/**
 * Unified Contract specification for Student Profile, Resources, Progress & Extensible Strengths Radar
 */

export type StrengthCategory = 'cognitive' | 'stem' | 'humanities' | 'social';

export interface StrengthMeta {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  category: StrengthCategory;
  defaultValue: number;
}

export const STRENGTH_REGISTRY: StrengthMeta[] = [
  {
    key: 'analytics',
    label: 'Аналітика',
    shortLabel: 'Аналітика',
    icon: '🧮',
    description: 'Точні обчислення, робота з даними, числовими закономірностями та формулами.',
    category: 'stem',
    defaultValue: 10,
  },
  {
    key: 'spatial',
    label: 'Просторове бачення',
    shortLabel: 'Простір',
    icon: '📐',
    description: 'Геометрія, креслення, системи координат, траєкторії та візуальні моделі.',
    category: 'stem',
    defaultValue: 10,
  },
  {
    key: 'criticalThinking',
    label: 'Критичне мислення',
    shortLabel: 'Мислення',
    icon: '🧠',
    description: 'Тести на розуміння, пошук суперечностей та причинно-наслідкові зв’язки.',
    category: 'cognitive',
    defaultValue: 10,
  },
  {
    key: 'curiosity',
    label: 'Допитливість',
    shortLabel: 'Допитливість',
    icon: '🔍',
    description: 'Дослідження поглиблених блоків, експерименти зі слайдерами теорії та запитання.',
    category: 'cognitive',
    defaultValue: 10,
  },
  {
    key: 'engineering',
    label: 'Інженерна кмітливість',
    shortLabel: 'Інженерія',
    icon: '⚙️',
    description: 'Робота в інтерактивних симуляторах, підбір параметрів та налагодження систем.',
    category: 'stem',
    defaultValue: 10,
  },
  {
    key: 'linguistic',
    label: 'Мовне чуття',
    shortLabel: 'Мовлення',
    icon: '✍️',
    description: 'Розбір речень, морфемний аналіз, орфографічна пильність і точність формулювань.',
    category: 'humanities',
    defaultValue: 10,
  },
  {
    key: 'resilience',
    label: 'Стійкість',
    shortLabel: 'Стійкість',
    icon: '🛡️',
    description: 'Подолання складних завдань, перевірка гіпотез і завершення робіт без здачі.',
    category: 'cognitive',
    defaultValue: 10,
  },
  {
    key: 'selfRegulation',
    label: 'Саморегуляція',
    shortLabel: 'Саморегуляція',
    icon: '🌿',
    description: 'Уважність, соматичні дихальні паузи та спокійне осмислення когнітивних затримок.',
    category: 'social',
    defaultValue: 10,
  },
  {
    key: 'collaboration',
    label: 'Командна взаємодія',
    shortLabel: 'Співпраця',
    icon: '🤝',
    description: 'Емпатія, діалогові рішення, взаємодопомога та спільні проєктні завдання.',
    category: 'social',
    defaultValue: 10,
  },
  {
    key: 'leadership',
    label: 'Лідерство та координація',
    shortLabel: 'Лідерство',
    icon: '🧭',
    description: 'Прийняття рішень у ролі пілота чи штурмана, координація дій та відповідальність за спільний результат.',
    category: 'social',
    defaultValue: 10,
  },
];

export type PersonalityTraits = Record<string, number>;

const LEGACY_TRAIT_ALIASES: Record<string, string> = {
  logic: 'analytics',
  spatialIntuition: 'spatial',
};

export const resolveTraitKey = (rawKey: string): string => {
  return LEGACY_TRAIT_ALIASES[rawKey] || rawKey;
};

export const createDefaultTraits = (): PersonalityTraits => {
  const base: PersonalityTraits = {};
  for (const meta of STRENGTH_REGISTRY) {
    base[meta.key] = meta.defaultValue;
  }
  return base;
};

export const normalizeTraits = (raw?: Record<string, unknown>): PersonalityTraits => {
  const normalized = createDefaultTraits();
  if (!raw || typeof raw !== 'object') return normalized;

  for (const [key, val] of Object.entries(raw)) {
    const targetKey = resolveTraitKey(key);
    const num = Number(val);
    if (Number.isFinite(num)) {
      // Preserve highest value if migrating from legacy alias alongside canonical key
      normalized[targetKey] = Math.max(normalized[targetKey] ?? 0, Math.round(num));
    }
  }
  return normalized;
};

export const generateProfileSeed = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let seed = 'NUSH-';
  for (let i = 0; i < 6; i++) {
    seed += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return seed;
};

export interface JournalEntry {
  id: string;
  timestamp: number;
  taskTitle: string;
  reflectionText: string;
  traitBoosted: string;
}

export interface SubjectChapterPointer {
  currentChapterIndex: number;
  currentTaskIndex: number;
}

export interface StudentProfile {
  id: string;
  profileSeed: string;
  studentName: string;
  avatarId: string;
  currentGrade: number;
  selectedSubjectId: string;
  resources: {
    wood: number;
    stone: number;
    energy: number;
  };
  traits: PersonalityTraits;
  totalXp: number;
  startedQuestIds: string[];
  completedQuestIds: string[];
  completedTaskIds: string[];
  unlockedHintTaskIds: string[];
  chapterProgressBySubject: Record<string, SubjectChapterPointer>;
  journal: JournalEntry[];
}
