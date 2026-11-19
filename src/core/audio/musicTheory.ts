/**
 * Shared Musical Theory, Dual Ukrainian + International Notation,
 * Authentic Note/Rest Duration Symbols, Grade-Band Curriculum Profiles (1–12),
 * and Extensible Instrument Registry Foundation.
 */

export type MusicScaleId = 'pentatonic' | 'major' | 'minor';
export type GradeBandId = '1-4' | '5-7' | '8-12';
export type NoteDurationId = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
export type RhythmBeatType = 'strong' | 'weak' | 'sub' | 'rest';
export type TimeSignatureId = '2/4' | '3/4' | '4/4' | '6/8';
export type SubdivisionId = 'quarter' | 'eighth' | 'mixed';

export type ActiveInstrumentTimbreId =
  | 'piano'
  | 'marimba'
  | 'plucked_bandura'
  | 'bass_acoustic'
  | 'bass_synth'
  | 'flute_woodwind'
  | 'brass_horn';
export type PlannedInstrumentTimbreId = ActiveInstrumentTimbreId;

export interface InstrumentDescriptor {
  id: PlannedInstrumentTimbreId;
  uaName: string;
  intlName: string;
  family: 'keyboard' | 'percussion' | 'strings' | 'bass' | 'wind';
  status: 'active' | 'planned';
  description: string;
}

/**
 * Extensible instrument registry:
 * Currently active timbres are 'piano' and 'marimba'.
 * Additional timbres (including acoustic/synth bass, strings, wind) are registered as
 * 'planned' structural hooks for future Music Studio expansion.
 */
export const INSTRUMENT_REGISTRY: InstrumentDescriptor[] = [
  {
    id: 'piano',
    uaName: 'Фортепіано',
    intlName: 'Piano',
    family: 'keyboard',
    status: 'active',
    description: 'Теплий гармонічний тембр із природним загасанням обертонів.',
  },
  {
    id: 'marimba',
    uaName: 'Маримба',
    intlName: 'Marimba',
    family: 'percussion',
    status: 'active',
    description: 'Чітка дерев’яна атака, зручна для швидких ритмів і восьмих доль.',
  },
  {
    id: 'plucked_bandura',
    uaName: 'Бандура / Арфа',
    intlName: 'Plucked Harp',
    family: 'strings',
    status: 'active',
    description: 'Щипковий струнний тембр із м’яким обертоновим переливом та арпеджіо.',
  },
  {
    id: 'bass_acoustic',
    uaName: 'Акустичний бас',
    intlName: 'Acoustic Bass',
    family: 'bass',
    status: 'active',
    description: 'Глибокий октавний бас із м’яким щипком і чистим низьким регістром.',
  },
  {
    id: 'bass_synth',
    uaName: 'Теплий саб-бас',
    intlName: 'Warm Sub Bass',
    family: 'bass',
    status: 'active',
    description: 'Октавна опора ритму з низькочастотною фільтрацією.',
  },
  {
    id: 'flute_woodwind',
    uaName: 'Сопілка / Флейта',
    intlName: 'Woodwind Flute',
    family: 'wind',
    status: 'active',
    description: 'Плавний духовий тембр із керованою тривалістю та дихальним вібрато.',
  },
  {
    id: 'brass_horn',
    uaName: 'Валторна / Мідні',
    intlName: 'Soft Horn',
    family: 'wind',
    status: 'active',
    description: 'М’який оркестровий мідний тембр для виразних фраз.',
  },
];

export const ACTIVE_INSTRUMENTS = INSTRUMENT_REGISTRY.filter(
  (inst): inst is InstrumentDescriptor & { id: ActiveInstrumentTimbreId } =>
    inst.status === 'active'
);

export interface MusicNoteDef {
  id: string;
  uaLabel: string;
  intlLabel: string;
  dualLabel: string;
  degree: string;
  freq: number;
  heightPct: number;
  /** Diatonic steps above C4 (C4 = 0, D4 = 1, ..., C5 = 7) for 5-line treble staff placement */
  staffStep: number;
  isFlat?: boolean;
  keyHint?: string;
}

export const CHROMATIC_OR_DIATONIC_NOTES: MusicNoteDef[] = [
  {
    id: 'До',
    uaLabel: 'До',
    intlLabel: 'C4',
    dualLabel: 'До / C4',
    degree: 'I',
    freq: 261.63,
    heightPct: 24,
    staffStep: 0,
    keyHint: 'A',
  },
  {
    id: 'Ре',
    uaLabel: 'Ре',
    intlLabel: 'D4',
    dualLabel: 'Ре / D4',
    degree: 'II',
    freq: 293.66,
    heightPct: 33,
    staffStep: 1,
    keyHint: 'S',
  },
  {
    id: 'Мі♭',
    uaLabel: 'Мі♭',
    intlLabel: 'E♭4',
    dualLabel: 'Мі♭ / E♭4',
    degree: 'III♭',
    freq: 311.13,
    heightPct: 39,
    staffStep: 2,
    isFlat: true,
    keyHint: 'E',
  },
  {
    id: 'Мі',
    uaLabel: 'Мі',
    intlLabel: 'E4',
    dualLabel: 'Мі / E4',
    degree: 'III',
    freq: 329.63,
    heightPct: 43,
    staffStep: 2,
    keyHint: 'D',
  },
  {
    id: 'Фа',
    uaLabel: 'Фа',
    intlLabel: 'F4',
    dualLabel: 'Фа / F4',
    degree: 'IV',
    freq: 349.23,
    heightPct: 52,
    staffStep: 3,
    keyHint: 'F',
  },
  {
    id: 'Соль',
    uaLabel: 'Соль',
    intlLabel: 'G4',
    dualLabel: 'Соль / G4',
    degree: 'V',
    freq: 392.0,
    heightPct: 62,
    staffStep: 4,
    keyHint: 'G',
  },
  {
    id: 'Ля♭',
    uaLabel: 'Ля♭',
    intlLabel: 'A♭4',
    dualLabel: 'Ля♭ / A♭4',
    degree: 'VI♭',
    freq: 415.3,
    heightPct: 68,
    staffStep: 5,
    isFlat: true,
    keyHint: 'Y',
  },
  {
    id: 'Ля',
    uaLabel: 'Ля',
    intlLabel: 'A4',
    dualLabel: 'Ля / A4',
    degree: 'VI',
    freq: 440.0,
    heightPct: 73,
    staffStep: 5,
    keyHint: 'H',
  },
  {
    id: 'Сі♭',
    uaLabel: 'Сі♭',
    intlLabel: 'B♭4',
    dualLabel: 'Сі♭ / B♭4',
    degree: 'VII♭',
    freq: 466.16,
    heightPct: 79,
    staffStep: 6,
    isFlat: true,
    keyHint: 'U',
  },
  {
    id: 'Сі',
    uaLabel: 'Сі',
    intlLabel: 'B4',
    dualLabel: 'Сі / B4',
    degree: 'VII',
    freq: 493.88,
    heightPct: 84,
    staffStep: 6,
    keyHint: 'J',
  },
  {
    id: 'До5',
    uaLabel: 'До5',
    intlLabel: 'C5',
    dualLabel: 'До5 / C5',
    degree: 'VIII',
    freq: 523.25,
    heightPct: 94,
    staffStep: 7,
    keyHint: 'K',
  },
];

const SCALE_NOTE_IDS: Record<MusicScaleId, string[]> = {
  pentatonic: ['До', 'Ре', 'Мі', 'Соль', 'Ля', 'До5'],
  major: ['До', 'Ре', 'Мі', 'Фа', 'Соль', 'Ля', 'Сі', 'До5'],
  minor: ['До', 'Ре', 'Мі♭', 'Фа', 'Соль', 'Ля♭', 'Сі♭', 'До5'],
};

export const getScaleNotes = (scale: MusicScaleId): MusicNoteDef[] => {
  const allowed = new Set(SCALE_NOTE_IDS[scale] || SCALE_NOTE_IDS.pentatonic);
  return CHROMATIC_OR_DIATONIC_NOTES.filter((n) => allowed.has(n.id));
};

export const findNoteDef = (idOrName: string): MusicNoteDef | undefined => {
  const norm = normalizeNoteId(idOrName);
  return CHROMATIC_OR_DIATONIC_NOTES.find((n) => n.id === norm);
};

export const normalizeNoteId = (raw: string): string => {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (s === 'c' || s === 'c4' || s === 'до' || s === 'до4') return 'До';
  if (s === 'd' || s === 'd4' || s === 'ре' || s === 'ре4') return 'Ре';
  if (s === 'eb' || s === 'eb4' || s === 'e♭' || s === 'e♭4' || s === 'мі♭' || s === 'мі-бемоль') return 'Мі♭';
  if (s === 'e' || s === 'e4' || s === 'мі' || s === 'мі4') return 'Мі';
  if (s === 'f' || s === 'f4' || s === 'фа' || s === 'фа4') return 'Фа';
  if (s === 'g' || s === 'g4' || s === 'соль' || s === 'соль4') return 'Соль';
  if (s === 'ab' || s === 'ab4' || s === 'a♭' || s === 'a♭4' || s === 'ля♭' || s === 'ля-бемоль') return 'Ля♭';
  if (s === 'a' || s === 'a4' || s === 'ля' || s === 'ля4') return 'Ля';
  if (s === 'bb' || s === 'bb4' || s === 'b♭' || s === 'b♭4' || s === 'сі♭' || s === 'сі-бемоль') return 'Сі♭';
  if (s === 'b' || s === 'b4' || s === 'сі' || s === 'сі4') return 'Сі';
  if (s === 'c5' || s === 'до5' || s === 'до²') return 'До5';
  return raw;
};

export interface NoteDurationDef {
  id: NoteDurationId;
  beats: number;
  uaName: string;
  intlName: string;
  ratioLabel: string;
  symbolText: string;
}

export const NOTE_DURATION_DEFS: Record<NoteDurationId, NoteDurationDef> = {
  whole: {
    id: 'whole',
    beats: 4,
    uaName: 'Ціла',
    intlName: 'Whole',
    ratioLabel: '1/1',
    symbolText: '𝅝',
  },
  half: {
    id: 'half',
    beats: 2,
    uaName: 'Половинна',
    intlName: 'Half',
    ratioLabel: '1/2',
    symbolText: '𝅗𝅥',
  },
  quarter: {
    id: 'quarter',
    beats: 1,
    uaName: 'Четвертна',
    intlName: 'Quarter',
    ratioLabel: '1/4',
    symbolText: '♩',
  },
  eighth: {
    id: 'eighth',
    beats: 0.5,
    uaName: 'Восьма',
    intlName: 'Eighth',
    ratioLabel: '1/8',
    symbolText: '♪',
  },
  sixteenth: {
    id: 'sixteenth',
    beats: 0.25,
    uaName: 'Шістнадцята',
    intlName: 'Sixteenth',
    ratioLabel: '1/16',
    symbolText: '♬',
  },
};

export const DURATION_DEFAULT_BY_SUBDIVISION: Record<SubdivisionId, NoteDurationId> = {
  quarter: 'quarter',
  eighth: 'eighth',
  mixed: 'quarter',
};

export interface RhythmBeatMeta {
  id: RhythmBeatType;
  uaLabel: string;
  intlLabel: string;
  shortDual: string;
  beats: number;
  durationId: NoteDurationId | 'rest';
}

export const RHYTHM_BEAT_META: Record<RhythmBeatType, RhythmBeatMeta> = {
  strong: {
    id: 'strong',
    uaLabel: 'Сильна доля',
    intlLabel: 'Downbeat (>)',
    shortDual: 'ТУК · Accent',
    beats: 1,
    durationId: 'quarter',
  },
  weak: {
    id: 'weak',
    uaLabel: 'Легка доля',
    intlLabel: 'Quarter (1/4)',
    shortDual: 'ТА · 1/4',
    beats: 1,
    durationId: 'quarter',
  },
  sub: {
    id: 'sub',
    uaLabel: 'Дрібна доля',
    intlLabel: 'Eighth (1/8)',
    shortDual: 'Ті-ті · 1/8',
    beats: 0.5,
    durationId: 'eighth',
  },
  rest: {
    id: 'rest',
    uaLabel: 'Пауза',
    intlLabel: 'Rest',
    shortDual: 'Пауза / Rest',
    beats: 1,
    durationId: 'rest',
  },
};

export interface GradeMusicProfile {
  band: GradeBandId;
  titleUa: string;
  defaultScale: MusicScaleId;
  defaultTempoBpm: number;
  minBpm: number;
  maxBpm: number;
  allowedDurations: NoteDurationId[];
  allowedMeters: TimeSignatureId[];
  allowSubdivisionBeat: boolean;
  allowSpeedControl: boolean;
}

export const GRADE_MUSIC_PROFILES: Record<GradeBandId, GradeMusicProfile> = {
  '1-4': {
    band: '1-4',
    titleUa: '1–4 класи · Пульс і пентатоніка',
    defaultScale: 'pentatonic',
    defaultTempoBpm: 88,
    minBpm: 68,
    maxBpm: 120,
    allowedDurations: ['half', 'quarter'],
    allowedMeters: ['2/4', '4/4'],
    allowSubdivisionBeat: false,
    allowSpeedControl: true,
  },
  '5-7': {
    band: '5-7',
    titleUa: '5–7 класи · Лади, восьмі та розміри',
    defaultScale: 'pentatonic',
    defaultTempoBpm: 96,
    minBpm: 68,
    maxBpm: 148,
    allowedDurations: ['half', 'quarter', 'eighth'],
    allowedMeters: ['2/4', '3/4', '4/4'],
    allowSubdivisionBeat: true,
    allowSpeedControl: true,
  },
  '8-12': {
    band: '8-12',
    titleUa: '8–12 класи · Складні ритми й темп',
    defaultScale: 'major',
    defaultTempoBpm: 112,
    minBpm: 60,
    maxBpm: 176,
    allowedDurations: ['whole', 'half', 'quarter', 'eighth', 'sixteenth'],
    allowedMeters: ['2/4', '3/4', '4/4', '6/8'],
    allowSubdivisionBeat: true,
    allowSpeedControl: true,
  },
};

export const inferGradeBandFromId = (gradeId?: string): GradeBandId => {
  const match = String(gradeId || '').match(/\d+/);
  const num = match ? Number(match[0]) : 5;
  if (num >= 1 && num <= 4) return '1-4';
  if (num >= 8) return '8-12';
  return '5-7';
};
