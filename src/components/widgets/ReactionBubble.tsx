import React from 'react';
import { ReactionZone } from '../../core/contracts/campaign.contract';
import { VarPrimitive, evaluateBooleanCondition } from '../../core/vars/var-engine';
import { RichBlockText } from '../ui/RichBlockText';

export interface ReactionEvalContext {
  outcome: 'hit' | 'undershoot' | 'overshoot' | 'near_miss' | 'idle';
  value?: number;
  target?: number;
  diff?: number;
  angle?: number;
  power?: number;
  attemptsUsed?: number;
}

export function evaluateReactionZones(
  zones: ReactionZone[] | undefined,
  ctx: ReactionEvalContext
): ReactionZone | null {
  if (!Array.isArray(zones) || zones.length === 0) return null;

  const env: Record<string, VarPrimitive> = {
    value: ctx.value ?? 0,
    target: ctx.target ?? 0,
    diff: ctx.diff ?? Math.abs((ctx.value ?? 0) - (ctx.target ?? 0)),
    angle: ctx.angle ?? 0,
    power: ctx.power ?? 0,
    attempts: ctx.attemptsUsed ?? 0,
    hit: ctx.outcome === 'hit' ? 1 : 0,
    undershoot: ctx.outcome === 'undershoot' ? 1 : 0,
    overshoot: ctx.outcome === 'overshoot' ? 1 : 0,
    near_miss: ctx.outcome === 'near_miss' ? 1 : 0,
  };

  for (const zone of zones) {
    const cond = String(zone.condition || '').trim();
    if (!cond) continue;
    const lower = cond.toLowerCase();
    if (lower === ctx.outcome) {
      return zone;
    }
    if (evaluateBooleanCondition(cond, env)) {
      return zone;
    }
  }
  return null;
}

const getEmoteBadge = (emote?: ReactionZone['emote']) => {
  switch (emote) {
    case 'joy':
      return '✨';
    case 'sweat':
      return '💧';
    case 'question':
      return '❓';
    case 'idea':
      return '💡';
    default:
      return null;
  }
};

export const ReactionBubble: React.FC<{ reaction: ReactionZone | null }> = ({ reaction }) => {
  if (!reaction) return null;
  const emoteIcon = getEmoteBadge(reaction.emote);

  return (
    <div className="surface-subtle rounded-[var(--radius-sm)] border-2 border-[var(--hl-border)] p-3 flex items-start gap-3 animate-fadeIn">
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-xl bg-[var(--surface)] border border-[var(--accent)] flex items-center justify-center text-xl">
          {reaction.avatar || '🧭'}
        </div>
        {emoteIcon && (
          <span className="emote-bubble-anchor emote-bubble-pop" aria-hidden="true">
            {emoteIcon}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5 text-left">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--primary-dark)]">
          {reaction.speaker || 'Наставник'}
        </div>
        <div className="text-xs font-semibold text-[var(--text)] leading-relaxed">
          <RichBlockText text={reaction.text} />
        </div>
      </div>
    </div>
  );
};
