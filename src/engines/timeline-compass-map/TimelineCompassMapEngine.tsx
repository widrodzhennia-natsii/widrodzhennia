import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';
import type { TimelineCompassEvent } from './timelineCompass.types';

export interface TimelineCompassMapConfig {
  mode?: 'compass' | 'timeline' | 'both';
  targetAzimuthDeg?: number;
  azimuthToleranceDeg?: number;
  events?: TimelineCompassEvent[];
  instruction?: string;
}

const DEFAULT_EVENTS: TimelineCompassEvent[] = [
  { year: 988, label: 'Хрещення Русі' },
  { year: 1648, label: 'Початок Національно-визвольної війни' },
  { year: 1991, label: 'Акт проголошення незалежності України' },
];

const CARDINALS: Array<{ label: string; deg: number }> = [
  { label: 'Пн (0°)', deg: 0 },
  { label: 'ПнСх (45°)', deg: 45 },
  { label: 'Сх (90°)', deg: 90 },
  { label: 'ПдСх (135°)', deg: 135 },
  { label: 'Пд (180°)', deg: 180 },
  { label: 'ПдЗх (225°)', deg: 225 },
  { label: 'Зх (270°)', deg: 270 },
  { label: 'ПнЗх (315°)', deg: 315 },
];

export const TimelineCompassMapEngine: React.FC<EngineProps<TimelineCompassMapConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const mode = config.mode ?? 'both';
  const showCompass = mode === 'compass' || mode === 'both';
  const showTimeline = mode === 'timeline' || mode === 'both';
  const targetDeg = config.targetAzimuthDeg ?? 90;
  const toleranceDeg = config.azimuthToleranceDeg ?? 10;

  const sourceEvents = config.events && config.events.length > 0 ? config.events : DEFAULT_EVENTS;

  const [azimuthDeg, setAzimuthDeg] = useState(0);
  const [orderedEvents, setOrderedEvents] = useState<TimelineCompassEvent[]>(() =>
    [...sourceEvents].sort((a, b) => b.year - a.year)
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setAzimuthDeg(0);
    setOrderedEvents([...sourceEvents].sort((a, b) => b.year - a.year));
    setFeedback(null);
    setIsSuccess(false);
  }, [config]);

  useEffect(() => {
    onStateChange?.({ azimuthDeg, orderedYears: orderedEvents.map((e) => e.year) });
  }, [azimuthDeg, orderedEvents, onStateChange]);

  const moveEvent = (idx: number, dir: -1 | 1) => {
    if (isReadOnly) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= orderedEvents.length) return;
    const copy = [...orderedEvents];
    const tmp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = tmp;
    setOrderedEvents(copy);
    setFeedback(null);
    setIsSuccess(false);
  };

  const handleVerify = () => {
    const compassDelta = Math.min(
      Math.abs(azimuthDeg - targetDeg),
      360 - Math.abs(azimuthDeg - targetDeg)
    );
    const compassOk = !showCompass || compassDelta <= toleranceDeg;

    let timelineOk = true;
    if (showTimeline) {
      for (let i = 1; i < orderedEvents.length; i++) {
        if (orderedEvents[i].year < orderedEvents[i - 1].year) {
          timelineOk = false;
          break;
        }
      }
    }

    if (compassOk && timelineOk) {
      setIsSuccess(true);
      setFeedback('✅ Чудова орієнтація у часі та просторі! Маршрут і хронологія підтверджені.');
      onSubmitAnswer?.({ azimuthDeg, orderedYears: orderedEvents.map((e) => e.year) });
    } else {
      setIsSuccess(false);
      const msgs: string[] = [];
      if (!compassOk) {
        msgs.push(`Налаштуйте азимут ближче до ${targetDeg}° (зараз ${azimuthDeg}°).`);
      }
      if (!timelineOk) {
        msgs.push('Упорядкуйте історичні події від найдавнішої до найновішої.');
      }
      setFeedback(`🧭 ${msgs.join(' ')}`);
    }
  };

  const rad = ((azimuthDeg - 90) * Math.PI) / 180;
  const tipX = 90 + Math.cos(rad) * 56;
  const tipY = 90 + Math.sin(rad) * 56;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🧭 ${showCompass ? `Встановіть азимут ${targetDeg}°` : ''}${showCompass && showTimeline ? ' та ' : ''}${
            showTimeline ? 'впорядкуйте події за зростанням років' : ''
          }.`}
      </div>

      <div className={`grid gap-4 ${showCompass && showTimeline ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {showCompass && (
          <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-3">
            <div className="flex items-center justify-between text-xs font-extrabold text-[var(--primary-dark)]">
              <span>Офлайн-компас сторін світу</span>
              <span className="font-mono tabular-nums">{azimuthDeg}°</span>
            </div>

            <div className="flex justify-center">
              <svg viewBox="0 0 180 180" className="w-40 h-40" role="img" aria-label="Компас азимуту">
                <circle cx="90" cy="90" r="72" fill="var(--surface-alt)" stroke="var(--border)" strokeWidth="2.5" />
                <circle cx="90" cy="90" r="56" fill="none" stroke="var(--border)" strokeDasharray="3 3" />
                <text x="90" y="30" textAnchor="middle" fontSize="11" fontWeight="900" fill="var(--primary-dark)">Пн</text>
                <text x="155" y="94" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-muted)">Сх</text>
                <text x="90" y="158" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-muted)">Пд</text>
                <text x="25" y="94" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-muted)">Зх</text>
                <line
                  x1="90"
                  y1="90"
                  x2={tipX}
                  y2={tipY}
                  stroke="var(--accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="90" cy="90" r="5" fill="var(--text)" />
              </svg>
            </div>

            <input
              type="range"
              min={0}
              max={355}
              step={5}
              disabled={isReadOnly}
              value={azimuthDeg}
              onChange={(e) => {
                setAzimuthDeg(Number(e.target.value));
                setFeedback(null);
              }}
              className="settings-range"
              aria-label="Кут азимуту"
            />

            <div className="grid grid-cols-4 gap-1">
              {CARDINALS.map((c) => (
                <Button
                  key={c.deg}
                  type="button"
                  size="sm"
                  variant={azimuthDeg === c.deg ? 'primary' : 'outline'}
                  disabled={isReadOnly}
                  onClick={() => {
                    setAzimuthDeg(c.deg);
                    setFeedback(null);
                  }}
                  className="text-[10px] px-1 py-1"
                >
                  {c.label.split(' ')[0]}
                </Button>
              ))}
            </div>
          </div>
        )}

        {showTimeline && (
          <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
            <div className="text-xs font-extrabold text-[var(--primary-dark)]">
              Хронологічна стрічка (від ранньої до пізнішої)
            </div>
            <div className="space-y-2">
              {orderedEvents.map((ev, idx) => (
                <div
                  key={`${ev.year}_${ev.label}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-alt)]"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-black text-[var(--accent)] mr-2">{ev.year}</span>
                    <span className="text-xs font-bold text-[var(--text)]">{ev.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isReadOnly || idx === 0}
                      onClick={() => moveEvent(idx, -1)}
                      aria-label="Вище"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isReadOnly || idx === orderedEvents.length - 1}
                      onClick={() => moveEvent(idx, 1)}
                      aria-label="Нижче"
                    >
                      ↓
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleVerify}>
          ✓ Перевірити компас і стрічку
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isSuccess
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};
