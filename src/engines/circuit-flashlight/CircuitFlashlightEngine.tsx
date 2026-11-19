import React, { useEffect, useState } from 'react';
import { EngineProps } from '../adapter';
import { Button } from '../../components/ui/Button';
import type { CircuitFlashlightConfig } from './circuitFlashlight.types';

export interface CircuitFlashlightEngineConfig extends Partial<CircuitFlashlightConfig> {
  targetCurrentMinMa?: number;
  targetCurrentMaxMa?: number;
  instruction?: string;
}

const RESISTOR_PRESETS = [47, 100, 150, 220, 330, 470, 680, 1000];

export const CircuitFlashlightEngine: React.FC<EngineProps<CircuitFlashlightEngineConfig>> = ({
  config,
  onStateChange,
  onSubmitAnswer,
  isReadOnly = false,
}) => {
  const voltageV = config.voltageV ?? 3.7;
  const ledForwardV = config.ledForwardV ?? 2.1;
  const targetMin = config.targetCurrentMinMa ?? 8;
  const targetMax = config.targetCurrentMaxMa ?? 20;

  const [isSwitchOn, setIsSwitchOn] = useState(true);
  const [resistorOhm, setResistorOhm] = useState(config.resistorOhm ?? 470);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setResistorOhm(config.resistorOhm ?? 470);
    setIsSwitchOn(true);
    setFeedback(null);
  }, [config]);

  const netV = Math.max(0, voltageV - ledForwardV);
  const currentMa = isSwitchOn && resistorOhm > 0 ? (netV / resistorOhm) * 1000 : 0;
  const isBurnedOut = isSwitchOn && currentMa > 25;
  const isUnderpowered = isSwitchOn && currentMa > 0 && currentMa < targetMin;
  const isOptimal = isSwitchOn && currentMa >= targetMin && currentMa <= targetMax;

  useEffect(() => {
    onStateChange?.({ isSwitchOn, resistorOhm, currentMa: Number(currentMa.toFixed(1)) });
  }, [isSwitchOn, resistorOhm, currentMa, onStateChange]);

  const handleSelectResistor = (ohm: number) => {
    if (isReadOnly) return;
    setResistorOhm(ohm);
    setFeedback(null);
  };

  const handleCheck = () => {
    if (!isSwitchOn) {
      setFeedback('⚠️ Замкніть вимикач, щоб струм пішов у коло!');
      return;
    }
    if (isBurnedOut) {
      setFeedback(
        `🔥 Перевантаження! Струм ${currentMa.toFixed(1)} мА перевищує 25 мА — світлодіод згорів. Збільште опір резистора!`
      );
      return;
    }
    if (isUnderpowered) {
      setFeedback(
        `🕯️ Занадто слабкий струм (${currentMa.toFixed(1)} мА). Потрібно ${targetMin}–${targetMax} мА. Зменште опір резистора.`
      );
      return;
    }
    if (isOptimal) {
      setFeedback(
        `✅ Безпечне та яскраве світіння! Струм ${currentMa.toFixed(1)} мА при опорі ${resistorOhm} Ом.`
      );
      onSubmitAnswer?.(resistorOhm);
      return;
    }
    setFeedback(
      `⚡ Струм ${currentMa.toFixed(1)} мА занадто великий для оптимального діапазону ${targetMin}–${targetMax} мА. Підвищте опір.`
    );
  };

  const statusTone = !isSwitchOn
    ? 'var(--text-muted)'
    : isBurnedOut
    ? 'var(--err-border)'
    : isOptimal
    ? 'var(--ok-border)'
    : 'var(--hl-border)';

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--text)]">
        {config.instruction ||
          `🔋 Доберіть резистор для Li-ion (${voltageV} В) та світлодіода (Vf = ${ledForwardV} В), щоб струм був у безпечному діапазоні ${targetMin}–${targetMax} мА (без перегріву > 25 мА).`}
      </div>

      {/* Interactive SVG Circuit Diagram */}
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col items-center">
        <svg viewBox="0 0 360 180" className="w-full max-w-[440px] h-auto" role="img" aria-label="Електричне коло ліхтарика">
          {/* Outer loop wire */}
          <rect
            x="44"
            y="34"
            width="272"
            height="112"
            rx="12"
            fill="none"
            stroke={isSwitchOn && !isBurnedOut ? statusTone : 'var(--border)'}
            strokeWidth="3.5"
            strokeDasharray={isSwitchOn && !isBurnedOut ? '8 5' : undefined}
          />

          {/* Battery (Left side) */}
          <rect x="20" y="62" width="48" height="56" rx="8" fill="var(--surface-alt)" stroke="var(--text)" strokeWidth="2" />
          <text x="44" y="84" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text)">
            Li-ion
          </text>
          <text x="44" y="101" textAnchor="middle" fontSize="11" fontWeight="900" fill="var(--primary-dark)">
            {voltageV} В
          </text>

          {/* Switch (Top center-left) */}
          <g
            onClick={() => !isReadOnly && setIsSwitchOn((v) => !v)}
            className="cursor-pointer"
          >
            <rect x="108" y="18" width="64" height="32" rx="6" fill="var(--surface-alt)" stroke="var(--border)" strokeWidth="1.5" />
            <line
              x1="120"
              y1="34"
              x2="160"
              y2={isSwitchOn ? 34 : 21}
              stroke="var(--text)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="120" cy="34" r="3.5" fill="var(--accent)" />
            <circle cx="160" cy="34" r="3.5" fill="var(--accent)" />
            <text x="140" y="61" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-muted)">
              {isSwitchOn ? 'УВІМК' : 'ВИМК'}
            </text>
          </g>

          {/* Resistor (Top center-right) */}
          <rect x="204" y="20" width="84" height="28" rx="4" fill="var(--hl-bg)" stroke="var(--hl-border)" strokeWidth="2" />
          <text x="246" y="38" textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--hl-text)">
            {resistorOhm} Ω
          </text>
          <text x="246" y="61" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-muted)">
            Резистор R
          </text>

          {/* LED (Right side) */}
          <circle
            cx="316"
            cy="90"
            r="24"
            fill={isBurnedOut ? 'var(--err-bg)' : isOptimal ? 'var(--ok-bg)' : 'var(--surface-alt)'}
            stroke={statusTone}
            strokeWidth="2.5"
          />
          {isOptimal && (
            <circle cx="316" cy="90" r="32" fill="none" stroke="var(--ok-border)" strokeWidth="1.5" strokeDasharray="4 3" />
          )}
          <text x="316" y="88" textAnchor="middle" fontSize="16">
            {!isSwitchOn ? '⚫' : isBurnedOut ? '💥' : isOptimal ? '💡' : '🔆'}
          </text>
          <text x="316" y="106" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--text)">
            LED {ledForwardV}В
          </text>

          {/* Ammeter formula readout at bottom wire */}
          <rect x="115" y="130" width="130" height="32" rx="8" fill="var(--surface-alt)" stroke={statusTone} strokeWidth="2" />
          <text x="180" y="150" textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--text)">
            I = {currentMa.toFixed(1)} мА
          </text>
        </svg>

        <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)] text-center">
          Закон Ома: I = (U - Vf) / R = ({voltageV} - {ledForwardV}) / {resistorOhm} ≈ {currentMa.toFixed(1)} мА
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-bold">
          <span>Опір резистора (Ом):</span>
          <span className="font-mono text-[var(--primary-dark)]">{resistorOhm} Ом</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {RESISTOR_PRESETS.map((ohm) => (
            <Button
              key={ohm}
              type="button"
              size="sm"
              variant={resistorOhm === ohm ? 'primary' : 'outline'}
              disabled={isReadOnly}
              onClick={() => handleSelectResistor(ohm)}
              className="font-mono text-xs px-1"
            >
              {ohm}Ω
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isReadOnly}
            onClick={() => setIsSwitchOn((v) => !v)}
          >
            {isSwitchOn ? '🔌 Розімкнути коло' : '⚡ Замкнути вимикач'}
          </Button>
          <Button type="button" variant="accent" size="md" disabled={isReadOnly} onClick={handleCheck}>
            ✓ Перевірити безпечний струм
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-[var(--radius-md)] border text-xs font-bold ${
            isOptimal
              ? 'bg-[var(--ok-bg)] border-[var(--ok-border)] text-[var(--ok-text)]'
              : isBurnedOut
              ? 'bg-[var(--err-bg)] border-[var(--err-border)] text-[var(--err-text)]'
              : 'bg-[var(--hl-bg)] border-[var(--hl-border)] text-[var(--hl-text)]'
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};
