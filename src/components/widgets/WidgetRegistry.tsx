import React, { useEffect, useMemo, useRef } from 'react';
import { Button } from '../ui/Button';
import { STEM_WIDGETS } from './StemWidgets';
import { HUMANITIES_AND_SUBJECT_WIDGETS } from './HumanitiesAndSubjectWidgets';
import { REACTIVE_STAGE2_WIDGETS } from './ReactiveStage2Widgets';
import { STAGE4_WIDGETS } from './Stage4Widgets';
import { STAGE5_WIDGETS } from './Stage5Widgets';
import { WidgetDefinition, parseWidgetArgString } from './widget.types';
import { useWidgetStore } from '../../core/state/useWidgetStore';
import { useLessonScopeStore } from '../../core/vars/useLessonScopeStore';

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  ...STEM_WIDGETS,
  ...HUMANITIES_AND_SUBJECT_WIDGETS,
  ...REACTIVE_STAGE2_WIDGETS,
  ...STAGE4_WIDGETS,
  ...STAGE5_WIDGETS,
};

export const REGISTERED_WIDGET_TYPES = Object.keys(WIDGET_REGISTRY);

interface InlineWidgetRendererProps {
  widgetType: string;
  rawArgs: string;
  interactive?: boolean;
  resetSignal?: string;
  instanceKey?: string;
  renderRichText?: (text: string) => React.ReactNode;
}

const INACTIVITY_RESET_MS = 25000;
const EMPTY_OVERRIDES: Record<string, number> = {};

export const InlineWidgetRenderer: React.FC<InlineWidgetRendererProps> = ({
  widgetType,
  rawArgs,
  interactive = false,
  resetSignal = '',
  instanceKey = 'w',
  renderRichText,
}) => {
  const def = WIDGET_REGISTRY[widgetType];
  const parsedArgs = useMemo(() => parseWidgetArgString(rawArgs), [rawArgs]);
  const sliders = useMemo(
    () => (interactive && def?.getSliders ? def.getSliders(parsedArgs) : []),
    [interactive, def, parsedArgs]
  );

  const storeKey = `${resetSignal || 'static'}::${instanceKey}::${widgetType}::${rawArgs}`;
  const instanceState = useWidgetStore((s) => s.instances[storeKey]);
  const toggleExplore = useWidgetStore((s) => s.toggleExplore);
  const setOverride = useWidgetStore((s) => s.setOverride);
  const resetOverrides = useWidgetStore((s) => s.resetOverrides);

  const scopeVars = useLessonScopeStore((s) => s.variables);
  const setScopeVar = useLessonScopeStore((s) => s.setVar);
  const resetScope = useLessonScopeStore((s) => s.resetScope);

  const isExploreOpen = instanceState?.exploreOpen ?? false;
  const localOverrides = instanceState?.overrides ?? EMPTY_OVERRIDES;

  // Bind optional LessonScope variables (e.g. varW=rectW;varH=rectH;varA=...;varB=...)
  const scopeOverrides = useMemo(() => {
    const mapped: Record<string, number> = {};
    const pairs: Array<[string, string | undefined]> = [
      ['w', parsedArgs.params.varW],
      ['h', parsedArgs.params.varH],
      ['a', parsedArgs.params.varA],
      ['b', parsedArgs.params.varB],
      ['deg', parsedArgs.params.varDeg],
      ['num', parsedArgs.params.varNum],
      ['den', parsedArgs.params.varDen],
    ];
    for (const [targetKey, scopeKey] of pairs) {
      if (scopeKey && scopeVars[scopeKey] !== undefined) {
        const numVal = Number(scopeVars[scopeKey]);
        if (Number.isFinite(numVal)) {
          mapped[targetKey] = numVal;
        }
      }
    }
    return mapped;
  }, [parsedArgs.params, scopeVars]);

  const overrides = useMemo(
    () => ({ ...scopeOverrides, ...localOverrides }),
    [scopeOverrides, localOverrides]
  );

  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToAuthorDefaults = () => {
    resetOverrides(storeKey);
    if (Object.keys(scopeOverrides).length > 0) {
      resetScope();
    }
    if (inactivityRef.current) {
      clearTimeout(inactivityRef.current);
      inactivityRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (inactivityRef.current) {
        clearTimeout(inactivityRef.current);
        inactivityRef.current = null;
      }
    };
  }, [storeKey]);

  if (!def) {
    const fallbackLabel =
      parsedArgs.params.title ||
      parsedArgs.params.text ||
      parsedArgs.params.body ||
      parsedArgs.params.label ||
      parsedArgs.positional[0];
    if (fallbackLabel) {
      return <span className="font-semibold text-[var(--text)]">{fallbackLabel}</span>;
    }
    return <span className="text-[var(--text-muted)]">…</span>;
  }

  const updateOverride = (key: string, nextVal: number) => {
    // Sync bound LessonScope var if widget declares varW/varH/etc.
    const scopeKeyMap: Record<string, string | undefined> = {
      w: parsedArgs.params.varW,
      h: parsedArgs.params.varH,
      a: parsedArgs.params.varA,
      b: parsedArgs.params.varB,
      deg: parsedArgs.params.varDeg,
      num: parsedArgs.params.varNum,
      den: parsedArgs.params.varDen,
    };
    const boundScopeKey = scopeKeyMap[key];
    if (boundScopeKey) {
      setScopeVar(boundScopeKey, nextVal);
      return;
    }

    setOverride(storeKey, key, nextVal, (updated) => {
      if (widgetType === 'fraction') {
        const den = updated.den ?? sliders.find((s) => s.key === 'den')?.defaultValue ?? 4;
        const num = updated.num ?? sliders.find((s) => s.key === 'num')?.defaultValue ?? 1;
        if (num > den) return { ...updated, num: den };
      }
      if (widgetType === 'split') {
        const total = updated.total ?? sliders.find((s) => s.key === 'total')?.defaultValue ?? 15;
        const left = updated.left ?? sliders.find((s) => s.key === 'left')?.defaultValue ?? 10;
        if (left >= total) return { ...updated, left: Math.max(1, total - 1) };
      }
      return updated;
    });

    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      resetOverrides(storeKey);
    }, INACTIVITY_RESET_MS);
  };

  const hasOverrides = Object.keys(localOverrides).length > 0 || Object.keys(scopeOverrides).length > 0;
  const liveSummaryText = def.getLiveSummary ? def.getLiveSummary(parsedArgs, overrides) : null;

  return (
    <div className="widget-frame my-2">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[var(--border)] min-w-0">
        <span className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wide min-w-0 break-words">
          {def.label}
        </span>

        {interactive && sliders.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-full min-w-0">
            {isExploreOpen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasOverrides}
                onClick={resetToAuthorDefaults}
                title="Повернути початкові значення прикладу"
              >
                ↺ Скинути до прикладу
              </Button>
            )}
            <Button
              type="button"
              variant={isExploreOpen ? 'accent' : 'outline'}
              size="sm"
              onClick={() => toggleExplore(storeKey)}
            >
              {isExploreOpen ? '▲ Згорнути' : '🎛️ Змінити'}
            </Button>
          </div>
        )}
      </div>

      <div className="pt-2 flex flex-col items-center w-full min-w-0 overflow-hidden">
        {def.render(parsedArgs, overrides, {
          interactive: interactive && (isExploreOpen || def.type === 'binary_bits'),
          onToggleOverride: updateOverride,
          renderRichText,
        })}
      </div>

      {interactive && isExploreOpen && sliders.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--border)] space-y-2 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sliders.map((sl) => {
              const currentVal = overrides[sl.key] !== undefined ? overrides[sl.key] : sl.defaultValue;
              const maxBound =
                widgetType === 'fraction' && sl.key === 'num'
                  ? overrides.den ?? sliders.find((s) => s.key === 'den')?.defaultValue ?? sl.max
                  : widgetType === 'split' && sl.key === 'left'
                  ? Math.max(1, (overrides.total ?? sliders.find((s) => s.key === 'total')?.defaultValue ?? sl.max) - 1)
                  : sl.max;

              return (
                <label key={sl.key} className="block space-y-1 text-xs font-bold min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="truncate min-w-0">{sl.label}</span>
                    <span className="font-mono tabular-nums text-[var(--primary-dark)] shrink-0 min-w-[3.25rem] text-right">
                      {currentVal}
                      {sl.unit ? ` ${sl.unit}` : ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={sl.min}
                    max={maxBound}
                    step={sl.step}
                    value={Math.min(maxBound, currentVal)}
                    onChange={(e) => updateOverride(sl.key, Number(e.target.value))}
                    className="settings-range"
                  />
                </label>
              );
            })}
          </div>

          {liveSummaryText && (
            <div className="status-panel status-panel--neutral text-xs font-bold min-h-[2.75rem] flex items-center tabular-nums">
              <span>💡 {liveSummaryText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
