import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { StoredGlossaryTerm, StoredSrsCard } from '../../core/storage/db';
import { GlossaryCategory, OfflineGlossaryService } from '../../services/offlineGlossaryService';
import { ContentLoaderService } from '../../services/contentLoaderService';

export interface OfflineGlossaryEntry {
  id: string;
  term: string;
  subjectId: string;
  summary: string;
}

interface OfflineGlossaryModalProps {
  isOpen: boolean;
  initialQuery?: string;
  initialSubjectId?: string;
  onClose: () => void;
}

const CATEGORY_LABELS: Array<{ id: GlossaryCategory | 'all'; label: string }> = [
  { id: 'all', label: 'Усі' },
  { id: 'formula', label: '📐 Формули' },
  { id: 'orthogram', label: '✍️ Орфограми' },
  { id: 'rule', label: '📖 Правила' },
  { id: 'term', label: '🏷️ Терміни' },
];

const FEYNMAN_CHECKLIST = [
  'Назвав(ла) головну суть простими словами',
  'Навів(ла) власний життєвий приклад',
  'Перевірив(ла), де найчастіше помиляються',
];

function formatRelativeDue(nextReviewAt: number): string {
  const diffMs = nextReviewAt - Date.now();
  if (diffMs <= 0) return 'Пора повторити зараз';
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `Через ${Math.max(1, hours)} год`;
  const days = Math.round(hours / 24);
  return `Через ${days} дн.`;
}

export const OfflineGlossaryModal: React.FC<OfflineGlossaryModalProps> = ({
  isOpen,
  initialQuery = '',
  initialSubjectId = '',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'dictionary' | 'srs'>('dictionary');
  const [query, setQuery] = useState(initialQuery);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<GlossaryCategory | 'all'>('all');
  const [terms, setTerms] = useState<StoredGlossaryTerm[]>([]);
  const [srsCards, setSrsCards] = useState<StoredSrsCard[]>([]);

  // Feynman practice editor state
  const [selectedTermForFeynman, setSelectedTermForFeynman] = useState<StoredGlossaryTerm | null>(null);
  const [feynmanNote, setFeynmanNote] = useState('');
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery || '');
    const normalizedSubj = initialSubjectId
      ? initialSubjectId.replace(/^grade_\d+_/, '')
      : 'all';
    setSubjectFilter(normalizedSubj || 'all');
    setStatusMsg(null);
  }, [isOpen, initialQuery, initialSubjectId]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    OfflineGlossaryService.searchTerms(query, subjectFilter, categoryFilter).then((res) => {
      if (!cancelled) setTerms(res);
    });
    OfflineGlossaryService.getSrsQueue().then((cards) => {
      if (!cancelled) setSrsCards(cards);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, query, subjectFilter, categoryFilter]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  const dueCount = useMemo(
    () => srsCards.filter((c) => c.nextReviewAt <= Date.now()).length,
    [srsCards]
  );

  if (!isOpen) return null;

  const subjectOptions = [
    { id: 'all', name: 'Усі предмети' },
    { id: 'math', name: 'Математика' },
    { id: 'ukrainian', name: 'Українська мова' },
    { id: 'history', name: 'Історія України' },
    { id: 'science', name: 'Природознавство' },
    { id: 'physics', name: 'Фізика' },
    { id: 'informatics', name: 'Інформатика' },
    { id: 'cybersecurity', name: 'Кібербезпека' },
    { id: 'music', name: 'Музичне мистецтво' },
    { id: 'art', name: 'Образотворче мистецтво' },
  ];

  const startFeynmanForTerm = (term: StoredGlossaryTerm) => {
    const existing = srsCards.find((c) => c.termId === term.id);
    setSelectedTermForFeynman(term);
    setFeynmanNote(existing?.feynmanNote || '');
    setChecks([false, false, false]);
    setStatusMsg(null);
    setActiveTab('srs');
  };

  const handleSaveSchedule = async (intervalDays: 1 | 3 | 7) => {
    if (!selectedTermForFeynman) return;
    const doneCount = checks.filter(Boolean).length;
    await OfflineGlossaryService.scheduleSrsCard({
      term: selectedTermForFeynman,
      intervalDays,
      feynmanNote,
      checklistDoneCount: doneCount,
    });
    const updated = await OfflineGlossaryService.getSrsQueue();
    setSrsCards(updated);
    setStatusMsg(
      `✅ Збережено офлайн! Нагадування для «${selectedTermForFeynman.term}» встановлено через ${intervalDays} дн.`
    );
  };

  return (
    <div
      className="modal-overlay no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Офлайн-довідник і черга повторень"
      onClick={onClose}
    >
      <div
        className="modal-content max-w-2xl max-h-[88dvh] flex flex-col gap-3 overflow-hidden p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[var(--primary-dark)]">
              📚 Офлайн-довідник і Фейнман / SRS
            </h2>
            <p className="text-[11px] font-semibold text-[var(--text-muted)]">
              Працює 100% без інтернету · Локальний індекс IndexedDB
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose} aria-label="Закрити довідник">
            ✕
          </Button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('dictionary')}
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] border text-xs font-extrabold cursor-pointer transition-colors ${
              activeTab === 'dictionary'
                ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)]'
                : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)]'
            }`}
          >
            📖 Довідник ({terms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('srs')}
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] border text-xs font-extrabold cursor-pointer transition-colors ${
              activeTab === 'srs'
                ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-text)]'
                : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)]'
            }`}
          >
            🔁 Фейнман + Повторення ({srsCards.length}
            {dueCount > 0 ? ` · ${dueCount} пора` : ''})
          </button>
        </div>

        {activeTab === 'dictionary' ? (
          <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
            {/* Search & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук орфограми, формули, терміна..."
                className="input-field py-2 px-3 text-xs sm:col-span-2"
                autoFocus
              />
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="input-field py-2 px-2.5 text-xs"
                aria-label="Фільтр за предметом"
              >
                {subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1">
              {CATEGORY_LABELS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] font-bold cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
                      : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {terms.length === 0 ? (
                <div className="p-6 text-center rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] text-xs text-[var(--text-muted)] font-semibold">
                  За запитом «{query}» нічого не знайдено. Спробуйте інше слово або змініть фільтр предмета.
                </div>
              ) : (
                terms.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] space-y-1.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">
                          {ContentLoaderService.getSubjectCategoryName(item.subjectId)} ·{' '}
                          {item.category === 'formula'
                            ? 'Формула'
                            : item.category === 'orthogram'
                            ? 'Орфограма'
                            : item.category === 'rule'
                            ? 'Правило'
                            : 'Термін'}
                        </div>
                        <h3 className="text-xs sm:text-sm font-extrabold text-[var(--primary-dark)]">
                          {item.term}
                        </h3>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startFeynmanForTerm(item)}
                      >
                        🧠 Пояснити (SRS)
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--text)] leading-relaxed font-medium">
                      {item.summary}
                    </p>
                    {item.example && (
                      <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono text-[var(--primary-dark)]">
                        Приклад: {item.example}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {statusMsg && (
              <div className="status-panel status-panel--success text-xs">{statusMsg}</div>
            )}

            {selectedTermForFeynman ? (
              <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--hl-bg)] border border-[var(--hl-border)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--hl-text)]">
                      Метод Фейнмана · Самоперевірка
                    </div>
                    <h3 className="text-sm font-extrabold text-[var(--text)]">
                      {selectedTermForFeynman.term}
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTermForFeynman(null)}
                  >
                    До списку
                  </Button>
                </div>

                <p className="text-xs font-semibold text-[var(--text)] bg-[var(--surface)] p-2.5 rounded-[var(--radius-sm)] border border-[var(--border)]">
                  {selectedTermForFeynman.feynmanPrompt ||
                    'Поясніть правило своїми словами так, ніби пояснюєте молодшому другу.'}
                </p>

                <textarea
                  value={feynmanNote}
                  onChange={(e) => setFeynmanNote(e.target.value)}
                  rows={3}
                  placeholder="Напишіть власне просте пояснення і 1 приклад..."
                  className="input-field text-xs py-2 px-3"
                />

                <div className="space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase">
                    Чекліст розуміння:
                  </div>
                  {FEYNMAN_CHECKLIST.map((label, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 text-xs font-bold text-[var(--text)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checks[idx]}
                        onChange={() =>
                          setChecks((prev) => prev.map((v, i) => (i === idx ? !v : v)))
                        }
                        className="accent-[var(--accent)] w-4 h-4 cursor-pointer"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
                  <div className="text-[11px] font-extrabold text-[var(--text-muted)]">
                    Нагадати правило через:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleSaveSchedule(1)}>
                      1 день (складно)
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleSaveSchedule(3)}>
                      3 дні (середньо)
                    </Button>
                    <Button type="button" variant="primary" size="sm" onClick={() => handleSaveSchedule(7)}>
                      7 днів (впевнено)
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--surface-alt)] border border-[var(--border)] text-xs text-[var(--text-muted)] font-semibold">
                Оберіть будь-який термін у «Довіднику» кнопкою «🧠 Пояснити (SRS)», щоб потренувати метод Фейнмана й запланувати інтервальне повторення (1–3–7 днів).
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
                Черга інтервального повторення ({srsCards.length})
              </div>
              {srsCards.length === 0 ? (
                <div className="p-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] text-center">
                  Черга порожня — додайте першу картку з довідника!
                </div>
              ) : (
                srsCards.map((card) => {
                  const isDue = card.nextReviewAt <= Date.now();
                  return (
                    <div
                      key={card.id}
                      className={`p-3 rounded-[var(--radius-sm)] border flex flex-wrap items-center justify-between gap-2 ${
                        isDue
                          ? 'bg-[var(--hl-bg)] border-[var(--hl-border)]'
                          : 'bg-[var(--surface-alt)] border-[var(--border)]'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-[var(--text)] truncate">
                          {card.termTitle}
                        </div>
                        <div className="text-[11px] font-semibold text-[var(--text-muted)]">
                          Інтервал: {card.intervalDays} дн. · Повторень: {card.repetitions} ·{' '}
                          <span className="font-extrabold">{formatRelativeDue(card.nextReviewAt)}</span>
                        </div>
                        {card.feynmanNote && (
                          <div className="text-[11px] italic text-[var(--text)] truncate">
                            «{card.feynmanNote}»
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant={isDue ? 'primary' : 'outline'}
                        size="sm"
                        onClick={async () => {
                          const all = await OfflineGlossaryService.ensureIndexed();
                          const found = all.find((t) => t.id === card.termId);
                          if (found) startFeynmanForTerm(found);
                        }}
                      >
                        {isDue ? 'Повторити зараз' : 'Оновити'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
