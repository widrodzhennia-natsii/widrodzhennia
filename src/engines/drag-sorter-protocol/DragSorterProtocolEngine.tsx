import React, { useEffect, useMemo, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';

export interface SorterBasketConfig {
  id: string;
  label: string;
  symbol?: string;
}

export interface SorterItemConfig {
  id: string;
  text: string;
  targetBasketId?: string;
}

export interface ProtocolStepConfig {
  id: string;
  text: string;
  hint?: string;
}

export interface DragSorterProtocolConfig {
  mode?: 'baskets' | 'protocol';
  title?: string;
  instruction?: string;
  baskets?: SorterBasketConfig[];
  items?: SorterItemConfig[];
  steps?: ProtocolStepConfig[];
}

const DEFAULT_SYMBOLS = ['●', '◆', '▲', '■', '✦'];
const BORDER_STYLES: Array<'solid' | 'dashed' | 'dotted'> = ['solid', 'dashed', 'dotted'];

function deterministicShuffle<T extends { id: string }>(arr: T[], seedStr: string): T[] {
  if (arr.length <= 1) return [...arr];
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const nextRand = () => {
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  // Never start already solved in protocol mode
  const isAlreadySolved = copy.every((item, idx) => item.id === arr[idx].id);
  if (isAlreadySolved && copy.length >= 2) {
    [copy[0], copy[copy.length - 1]] = [copy[copy.length - 1], copy[0]];
  }
  return copy;
}

export const DragSorterProtocolEngine: React.FC<EngineProps<DragSorterProtocolConfig>> = ({
  config,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const hasBaskets = Array.isArray(config.baskets) && config.baskets.length > 0;
  const resolvedMode: 'baskets' | 'protocol' =
    config.mode || (hasBaskets ? 'baskets' : 'protocol');

  const baskets: SorterBasketConfig[] = useMemo(() => {
    if (Array.isArray(config.baskets) && config.baskets.length > 0) {
      return config.baskets;
    }
    return [
      { id: 'safe', label: 'Безпечно', symbol: '●' },
      { id: 'risk', label: 'Загроза', symbol: '▲' },
    ];
  }, [config.baskets]);

  const basketItems: SorterItemConfig[] = useMemo(() => {
    const raw =
      Array.isArray(config.items) && config.items.length > 0
        ? config.items
        : [
            { id: 'i1', text: 'Офіційний домен школи (.edu.ua)', targetBasketId: baskets[0]?.id || 'safe' },
            { id: 'i2', text: 'Лист «Виграш 10 000 ₴ — введіть пароль картки»', targetBasketId: baskets[1]?.id || baskets[0]?.id || 'risk' },
          ];
    return deterministicShuffle(raw, `${config.title || ''}:${raw.map((x) => x.id).join(',')}`);
  }, [config.items, config.title, baskets]);

  const targetProtocolSteps: ProtocolStepConfig[] = useMemo(() => {
    if (Array.isArray(config.steps) && config.steps.length > 0) {
      return config.steps;
    }
    if (Array.isArray(config.items) && config.items.length > 0) {
      return config.items.map((it) => ({ id: it.id, text: it.text }));
    }
    return [
      { id: 's1', text: 'Не переходьте за підозрілим посиланням' },
      { id: 's2', text: 'Збережіть скріншот повідомлення' },
      { id: 's3', text: 'Повідомте дорослих або вчителя' },
    ];
  }, [config.steps, config.items]);

  // State for Baskets Mode: maps itemId -> basketId | null
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [mismatchedIds, setMismatchedIds] = useState<string[]>([]);

  // State for Protocol Mode: ordered step IDs
  const [orderedSteps, setOrderedSteps] = useState<ProtocolStepConfig[]>(() =>
    deterministicShuffle(targetProtocolSteps, targetProtocolSteps.map((s) => s.id).join('|'))
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSuccessState, setIsSuccessState] = useState(false);

  useEffect(() => {
    const emptyMap: Record<string, string | null> = {};
    basketItems.forEach((it) => {
      emptyMap[it.id] = null;
    });
    setAssignments(emptyMap);
    setSelectedItemId(null);
    setMismatchedIds([]);
    setOrderedSteps(
      deterministicShuffle(targetProtocolSteps, targetProtocolSteps.map((s) => s.id).join('|'))
    );
    setSelectedStepId(null);
    setFeedback(null);
    setIsSuccessState(false);
  }, [resolvedMode, basketItems, targetProtocolSteps]);

  const moveItemToBasket = (itemId: string, basketId: string | null) => {
    if (isReadOnly) return;
    setAssignments((prev) => ({ ...prev, [itemId]: basketId }));
    setSelectedItemId(null);
    setDraggedId(null);
    setMismatchedIds((prev) => prev.filter((id) => id !== itemId));
    setFeedback(null);
    setIsSuccessState(false);
  };

  const moveProtocolStep = (index: number, direction: -1 | 1) => {
    if (isReadOnly) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= orderedSteps.length) return;
    setOrderedSteps((prev) => {
      const next = [...prev];
      [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
      return next;
    });
    setMismatchedIds([]);
    setFeedback(null);
    setIsSuccessState(false);
  };

  const handleProtocolDropOrSwap = (targetIdx: number, sourceStepId?: string | null) => {
    if (isReadOnly) return;
    const srcId = sourceStepId ?? draggedId ?? selectedStepId;
    if (!srcId) return;
    const srcIdx = orderedSteps.findIndex((s) => s.id === srcId);
    if (srcIdx === -1 || srcIdx === targetIdx) {
      setSelectedStepId(null);
      setDraggedId(null);
      return;
    }
    setOrderedSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(srcIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setSelectedStepId(null);
    setDraggedId(null);
    setMismatchedIds([]);
    setFeedback(null);
    setIsSuccessState(false);
  };

  const handleReset = () => {
    if (isReadOnly) return;
    if (resolvedMode === 'baskets') {
      const emptyMap: Record<string, string | null> = {};
      basketItems.forEach((it) => {
        emptyMap[it.id] = null;
      });
      setAssignments(emptyMap);
      setSelectedItemId(null);
    } else {
      setOrderedSteps(
        deterministicShuffle(targetProtocolSteps, targetProtocolSteps.map((s) => s.id).join('|'))
      );
      setSelectedStepId(null);
    }
    setMismatchedIds([]);
    setFeedback(null);
    setIsSuccessState(false);
  };

  const handleVerify = () => {
    if (resolvedMode === 'baskets') {
      const unassigned = basketItems.filter((it) => !assignments[it.id]);
      if (unassigned.length > 0) {
        setIsSuccessState(false);
        setFeedback(`💡 Спочатку розподіліть усі картки по категоріях (залишилось: ${unassigned.length}).`);
        return;
      }

      const wrong = basketItems.filter((it) => assignments[it.id] !== it.targetBasketId);
      if (wrong.length === 0) {
        setMismatchedIds([]);
        setIsSuccessState(true);
        setFeedback(`🎯 Бездоганно! Усі ${basketItems.length} карток розподілено правильно.`);
        onSubmitAnswer?.(assignments);
      } else {
        setMismatchedIds(wrong.map((w) => w.id));
        setIsSuccessState(false);
        const correctCount = basketItems.length - wrong.length;
        setFeedback(
          `⚠️ Правильно визначено ${correctCount} з ${basketItems.length} карток. Перегляньте картки, позначені знаком ⚠.`
        );
      }
      return;
    }

    // Protocol ordering verification
    const wrongStepIds: string[] = [];
    orderedSteps.forEach((st, idx) => {
      if (targetProtocolSteps[idx]?.id !== st.id) {
        wrongStepIds.push(st.id);
      }
    });

    if (wrongStepIds.length === 0) {
      setMismatchedIds([]);
      setIsSuccessState(true);
      setFeedback(`🎯 Протокол зібрано у правильній послідовності (${orderedSteps.length} кроків)!`);
      onSubmitAnswer?.(orderedSteps.map((s) => s.id));
    } else {
      setMismatchedIds(wrongStepIds);
      setIsSuccessState(false);
      const rightCount = orderedSteps.length - wrongStepIds.length;
      setFeedback(
        `⚠️ На правильному місці зараз ${rightCount} з ${orderedSteps.length} кроків. Використовуйте ↑ / ↓ або перетягування, щоб виправити порядок.`
      );
    }
  };

  const unassignedItems = basketItems.filter((it) => !assignments[it.id]);

  return (
    <div className="p-4 sm:p-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-md)] space-y-4 shadow-card min-w-0 overflow-hidden">
      <div className="text-center space-y-1">
        <h4 className="text-sm font-extrabold text-[var(--primary-dark)] uppercase tracking-wide">
          {config.title || (resolvedMode === 'baskets' ? '🗂️ Сортувальник категорій' : '📋 Конструктор алгоритму безпеки')}
        </h4>
        <p className="text-xs text-[var(--text-muted)] font-medium">
          {config.instruction ||
            (resolvedMode === 'baskets'
              ? 'Перетягніть картку в потрібний кошик або торкніться картки, а потім — обраного кошика.'
              : 'Вибудуйте кроки у правильній послідовності кнопками ↑ / ↓ або перетягуванням.')}
        </p>
      </div>

      {resolvedMode === 'baskets' ? (
        <div className="space-y-4">
          {/* Item Pool */}
          <div
            className="p-3 bg-[var(--bg)] border border-dashed border-[var(--border-hover)] rounded-[var(--radius-sm)] space-y-2 min-h-[76px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain') || draggedId;
              if (id) moveItemToBasket(id, null);
            }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)] flex items-center justify-between gap-2">
              <span>Нерозподілені картки ({unassignedItems.length})</span>
              {selectedItemId && (
                <span className="text-[var(--primary-dark)]">● Оберіть кошик нижче</span>
              )}
            </div>

            {unassignedItems.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic py-1">
                Усі картки розміщено по кошиках. Натисніть «Перевірити розподіл».
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unassignedItems.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      draggable={!isReadOnly}
                      onDragStart={(e) => {
                        setDraggedId(item.id);
                        e.dataTransfer.setData('text/plain', item.id);
                      }}
                      onClick={() => {
                        if (isReadOnly) return;
                        setSelectedItemId((prev) => (prev === item.id ? null : item.id));
                      }}
                      className={`px-3 py-1.5 rounded-[var(--radius-sm)] border-2 text-xs font-bold text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--hl-bg)] border-[var(--accent)] text-[var(--hl-text)] shadow-sm'
                          : 'bg-[var(--surface)] border-[var(--border-hover)] text-[var(--text)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {isSelected && <span className="mr-1" aria-hidden="true">●</span>}
                      {item.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target Baskets */}
          <div className={`grid grid-cols-1 ${baskets.length >= 2 ? 'sm:grid-cols-2' : ''} ${baskets.length >= 3 ? 'lg:grid-cols-3' : ''} gap-3`}>
            {baskets.map((basket, bIdx) => {
              const itemsHere = basketItems.filter((it) => assignments[it.id] === basket.id);
              const sym = basket.symbol || DEFAULT_SYMBOLS[bIdx % DEFAULT_SYMBOLS.length];
              const borderStyle = BORDER_STYLES[bIdx % BORDER_STYLES.length];
              const isDropTargetActive = Boolean(selectedItemId);

              return (
                <div
                  key={basket.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData('text/plain') || draggedId;
                    if (id) moveItemToBasket(id, basket.id);
                  }}
                  onClick={() => {
                    if (selectedItemId) {
                      moveItemToBasket(selectedItemId, basket.id);
                    }
                  }}
                  className={`p-3 rounded-[var(--radius-sm)] border-2 space-y-2.5 min-h-[120px] flex flex-col justify-between transition-colors ${
                    isDropTargetActive ? 'cursor-pointer hover:bg-[var(--hl-bg)]' : ''
                  }`}
                  style={{
                    borderStyle,
                    borderColor: isDropTargetActive ? 'var(--accent)' : 'var(--border-hover)',
                    backgroundColor: 'var(--surface-alt)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--border)]">
                    <span className="text-xs font-extrabold text-[var(--primary-dark)] flex items-center gap-1.5 min-w-0">
                      <span aria-hidden="true">{sym}</span>
                      <span className="break-words">{basket.label}</span>
                    </span>
                    <span className="font-mono text-[11px] font-extrabold text-[var(--text-muted)] tabular-nums shrink-0">
                      {itemsHere.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1">
                    {itemsHere.length === 0 ? (
                      <div className="text-[11px] text-[var(--text-muted)] italic m-auto text-center py-2">
                        {isDropTargetActive ? 'Торкніться сюди, щоб покласти' : 'Порожній кошик'}
                      </div>
                    ) : (
                      itemsHere.map((item) => {
                        const hasWarn = mismatchedIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            draggable={!isReadOnly}
                            onDragStart={(e) => {
                              setDraggedId(item.id);
                              e.dataTransfer.setData('text/plain', item.id);
                            }}
                            className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] border text-xs font-bold flex items-center justify-between gap-2 ${
                              hasWarn
                                ? 'bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]'
                                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)]'
                            }`}
                          >
                            <span className="min-w-0 break-words">
                              {hasWarn && <span className="mr-1 font-extrabold">⚠</span>}
                              {item.text}
                            </span>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveItemToBasket(item.id, null);
                                }}
                                title="Повернути у список"
                                className="text-[var(--text-muted)] hover:text-[var(--err-text)] font-extrabold px-1 cursor-pointer shrink-0"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Ordered Protocol Mode */
        <div className="space-y-2">
          {orderedSteps.map((step, idx) => {
            const isSelected = selectedStepId === step.id;
            const hasWarn = mismatchedIds.includes(step.id);

            return (
              <div
                key={step.id}
                draggable={!isReadOnly}
                onDragStart={(e) => {
                  setDraggedId(step.id);
                  e.dataTransfer.setData('text/plain', step.id);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const srcId = e.dataTransfer.getData('text/plain') || draggedId;
                  handleProtocolDropOrSwap(idx, srcId);
                }}
                onClick={() => {
                  if (isReadOnly) return;
                  if (selectedStepId && selectedStepId !== step.id) {
                    handleProtocolDropOrSwap(idx, selectedStepId);
                  } else {
                    setSelectedStepId((prev) => (prev === step.id ? null : step.id));
                  }
                }}
                className={`p-3 rounded-[var(--radius-sm)] border-2 flex items-center justify-between gap-3 transition-colors min-w-0 ${
                  hasWarn
                    ? 'bg-[var(--warn-bg)] border-[var(--warn-border)] text-[var(--warn-text)]'
                    : isSelected
                    ? 'bg-[var(--hl-bg)] border-[var(--accent)] text-[var(--hl-text)]'
                    : 'bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)]'
                } ${!isReadOnly ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--surface)] border border-[var(--border-hover)] text-[var(--primary-dark)] font-mono text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-xs sm:text-sm font-bold leading-snug break-words">
                      {hasWarn && <span className="mr-1 font-extrabold">⚠</span>}
                      {step.text}
                    </div>
                    {step.hint && (
                      <div className="text-[11px] text-[var(--text-muted)]">{step.hint}</div>
                    )}
                  </div>
                </div>

                {!isReadOnly && (
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => moveProtocolStep(idx, -1)}
                      aria-label="Перемістити вище"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={idx === orderedSteps.length - 1}
                      onClick={() => moveProtocolStep(idx, 1)}
                      aria-label="Перемістити нижче"
                    >
                      ↓
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {feedback && (
        <div className={`status-panel ${isSuccessState ? 'status-panel--success' : 'status-panel--warning'}`}>
          {feedback}
        </div>
      )}

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            ↺ Скинути
          </Button>
          <Button type="button" variant="primary" onClick={handleVerify} className="flex-1 min-w-[200px]">
            {resolvedMode === 'baskets' ? 'Перевірити розподіл' : 'Перевірити порядок кроків'}
          </Button>
        </div>
      )}
    </div>
  );
};
