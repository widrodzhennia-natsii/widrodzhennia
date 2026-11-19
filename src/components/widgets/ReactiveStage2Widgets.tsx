import React, { useEffect, useRef } from 'react';
import { BeforeAfterDrawer } from '../../features/story-player/BeforeAfterDrawer';
import { ArgumentMindMap, MindMapBranch } from '../../features/story-player/ArgumentMindMap';
import { useLessonScopeStore } from '../../core/vars/useLessonScopeStore';
import { evaluateSafeExpression } from '../../core/vars/var-engine';
import { ParsedWidgetArgs, WidgetDefinition, parseWidgetArgString, strArg } from './widget.types';

/**
 * Inline Tangle Scrubber: allows dragging horizontally on a highlighted number
 * directly inside prose or adjusting via compact +/- controls, synchronizing
 * reactive LessonScope variables and dependent formulas/SVG widgets.
 */
export const InlineTangleNumber: React.FC<{ rawArgs: string }> = ({ rawArgs }) => {
  const parsed = parseWidgetArgString(rawArgs);
  const varName = strArg(parsed, ['var', 'name', 'key'], 'x', 0);
  const min = Number(strArg(parsed, ['min'], '1')) || 1;
  const max = Number(strArg(parsed, ['max'], '24')) || 24;
  const step = Math.max(0.1, Number(strArg(parsed, ['step'], '1')) || 1);
  const defaultVal = Number(strArg(parsed, ['value', 'val', 'default'], String(Math.round((min + max) / 2)), 1)) || min;
  const unit = strArg(parsed, ['unit'], '');
  const label = strArg(parsed, ['label'], '');

  const variables = useLessonScopeStore((s) => s.variables);
  const registerVarIfMissing = useLessonScopeStore((s) => s.registerVarIfMissing);
  const setVar = useLessonScopeStore((s) => s.setVar);

  useEffect(() => {
    registerVarIfMissing(varName, defaultVal, unit);
  }, [varName, defaultVal, unit, registerVarIfMissing]);

  const rawCurrent = variables[varName];
  const currentNum =
    typeof rawCurrent === 'number' && Number.isFinite(rawCurrent) ? rawCurrent : defaultVal;

  const dragRef = useRef<{ startX: number; startVal: number; moved: boolean } | null>(null);

  const clampAndStep = (val: number) => {
    const clamped = Math.max(min, Math.min(max, val));
    const snapped = Math.round((clamped - min) / step) * step + min;
    const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
    return Number(Math.max(min, Math.min(max, snapped)).toFixed(decimals));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startVal: currentNum, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 3) dragRef.current.moved = true;
    const deltaSteps = Math.round(dx / 12);
    const nextVal = clampAndStep(dragRef.current.startVal + deltaSteps * step);
    if (nextVal !== currentNum) {
      setVar(varName, nextVal);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (dragRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if not captured
      }
      dragRef.current = null;
    }
  };

  return (
    <span className="inline-flex items-center gap-0.5 align-baseline mx-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--hl-bg)] border border-dashed border-[var(--hl-border)] text-[var(--hl-text)] select-none">
      {label && <span className="text-[11px] font-semibold mr-0.5">{label}</span>}
      <button
        type="button"
        onClick={() => setVar(varName, clampAndStep(currentNum - step))}
        disabled={currentNum <= min}
        className="w-4 h-4 rounded text-[11px] font-extrabold leading-none flex items-center justify-center hover:bg-[var(--surface)] disabled:opacity-40 cursor-pointer"
        aria-label={`Зменшити ${label || varName}`}
        title="Зменшити значення"
      >
        −
      </button>
      <span
        role="slider"
        tabIndex={0}
        aria-label={label || `Змінна ${varName}`}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={currentNum}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            setVar(varName, clampAndStep(currentNum + step));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            setVar(varName, clampAndStep(currentNum - step));
          }
        }}
        title="Потягніть ліворуч/праворуч або скористайтесь − / +"
        className="px-1 font-mono font-extrabold tabular-nums cursor-ew-resize text-[var(--primary-dark)]"
      >
        {currentNum}
        {unit ? ` ${unit}` : ''}
      </span>
      <button
        type="button"
        onClick={() => setVar(varName, clampAndStep(currentNum + step))}
        disabled={currentNum >= max}
        className="w-4 h-4 rounded text-[11px] font-extrabold leading-none flex items-center justify-center hover:bg-[var(--surface)] disabled:opacity-40 cursor-pointer"
        aria-label={`Збільшити ${label || varName}`}
        title="Збільшити значення"
      >
        +
      </button>
    </span>
  );
};

/**
 * Inline Live Formula Readout subscribed to useLessonScopeStore.
 */
export const InlineScopeExprReadout: React.FC<{ rawArgs: string }> = ({ rawArgs }) => {
  const parsed = parseWidgetArgString(rawArgs);
  const expr = strArg(parsed, ['expr', 'formula'], '0', 0);
  const label = strArg(parsed, ['label'], '');
  const unit = strArg(parsed, ['unit'], '');

  const variables = useLessonScopeStore((s) => s.variables);
  const value = evaluateSafeExpression(expr, variables);

  return (
    <span className="inline-flex items-center gap-1 align-baseline mx-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--ok-bg)] border border-[var(--ok-border)] text-[var(--ok-text)] font-mono font-extrabold tabular-nums text-[0.92em]">
      {label && <span className="font-sans text-[11px] font-bold">{label} =</span>}
      <span>
        {value}
        {unit ? ` ${unit}` : ''}
      </span>
    </span>
  );
};

function parseMindMapBranches(args: ParsedWidgetArgs): MindMapBranch[] {
  const branches: MindMapBranch[] = [];

  if (args.params.evidence || args.params.counter || args.params.conclusion || args.params.args) {
    const evRaw = strArg(args, ['evidence', 'args', 'proofs'], '');
    if (evRaw) {
      branches.push({
        id: 'evidence',
        label: strArg(args, ['evidenceLabel'], 'Аргументи та докази'),
        role: 'evidence',
        items: evRaw.split('|').map((s) => s.trim()).filter(Boolean),
      });
    }
    const counterRaw = strArg(args, ['counter', 'counterargument'], '');
    if (counterRaw) {
      branches.push({
        id: 'counter',
        label: strArg(args, ['counterLabel'], 'Контраргумент / обмеження'),
        role: 'counter',
        items: counterRaw.split('|').map((s) => s.trim()).filter(Boolean),
      });
    }
    const concRaw = strArg(args, ['conclusion', 'summary'], '');
    if (concRaw) {
      branches.push({
        id: 'conclusion',
        label: strArg(args, ['conclusionLabel'], 'Висновок'),
        role: 'conclusion',
        items: concRaw.split('|').map((s) => s.trim()).filter(Boolean),
      });
    }
    return branches;
  }

  const rawBranches = strArg(args, ['branches', 'nodes'], '', 1);
  if (rawBranches) {
    rawBranches
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((chunk, idx) => {
        const colonIdx = chunk.indexOf(':');
        if (colonIdx > 0) {
          const lbl = chunk.slice(0, colonIdx).trim();
          const items = chunk
            .slice(colonIdx + 1)
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
          branches.push({ id: `b_${idx}`, label: lbl, role: 'branch', items });
        } else {
          branches.push({ id: `b_${idx}`, label: chunk, role: 'branch', items: [] });
        }
      });
  }

  return branches;
}

export const REACTIVE_STAGE2_WIDGETS: Record<string, WidgetDefinition> = {
  before_after: {
    type: 'before_after',
    label: 'Шторка порівняння До / Після',
    category: 'humanities',
    render: (args, _ov, options) => (
      <BeforeAfterDrawer
        pair={{
          title: strArg(args, ['title'], 'Порівняння: До і Після'),
          beforeLabel: strArg(args, ['beforeLabel', 'beforeTitle'], 'До', 0),
          afterLabel: strArg(args, ['afterLabel', 'afterTitle'], 'Після', 1),
          beforeText: strArg(args, ['beforeText', 'before'], '', 2),
          afterText: strArg(args, ['afterText', 'after'], '', 3),
          beforeMeta: strArg(args, ['beforeMeta'], ''),
          afterMeta: strArg(args, ['afterMeta'], ''),
        }}
        renderRichText={options?.renderRichText}
      />
    ),
  },

  arg_map: {
    type: 'arg_map',
    label: 'Карта аргументів',
    category: 'humanities',
    render: (args, _ov, options) => (
      <ArgumentMindMap
        spec={{
          title: strArg(args, ['title'], 'Структура переконання'),
          mode: 'argument',
          rootLabel: strArg(args, ['thesis', 'root', 'claim'], 'Головна теза', 0),
          branches: parseMindMapBranches(args),
        }}
        renderRichText={options?.renderRichText}
      />
    ),
  },

  mindmap: {
    type: 'mindmap',
    label: 'Інтелект-карта',
    category: 'humanities',
    render: (args, _ov, options) => (
      <ArgumentMindMap
        spec={{
          title: strArg(args, ['title'], 'Опорна схема понять'),
          mode: 'mindmap',
          rootLabel: strArg(args, ['root', 'thesis', 'center'], 'Ключова тема', 0),
          branches: parseMindMapBranches(args),
        }}
        renderRichText={options?.renderRichText}
      />
    ),
  },
};
